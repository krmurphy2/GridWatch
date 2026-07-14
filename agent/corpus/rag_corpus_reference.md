# GridWatch RAG Corpus — Source Reference

**Updated:** July 14, 2026
**Purpose:** Provenance catalog for the reference documents ingested into the RAG
corpus. Every entry corresponds to an actual PDF present in `agent/corpus/`.
**Vector Store:** Qdrant Cloud | **Embedding:** `text-embedding-3-small` | **Chunking:** recursive character split, 900/120, markdown-aware separators

> All sources are **local PDFs** in `agent/corpus/` (web articles were saved to
> PDF), so ingestion is a uniform PDF read. Documents from the original
> deep-research catalog that could not be obtained were removed and the remaining
> docs renumbered contiguously — see "Removed sources" at the bottom.

---

## Document Catalog

### DOC-001 — NIST IR 8425A: Consumer IoT Cybersecurity — Profile for Router Requirements

| Field | Value |
|---|---|
| **Organization** | NIST |
| **Local file** | `nist-ir-8425a-router-profile.pdf` |
| **Document Type** | PDF |
| **Publish Date** | 2024-09 |
| **Source URL** | https://nvlpubs.nist.gov/nistpubs/ir/2024/NIST.IR.8425A.pdf |
| **License** | Public domain (U.S. Government) |
| **Living Document?** | No — versioned |

**Coverage:** router-specific consumer security baseline, admin auth, firmware
update and network-segmentation requirements. Most authoritative router reference.
**Tags:** `nist`, `consumer-router`, `baseline-requirements`, `firmware`, `admin-auth`, `hardening`

### DOC-002 — NSA CSI: Best Practices for Securing Your Home Network

| Field | Value |
|---|---|
| **Organization** | NSA (with CISA) |
| **Local file** | `nsa-securing-home-network.pdf` |
| **Document Type** | PDF |
| **Publish Date** | 2023-02-22 |
| **Source URL** | https://media.defense.gov/2023/Feb/22/2003165170/-1/-1/0/CSI_BEST_PRACTICES_FOR_SECURING_YOUR_HOME_NETWORK.PDF |
| **License** | Public domain (U.S. Government) |
| **Living Document?** | No — point-in-time CSI |

**Coverage:** consumer-friendly router hardening checklist, WPA2/WPA3, guest
network, remote-management disable, firmware updates. Closest to GridWatch's voice.
**Tags:** `nsa`, `home-network`, `hardening-checklist`, `wpa3`, `remote-management`, `consumer-guide`

### DOC-003 — CISA Project Upskill, Module 5: Securing Your Home Wi-Fi

| Field | Value |
|---|---|
| **Organization** | CISA |
| **Local file** | `cisa-project-upskill-module5-home-wifi.pdf` |
| **Document Type** | PDF (saved web page) |
| **Publish Date** | 2024–2025 (living page, snapshot) |
| **Source URL** | https://www.cisa.gov/audiences/high-risk-communities/projectupskill/module5 |
| **License** | Public domain (U.S. Government) |
| **Living Document?** | Yes — re-snapshot periodically |

**Coverage:** plain-English home-network basics for the general public; strong
"explain it to me" anchor. **Tags:** `cisa`, `project-upskill`, `consumer-education`, `plain-language`

### DOC-004 — OWASP IoT Security Testing Guide (ISTG)

| Field | Value |
|---|---|
| **Organization** | OWASP Foundation |
| **Local file** | `owasp-iot-security-testing-guide.pdf` |
| **Document Type** | PDF |
| **Publish Date** | 2024 (v1.0, in progress) |
| **Source URL** | https://owasp.org/www-project-iot-security-testing-guide/ |
| **License** | CC BY-SA 4.0 (attribution + share-alike) |
| **Living Document?** | Yes — actively maintained |

**Coverage:** IoT/router security testing methodology; port/service risk framework;
authentication and firmware analysis. Supersedes the deprecated OWASP IoT Top 10 (2018).
**Tags:** `owasp`, `iot-testing`, `istg`, `port-analysis`, `firmware-analysis`

### DOC-005 — Wi-Fi Alliance WPA3 Specification v3.5

