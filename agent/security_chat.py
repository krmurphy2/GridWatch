"""LangGraph conversational agent for GridWatch home-network security Q&A.

This graph powers the per-user security chat. Every request is namespaced by
user_id (via config.configurable) so one user's conversation can never mix with
another's. The system prompt tightly constrains scope and tone:

- Home-network / router security only; politely declines anything else.
- Plain, jargon-free language by default; deep technical detail only on request.
- Answers are grounded in the user's saved router profile and never fabricated.
- Strictly defensive: never assists with attacking or accessing networks or
  devices the user does not own.
"""

from typing import Any, Dict, List, Optional, TypedDict

from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_core.runnables import RunnableConfig
from langgraph.graph import END, StateGraph

from llm import get_chat_model
from rag import retrieve_security_guidance

# Cap on retrieve -> reason cycles per reply, so a misbehaving model can't loop.
MAX_TOOL_ITERATIONS = 3


class SecurityChatState(TypedDict, total=False):
    messages: List[Dict[str, str]]
    routerProfile: Optional[Dict[str, Any]]
    output: Dict[str, Any]
    namespace: str


# Versioned in source control so prompt changes are reviewable (see AI rules).
SECURITY_CHAT_SYSTEM_PROMPT = """
You are GridWatch, a friendly assistant that helps everyday people understand and
improve the security of their own home network and router.

SCOPE — what you help with:
- The user's own home network, router, Wi-Fi, and connected consumer devices.
- Explaining their GridWatch security assessment and what the findings mean.
- Plain, practical steps to reduce risk (e.g. disabling risky features, updating
  firmware, choosing stronger Wi-Fi security, safe remote-access choices).
- General consumer-security and privacy concepts closely related to the above.

OUT OF SCOPE — politely decline and steer back:
- Anything unrelated to home-network security (coding help, general trivia,
  personal/medical/legal/financial advice, world knowledge, etc.).
- Any request involving networks, systems, or devices the user does not own.
- Attacking, exploiting, scanning, gaining unauthorized access, hiding activity,
  or bypassing protections on ANY system. You are strictly defensive.
If a request is out of scope, briefly say it's outside what you can help with and
offer a relevant home-network security topic instead.

TONE AND DEPTH:
- Default to plain, everyday language. Avoid jargon and technobabble. If you must
  use a technical term, define it in one short, simple phrase.
- Be concise and actionable. Lead with the single most important point, then a
  few short bullets if helpful.
- Only go into deep technical detail (CVE identifiers, exact config syntax,
  command-line steps, protocol/packet-level explanations) when the user explicitly
  asks for technical detail or clearly signals they are technical. Otherwise keep
  it high-level.

GROUNDING AND HONESTY:
- Use the user's router profile below when it is relevant. Refer to their actual
  vendor, model, firmware, and settings rather than generic examples.
- Never invent details that aren't in the profile. If something needed isn't
  known, say so plainly and suggest they capture it (e.g. upload a screenshot of
  that router page) so the assessment can improve.
- Never reveal or ask for passwords, Wi-Fi passphrases, or other secrets.

USING TRUSTED GUIDANCE:
- You have a `retrieve_security_guidance` tool backed by GridWatch's trusted
  home-network security guidance. Call it when the user asks how to fix, change,
  or understand a security setting, port, vulnerability, or exposure result, so
  your advice is grounded rather than from memory.
- Base remediation steps on what the tool returns. Do not fabricate guidance; if
  the tool returns nothing relevant, give safe general advice and say so.
- Keep the plain-language tone — do not dump raw tool text or [Source N] labels at
  the user unless they ask for detailed references.
""".strip()


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


def _format_profile(profile: Optional[Dict[str, Any]]) -> str:
    """Render a compact, non-sensitive summary of the user's router profile."""
    if not profile:
        return "No router profile has been captured yet."

    fields = [
        ("Router vendor", profile.get("routerVendor")),
        ("Router model", profile.get("routerModel")),
        ("Hardware version", profile.get("hardwareVersion")),
        ("Firmware version", profile.get("firmwareVersion")),
        ("Public IP known", "yes" if profile.get("publicIp") else "no"),
        ("UPnP", profile.get("upnpStatus")),
        ("Remote administration", profile.get("remoteAdminStatus")),
        ("Port forwarding", profile.get("portForwardingStatus")),
        ("Wi-Fi security", profile.get("wifiSecurity")),
    ]
    lines = [f"- {label}: {value}" for label, value in fields if value not in (None, "")]

    missing = profile.get("missingFields") or []
    if missing:
        lines.append(f"- Not yet captured: {', '.join(str(m) for m in missing)}")

    if not lines:
        return "A router profile exists but no fields have been filled in yet."

    return "\n".join(lines)


def _to_lc_messages(history: List[Dict[str, str]]) -> List[BaseMessage]:
    """Convert stored {role, content} history into LangChain messages."""
    converted: List[BaseMessage] = []
    for item in history:
        role = (item.get("role") or "").lower()
        content = item.get("content") or ""
        if not content:
            continue
        if role == "assistant":
            converted.append(AIMessage(content=content))
        else:
            converted.append(HumanMessage(content=content))
    return converted


def respond(
    state: SecurityChatState, config: Optional[RunnableConfig] = None
) -> SecurityChatState:
    """Generate a scoped, plain-language reply grounded in the user's profile."""
    _, namespace = _resolve_namespace(config)

    history = state.get("messages") or []
    if not history:
        reply = (
            "Hi! I can help you understand and improve your home network's "
            "security. What would you like to look at first?"
        )
        return {**state, "output": {"reply": reply}, "namespace": namespace}

    profile_summary = _format_profile(state.get("routerProfile"))
    system_content = (
        f"{SECURITY_CHAT_SYSTEM_PROMPT}\n\n"
        f"USER'S ROUTER PROFILE:\n{profile_summary}"
    )

    messages: List[BaseMessage] = [SystemMessage(content=system_content)]
    messages.extend(_to_lc_messages(history))

    # Bounded ReAct loop: the model may call retrieve_security_guidance to ground
    # its answer, then reason over the results. We cap iterations so a model that
    # keeps requesting tools can't loop forever.
    llm = get_chat_model(temperature=0.2, max_tokens=700).bind_tools(
        [retrieve_security_guidance]
    )

    response: Optional[BaseMessage] = None
    for _ in range(MAX_TOOL_ITERATIONS):
        response = llm.invoke(messages)
        messages.append(response)

        tool_calls = getattr(response, "tool_calls", None)
        if not tool_calls:
            break

        for call in tool_calls:
            try:
                result = retrieve_security_guidance.invoke(call["args"])
            except Exception:
                result = "Guidance lookup was unavailable."
            messages.append(ToolMessage(content=result, tool_call_id=call["id"]))

    # If we exhausted the tool budget mid-call, ask once more without tools so the
    # user always gets a written answer rather than a dangling tool request.
    if response is not None and getattr(response, "tool_calls", None):
        response = get_chat_model(temperature=0.2, max_tokens=700).invoke(messages)

    raw = response.content if response is not None else ""
    reply = raw if isinstance(raw, str) else str(raw)
    if not reply.strip():
        reply = "Sorry, I couldn't generate a response just now. Please try again."

    return {**state, "output": {"reply": reply}, "namespace": namespace}


builder = StateGraph(SecurityChatState)
builder.add_node("respond", respond)
builder.set_entry_point("respond")
builder.add_edge("respond", END)
graph = builder.compile()
