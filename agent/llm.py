"""Shared model factory for the GridWatch agent graphs.

All chat and embedding calls go through here so provider/gateway configuration
lives in one place. When an AI gateway is configured (Vercel AI Gateway, which
is OpenAI-compatible), every call is routed through it for centralized cost
tracking, fallback, and observability; otherwise we fall back to direct OpenAI
so local development keeps working with just an OPENAI_API_KEY.

Gateway model IDs are provider-qualified (e.g. "openai/gpt-5.1"); direct OpenAI
uses the bare id ("gpt-5.1"). The factory normalizes whichever form OPENAI_MODEL
holds to the one the active mode expects, so the same env var works either way.
"""

import os
from typing import Optional, Tuple

from langchain_openai import ChatOpenAI, OpenAIEmbeddings

DEFAULT_CHAT_MODEL = "gpt-5.1"
DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small"
DEFAULT_GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/v1"


def _gateway_config() -> Optional[Tuple[str, str]]:
    """Return (api_key, base_url) when an AI gateway is configured, else None.

    The agent runs on LangGraph Platform (not inside Vercel's runtime), so the
    gateway must be authenticated with an explicit AI_GATEWAY_API_KEY — the
    Vercel OIDC token path is not available here.
    """
    api_key = os.getenv("AI_GATEWAY_API_KEY")
    if not api_key:
        return None
    base_url = os.getenv("AI_GATEWAY_BASE_URL", DEFAULT_GATEWAY_BASE_URL)
    return api_key, base_url


def _resolve_model_id(raw: str, use_gateway: bool) -> str:
    """Normalize a model id for the active mode.

    Gateway wants a provider-qualified id ("openai/gpt-5.1"); direct OpenAI wants
    the bare id ("gpt-5.1"). We only add/strip the "openai/" provider prefix so a
    model id that already names a non-OpenAI provider is left untouched.
    """
    if use_gateway:
        return raw if "/" in raw else f"openai/{raw}"
    return raw[len("openai/"):] if raw.startswith("openai/") else raw


def get_chat_model(*, temperature: float = 0.0, max_tokens: Optional[int] = None) -> ChatOpenAI:
    """Build the chat model for the configured mode (gateway or direct OpenAI)."""
    raw = os.getenv("OPENAI_MODEL", DEFAULT_CHAT_MODEL)
    gateway = _gateway_config()

    kwargs = {"model": _resolve_model_id(raw, gateway is not None), "temperature": temperature}
    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens
    if gateway is not None:
        api_key, base_url = gateway
        kwargs["api_key"] = api_key
        kwargs["base_url"] = base_url

    return ChatOpenAI(**kwargs)


def get_embeddings() -> OpenAIEmbeddings:
    """Build the embedding model for the configured mode.

    Used by the RAG pipeline; kept here so retrieval and generation share the
    same gateway configuration.
    """
    raw = os.getenv("OPENAI_EMBEDDING_MODEL", DEFAULT_EMBEDDING_MODEL)
    gateway = _gateway_config()

    kwargs = {"model": _resolve_model_id(raw, gateway is not None)}
    if gateway is not None:
        api_key, base_url = gateway
        kwargs["api_key"] = api_key
        kwargs["base_url"] = base_url

    return OpenAIEmbeddings(**kwargs)
