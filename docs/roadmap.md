# GridWatch Roadmap

Planned work beyond the delivered POC. The POC ships an external-first agentic RAG
assistant (router-screenshot extraction, read-only NVD + Shodan InternetDB checks,
trusted-source RAG with provenance, plain-English assessments, chat, deterministic
guardrails), all deployed and evaluated. This document tracks what comes next; the
architecture docs describe only what is built today.

## Planned tools & integrations

Only NIST NVD (CVE lookup) and Shodan InternetDB (passive exposure) are wired today.
Planned additions:

- **Approved active public-IP exposure scan** — an actual port/service scan of the
  user's own verified router IP, behind strict target-verification and explicit
  approval. Higher-risk than the passive checks, so it needs its own guardrails.
- **Tavily web search** — fresh vendor guidance / source discovery when the curated
  corpus and NVD are insufficient.
- **AbuseIPDB** — public-IP reputation context (verified public IP only, never a
  private/LAN address).
- **HaveIBeenPwned** — breach-exposure checks, only with explicit user-provided
  account context and consent.

## Retrieval & evaluation

- **Improve retrieval recall.** The eval baseline shows context recall ~0.63 on the
  official corpus — real headroom, and a larger lever than dense-vs-hybrid (a wash).
  Try reranking (e.g. Cohere), chunk tuning, broader corpus coverage, multi-query
  expansion; measure each against the committed testset.
- **Experiment with embeddings** — e.g. `text-embedding-3-large` or non-OpenAI
  embeddings; measure retrieval quality vs. cost/latency. (Changing the embedding
  model requires a full Qdrant re-ingest.)
- **Experiment with vector stores** — alternatives to Qdrant Cloud; compare setup,
  cost, and retrieval quality.
- **Mature the eval harness** — grow the test set, add explicit safety-boundary and
  tool-selection cases, and wire the LangSmith experiment in as a CI regression gate.

## Product / UX

- **Review & acknowledge posture findings (port forwarding first)** — let the user
  mark a finding (e.g. an intentional port-forwarding rule) as approved/acknowledged
  so it's silenced from "action needed," with the acknowledgement retained in
  assessment memory. Generalize to any posture finding.

## Privacy & data handling (before real users)

User data (router screenshots, config, chat, public IP) is sent to third-party
subprocessors — OpenAI (via the Vercel AI Gateway), LangSmith (tracing logs
inputs/outputs), and Shodan (public IP) — and stored in Neon. Before real users:

- Privacy notice + consent at the upload step ("sent to AI services and logged for
  monitoring; don't upload passwords/secrets; redact sensitive fields").
- Privacy policy / subprocessor disclosure, with a no-training statement (verify
  OpenAI/gateway terms).
- Configure LangSmith trace retention and scrub PII/secrets from traces.
- Move stored screenshots from Postgres to private object storage with a retention +
  delete path.
- Minimize what reaches the LLM (client-side redaction guidance — screenshots can
  contain Wi-Fi passwords, admin credentials, MACs, serials).
- Legal review for GDPR/CCPA applicability depending on user jurisdiction.

## Deferred (post-MVP)

- **Local LAN scanning / device inventory** — "what devices are on my network,"
  new-device alerts. Requires a local scanner, router integration, or appliance, plus
  its own privacy model; intentionally outside the external-first MVP.
