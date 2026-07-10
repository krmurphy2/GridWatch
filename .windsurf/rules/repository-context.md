---
trigger: always_on
description: Repo-specific context for GridWatch (AI monitoring and automation system).
---

# Repository Context

## Overview
**Purpose**: AI-powered home network security assistant with a Vercel-hosted
web app/API and a separately deployed AI extraction agent

**Languages**: TypeScript (Next.js web app/API, primary) and Python (agent)

**Development Stage**: Active development, experimental features expected

## Key Technologies
- Next.js 14 (App Router) + React 18 for the frontend/API at repo root
- Neon serverless Postgres for persistence (via `@neondatabase/serverless`)
- Python 3 LangGraph agent deployed to LangGraph/LangSmith
- OpenAI (gpt-5.1) for router screenshot extraction

## Project Structure
The Next.js app lives at the repo root (zero-config Vercel deploy). The Python
AI agent is isolated under `agent/`.
```
app/           - Next.js App Router pages, server actions, and API routes
lib/           - Server-side helpers (auth, db, agent client, types)
agent/         - Python LangGraph router-extraction agent (deployed separately)
docs/          - Detailed documentation and experiments
TestExamples/  - Sample router screenshots for testing extraction
package.json, next.config.mjs, tsconfig.json, vercel.json - Next.js/Vercel config at root
```

## Development Principles
- **AI-First Design**: Built for AI agents to interact with and extend
- **Experimentation**: Track experiments systematically in docs/
- **Cost Awareness**: Monitor and optimize API usage
- **Documentation**: Version control prompts and configurations
- **Ethical AI**: Consider biases, limitations, and safety

## Important Constraints
- API keys and credentials must never be committed
- All sensitive config goes in environment variables
- Document model choices and reasoning
- Track costs and performance metrics

## Useful Commands

### Web App (root, Next.js/TypeScript)
```bash
# Install dependencies
npm install

# Local dev (file-backed store + mock agent)
npm run setup:local
npm run dev:local

# Lint, type check, and build
npm run lint
npm run typecheck
npm run build
```

### Agent (agent/, Python)
```bash
# Set up environment with uv
cd agent
uv venv
uv pip install -e .

# Format and lint
black .
ruff check .
```

## Security Considerations
- Use environment variables for API keys
- Never commit `.env` files
- Follow least-privilege for API access
- Monitor API usage for security and cost
