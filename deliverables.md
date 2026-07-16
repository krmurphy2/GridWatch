# GridWatch — Certification Challenge Deliverables (Traceability)

This document maps every deliverable in the AI Engineering Certification Challenge
rubric to its exact location in this repository. It is the grader's index: each row
points to the written artifact and, where applicable, the code that implements it.

> **What is built today vs. planned.** GridWatch ships an external-first agentic RAG
> assistant: router-screenshot extraction, read-only NIST NVD + Shodan InternetDB
> checks, trusted-source RAG with provenance, plain-English assessments, chat, and
> deterministic guardrails — all deployed and evaluated. Anything not yet built
> (active scan, Tavily, AbuseIPDB, HIBP) is tracked in
> [docs/roadmap.md](docs/roadmap.md). The architecture docs describe only what runs
> today.

## Submission Links

| Item | Link |
| --- | --- |
| Public repository | `https://github.com/krmurphy2/GridWatch` |
| Deployed public endpoint | **⟨fill in Vercel production URL⟩** |
| 10-minute demo video (Loom) | **⟨fill in Loom link⟩** |
| LangSmith project / eval experiments | **⟨fill in LangSmith project link⟩** |
| This traceability document | [deliverables.md](deliverables.md) |

---

## Task 1 — Defining Problem, Audience, and Scope (1 pt)

