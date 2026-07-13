# RAG Scoping Exercise

## Challenge Alignment

This document supports Task 3 by turning likely user questions into feature-level
RAG and tool requirements. It should be updated as the project scope changes.

## Vector Store and Embedding Choice

- **Vector store:** Qdrant, hosted on **Qdrant Cloud (free tier)** for the deployed
  prototype. In-memory Qdrant (`location=":memory:"`) is kept for local development
  and the evaluation notebooks, so the same `langchain-qdrant` API is used in both.
- **Embedding model:** OpenAI `text-embedding-3-small`.
- **Why Qdrant Cloud (free tier):** The challenge does not mandate a specific vector
  database — Task 2 only requires naming one as a component, and Task 4 requires a
  "production-grade stack" deployed to a public endpoint. A managed store satisfies
  that without re-embedding the corpus on every cold start. We chose the Qdrant Cloud
  free tier specifically **because of time restrictions**: we were already comfortable
  with the Qdrant API from in-memory use in the course, so the identical API behind a
  hosted URL + key is the lowest-friction managed option and keeps the project moving.
  A self-hosted or higher-tier deployment was deliberately deferred. This supersedes
  the earlier "ChromaDB for prototype" note in the planning docs.

## How To Use This Exercise

For each feature, decide:

1. What user questions must be answered?
2. Which facts come from tools rather than documents?
3. Which documents are trusted enough for RAG?
4. Which external APIs are needed?
5. What should be evaluated?
6. What should not be answered without more evidence?

## Feature 1: Router Setup From Screenshots

### User Questions

- Can you review my router screenshots?
- What router model and firmware version do I have?
- Do these settings show remote administration, UPnP, or port forwarding?
- What information do you still need from my router page?

### Tool Facts

- Uploaded router screenshots.
- User-entered router make, model, firmware, ISP, and router ownership context.
- Extracted text from screenshot vision/OCR.
- Extracted configuration clues such as remote administration, UPnP, DNS, Wi-Fi
  mode, guest network, and port forwarding.
- User-confirmed public router IP when available.

### RAG Corpus

- Router UI terminology.
- Firmware/version identification guidance.
- Common router configuration fields and security implications.
- Plain-English guidance for safely finding router details.

### External APIs

- No external lookup is required for screenshot extraction itself.
- Tavily can help find vendor-specific router UI documentation after user
  approval or when generic guidance is insufficient.

### Evaluation Cases

- Extracts router model and firmware only when visible or user-provided.
- Identifies configuration clues without over-claiming certainty.
- Asks for missing evidence when screenshots are incomplete.
- Avoids exposing or logging raw screenshots unnecessarily.

## Feature 2: Public IP Exposure Scan

### User Questions

- Is my home network exposed to the internet?
- What ports and services are visible from outside my home?
- Is my router admin page exposed externally?
- What does it mean if port 80, 443, 22, 23, 3389, or 8080 is open?

### Tool Facts

- Verified router public IP for the assessment session.
- Explicit user approval for the scan.
- Externally visible ports and common service banners.
- Scan timestamp and scan intensity profile.

### RAG Corpus

- Plain-English port and service risk guide.
- Router firewall and port forwarding explanation.
- Remote administration risk guidance.
- Safe next steps for closing exposed services.

### External APIs

- Active exposure scan against only the verified router public IP.
- No arbitrary public IP, domain, or CIDR scan support.

### Evaluation Cases

- Refuses arbitrary internet scan requests.
- Requires explicit approval before external exposure scans.
- Explains exposed services without overstating certainty.
- Recommends router UI checks rather than destructive changes.

## Feature 3: Passive External Intelligence

### User Questions

- Has my public IP appeared in public security intelligence?
- Do other services already see open ports on my router?
- Is my public IP associated with abuse or suspicious activity?
- Have any home-network-related accounts appeared in breaches?

### Tool Facts

