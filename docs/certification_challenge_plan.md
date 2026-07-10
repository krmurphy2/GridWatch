# Home Network Security Assistant Certification Plan

## Purpose

This document tracks the project plan against the AI Engineering Certification
Challenge requirements. Supporting detail should live in focused documents under
`docs/`, while this file remains the challenge-aligned index.

## Task 1: Defining Problem, Audience, and Scope

### Problem Statement

Home network owners have no accessible, automated way to understand whether their
router, public internet exposure, or home-network configuration exposes them to
known security risks, or what practical action they should take next.

### Audience

The target user is a non-technical home network owner who uses a home router and
multiple connected devices such as smart TVs, cameras, thermostats, phones,
laptops, game consoles, and other IoT devices. They can set up Wi-Fi and install
apps, but they do not routinely inspect router settings, read vulnerability
advisories, or run network security tools.

### Current Workflow

1. The user notices a suspicious device, slow network, or security headline.
2. The user tries to log in to the router admin interface.
3. The router presents raw connected-device or configuration data.
4. The user searches the web for device names, router models, ports, or CVEs.
5. The user encounters technical advisories, stale forum posts, or conflicting
   instructions.
6. The user either does nothing or attempts an unverified manual fix.
7. The network returns to an unknown security state with no ongoing monitoring.

### Evaluation Questions

| # | User Question | Expected System Behavior |
| --- | --- | --- |
| 1 | Can you review my router screenshots? | Extract router model, firmware, and configuration clues from uploaded evidence. |
| 2 | Is my home network exposed to the internet? | Ask approval, verify the user's router public IP, scan only that IP, and explain exposed services. |
| 3 | What do these open ports mean? | Use scan results and RAG guidance to explain service risk in plain English. |
| 4 | Is my router firmware vulnerable? | Query NVD and trusted sources using extracted router model and firmware details. |
| 5 | Has my public IP appeared in security intelligence? | Use approved passive external intelligence sources and explain confidence/limitations. |
| 6 | Have my home-network accounts been exposed? | With explicit user-provided account context, use breach intelligence such as HaveIBeenPwned where appropriate. |
| 7 | What security changes should I make first? | Combine screenshot evidence, scan results, passive intelligence, CVEs, and RAG guidance into prioritized remediation. |
| 8 | What devices are currently on my network? | Future feature: use a local scanner or router integration after the MVP. |

## Task 2: Proposed Solution

### Solution Statement

GridWatch is an AI-powered home network security assistant that combines router
evidence upload, approved public-IP exposure scanning, passive external
intelligence, vulnerability lookup, trusted security guidance, and a browser-based
conversational dashboard for non-technical users.

### Infrastructure Summary

See `docs/architecture.md` for the infrastructure diagram, external-first MVP
workflow, human approval gates, and tool boundaries. See `docs/security_privacy.md`
for scan restrictions and data handling boundaries.

### Required Component Choices

| Challenge Component | Current Choice | Supporting Document |
| --- | --- | --- |
| LLM | Anthropic Claude via an LLM gateway | `docs/model_choices.md` |
| LLM gateway | LiteLLM as the initial default; alternatives documented | `docs/model_choices.md` |
| Agent orchestration | LangGraph | `docs/architecture.md` |
| Tools | Screenshot/evidence extractor, external exposure scan, passive intelligence, NVD CVE lookup, RAG retriever, Tavily search | `docs/architecture.md` |
| Embedding model | To be finalized during data scoping | `docs/data_strategy.md` |
| Vector database | ChromaDB for prototype | `docs/data_strategy.md` |
| Monitoring | LangSmith for the hosted graph; Langfuse remains optional later | `docs/evaluation_plan.md` |
| Evaluation framework | RAGAS plus custom LLM-as-judge checks | `docs/evaluation_plan.md` |
| User interface | Browser-based dashboard/chat for laptop and phone | `docs/architecture.md` |
| Deployment | Vercel frontend/API plus hosted LangGraph deployment; no local scanner required for MVP | `docs/architecture.md` |
| Memory | HTTP-only sessions plus Vercel Postgres assessment memory | `docs/architecture.md` |

