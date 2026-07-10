# Claude Context: GridWatch

## Rules and Guidelines

When working with this repository, follow these guidelines:

### Critical Behavior Rules
- **NEVER commit to main branch** - Always work in feature branches with prefixes (`feature/`, `bug/`, `docs/`, `wip/`)
- **NEVER hardcode** API keys, credentials, or sensitive configuration values
- **NEVER commit** credentials, API keys, or sensitive data files
- **ALWAYS ask before making destructive changes** - Deletions, replacements, or breaking changes require explicit approval
- **ALWAYS keep documentation updated with changes** - Update README.md, CLAUDE.md, and docs/ as needed
- **ALWAYS keep `CLAUDE.md` and `.windsurf/rules/` consistent** - When a rule changes in one, update the other in the same PR; they must not contradict each other
- **NEVER create public GitHub gists** - Repo contents are private/internal
- **NEVER upload repo contents, code, config, logs, or secrets to external/third-party services** (gists, pastebins, file-sharing, external APIs) without explicit user approval; any needed gist must be secret/private and approved first

### Code Style and Standards
- Preserve existing code formatting and style conventions
- Follow Python best practices (PEP 8, type hints, clear naming)
- Add comments only when necessary to explain complex logic or AI-specific decisions
- Use descriptive variable and function names
- Write self-documenting code where possible

### Making Changes
- Always run linters/formatters before committing (black, ruff, etc.)
- Validate changes with tests when applicable
- Never hardcode sensitive values (use environment variables or config files)
- Maintain backward compatibility when possible

### Communication
- Be concise and direct in explanations
- Reference specific files and line numbers when discussing code
- Explain the "why" behind AI architecture decisions
- Flag potential performance, cost, or ethical implications

### Documentation Structure
- Prefer a breakout strategy: keep the README concise and split detailed topics into separate files under `docs/`
- The README should act as an entry point/overview that links out to the relevant `docs/` files
- Do NOT accumulate every detail in the README — move deep dives (architecture, design decisions, experiments) into dedicated `docs/` files
- Each `docs/` file should cover one focused topic with a descriptive filename (e.g., `docs/architecture.md`, `docs/experiments.md`)

### AI Project Specific Rules
- **Document model choices and reasoning** - Explain why specific models or approaches were selected
- **Track experiments systematically** - Keep notes on what works and what doesn't
- **Version control prompts and configurations** - Treat prompts as code
- **Monitor costs and performance** - Be aware of API usage and optimization opportunities
- **Consider ethical implications** - Document potential biases, limitations, and safety considerations

## Repository Overview

This repository contains GridWatch, an AI project designed for AI agents and automation.

**Key Facts:**
- **Purpose**: AI-powered home network security assistant
- **Target**: Built for AI agents to interact with and extend
- **Languages**: TypeScript (Next.js web app/API, primary) and Python (agent)
- **Development**: Active development, experimental features expected

## Repository Structure

The Next.js app lives at the repo root for zero-config Vercel deploys. The
Python AI agent is isolated under `agent/` and deploys separately to
LangGraph/LangSmith.

```
.
├── .windsurf/rules/         # Windsurf AI assistant rules
├── .cursor/rules/           # Cursor AI assistant rules
├── app/                     # Next.js App Router pages, server actions, API routes
├── lib/                     # Server-side helpers (auth, db, agent client, types)
├── agent/                   # Python LangGraph router-extraction agent
├── docs/                    # Detailed documentation
├── TestExamples/            # Sample router screenshots for testing extraction
├── package.json             # Next.js dependencies and scripts
├── next.config.mjs          # Next.js config
├── tsconfig.json            # TypeScript config
├── vercel.json              # Vercel deploy config
├── CLAUDE.md               # This file - Claude AI context
└── README.md               # Project overview and quick start
```

## Working with This Repository

### Making Changes

1. Create a feature branch from `main`
2. Make your changes with clear, focused commits
3. Update documentation as needed
4. Open a PR with a clear description
5. After review and approval, merge to `main`

### Local Development

Web app (root, Next.js/TypeScript):

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

Agent (agent/, Python via uv):

```bash
cd agent
uv venv
uv pip install -e .
black .
ruff check .
```

### Common Tasks

**Adding a new feature:**
1. Create feature branch: `git checkout -b feature/your-feature-name`
2. Implement the feature with tests
3. Update relevant documentation
4. Commit and push for review

**Experimenting with AI models:**
1. Document the experiment goal in `docs/experiments.md`
2. Track costs and performance metrics
3. Record results and learnings
4. Clean up or integrate successful experiments

**Updating dependencies:**
1. Test changes thoroughly
2. Update `package.json` (web app) or `agent/pyproject.toml` (agent)
3. Document any breaking changes

## Security Considerations

- API keys and credentials must be stored in environment variables or secure config
- Never commit `.env` files or credentials
- Use `.gitignore` to prevent accidental commits of sensitive data
- Follow least-privilege principles for API access
- Monitor and log API usage for security and cost tracking

## AI Development Best Practices

- **Prompt Engineering**: Version control prompts, document what works
- **Model Selection**: Document reasoning for model choices (cost, performance, capabilities)
- **Error Handling**: Implement robust error handling for API calls and model responses
- **Rate Limiting**: Respect API rate limits and implement backoff strategies
- **Testing**: Test with various inputs, edge cases, and failure scenarios
- **Monitoring**: Track performance, costs, and quality metrics

## Useful Commands

```bash
# Development
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Code quality
black .
ruff check .
mypy .

# Testing
pytest
pytest --cov

# Git workflow
git checkout -b feature/my-feature
git add .
git commit -m "feat: descriptive message"
git push origin feature/my-feature
```

## References

- **Project Documentation**: See `docs/` directory
- **AI Best Practices**: [Link to relevant resources]
- **Python Style Guide**: PEP 8
