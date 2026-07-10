# Model Choices and LLM Gateway

## Challenge Alignment

This document supports Task 2 by documenting LLM choices, LLM gateway options,
model-selection reasoning, fallback strategy, cost considerations, and reliability
concerns.

## Why Use an LLM Gateway?

The challenge explicitly requires using an LLM gateway. Beyond satisfying that
requirement, a gateway is useful because it separates application code from a
single model provider.

Primary benefits:

1. **Provider abstraction:** The agent can call one internal interface while the
   gateway routes to Anthropic, OpenAI, Gemini, or local models.
2. **Fallbacks:** If the primary model is unavailable or rate-limited, the gateway
   can route selected requests to a backup model.
3. **Cost controls:** Requests can be routed by task complexity, with cheaper
   models used for simple classification or formatting.
4. **Observability:** Gateway-level logging can capture latency, token usage, and
   cost without scattering that logic across tools.
5. **Policy enforcement:** The gateway can centralize model allowlists, max token
   limits, retry behavior, and redaction rules.
6. **Experimentation:** The project can compare models while keeping prompts and
   agent code mostly stable.

A gateway does add operational complexity. If this were not a certification
requirement, a direct Anthropic SDK integration would be acceptable for an early
prototype. Because the challenge requires a gateway and the project needs
extensibility, the gateway is justified.

## LLM Gateway Options

| Option | Strengths | Tradeoffs | Fit |
| --- | --- | --- | --- |
| LiteLLM | Broad provider support, OpenAI-compatible API, routing, retries, budgets, common in prototypes | Adds another service/library and config layer | Best default for this project. |
| Portkey | Managed gateway, observability, guardrails, routing, prompt management | More SaaS dependency; cost and data-sharing review needed | Good if managed ops matter more than open-source control. |
| Helicone | Strong observability/proxy for LLM calls, useful analytics | More monitoring proxy than full orchestration gateway | Good complement or lightweight gateway option. |
| LangChain model abstractions | Easy if already using LangChain/LangGraph, supports multiple providers | Less of a standalone gateway; cost/routing features may need custom code | Reasonable for local-only prototype, weaker for challenge narrative. |
| Custom internal wrapper | Minimal dependencies, full control | Must build retries, fallback, telemetry, cost tracking, and provider normalization | Not recommended for MVP. |
| Direct Anthropic SDK | Simplest and lowest moving parts | Does not satisfy gateway requirement; harder to add fallback/cost routing | Not sufficient as final challenge architecture. |
| Cloud provider gateway | Centralized enterprise controls if using AWS/GCP/Azure AI stacks | Vendor lock-in and more setup | Better for enterprise version, not MVP. |

## Selected Gateway

Use LiteLLM for the MVP.

Reasons:

1. It satisfies the challenge gateway requirement.
2. It works with an OpenAI API key.
3. It preserves optional fallback paths to Anthropic, Gemini, or local models.
4. It supports cost and usage tracking patterns needed by the repo rules.
5. It keeps provider-specific code out of the LangGraph agent.

## Primary Model

Use OpenAI `gpt-5.1` as the primary model for the agent.

Reasons:

1. Strong instruction following for multi-step security guidance.
2. Good fit for plain-English explanations for non-technical users.
3. Good reasoning for tool selection and risk summarization.
4. Vision support for the router screenshot extraction task.
5. User provides an OpenAI API key.

The model name is environment-configured via `OPENAI_MODEL` (default `gpt-5.1`)
so evaluations are reproducible and experiments do not require code changes.

## Model Routing Plan

| Task Type | Recommended Model Route | Reason |
| --- | --- | --- |
| Screenshot extraction | OpenAI `gpt-5.1` (vision) | Reads router admin screenshots and returns structured fields. |
| Tool selection | OpenAI `gpt-5.1` primary | Accuracy and safety matter. |
| Security answer synthesis | OpenAI `gpt-5.1` primary | Needs careful language and source-grounding. |
| RAG answer generation | OpenAI `gpt-5.1` primary | Must avoid unsupported security claims. |
| Short classification | Lower-cost model if available | Can reduce cost after eval proves no quality loss. |
| LLM-as-judge evals | Same family or stronger model than production | Keeps judging quality high. |
| Embeddings | Separate embedding model | Generation models should not be used for retrieval embeddings. |

## Fallback Strategy

Initial fallback can be disabled until the first prototype is stable. Once the
main path works, configure fallback for non-safety-critical requests.

Recommended policy:

1. Retry transient failures with exponential backoff.
2. Fall back only for read-only reasoning and summarization tasks.
3. Do not silently fall back for policy-sensitive scan approvals unless the
   fallback model has passed the same safety evaluations.
4. Record model name, version, latency, token count, and estimated cost for every
   call.

## Cost Controls

Cost controls should include:

1. Max token limits by route.
2. Short context windows for classification tasks.
3. RAG context trimming and reranking before synthesis.
4. Caching for repeated CVE and documentation queries.
5. Budget-aware evaluation runs.
6. Environment-configured model names so experiments do not require code changes.

## Privacy and Logging

Model prompts may contain device names, router models, local IPs, or user-provided
network descriptions. The system should:

1. Avoid sending raw MAC addresses unless necessary.
2. Redact secrets and credentials from prompts and logs.
3. Avoid logging full scan output by default.
4. Store only the minimum metadata needed for memory and evaluation.
5. Clearly document what leaves the user's local network.

## Open Questions

1. Should a cheaper vision model (e.g. `gpt-4o-mini`) be used for extraction once eval proves no quality loss?
2. Should fallback be implemented during MVP or after baseline evals?
3. Which embedding provider should be used for the first RAG corpus?
4. Should LiteLLM run as a library in the backend or as a separate proxy service?