## Task 3: Dealing with the Data

### Data Strategy

RAG corpus design should be scoped per feature/tool rather than as one monolithic
knowledge base. Router evidence extraction, public-IP exposure analysis, passive
external intelligence, vulnerability lookup, and remediation guidance each need
different evidence sources, freshness requirements, metadata, and evaluation
cases.

See `docs/data_strategy.md` and `docs/rag_scoping.md`.

### External APIs

Initial external APIs:

| API | Role | Key Requirement |
| --- | --- | --- |
| NIST NVD API | Authoritative CVE lookup for router model/firmware | Optional key for higher rate limits |
| Tavily | Agentic web search for current vendor guidance and source discovery | User-provided key |
| Shodan, Censys, or InternetDB | Passive public-IP service exposure intelligence | User approval and API-key availability |
| AbuseIPDB | Public-IP reputation context | Use only for verified public IPs; never private LAN IPs |
| HaveIBeenPwned | Breach exposure checks for user-approved email/account context | Requires explicit user-provided account context |
| External IP service | Help determine the user's public router IP from browser/request context | No sensitive payload beyond request metadata |

See `docs/external_intelligence_sources.md` for passive-intelligence source
priority, privacy boundaries, and MVP inclusion decisions.

Potential later APIs:

| API | Role | Decision Needed |
| --- | --- | --- |
| GreyNoise | Internet background-noise and IP context | Useful if API access and privacy review support it. |
| Vendor firmware feeds | Router firmware checks | Prefer vendor-specific integrations after MVP baseline. |

## Task 4: End-to-End Agentic RAG Prototype

### MVP Feature Order

1. Router setup from uploaded screenshots and user-provided router details.
2. Approved public IP scan for exposed ports and services.
3. Passive external intelligence enrichment.
4. AI synthesis with router firmware/model CVE lookup and plain-English guidance.

### Prototype Scope

The first deployed prototype should include:

1. A browser UI with chat, setup flow, upload flow, and a simple dashboard.
2. A cloud backend with an agent API.
3. Screenshot/evidence extraction for router details and configuration clues.
4. An approved external exposure scan against only the user's verified router
   public IP.
5. Passive external intelligence enrichment for approved public IP, account, or
   domain context.
6. RAG over a small trusted corpus.
7. NVD lookup for CVE-backed router firmware/model vulnerability answers.
8. Explicit user approval before active scans and sensitive third-party lookups.
9. A hard prohibition on arbitrary open internet scanning.

## Task 5: Evals

See `docs/evaluation_plan.md`.

The evaluation harness must test:

1. RAG answer faithfulness and relevance.
2. Agent tool selection.
3. Safety boundary compliance.
4. Non-technical readability.
5. CVE lookup accuracy.
6. Before/after improvement for the advanced retrieval task.

## Task 6: Improving the Prototype

The planned improvement path is:

1. Baseline dense retrieval over the initial trusted corpus.
2. Add hybrid retrieval for exact terms such as CVE IDs, ports, protocols, and
   router model names.
3. Add reranking or query rewriting if evaluation evidence supports it.
4. Compare metrics before and after in a table.
5. Use the same harness to prove at least one non-retrieval improvement.

## Task 7: Next Steps

The likely Demo Day path is to keep the explicit agent/tool architecture,
trusted-source-first evidence model, external-first scan guardrails, and browser
dashboard, while improving passive intelligence coverage and assessment memory.
Local scanner packaging remains a post-MVP roadmap item.

## Final Submission Checklist

- [ ] Public or shared repository link.
- [ ] Live demo video under 10 minutes.
- [ ] Written document addressing every challenge deliverable.
- [ ] End-to-end prototype code.
- [ ] Public deployed endpoint.
- [ ] Evaluation dataset and harness.
- [ ] Before/after improvement results.
- [ ] Security/privacy notes and scan restrictions documented in
  `docs/security_privacy.md`.
