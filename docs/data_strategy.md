# Data Strategy

## Challenge Alignment

This document supports Task 3 by describing data sources, external APIs, default
chunking strategy, and how RAG data interacts with agent tools.

## Data Principle

The RAG corpus should be scoped by feature and tool. A single generic knowledge
base would mix long-lived best practices, fast-changing vulnerability facts,
router screenshot evidence, public exposure findings, passive intelligence, and
user-specific assessment memory. Each data type needs different freshness,
metadata, privacy, and evaluation rules.

## Data Classes

| Data Class | Examples | Storage | Freshness Need |
| --- | --- | --- | --- |
| Trusted guidance | CISA home network guidance, OWASP IoT risks, router hardening docs | RAG corpus | Review periodically. |
| Router evidence | Uploaded screenshots, extracted router model, firmware, UPnP/remote-admin clues | Assessment memory | Updated per user upload. |
| Vulnerability facts | CVEs, CVSS, affected products, CPEs | NVD API plus optional cache | Fresh or cached with timestamps. |
| Active external exposure | Verified public IP, exposed ports, service banners, scan timestamp | Assessment memory | Updated only after approved scan. |
| Passive external intelligence | Shodan/Censys/InternetDB/GreyNoise/AbuseIPDB/HIBP results | Ephemeral or user-approved cache | Fresh per query with source timestamp. |
| Web search snippets | Current threat news or vendor advisories | Ephemeral or cited cache | Fresh per query. |
| Evaluation data | Test questions, expected tools, expected evidence | Repo fixtures | Version controlled. |

## Feature-Scoped Corpus Plan

| Feature | RAG Corpus | Tool Data | Notes |
| --- | --- | --- | --- |
| Router setup from screenshots | Router UI terminology, firmware/version identification, common configuration fields | Vision/OCR extraction and structured setup form | Tool extracts facts; RAG explains what fields mean. |
| Public IP exposure scan | Port/service risk guide, router firewall basics, remote administration risks | Approved scan results against verified router public IP | Active scan scope must stay narrow. |
| Passive external intelligence | Source interpretation guide, confidence/limitations for public intelligence | Shodan, Censys, InternetDB, GreyNoise, AbuseIPDB, HIBP where approved | Used to enrich, not replace, direct scan evidence. |
| Router firmware/model CVE lookup | CVE interpretation guides, device naming/CPE guidance, remediation patterns | NVD API, Tavily, optional vendor advisories | NVD remains authoritative for CVE facts. |
| Plain-English remediation | CISA, CIS, OWASP IoT, Wi-Fi security guidance | Router evidence, scan findings, CVEs, passive intelligence | Final AI synthesis should prioritize actionability. |
| Local device inventory | Device category and local scanning guidance | Future local scanner or router integration | Deferred until after MVP. |

## Initial Trusted Sources

Potential sources for the MVP corpus:

1. CISA guidance for home networks and securing connected devices.
2. OWASP IoT Top 10 or current OWASP IoT guidance.
3. CIS Controls guidance relevant to home routers and wireless networks.
4. NIST consumer/home networking guidance where directly applicable.
5. Project-owned summaries for Wi-Fi security, router hardening, and common
   risky ports.

Project-owned summaries should cite the source documents they are derived from.
They are useful when authoritative material is too technical for non-technical
users.

## External APIs

| API | Role | Interaction With RAG |
| --- | --- | --- |
| NIST NVD API | Live CVE lookup by CVE ID, keyword, router model, firmware, or CPE | RAG explains impact and remediation in accessible language. |
| Tavily | Fresh public search when curated corpus is insufficient | Search results must be cited and treated as less trusted than curated docs/NVD. |
| Shodan, Censys, or InternetDB | Passive public-IP exposure intelligence | RAG explains source limitations and service/port meaning. |
| GreyNoise | Public-IP background noise and internet scanning context | RAG explains whether context is relevant to a home router. |
| AbuseIPDB | Public-IP reputation context | RAG explains confidence and avoids over-claiming compromise. |
| HaveIBeenPwned | User-approved email/account breach exposure checks | RAG explains password reuse and account hygiene guidance. |
| External IP service | Helps determine the user's public router IP from browser/request context | Enables approved external exposure checks only. |

See `docs/external_intelligence_sources.md` for source prioritization and privacy
rules for passive intelligence providers.

## Default Chunking Strategy

Use recursive character splitting with semantic boundary awareness.

Initial settings:

| Setting | Value |
| --- | --- |
| Chunk size | Approximately 512 tokens |
| Chunk overlap | Approximately 64 tokens |
| Preferred separators | Headings, subheadings, paragraphs, lines, spaces |
| Metadata | Source, section title, URL or file path, document type, freshness date |

Reasoning:

Security documentation is structured around sections, procedures, risk categories,
and remediation steps. Splitting on headings and paragraphs keeps complete advice
units together while still making retrieval precise.

For CVE summary documents, each CVE entry should be its own chunk with metadata
for CVE ID, affected products, CVSS score, source, and publication/update date.

## Retrieval Design

Baseline retrieval:

1. Embed trusted guidance chunks.
2. Retrieve top relevant chunks for the user query.
3. Synthesize an answer with citations.

Improved retrieval for Task 6:

1. Combine dense retrieval with keyword/BM25 retrieval.
2. Prioritize exact matches for CVE IDs, port numbers, protocols, and model names.
3. Rerank the merged result set if evaluation shows enough benefit.
4. Compare before/after metrics in the evaluation harness.

## Data Handling Restrictions

1. Do not commit real user screenshots, scan data, passive intelligence results,
   or account exposure data.
2. Do not log API keys, credentials, router admin secrets, or full raw screenshots.
3. Store normalized screenshot-derived facts where possible instead of raw images.
4. Do not query reputation APIs with private LAN IPs.
5. Do not use arbitrary public IPs, domains, or CIDR ranges from chat as scan
   targets.
6. Query HaveIBeenPwned only with explicit user-provided account context and
   approval.
7. Use synthetic or sanitized screenshot, scan, and passive-intelligence fixtures
   for tests and demos.

## Open Questions

1. Which exact source documents should be in the first RAG corpus?
2. Should project-owned summaries be hand-authored first or generated from source
   documents and reviewed?
3. Which embedding model should be used for MVP?
4. What metadata schema should assessment memory use for screenshot-derived facts,
   scan results, passive intelligence, and CVE findings?
5. How often should cached NVD and passive-intelligence results refresh?
6. Which passive intelligence providers are required for MVP versus optional?
