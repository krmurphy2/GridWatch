---
trigger: glob
description: Rules for authoring documentation in this AI project repository.
globs: *.md, docs/**/*.md
---

## Documentation Rules

### Documentation Structure
- Prefer a breakout strategy: keep the README concise and split detailed topics into separate files under `docs/`
- The README should act as an entry point/overview that links out to the relevant `docs/` files
- Do NOT accumulate every detail in the README — move deep dives (architecture, experiments, model evaluations) into dedicated `docs/` files
- Each `docs/` file should cover one focused topic with a descriptive filename (e.g., `docs/architecture.md`, `docs/experiments.md`)

### README.md & General Docs
- Documentation should be clear, technical, and accurate for AI/ML context
- Use code examples to illustrate patterns (e.g., API usage, agent workflows)
- Include context about when/why to use specific models or approaches
- Document cost implications and performance characteristics
- Keep docs up-to-date with AI architecture changes

### Markdown Format
- Use consistent heading hierarchy (# for title, ## for sections)
- Include table of contents for longer docs
- Use code blocks for commands, configuration, and examples
- Link to relevant files with relative paths (e.g., `src/agents/monitor.py`)
- Avoid overly long lines; wrap at ~80 chars for readability
