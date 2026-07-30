# GridWatch — Demo Day Slide Outline (generator-ready)

Paste-ready outline for a slide generator (PowerPoint Copilot, Gamma, Beautiful.ai,
etc.). Each slide has an **on-slide** block (title + concise bullets) and **speaker
notes** (what to say). Keep bullets short — let the notes carry the detail. ~12 slides;
trim the "how it's built" or roadmap slides first if the deck runs long.

Working notes, not committed with the code. Fill the `⟨…⟩` placeholders before generating.

---

## Slide 1 — Title
**On-slide:**
- GridWatch
- AI home-network security for people who aren't security experts
- ⟨Your name⟩ · AIE Certification Challenge · ⟨date⟩

**Speaker notes:** One line — "GridWatch turns a confusing pile of router and network
security data into a plain-English, prioritized action list for a non-technical home user."

---

## Slide 2 — The problem
**On-slide:**
- Home networks keep getting more complex (IoT, smart home, remote work)
- The average user can't tell if their router/config/exposure is a risk
- Security tooling exists — but it's built for experts, not households

**Speaker notes:** Most people set up the router once and forget it. Meanwhile firmware
goes stale, ports get left open, and attackers scan the whole internet automatically. A
compromised router is a gateway to every device in the home — cameras, laptops, even a
smart lock. The evidence a user would need is fragmented and technical, so they do nothing.

---

## Slide 3 — The audience
**On-slide:**
- Primary: non-technical home network owner
- Can set up Wi-Fi and apps; does NOT read CVEs or run scanners
- Wants a clear answer: "Am I OK, and what do I fix first?"

**Speaker notes:** This framing drives every product decision — external-first (no
software to install), plain-English output, and safety rails so we never break their
internet or scan something we shouldn't.

---

## Slide 4 — The solution
**On-slide:**
- Upload a router screenshot → GridWatch extracts the facts (vision AI)
- Read-only checks: known vulnerabilities, internet exposure, IP reputation
- Plain-English risk + prioritized fixes, grounded in trusted security sources
- Chat for follow-ups · recurring scans with email alerts

**Speaker notes:** No agents on the LAN, no appliance. Everything runs from the browser.
The agent reads the screenshot, we run read-only external checks, and an LLM grounded in a
curated corpus writes the explanation. New since the last cut: an IP-reputation signal and
opt-in recurring monitoring.

---

## Slide 5 — Architecture (as built)
**On-slide:**
- Next.js on Vercel = orchestrator + deterministic guardrails
- LangGraph Platform hosts 3 agent graphs (extraction, chat, summary), traced by LangSmith
- Tools: NIST NVD, Shodan InternetDB, AbuseIPDB · RAG in Qdrant · OpenAI via Vercel AI Gateway
- Neon Postgres for memory · Vercel Cron for recurring scans
- ⟨paste the README infrastructure mermaid diagram as the slide image⟩

**Speaker notes:** Key point for graders: the Vercel server layer calls the read-only
tools directly and enforces guardrails; the LangGraph graphs do extraction, chat, and the
RAG-grounded summary. Every agent run is traced in LangSmith.

---

## Slide 6 — Live demo: extraction (part 1)
**On-slide:**
- Upload a real router screenshot
- Profile auto-fills: vendor, model, firmware, settings
- Prove it: open the LangSmith trace of the extraction run

**Speaker notes:** "The screenshot was read by a vision model running as a LangGraph
agent — no typing." Show the fresh `router_extraction` trace: the image in, structured
output out, latency.

---

## Slide 7 — Live demo: clean scan + cost guardrail (part 2)
**On-slide:**
- Run checks on the benign profile → "No urgent problems found"
- NVD + InternetDB + AbuseIPDB all came back clean
- Cost guardrail: clean scan skips the paid LLM summary (deterministic result)

**Speaker notes:** Note the guardrail — we don't spend tokens explaining "all clear." Only
a non-clean scan triggers the LLM. Good place to show the Qdrant request logs are quiet
here (no retrieval needed on a clean scan).

---

## Slide 8 — Live demo: the bad scan (part 3, the money shot)
**On-slide:**
- Switch to a known-bad IP / vulnerable model (⟨D-Link DIR-859, IP 45.33.32.156⟩)
- Exposed ports + real CVEs + poor IP reputation → HIGH risk
- Plain-English summary with prioritized, non-technical fixes
- "See full technical details" → raw NVD / InternetDB / AbuseIPDB JSON

**Speaker notes:** This is the core value: a firehose of CVEs, ports, and an abuse score
becomes "here's what's wrong and what to do first, in order." Show the raw-JSON toggle to
prove the tools really ran, then contrast with the friendly summary. Call out the new
AbuseIPDB line — a bad reputation can mean a device on the network is compromised.

---

## Slide 9 — Live demo: recurring scans + email (part 4, NEW)
**On-slide:**
- Toggle "run this scan automatically once a day" + notification email
- "Run scan & email now" → preview the exact summary email
- Runs on Vercel Cron in production (CRON_SECRET-protected)

**Speaker notes:** Set-and-forget monitoring is what a real household needs — you won't log
in daily. Click "Run now" to show the generated email payload live. Be transparent:
delivery is stubbed for the demo (logged + shown in the UI); swapping in Resend/SES is a
one-function change. The cron path re-runs the same checks for every opted-in user.

---

## Slide 10 — How we know it works (evals)
**On-slide:**
- RAGAS metrics (LLM-as-judge), run + tracked in LangSmith
- Faithfulness / Context Recall / Answer Accuracy on a committed test set
- Advanced retrieval: hybrid (dense + BM25 + RRF)
- Biggest win: grounded answer prompt — faithfulness 0.43 → 0.81 (+0.39)

**Speaker notes:** We didn't just ship — we measured. The grounded-prompt change is the
headline: a large, evidence-backed jump in how faithful answers are to the trusted corpus,
proven with the same harness. Show the LangSmith experiment view if time allows.

---

## Slide 11 — Why it works / differentiators
**On-slide:**
- External-first: nothing to install, safe by default (read-only, private IPs rejected)
- Grounded in authoritative sources (NIST, NSA, CISA, OWASP, FTC, FBI IC3, Wi-Fi Alliance)
- Plain-English, prioritized — built for the non-expert
- Traceable + evaluated end to end (LangSmith + RAGAS)

**Speaker notes:** The combination is the moat: safety rails + grounded guidance + a
consumer-friendly explanation, all observable and tested.

---

## Slide 12 — Roadmap & close
**On-slide:**
- Next: real email delivery, change-only alerts, active (approved) scan, public-IP ownership check
- Later: breach checks (HIBP), local device inventory, privacy hardening
- Call to action: ⟨deployed URL⟩ · ⟨repo / deliverables.md link⟩

**Speaker notes:** Close on the vision — bring enterprise-grade visibility to the home
user, responsibly. Point to the live app and the deliverables doc for the full traceability.

---

## Appendix — pre-demo checklist (don't slide; keep handy)
- Prod healthy: Vercel app + LangGraph revision (corpus ingested, `points_count` > 0)
- `ABUSEIPDB_API_KEY` set in prod so the reputation line shows real data
- `CRON_SECRET` set; recurring toggle saved with a notify email
- Tabs open: app dashboard · LangSmith traces · Qdrant metrics · LangSmith eval experiment
- One warm-up scan + chat so cold starts don't stall the live run
- Known-bad values ready (⟨model / IP⟩); know how to restore the good profile after
