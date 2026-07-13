# Deployment

## Purpose

This document describes the first deployable GridWatch slice: a Vercel-hosted
Next.js frontend/API and a LangGraph agent deployment managed through
LangSmith/LangGraph Platform.

## Architecture

```text
Browser
  -> Vercel Next.js app
      -> server actions/API code
      -> Neon serverless Postgres for user/session/router profile data
      -> hosted LangGraph agent (router extraction + security chat)
          -> OpenAI vision-capable model (gpt-5.1)
      -> LangSmith tracing/evaluation
```

The browser never calls OpenAI, LangGraph, LangSmith, Shodan, Tavily, or other
security APIs directly. All credentials stay in server-side environment variables.

## Vercel Frontend/API

The Vercel app provides:

1. First-user-only account creation.
2. Password sign-in with HTTP-only session cookies.
3. No public signup after the first user exists.
4. Router screenshot upload.
5. Router profile persistence in Neon serverless Postgres.
6. Scan approval capture before future public-IP exposure checks.
7. Server-side calls to the hosted router extraction agent.
8. `GET /api/health` for deployment health checks.
9. Authenticated `GET /api/router-profile` and `POST /api/router-profile` for retained router profile access and upload processing.

Required Vercel environment variables:

```bash
DATABASE_URL="postgres://USER:PASSWORD@HOST/DATABASE?sslmode=require"
FIRST_USER_SETUP_TOKEN="generate-a-one-time-setup-token"
LANGGRAPH_DEPLOYMENT_URL="https://your-langgraph-deployment-url"
LANGGRAPH_API_KEY="your-langgraph-api-key"
LANGGRAPH_ASSISTANT_ID="router_extraction"
LANGGRAPH_CHAT_ASSISTANT_ID="security_chat"
LANGGRAPH_SUMMARY_ASSISTANT_ID="findings_summary"
USE_MOCK_AGENT="false"
# Optional: raises NIST NVD rate limits for CVE lookups (works without a key).
NVD_API_KEY="your-nvd-api-key"
```

The CVE lookup (NIST NVD) and passive exposure (Shodan InternetDB) checks are
read-only and free. `NVD_API_KEY` is optional and only raises NVD rate limits;
InternetDB requires no key. Passive intelligence only queries the user's verified
public IP — private/LAN addresses are never sent to third parties.

For local development without Neon Postgres or the hosted agent, use the file-backed local setup in `docs/local_development.md`. The short version is:

```bash
npm install
npm run setup:local
npm run dev:local
```

## First User Setup

1. Deploy the Vercel app with `FIRST_USER_SETUP_TOKEN` configured.
2. Open the deployed app.
3. Create the first user with email, password, and the setup token.
4. After that user exists, the setup form is no longer available and public signup
   is disabled.
5. Rotate or remove `FIRST_USER_SETUP_TOKEN` after the first user is created.

## LangGraph Agent Deployment

The agent lives in `agent/`.

Required agent environment variables:

```bash
OPENAI_API_KEY="your-openai-api-key"
OPENAI_MODEL="gpt-5.1"
OPENAI_EMBEDDING_MODEL="text-embedding-3-small"
# Vercel AI Gateway (OpenAI-compatible). Set on the LangGraph deployment to route
# all model/embedding calls through the gateway; unset to call OpenAI directly.
# The agent runs on LangGraph Platform (not Vercel), so it needs an explicit key —
# the Vercel OIDC token path is not available here.
AI_GATEWAY_API_KEY="your-vercel-ai-gateway-key"
AI_GATEWAY_BASE_URL="https://ai-gateway.vercel.sh/v1"
# Qdrant Cloud for RAG. Build the collection once before/after deploy with
# `cd agent && QDRANT_URL=... QDRANT_API_KEY=... uv run python ingest.py`.
QDRANT_URL="https://your-cluster.qdrant.io"
QDRANT_API_KEY="your-qdrant-api-key"
QDRANT_COLLECTION="gridwatch_security_guidance"
LANGSMITH_API_KEY="your-langsmith-api-key"
LANGSMITH_TRACING="true"
LANGSMITH_PROJECT="gridwatch-router-extraction"
```

If `QDRANT_URL` is unset the agent builds an in-memory index from the bundled
corpus on first use, so retrieval still works without Qdrant Cloud (rebuilt per
process). For a deployed public endpoint, set the Qdrant Cloud vars and run the
ingestion script so the collection persists and is not re-embedded per cold start.

### Updating the RAG corpus

The corpus (`agent/corpus/*.md`) is loaded by glob, so a new or edited file is
picked up automatically — no code or config changes are needed. But the Qdrant
Cloud collection is built **offline and is not auto-synced**, so after any corpus
change you must re-ingest, or production keeps serving the old vectors.

> **Important:** this failure is silent. Stale or missing vectors produce empty
> guidance (no sources, generic answers), not an error. Always verify after
> ingesting.

1. Add or edit files in `agent/corpus/*.md`. The first `#` heading becomes the
   citation label shown to users.
2. Re-ingest into Qdrant Cloud (uses `force_recreate`, so it cleanly rebuilds):

   ```bash
   cd agent
   QDRANT_URL="https://your-cluster.qdrant.io" \
   QDRANT_API_KEY="your-qdrant-api-key" \
   OPENAI_API_KEY="your-openai-api-key" \
   uv run python ingest.py
   ```

   Use the same `QDRANT_URL`/`QDRANT_API_KEY`/`QDRANT_COLLECTION` as the deployment.
   The embedding model is `text-embedding-3-small` either way, so ingesting with
   direct OpenAI stays compatible with a gateway-routed deployment.
3. Verify:
   - `curl -s "$QDRANT_URL/collections/gridwatch_security_guidance" -H "api-key: $QDRANT_API_KEY"`
     shows the updated `points_count`.
   - Re-run a security scan or ask the chat a question, and confirm the guidance
     reflects the new content (and a `points/query` 200 appears in the Qdrant logs).

Local development needs none of this — with `QDRANT_URL` unset, the in-memory
index rebuilds from the current corpus on every run.

The graph entries are defined in `agent/langgraph.json`:

```json
{
  "graphs": {
    "router_extraction": "./router_extraction.py:graph",
    "security_chat": "./security_chat.py:graph",
    "findings_summary": "./findings_summary.py:graph"
  }
}
```

Deploy these graphs through the LangGraph/LangSmith deployment flow, then copy the
deployment URL/API key into the Vercel environment variables. The Vercel client
accepts either the base deployment URL or a full `/runs/wait` URL and normalizes
base deployment URLs to `/runs/wait` before invoking a graph. `router_extraction`
powers screenshot extraction; `security_chat` powers the per-user security chat;
`findings_summary` turns the raw CVE/exposure results into a plain-English
assessment. If `findings_summary` is not deployed, the app falls back to a
deterministic on-server heuristic summary, so the dashboard still works.

## Data Retention Notes

This first version stores uploaded image base64 data in Neon serverless Postgres to satisfy
"save and retain all data" for the prototype. Before using real user data beyond
this controlled MVP, replace that with private object storage and a documented
retention policy.

## Security Notes

1. Never prefix secrets with `NEXT_PUBLIC_`.
2. Do not commit `.env` files.
3. Rotate the first-user setup token after account creation.
4. Keep LangGraph, OpenAI, LangSmith, and database tokens server-side only.
5. Do not enable active scans until verified public-IP target validation is in
   place.
