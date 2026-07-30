# Local Development

## Purpose

This guide runs the first GridWatch slice locally without Vercel Postgres or a
hosted LangGraph deployment. Local mode uses a file-backed development store and
mock router extraction so the UI/auth/profile flow can be tested first.

## Prerequisites

Install Node.js 20 or newer on your machine.

Check your toolchain:

```bash
node --version
npm --version
```

## Local Environment

Create a local env file from the template:

```bash
npm run setup:local
```

The default local env uses:

```bash
USE_LOCAL_FILE_DB="true"
LOCAL_DATA_PATH=".data/gridwatch-local.json"
FIRST_USER_SETUP_TOKEN="local-first-user-token"
USE_MOCK_AGENT="true"
LANGGRAPH_ASSISTANT_ID="router_extraction"
```

This means:

1. No Vercel Postgres connection is required.
2. Local user/session/router profile data is stored in `.data/gridwatch-local.json`.
3. Router screenshot extraction uses mock output until a hosted LangGraph URL is configured.
4. The first-user setup token for local development is `local-first-user-token`.

Optional extras for the security tools (all degrade gracefully if unset):

```bash
# Enables the AbuseIPDB IP-reputation check; the scan skips reputation without it.
ABUSEIPDB_API_KEY="your-abuseipdb-api-key"
# Needed only to exercise the recurring-scan cron route locally. Call it with:
#   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/recurring-scan
CRON_SECRET="local-cron-secret"
```

The recurring-scan email is stubbed locally: the payload is printed to the server
console and shown on the dashboard (no real email is sent).

## Install and Run

Install dependencies:

```bash
npm install
```

Start the Next.js development server:

```bash
npm run dev:local
```

Open:

```text
http://localhost:3000
```

Create the first local user with:

```text
setup token: local-first-user-token
```

## Reset Local Data

Stop the dev server and remove the local data file:

```bash
rm -f .data/gridwatch-local.json
```

Then restart the app and create a new first user.

## Optional Hosted Agent Test

After deploying the LangGraph router extraction graph, update `.env.local`:

```bash
USE_MOCK_AGENT="false"
LANGGRAPH_DEPLOYMENT_URL="https://your-langgraph-deployment-url"
LANGGRAPH_API_KEY="your-langgraph-api-key"
LANGGRAPH_ASSISTANT_ID="router_extraction"
```

The browser still does not call LangGraph or OpenAI directly. The Next.js server
calls the hosted graph from server-side code.

## Validation

Run these before deploying:

```bash
npm run lint
npm run typecheck
npm run build
```

This workspace currently lacks Node/npm, so these commands must be run on a
machine with Node installed.