- User-approved public IP intelligence results.
- Source name, source timestamp, and confidence/limitations.
- Shodan/Censys/InternetDB/GreyNoise-style service observations when available.
- AbuseIPDB-style reputation results when appropriate.
- HaveIBeenPwned breach results for explicit user-provided email/account context.

### RAG Corpus

- Passive intelligence source interpretation guide.
- Confidence and stale-data explanation for public internet datasets.
- Public-IP reputation interpretation guidance.
- Account breach and password reuse guidance.

### External APIs

- Shodan, Censys, InternetDB, GreyNoise, AbuseIPDB, and HaveIBeenPwned as API
  access and user approval allow.
- Tavily for current source discovery or vendor-specific context.

### Evaluation Cases

- Explains source limitations and timestamps.
- Does not treat passive intelligence as proof of compromise by itself.
- Does not query HIBP without explicit user-provided account context.
- Never sends private LAN IPs to reputation services.

## Feature 4: Router Firmware/Model CVE Lookup

### User Questions

- Is my router firmware vulnerable?
- Are there known security issues for my router model?
- What does this CVE mean for me?
- Does this vulnerability affect my specific firmware version?

### Tool Facts

- Router vendor, model, hardware revision, and firmware version from screenshots
  or user-provided setup details.
- CPE if resolvable.
- CVE records from NVD.
- CVSS score, publication date, last modified date, and affected products.
- Vendor advisory details from Tavily or vendor sources when needed.

### RAG Corpus

- CVE interpretation guide for non-technical users.
- Router remediation patterns.
- Vendor/model identification guidance.
- Project-owned summaries for common consumer router risk patterns.

### External APIs

- NIST NVD API.
- Tavily only when NVD and curated docs are insufficient or vendor advisory
  freshness matters.

### Evaluation Cases

- Uses NVD for live vulnerability claims.
- Does not claim a router is affected unless model/version evidence supports that
  conclusion.
- Explains severity and next action in plain English.
- Distinguishes firmware update advice from unsupported exploit details.

## Feature 5: Final AI Guidance

### User Questions

- What should I do first to secure my home network?
- Which finding matters most?
- How do I fix exposed services or risky router settings?
- Should I update my router firmware?
- What should I ask my ISP or router vendor?

### Tool Facts

- Screenshot-derived router facts.
- Active external exposure scan findings.
- Passive external intelligence findings with source timestamps.
- NVD CVE findings.
- Tavily/vendor guidance where needed.
- User constraints and confirmations.

### RAG Corpus

- CISA home network guidance.
- OWASP IoT guidance.
- CIS controls or benchmarks relevant to home routers.
- Wi-Fi security protocol guidance.
- Project-authored hardening checklist with citations.

### External APIs

- No new source is required; this feature synthesizes all prior tool outputs and
  retrieved guidance.

### Evaluation Cases

- Returns prioritized, realistic actions.
- Avoids unexplained jargon.
- Differentiates high-impact tasks from nice-to-have improvements.
- Does not ask users to perform risky actions without warnings.
- Clearly separates confirmed facts, likely interpretations, and unknowns.

## Future Feature: Local Device Inventory

### User Questions

- What devices are currently on my network?
- Did anything new join my network?
- Is this IoT device safe to keep connected?

### Tool Facts

- Future local scanner, router integration, or appliance output.
- Local IP, hostname, vendor, open local ports, first seen, and last seen.

### RAG Corpus

- Device category and local scanning guidance.
- Common IoT risk categories.

### External APIs

- Prefer local OUI data in a future local scanner.

### Evaluation Cases

- Deferred until local scanning is implemented.

## Cross-Feature RAG Questions

Before implementation, answer these:

1. Which sources are authoritative enough for each feature?
2. Which data needs freshness timestamps?
3. Which claims require tool evidence rather than RAG evidence?
4. Which user identifiers must be redacted before model calls?
5. Which answers need confidence levels?
6. Which tasks need approval before any tool call?
7. Which test questions should be in the first 50-case evaluation set?
