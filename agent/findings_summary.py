"""LangGraph node that turns raw GridWatch security findings into a plain-English
assessment for a non-technical home user.

Input is the read-only data the app already gathered (NVD CVE matches + Shodan
InternetDB passive exposure) plus the user's router profile and a deterministic
heuristic baseline computed on the server. The graph asks the LLM to improve on
that baseline and returns strict JSON:

    { "headline": str, "riskLevel": "low"|"medium"|"high",
      "summary": str, "actions": [ {"title", "detail", "priority"} ] }

Every run is namespaced by user_id (via config.configurable) so one user's data
never mixes with another's. The server validates/normalizes this JSON and falls
back to its own heuristic if the shape is unusable, so the graph output is
advisory, not load-bearing.
"""

import json
import os
from typing import Any, Dict, List, Optional, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph
from pydantic import BaseModel, Field


class AssessmentAction(BaseModel):
    title: str
    detail: str
    priority: str = "medium"


class FindingsAssessment(BaseModel):
    headline: str
    riskLevel: str
    summary: str
    actions: List[AssessmentAction] = Field(default_factory=list)


class FindingsSummaryState(TypedDict, total=False):
    profile: Optional[Dict[str, Any]]
    cve: Dict[str, Any]
    passive: Dict[str, Any]
    baseline: Optional[Dict[str, Any]]
    output: Dict[str, Any]
    namespace: str


SYSTEM_PROMPT = (
    "You are GridWatch, a friendly assistant that explains home-network security "
    "findings to everyday, non-technical people. You are strictly defensive and "
    "never help attack or access systems the user does not own."
)


def _resolve_namespace(config: Optional[RunnableConfig]) -> tuple[Optional[str], str]:
    """Read the caller-provided per-user identity from the run config."""
    configurable: Dict[str, Any] = {}
    if isinstance(config, dict):
        configurable = config.get("configurable") or {}

    user_id = configurable.get("user_id")
    namespace = configurable.get("namespace") or (
        f"user:{user_id}" if user_id else "user:unknown"
    )
    return user_id, namespace


def _extract_text(content: Any) -> str:
    if isinstance(content, str):
        return content

    if isinstance(content, list):
        text_parts: List[str] = []
        for part in content:
            if isinstance(part, dict) and "text" in part:
                text_parts.append(str(part["text"]))
                continue
            text = getattr(part, "text", None)
            if text:
                text_parts.append(str(text))
        return "\n".join(text_parts)

    return str(content)


def _strip_json_fence(text: str) -> str:
    stripped = text.strip()
    if not stripped.startswith("```"):
        return stripped
    stripped = stripped.strip("`").strip()
    if stripped.startswith("json"):
        return stripped[4:].strip()
    return stripped


def _router_label(profile: Optional[Dict[str, Any]]) -> str:
    if not profile:
        return "the user's router"
    parts = [profile.get("routerVendor"), profile.get("routerModel")]
    label = " ".join(str(p) for p in parts if p)
    return label or "the user's router"


def _describe_findings(state: FindingsSummaryState) -> str:
    """Render the raw findings as a compact, factual brief for the model."""
    profile = state.get("profile") or {}
    cve = state.get("cve") or {}
    passive = state.get("passive") or {}

    lines: List[str] = []
    lines.append(f"Router: {_router_label(profile)}")
    if profile.get("firmwareVersion"):
        lines.append(f"Firmware: {profile['firmwareVersion']}")

    results = cve.get("results") or []
    if results:
        lines.append(f"\nKnown vulnerabilities (NVD) — {len(results)} match(es):")
        for item in results[:10]:
            score = item.get("cvssScore")
            severity = item.get("severity")
            marker = severity or (f"CVSS {score}" if score is not None else "unscored")
            lines.append(f"- {item.get('id')} [{marker}]: {item.get('description')}")
    else:
        lines.append(f"\nKnown vulnerabilities (NVD): none matched. {cve.get('note') or ''}".strip())

    exposure = passive.get("exposure")
    if exposure and exposure.get("found"):
        ports = exposure.get("ports") or []
        vulns = exposure.get("vulns") or []
        lines.append("\nPassive internet exposure (Shodan InternetDB):")
        lines.append(f"- Open ports visible to the public internet: {ports or 'none'}")
        if vulns:
            lines.append(f"- Flagged CVEs on exposed services: {vulns}")
        if exposure.get("tags"):
            lines.append(f"- Tags: {exposure['tags']}")
    else:
        lines.append(f"\nPassive internet exposure: {passive.get('note') or 'no records found.'}")

    return "\n".join(lines)


def _build_prompt(state: FindingsSummaryState) -> str:
    baseline = state.get("baseline")
    baseline_json = json.dumps(baseline, indent=2) if baseline else "None"

    return f"""
Explain the security findings below to a non-technical home-network owner.

FINDINGS:
{_describe_findings(state)}

A deterministic baseline assessment has already been computed from the same data:
{baseline_json}

Improve on that baseline. Keep whatever it got right, but make the language
clearer, warmer, and more actionable. Return STRICT JSON only, matching:
{{
  "headline": "a short, reassuring-but-honest headline (max ~8 words)",
  "riskLevel": "low" | "medium" | "high",
  "summary": "2-4 plain sentences: what we found and what it means for them",
  "actions": [
    {{
      "title": "short imperative step",
      "detail": "1-2 plain sentences on what to do and why",
      "priority": "high" | "medium" | "low"
    }}
  ]
}}

Rules:
- Plain, everyday language. No jargon, no CVE identifiers, no CVSS numbers in the
  summary or actions (the raw technical data is shown separately).
- Order actions by importance, most important first. 1 to 5 actions.
- riskLevel must reflect the findings: "high" if there are severe vulnerabilities
  or risky internet-facing services, "low" if nothing needs attention.
- If nothing needs fixing, say so plainly and give one gentle upkeep action.
- Do not invent findings that are not in the data above.
- Never ask for or reveal passwords or Wi-Fi passphrases.
""".strip()


def summarize(
    state: FindingsSummaryState, config: Optional[RunnableConfig] = None
) -> FindingsSummaryState:
    """Produce a plain-English assessment JSON from the raw findings."""
    _, namespace = _resolve_namespace(config)

    model_name = os.getenv("OPENAI_MODEL", "gpt-5.1")
    llm = ChatOpenAI(model=model_name, temperature=0.3, max_tokens=900)

    response = llm.invoke(
        [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=_build_prompt(state)),
        ]
    )

    parsed = json.loads(_strip_json_fence(_extract_text(response.content)))
    assessment = FindingsAssessment.model_validate(parsed)

    return {**state, "output": assessment.model_dump(), "namespace": namespace}


builder = StateGraph(FindingsSummaryState)
builder.add_node("summarize", summarize)
builder.set_entry_point("summarize")
builder.add_edge("summarize", END)
graph = builder.compile()
