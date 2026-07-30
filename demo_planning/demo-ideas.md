# GridWatch Demo — Idea Capture (working notes, NOT committed)

Scratch list of things to include when we build the 10-minute demo script. The
goal of the demo is to walk the GridWatch workflow and, at each step, pause to
prove the infrastructure (LangSmith / Qdrant / backend) was actually used.

## Ideas to include

- [ ] **Show chat guardrails** — and prove the request did **not** hit the LLM
      (e.g., off-topic/injection message returns instantly; no new LangSmith trace,
      no Qdrant query, no token spend).
- [ ] **Show LangSmith tracing** — open a real agent run and walk the trace.
- [ ] **Show Qdrant** — prove the cluster is getting hit (collection points +
      `points/query` 200 in the Qdrant request logs during a live chat/scan).
- [ ] **Show the human workflow** with deliberate pauses to jump to the metrics /
      backend at each step (setup → dashboard → scan → chat).
- [ ] **Show a clean scan** — nothing found; note the LLM summary was skipped
      (cost guardrail) and the heuristic "all clear" was used.
- [ ] **Update IP to a known-bad IP** and show the "bad" scan results
      (exposed ports / flagged vulns → high-risk assessment).
- [ ] **Show the raw technical tool output** — what the CVE/exposure data looks
      like before the LLM turns it into plain English (the "see full technical
      details" view vs. the friendly summary).

## Notes / TODO for the script

- Sequence these into a ~10-minute flow with timing.
- Final segment: show some of the code if time allows.
- Decide which known-bad IP to use for the demo (needs a public IP with real
  exposed services in InternetDB; do not scan anything we don't own — use a
  documented test/lab IP or a Shodan-known host for read-only passive lookup).
