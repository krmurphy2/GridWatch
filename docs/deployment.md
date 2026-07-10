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
      -> hosted LangGraph router extraction agent
          -> Anthropic vision-capable model
      -> LangSmith tracing/evaluation
```

The browser never calls Anthropic, LangGraph, LangSmith, Shodan, Tavily, or other
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
USE_MOCK_AGENT="false"
```

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
ANTHROPIC_API_KEY="your-anthropic-api-key"
LANGSMITH_API_KEY="your-langsmith-api-key"
LANGSMITH_TRACING="true"
LANGSMITH_PROJECT="gridwatch-router-extraction"
ANTHROPIC_MODEL="claude-3-5-sonnet-20241022"
```

The graph entry is defined in `agent/langgraph.json`:

```json
{
  "graphs": {
    "router_extraction": "./router_extraction.py:graph"
  }
}
```

Deploy this graph through the LangGraph/LangSmith deployment flow from the course,
then copy the deployment URL/API key into the Vercel environment variables. The
Vercel client accepts either the base deployment URL or a full `/runs/wait` URL and
normalizes base deployment URLs to `/runs/wait` before invoking the graph.

## Data Retention Notes

This first version stores uploaded image base64 data in Neon serverless Postgres to satisfy
"save and retain all data" for the prototype. Before using real user data beyond
this controlled MVP, replace that with private object storage and a documented
retention policy.

## Security Notes

1. Never prefix secrets with `NEXT_PUBLIC_`.
2. Do not commit `.env` files.
3. Rotate the first-user setup token after account creation.
4. Keep LangGraph, Anthropic, LangSmith, and database tokens server-side only.
5. Do not enable active scans until verified public-IP target validation is in
   place.