| Field | Value |
|---|---|
| **Organization** | Wi-Fi Alliance |
| **Local file** | `wifi-alliance-wpa3-specification-v3.5.pdf` |
| **Document Type** | PDF |
| **Publish Date** | 2025 |
| **Source URL** | https://www.wi-fi.org/file/wpa3-specification |
| **License** | Wi-Fi Alliance document — committed unmodified for reference use |
| **Living Document?** | No — versioned spec |

**Coverage:** WPA3-Personal/Enterprise, SAE handshake, PMF, transition mode.
Sections 2–4 highest value; skip appendices/test vectors.
**Tags:** `wifi-alliance`, `wpa3`, `sae`, `pmf`, `encryption-standard`

### DOC-006 — FBI IC3 PSA: Cyber Criminal Proxy Services Exploiting End-of-Life Routers

| Field | Value |
|---|---|
| **Organization** | FBI / IC3 |
| **Local file** | `fbi-ic3-eol-routers-proxy-2025.pdf` |
| **Document Type** | PDF (saved web PSA) |
| **Publish Date** | 2025-05-07 (Alert I-050725-PSA) |
| **Source URL** | https://www.ic3.gov/PSA/2025/PSA250507 |
| **License** | Public domain (U.S. Government) |
| **Living Document?** | No — archived PSA |

**Coverage:** active exploitation of end-of-life SOHO routers, proxy botnets, and
mitigation (update/replace EOL devices). Avoid embedding volatile IOCs.
**Tags:** `fbi`, `ic3`, `soho-router`, `end-of-life`, `botnet`, `2025-threat`

### DOC-007 — FTC Consumer Advice: How To Secure Your Home Wi-Fi Network

| Field | Value |
|---|---|
| **Organization** | FTC |
| **Local file** | `ftc-secure-home-wifi.pdf` |
| **Document Type** | PDF (saved web article) |
| **Publish Date** | 2024 (last reviewed; living) |
| **Source URL** | https://consumer.ftc.gov/articles/how-secure-your-home-wi-fi-network |
| **License** | Public domain (U.S. Government) |
| **Living Document?** | Yes — re-snapshot annually |

**Coverage:** lowest-technical-depth, plain-language router/Wi-Fi basics; the "floor"
for explanation complexity and voice calibration. **Tags:** `ftc`, `consumer-guide`, `home-wifi`, `plain-language`

### DOC-008 — FIRST CVSS v4.0 User Guide

| Field | Value |
|---|---|
| **Organization** | FIRST (Forum of Incident Response and Security Teams) |
| **Local file** | `first-cvss-v40-user-guide.pdf` |
| **Document Type** | PDF |
| **Publish Date** | CVSS v4.0 released 2023-11; guide doc v1.2, 2025-11-16 |
| **Source URL** | https://www.first.org/cvss/v4-0/cvss-v40-user-guide.pdf |
| **License** | Free to use (FIRST) — attribution to FIRST.org |
| **Living Document?** | Yes — revised with v4.0 updates |

**Coverage:** how to *read* a CVSS score — metric groups (Base/Threat/Environmental/
Supplemental), severity bands, v4.0 nomenclature. Lets the agent explain *why* a
CVE's score is what it is. Fills the CVE-interpretation gap.
**Tags:** `first`, `cvss`, `cvss-v4`, `severity`, `cve-interpretation`

### DOC-009 — FIRST CVSS v4.0 Specification

| Field | Value |
|---|---|
| **Organization** | FIRST |
| **Local file** | `first-cvss-v40-specification.pdf` |
| **Document Type** | PDF |
| **Publish Date** | CVSS v4.0 released 2023-11; spec doc v1.2, 2024-06-18 |
| **Source URL** | https://www.first.org/cvss/v4-0/cvss-v40-specification.pdf |
| **License** | Free to use (FIRST) — attribution to FIRST.org |
| **Living Document?** | No — versioned spec |

**Coverage:** authoritative definitions of every CVSS metric and vector component.
Metric-definitions section is the high-value part; skip the scoring-equation appendix.
**Tags:** `first`, `cvss`, `cvss-v4`, `vector-string`, `scoring`

