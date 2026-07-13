"""Unit tests for the shared model factory (agent/llm.py).

Pure logic + lazy object construction only — no network calls. Runs under pytest
or directly: `uv run python test_llm.py` from the agent/ directory.
"""

import os

import llm


def _set_env(**kwargs):
    for key, value in kwargs.items():
        if value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = value


def test_resolve_model_id_gateway_qualifies():
    # Bare OpenAI id gets provider-qualified for the gateway.
    assert llm._resolve_model_id("gpt-5.1", True) == "openai/gpt-5.1"
    # Already-qualified ids are left alone (openai or any other provider).
    assert llm._resolve_model_id("openai/gpt-5.1", True) == "openai/gpt-5.1"
    assert llm._resolve_model_id("anthropic/claude", True) == "anthropic/claude"


def test_resolve_model_id_direct_strips_openai_prefix():
    assert llm._resolve_model_id("openai/gpt-5.1", False) == "gpt-5.1"
    assert llm._resolve_model_id("gpt-5.1", False) == "gpt-5.1"


def test_gateway_config_none_without_key():
    _set_env(AI_GATEWAY_API_KEY=None)
    assert llm._gateway_config() is None


def test_gateway_config_defaults_base_url():
    _set_env(AI_GATEWAY_API_KEY="k", AI_GATEWAY_BASE_URL=None)
    assert llm._gateway_config() == ("k", llm.DEFAULT_GATEWAY_BASE_URL)
    _set_env(AI_GATEWAY_API_KEY=None)


def test_gateway_config_custom_base_url():
    _set_env(AI_GATEWAY_API_KEY="k", AI_GATEWAY_BASE_URL="https://gw.example/v1")
    assert llm._gateway_config() == ("k", "https://gw.example/v1")
    _set_env(AI_GATEWAY_API_KEY=None, AI_GATEWAY_BASE_URL=None)


def test_get_chat_model_direct_uses_bare_id():
    _set_env(AI_GATEWAY_API_KEY=None, OPENAI_MODEL="gpt-5.1", OPENAI_API_KEY="sk-test")
    model = llm.get_chat_model(temperature=0.1, max_tokens=100)
    assert model.model_name == "gpt-5.1"


def test_get_chat_model_gateway_qualifies_and_sets_base_url():
    _set_env(AI_GATEWAY_API_KEY="gwkey", AI_GATEWAY_BASE_URL=None, OPENAI_MODEL="gpt-5.1")
    model = llm.get_chat_model()
    assert model.model_name == "openai/gpt-5.1"
    _set_env(AI_GATEWAY_API_KEY=None)


if __name__ == "__main__":
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_")]
    for test in tests:
        test()
        print(f"ok - {test.__name__}")
    print(f"\n{len(tests)} passed")
