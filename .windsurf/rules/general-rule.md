---
trigger: always_on
description: General rules that always apply to this AI project repository.
---

## General Rules

### Git Workflow
- **Never commit directly to main branch** — always use feature/bug branches and create a PR
- **Branch naming**: Must start with a meaningful prefix followed by description
  - `feature/agent-monitoring` ✓ (clear, concise)
  - `bug/fix-api-timeout` ✓ (descriptive)
  - `wip/experiment-new-model` ✓ (work in progress)
  - `main-update` ✗ (no meaningful prefix)
  - `feature/add-support-for-multiple-llm-providers-with-fallback-and-retry-logic` ✗ (too long)
- Keep branch names concise (under ~50 chars total) but meaningful
- Always create a PR for review before merging to main

### Code & Documentation
- Write code that is self-documenting (clear names, logical structure)
- Add comments only for non-obvious decisions (the WHY, not the WHAT)
- Keep changes focused to a single feature or bug fix per PR
- Explain decisions and trade-offs clearly in PR descriptions

### AI Assistant Rules Consistency
- Keep `CLAUDE.md` and `.windsurf/rules/` consistent — when a rule or guideline changes in one, update the other in the same PR
- Both must agree on behavior rules, constraints, and repo context; neither should contradict the other

### Data Handling & Sharing
- **NEVER create public GitHub gists** — this repo and its contents are private/internal
- **NEVER upload repo contents, code, config, logs, or secrets to any external/third-party service** (gists, pastebins, file-sharing sites, external APIs) without explicit user approval
- If a gist is genuinely needed, it must be **secret/private** and explicitly approved by the user first
- Never grant or use tokens with the `gist` scope unless a task specifically requires it and the user approves

### Process
- One feature at a time — finish and merge before starting another
- Test changes locally before pushing
- Document experiments and results in `docs/experiments.md`
- Always ask before making destructive changes (deletions, replacements, breaking changes)
- Monitor API costs and usage when working with LLM providers