---

## Coverage Gap Analysis

| Feature Area | Primary Docs | Status |
|---|---|---|
| Router UI terminology / hardening | DOC-001, DOC-002 | ✅ Good |
| Port & service risk guidance | DOC-004, DOC-002 | ✅ Good |
| Plain-English remediation | DOC-002, DOC-003, DOC-007 | ✅ Strong |
| Wi-Fi encryption (WPA2/WPA3) | DOC-005, DOC-002 | ✅ Good |
| CVE / CVSS interpretation | DOC-008, DOC-009 | ✅ Now covered (was the main gap) |
| Threat / EOL-router context | DOC-006 | ✅ Adequate |
| Authentication best practices | DOC-001, DOC-002 | 🟡 Partial (NIST SP 800-63B was removed — re-add if desired) |

**Note:** the CVSS docs (DOC-008/009) close the previously-thin CVE-interpretation
gap. Live NVD API lookup still supplies per-CVE details, translated to plain English
by the LLM (OpenAI via the Vercel AI Gateway).

---

## Ingestion Notes

- **Uniform:** all sources are local PDFs in `agent/corpus/`; ingest via the PDF loader.
- **Metadata:** `rag_corpus_reference.csv` is the ingestion manifest (`local_filename`
  → provenance). The loader should attach `doc_id`, `title`, `organization`,
  `publish_date`, `source_url`, `license`, and an `ingestion_date` stamp to each
  chunk's Qdrant payload so citations show the real title/date/link.
- **Re-ingest** after any corpus change (`ingest.py`) — see `docs/deployment.md` →
  "Updating the RAG corpus".
- **Exclude from ingestion:** `rag_corpus_reference.md`, `rag_corpus_reference.csv`,
  and `SOURCES.md` are provenance, not corpus content.

## Metadata Schema (per chunk, Qdrant payload)

```json
{
  "doc_id": "DOC-001",
  "title": "NIST IR 8425A: Consumer IoT Cybersecurity — Profile for Router Requirements",
  "organization": "NIST",
  "publish_date": "2024-09",
  "source_url": "https://nvlpubs.nist.gov/nistpubs/ir/2024/NIST.IR.8425A.pdf",
  "license": "Public domain (U.S. Government)",
  "document_type": "pdf",
  "tags": ["nist", "consumer-router", "hardening"],
  "ingestion_date": "2026-07-14",
  "living_document": false
}
```

## What NOT to Ingest

| Source | Reason |
|---|---|
| OWASP IoT Top 10 (2018) | Deprecated — superseded by the ISTG (DOC-004). |
| Live CVE detail pages / KEV feed | Scores and status change; use the NVD API live, not static embeddings. |
| Volatile IOCs (IPs, hashes, C2 domains) | Go stale fast; belong in a live feed, not the vector store. |
| Vendor router manuals | Proprietary and too device-specific. |
| AI-generated summaries | No authoritative basis. |

---

## Removed Sources (from the original deep-research catalog)

Removed because the file was not obtained (dead URL, gated, or not downloaded). The
kept documents were renumbered contiguously, so these no longer hold DOC IDs.

| Source | Why removed |
|---|---|
| CISA/FBI Secure-by-Design SOHO Alert | Catalog URL returned 404; not located |
| CISA Joint Advisory AA26-194A | Not downloaded (verify it's a real advisory before re-adding) |
| Wi-Fi Alliance WPA3 Deployment Guidelines | Not obtained (registration-gated) |
| FBI IC3 PSA — GRU / SOHO (2026) | Catalog URL 404; slug likely fabricated |
| FBI IC3 PSA — BADBOX 2.0 | Not downloaded |
| CIS Benchmarks (Network Device) | Gated + redistribution-restricted (cite-only) |
| NIST SP 800-63B (Authentication) | Not downloaded (re-add for auth grounding if desired) |

---

*Document count: 9 reference PDFs | Organizations: NIST, NSA, CISA, FBI, OWASP, Wi-Fi Alliance, FTC, FIRST*
*Reconciled against `agent/corpus/` on 2026-07-14 — GridWatch, AI Engineering Certification Challenge.*
