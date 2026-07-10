# External Intelligence Sources

## Purpose

This document scopes passive external intelligence sources for the external-first
MVP. These sources enrich the user's approved public router IP, router model,
firmware, or explicitly provided account context. They do not replace the approved
active exposure scan or NVD CVE lookup.

## Source Priority

| Priority | Source | MVP Role | Notes |
| --- | --- | --- | --- |
| Required | NIST NVD | Router firmware/model CVE lookup | Authoritative CVE source. |
| Required | Tavily | Vendor guidance and source discovery | Use when curated corpus and NVD are insufficient. |
| Recommended | InternetDB or Shodan | Passive public-IP service observations | Prefer one for MVP depending on API access. |
| Optional | AbuseIPDB | Public-IP reputation context | Use carefully; reputation does not prove compromise. |
| Optional | HaveIBeenPwned | User-approved account breach context | Requires explicit email/account context and approval. |
| Later | Censys | Passive exposure and certificate/service data | Useful but may add API and data-shaping complexity. |
| Later | GreyNoise | Internet background-noise context | Useful for IP context, not required for MVP. |

## Provider Notes

### NIST NVD

- **Input:** Router vendor, model, firmware, CPE, or CVE ID.
- **Output:** CVE records, severity, publication/update dates, affected products.
- **Use:** Authoritative vulnerability lookup for router firmware/model findings.
- **Risk:** Product matching can be ambiguous; require confidence labels.

### Tavily

- **Input:** Public web search query about router model, firmware, vendor advisory,
  or remediation steps.
- **Output:** Search results and snippets.
- **Use:** Find current vendor-specific guidance when curated RAG and NVD are
  insufficient.
- **Risk:** Results are less authoritative than NVD or vendor advisories; cite and
  qualify them.

### InternetDB or Shodan

- **Input:** User-approved verified public router IP.
- **Output:** Observed ports, services, hostnames, vulnerabilities, or timestamps
  depending on provider.
- **Use:** Passive comparison against the active exposure scan.
- **Risk:** Data may be stale or incomplete; never treat as proof of current
  exposure without timestamp and caveat.

### AbuseIPDB

- **Input:** User-approved verified public router IP.
- **Output:** Abuse score, report categories, timestamps.
- **Use:** Context on whether the public IP has appeared in abuse reports.
- **Risk:** Residential IPs can inherit reputation from previous ISP assignment;
  avoid implying user compromise.

### HaveIBeenPwned

- **Input:** Explicit user-provided email/account identifier.
- **Output:** Breach exposure metadata.
- **Use:** Account-hygiene guidance related to router/admin/ISP account safety.
- **Risk:** Requires clear consent and careful privacy handling; never query
  arbitrary accounts.

### Censys

- **Input:** User-approved verified public router IP.
- **Output:** Host/service/certificate observations.
- **Use:** Optional deeper passive exposure context.
- **Risk:** Adds API complexity and may overlap with Shodan/InternetDB.

### GreyNoise

- **Input:** User-approved verified public router IP.
- **Output:** Internet noise, scanner, or classification context.
- **Use:** Helps interpret whether an IP is seen participating in internet-scale
  scanning or noise.
- **Risk:** May be less relevant for typical residential users; keep optional.

## MVP Recommendation

For the first implementation, use:

1. NIST NVD for CVEs.
2. Tavily for current vendor guidance.
3. One passive public-IP source such as InternetDB or Shodan.
4. Optional AbuseIPDB if API access is easy.
5. Optional HaveIBeenPwned only if the UI has explicit account-consent flow.

Do not integrate every source at once. The MVP should prove that the agent can
combine active scan results, one passive intelligence source, NVD, RAG, and
plain-English guidance.

## Safety Rules

1. Never scan or query arbitrary public IPs, domains, or CIDR blocks from chat.
2. Never send private LAN IPs to public intelligence sources.
3. Query passive public-IP sources only for the verified router public IP.
4. Query breach sources only for explicit user-provided account identifiers.
5. Treat passive intelligence as supporting context, not proof of compromise.
6. Preserve source name, timestamp, and confidence/limitations in the final report.
