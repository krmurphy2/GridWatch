# GridWatch Roadmap

Planned work beyond the delivered POC. The POC ships an external-first agentic RAG
assistant (router-screenshot extraction, read-only NVD + Shodan InternetDB checks,
trusted-source RAG with provenance, plain-English assessments, chat, deterministic
guardrails), all deployed and evaluated. This document tracks what comes next; the
architecture docs describe only what is built today.

## Planned tools & integrations

Wired today: NIST NVD (CVE lookup), Shodan InternetDB (passive exposure), and
AbuseIPDB (public-IP reputation). Planned additions:

- **Approved active public-IP exposure scan** — an actual port/service scan of the
  user's own verified router IP, behind strict target-verification and explicit
  approval. Higher-risk than the passive checks, so it needs its own guardrails.
- **Verify public-IP ownership** — today the IP-based lookups only reject private/LAN
  addresses; they don't confirm the public IP belongs to the user. Add an
  ownership/verification step (and an explicit approval gate) before any IP lookup.
- **Tavily web search** — fresh vendor guidance / source discovery when the curated
  corpus and NVD are insufficient.
- **HaveIBeenPwned** — breach-exposure checks, only with explicit user-provided
  account context and consent.

## Recurring scans & notifications

Shipped in the POC: a daily Vercel Cron job (`/api/cron/recurring-scan`, protected by
`CRON_SECRET`) re-runs the checks for opted-in users, plus a dashboard toggle and a
"Run scan & email now" button. Email delivery is currently a **stub** — the payload is
logged server-side and displayed in the UI. Planned:

- **Real email delivery** — swap `lib/email.ts` onto a provider (Resend / SES). One
  function, no caller changes.
- **Change-only alerts** — only email when the posture changes (new CVE, newly exposed
  port, reputation crossing a threshold) instead of every run, to avoid alert fatigue.
- **Per-user cadence** — let the user choose daily/weekly; Vercel Hobby cron is limited
  to once/day, so sub-daily needs a Pro plan or an external scheduler.

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
  assessment memory. Generalize to any posture finding, and track **remediation
  status** over time (fixed / acknowledged / outstanding).

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
