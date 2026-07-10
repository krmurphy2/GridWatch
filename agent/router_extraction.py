import json
import os
import time
from typing import Any, Dict, List, Optional, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph
from pydantic import BaseModel, Field


class RouterExtraction(BaseModel):
    routerVendor: Optional[str] = None
    routerModel: Optional[str] = None
    hardwareVersion: Optional[str] = None
    firmwareVersion: Optional[str] = None
    publicIp: Optional[str] = None
    routerAdminUrl: Optional[str] = None
    upnpStatus: Optional[str] = None
    remoteAdminStatus: Optional[str] = None
    portForwardingStatus: Optional[str] = None
    wifiSecurity: Optional[str] = None
    confidence: Dict[str, str] = Field(default_factory=dict)
    missingFields: List[str] = Field(default_factory=list)
    notes: List[str] = Field(default_factory=list)


class RouterExtractionState(TypedDict, total=False):
    imageBase64: str
    imageMime: str
    userNotes: str
    output: Dict[str, Any]
    namespace: str


REQUIRED_FIELDS = [
    "routerVendor",
    "routerModel",
    "firmwareVersion",
    "publicIp",
    "upnpStatus",
    "remoteAdminStatus",
    "portForwardingStatus",
    "wifiSecurity",
]


def _build_prompt(user_notes: str) -> str:
    return f"""
Extract security-relevant router setup facts from the uploaded router admin
screenshot.
Return strict JSON matching this schema:
{{
  "routerVendor": string or null,
  "routerModel": string or null,
  "hardwareVersion": string or null,
  "firmwareVersion": string or null,
  "publicIp": string or null,
  "routerAdminUrl": string or null,
  "upnpStatus": string or null,
  "remoteAdminStatus": string or null,
  "portForwardingStatus": string or null,
  "wifiSecurity": string or null,
  "confidence": {{ "fieldName": "high|medium|low plus short reason" }},
  "missingFields": ["fieldName"],
  "notes": ["short note"]
}}

Rules:
- Use null when a field is not visible or cannot be inferred safely.
- Do not invent model, firmware, public IP, or setting status values.
- Include missing required fields in missingFields.
- Do not include passwords, Wi-Fi passphrases, admin usernames, MAC addresses,
  or private LAN-only device details in notes.
- If the screenshot contains sensitive secrets, mention that sensitive values were
  intentionally ignored.
- Public IP must be an internet-routable WAN/public address if visible. Do not
  use 192.168.x.x, 10.x.x.x, 172.16-31.x.x, localhost, or link-local addresses
  as public IP.

User notes:
{user_notes or "None"}
"""


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


def _resolve_namespace(config: Optional[RunnableConfig]) -> tuple[Optional[str], str]:
    """Read the caller-provided per-user identity from the run config.

    The frontend passes config.configurable.user_id/namespace so every user's
    agent history is stored under its own namespace and never mixes with another
    user's router details.
    """
    configurable = {}
    if isinstance(config, dict):
        configurable = config.get("configurable") or {}

    user_id = configurable.get("user_id")
    namespace = configurable.get("namespace") or (
        f"user:{user_id}" if user_id else "user:unknown"
    )
    return user_id, namespace


def _record_history(namespace: str, user_id: Optional[str], extraction: RouterExtraction) -> None:
    """Persist a small per-run summary in the store under the user's namespace.

    Defensive: if no store is bound to the run (e.g. some deploy targets), skip
    silently rather than failing the extraction.
    """
    if not user_id:
        return

    try:
        from langgraph.config import get_store

        store = get_store()
    except Exception:
        return

    if store is None:
        return

    try:
        store.put(
            (namespace, "router_extractions"),
            f"extraction-{int(time.time() * 1000)}",
            {
                "routerVendor": extraction.routerVendor,
                "routerModel": extraction.routerModel,
                "firmwareVersion": extraction.firmwareVersion,
                "missingFields": extraction.missingFields,
            },
        )
    except Exception:
        # History persistence is best-effort and must never block extraction.
        return


def extract_router_details(
    state: RouterExtractionState, config: Optional[RunnableConfig] = None
) -> RouterExtractionState:
    user_id, namespace = _resolve_namespace(config)
    model_name = os.getenv("OPENAI_MODEL", "gpt-5.1")
    llm = ChatOpenAI(model=model_name, temperature=0, max_tokens=1200)
    image_base64 = state["imageBase64"]
    image_mime = state.get("imageMime", "image/png")
    user_notes = state.get("userNotes", "")

    message = HumanMessage(
        content=[
            {"type": "text", "text": _build_prompt(user_notes)},
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:{image_mime};base64,{image_base64}",
                },
            },
        ]
    )

    response = llm.invoke(
        [
            SystemMessage(
                content=(
                    "You are a careful defensive home-network evidence "
                    "extraction assistant."
                )
            ),
            message,
        ]
    )

    parsed = json.loads(_strip_json_fence(_extract_text(response.content)))
    extraction = RouterExtraction.model_validate(parsed)
    missing = set(extraction.missingFields)

    for field in REQUIRED_FIELDS:
        if getattr(extraction, field) in (None, ""):
            missing.add(field)

    extraction.missingFields = sorted(missing)
    _record_history(namespace, user_id, extraction)
    return {**state, "output": extraction.model_dump(), "namespace": namespace}


builder = StateGraph(RouterExtractionState)
builder.add_node("extract_router_details", extract_router_details)
builder.set_entry_point("extract_router_details")
builder.add_edge("extract_router_details", END)
graph = builder.compile()