| Rubric deliverable | Where it's addressed |
| --- | --- |
| 1-sentence problem statement | [README.md → "1-Sentence Problem Statement"](README.md#1-sentence-problem-statement) |
| 1–2 paragraphs on why it's a problem for the specific user | [README.md → "Audience"](README.md#audience) and [README.md → "Why This Is a Problem"](README.md#why-this-is-a-problem) |
| Workflow diagram of how the user solves this today | [README.md → "Current Workflow"](README.md#current-workflow) (mermaid) |

Supporting: [docs/certification_challenge_plan.md → Task 1](docs/certification_challenge_plan.md).

---

## Task 2 — Propose a Solution (1 pt)

| Rubric deliverable | Where it's addressed |
| --- | --- |
| 1-sentence solution description | [README.md → "1-Sentence Solution Statement"](README.md#1-sentence-solution-statement) |
| Infrastructure diagram of the stack | [README.md → "Infrastructure Diagram"](README.md#infrastructure-diagram) and [docs/architecture.md → "High-Level Infrastructure"](docs/architecture.md#high-level-infrastructure) (identical, "as-built" mermaid: Vercel orchestrator, LangGraph Platform agent, NVD/InternetDB tools, AI Gateway → OpenAI, Qdrant) |
| Agent workflow diagram | [README.md → "Agent Workflow"](README.md#agent-workflow) and [docs/architecture.md → "Agent Workflow"](docs/architecture.md#agent-workflow) |
| Tooling stack / component choices | [README.md → "Component Choices"](README.md#component-choices); [docs/model_choices.md](docs/model_choices.md) |

Stack (as built): OpenAI gpt-5.1 via **Vercel AI Gateway**; **LangGraph** orchestration
(3 hosted graphs); **Qdrant Cloud** vector store; **Neon** Postgres; **LangSmith**
tracing/evals; **RAGAS** evaluation; Next.js browser UI on **Vercel**.

---

## Task 3 — Dealing with the Data (5 pts)

| Rubric deliverable | Where it's addressed | Code |
| --- | --- | --- |
| Describe all data sources & external APIs and their use | [README.md → "Data Sources"](README.md#data-sources) and [README.md → "External APIs"](README.md#external-apis); [docs/data_strategy.md](docs/data_strategy.md); [docs/external_intelligence_sources.md](docs/external_intelligence_sources.md) | NVD: [lib/nvd.ts](lib/nvd.ts); InternetDB: [lib/internetdb.ts](lib/internetdb.ts); RAG corpus (9 official PDFs + manifest): [agent/corpus/](agent/corpus/) |
| Default chunking strategy + justification | [README.md → "Default Chunking Strategy"](README.md#default-chunking-strategy); [docs/rag_scoping.md](docs/rag_scoping.md) | `RecursiveCharacterTextSplitter`, `chunk_size=900`, `chunk_overlap=120`, markdown-aware separators — [agent/rag.py:39-40](agent/rag.py#L39-L40) (constants), [agent/rag.py:157-165](agent/rag.py#L157-L165) (splitter); PDF cleanup `_clean_pdf_text` and provenance metadata `_metadata_for` in [agent/rag.py](agent/rag.py) |

Corpus provenance (source URL, title, publisher, publish date) is manifest-driven:
[agent/corpus/rag_corpus_reference.csv](agent/corpus/rag_corpus_reference.csv), loaded
by `_manifest()` in [agent/rag.py](agent/rag.py). Ingestion: [agent/ingest.py](agent/ingest.py).

---

## Task 4 — Build End-to-End Agentic RAG Prototype (15 pts)

| Rubric deliverable | Location |
| --- | --- |
| Deployed functional prototype (frontend on Vercel) | Deployed URL above. Next.js App Router UI: [app/](app/) — dashboard [app/dashboard/page.tsx](app/dashboard/page.tsx), setup [app/setup/page.tsx](app/setup/page.tsx), chat [app/chat/page.tsx](app/chat/page.tsx), auth [app/auth-forms.tsx](app/auth-forms.tsx) |
| Backend / server actions (orchestrator) | [app/actions.ts](app/actions.ts) — `runSecurityChecksAction` runs NVD + InternetDB, feeds `findings_summary`, persists to Neon ([app/actions.ts:180-236](app/actions.ts#L180-L236)); API routes [app/api/](app/api/) |
| Agentic RAG graphs (LangGraph) | Extraction [agent/router_extraction.py](agent/router_extraction.py); chat [agent/security_chat.py](agent/security_chat.py); grounded summary [agent/findings_summary.py](agent/findings_summary.py); graph registry [agent/langgraph.json](agent/langgraph.json) |
| RAG retrieval | [agent/rag.py](agent/rag.py) — `retrieve()` / `retrieve_security_guidance()` over Qdrant |
| Security tools | NVD CVE lookup [lib/nvd.ts](lib/nvd.ts); passive exposure [lib/internetdb.ts](lib/internetdb.ts) |
| Deterministic guardrails (pre-LLM) | [lib/guardrails.ts](lib/guardrails.ts) (`screenChatMessage`, injection/off-topic/trivial); clean-scan LLM skip [app/actions.ts:217-220](app/actions.ts#L217-L220) |
| Graph clients (Vercel → LangGraph, per-user threads) | [lib/agent-client.ts](lib/agent-client.ts), [lib/chat-client.ts](lib/chat-client.ts), [lib/findings-summary-client.ts](lib/findings-summary-client.ts) |
| Memory / persistence | Neon schema & access [lib/db.ts](lib/db.ts), [lib/router-profile.ts](lib/router-profile.ts), [lib/security-findings.ts](lib/security-findings.ts); design [docs/architecture.md → "Memory Design"](docs/architecture.md#memory-design) |
| Deployment config | Web: [vercel.json](vercel.json); agent: [agent/langgraph.json](agent/langgraph.json); details [docs/deployment.md](docs/deployment.md) |

---

## Task 5 — Evals (2 pts)

| Rubric deliverable | Where it's addressed |
| --- | --- |
| Test dataset (synthesized/assembled) | Committed golden set [eval/testset.json](eval/testset.json); generator with personas + query distribution [eval/generate_dataset.py](eval/generate_dataset.py) |
| Evaluation harness relevant to the problem space | [eval/run_eval.py](eval/run_eval.py) (RAGAS faithfulness / context recall / answer accuracy, LangSmith `aevaluate`), shared build in [eval/eval_common.py](eval/eval_common.py); how-to [eval/README.md](eval/README.md); design [docs/evaluation_plan.md](docs/evaluation_plan.md) |
| Conclusions about pipeline performance | [docs/evaluation_plan.md → "Baseline"](docs/evaluation_plan.md#baseline-official-corpus-15-curated-questions) (faithfulness 0.81 / context recall 0.63 / answer accuracy 0.65) and [docs/evaluation_plan.md → "Conclusions To Produce"](docs/evaluation_plan.md) |

---

## Task 6 — Improving the Prototype / Advanced Retrieval (6 pts)

| Rubric deliverable | Where it's addressed |
| --- | --- |
| Advanced retrieval technique + justification | **Hybrid retrieval** — dense + BM25 fused with Reciprocal Rank Fusion (`RRF_CONSTANT=60`, `FIRST_STAGE_K=8`), default on. Code: [agent/rag.py:222-254](agent/rag.py#L222-L254) (`_rrf_fuse`, `retrieve`), BM25 index [agent/rag.py:202-216](agent/rag.py#L202-L216). Rationale (exact-term recall for CVE IDs / ports / model names): [docs/rag_scoping.md](docs/rag_scoping.md), [docs/evaluation_plan.md → "Task 6 Improvement"](docs/evaluation_plan.md#task-6-improvement--advanced-retriever-hybrid) |
| Performance comparison table vs. original RAG | Dense vs. hybrid table: [docs/evaluation_plan.md](docs/evaluation_plan.md#task-6-improvement--advanced-retriever-hybrid) (faithfulness 0.814→0.835, recall 0.630→0.603, accuracy 0.650→0.667) |
| Meaningful improvement backed by eval evidence | **Non-retrieval improvement — grounded answer prompt**: faithfulness **0.427 → 0.812 (+0.386)**. Table + analysis: [docs/evaluation_plan.md → "Non-Retrieval Improvement"](docs/evaluation_plan.md#non-retrieval-improvement--grounded-answer-prompt). Grounded prompt in [agent/findings_summary.py](agent/findings_summary.py); A/B via `--compare` / `--compare-prompt` in [eval/run_eval.py](eval/run_eval.py) |

---

## Task 7 — Next Steps for Demo Day (2 pts)

| Rubric deliverable | Where it's addressed |
| --- | --- |
| Reflection on implementation decisions / Demo Day plan | [docs/certification_challenge_plan.md → Task 7](docs/certification_challenge_plan.md); forward roadmap [docs/roadmap.md](docs/roadmap.md) |

---

## Final Submission (20 pts)

| Rubric deliverable | Location |
| --- | --- |
| 10-minute Loom demo video | **⟨fill in Loom link⟩** (script: internal demo notes) |
| Written document addressing all deliverables | This file + [README.md](README.md) (Tasks 1–3 entry point) + [docs/](docs/) |
| All relevant code | This repository: web app [app/](app/) / [lib/](lib/); agent [agent/](agent/); evals [eval/](eval/) |
| Public deployed endpoint | **⟨fill in Vercel production URL⟩** |

---

## Supporting Documentation Index

- [docs/architecture.md](docs/architecture.md) — infrastructure, agent workflow, tool boundaries, memory, deployment
- [docs/model_choices.md](docs/model_choices.md) — LLM + gateway reasoning
- [docs/data_strategy.md](docs/data_strategy.md) / [docs/rag_scoping.md](docs/rag_scoping.md) — data + RAG design
- [docs/external_intelligence_sources.md](docs/external_intelligence_sources.md) — passive-intel sources & privacy boundaries
- [docs/evaluation_plan.md](docs/evaluation_plan.md) — eval harness, metrics, before/after results
- [docs/security_privacy.md](docs/security_privacy.md) — scan restrictions & data handling
- [docs/deployment.md](docs/deployment.md) / [docs/local_development.md](docs/local_development.md) — deploy & local dev
- [docs/roadmap.md](docs/roadmap.md) — planned work beyond the POC
