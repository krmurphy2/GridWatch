# Security and Privacy Design

## Challenge Alignment

This document supports Task 2, Task 3, Task 4, and Task 5 by documenting human
approval steps, scan restrictions, data handling boundaries, and safety evaluation
requirements.

## Security Posture

GridWatch is a defensive home network assistant for users who own or administer
the network being inspected. It must not become a general-purpose scanning tool
for arbitrary internet targets.

## Core Restrictions

1. The agent must not scan arbitrary public internet targets.
2. The only permitted active-scan target is the user's own verified router
   external IP address, and only after explicit approval.
3. The MVP must not perform local LAN scanning or require a local scanner.
4. The cloud backend must not attempt to scan private LAN devices directly.
5. The system must refuse scan requests that target unrelated public IPs,
   domains, or networks.
6. The system must explain scan refusals in plain English.
7. Passive intelligence lookups must use only approved user context, such as the
   verified public IP or an explicitly provided email/account identifier.

## External Exposure Scan Policy

External exposure checks are allowed only when all conditions are true:

1. The user asks to check their home network's internet exposure.
2. The system can determine or confirm the router's external/public IP from the
   user's assessment session, browser/request context, or another trusted
   user-specific verification flow.
3. The user explicitly approves the external exposure scan.
4. The scan is limited to low-intensity open-port and common-service discovery
   appropriate for a home router exposure check.
5. The result is used only to explain exposed services and suggested next steps.

The agent must reject any user-provided public IP, domain, or CIDR block that
cannot be verified as the user's own router external IP.

## Screenshot and Evidence Upload Policy

Router screenshots and user-provided setup details are allowed only when:

1. The user explicitly uploads the evidence or enters the details.
2. The UI warns that screenshots may contain sensitive router, network, or account
   information.
3. The system extracts only the facts needed for the assessment where possible.
4. Raw screenshots are not committed to the repository or retained longer than the
   documented retention policy.
5. Extracted facts are labeled with source and confidence.

## Post-MVP Local Scan Policy

Local LAN scanning is deferred until after the MVP. If implemented later, local
scans must run from inside the user's home network, target only private local
subnets associated with that scanner context, require approval, and return only
the inventory/risk data required for the requested feature.

## Human Approval Gates

The assistant must ask for approval before:

1. Starting external exposure scans.
2. Processing uploaded screenshots that may contain sensitive router or network
   information.
3. Querying passive intelligence APIs with the user's public IP, email/account,
   domain, router model, or firmware when not strictly necessary.
4. Querying HaveIBeenPwned or similar breach sources with an email/account value.
5. Suggesting disruptive actions such as router factory resets, firmware flashes,
   or configuration changes that could disconnect the user.

## Sensitive Data

Potentially sensitive data includes:

1. Uploaded router screenshots.
2. Router model, hardware revision, firmware version, and configuration settings.
3. Public router IP address.
4. Exposed port and service findings.
5. Passive intelligence results and source timestamps.
6. Email/account identifiers used for breach checks.
7. Local IP addresses, MAC addresses, hostnames, or device labels visible in
   screenshots.
8. Scan timestamps and assessment history.
9. API keys and credentials.

## Data Minimization

The system should:

1. Store the minimum screenshot-derived facts, scan results, and intelligence
   summaries required for user value and evaluation.
2. Avoid retaining raw screenshots when normalized extracted facts are sufficient.
3. Avoid sending screenshot-visible local IPs, MAC addresses, or hostnames to
   external services unless necessary and approved.
4. Avoid committing real screenshots, scan data, or passive intelligence results
   to the repository.
5. Use synthetic or sanitized fixtures in tests and demos.
6. Redact credentials, secrets, router admin URLs, and account identifiers from
   logs.
7. Log tool outcomes and metrics without storing full raw payloads by default.

## Third-Party API Boundaries

| Service | Allowed Data | Disallowed Data |
| --- | --- | --- |
| Anthropic via gateway | User question, minimal context, extracted facts, retrieved evidence | API keys, passwords, unnecessary raw screenshots or raw scan dumps |
| NVD API | CVE ID, CPE, router vendor/model/firmware keyword | User identity, screenshots, full assessment history |
| Tavily | Public security or vendor guidance search queries | Private network topology, credentials, or raw screenshots |
| Shodan/Censys/InternetDB/GreyNoise | Verified public IP if approved | Private LAN IPs, arbitrary third-party IPs, unrelated domains |
| AbuseIPDB | Verified public IP if approved | Private LAN IPs or unverified public IPs |
| HaveIBeenPwned | Explicit user-provided email/account context if approved | Router credentials, passwords, or accounts not provided by the user |

## Prompt and Response Safety

Prompts should instruct the model to:

1. Distinguish evidence from inference.
2. Cite tool output or retrieved sources for security claims.
3. Use risk labels without exaggeration.
4. Ask clarifying questions when model/version evidence is insufficient.
5. Refuse unsafe scan requests.
6. Avoid step-by-step offensive exploitation guidance.

## Evaluation Requirements

The evaluation harness must include safety cases for:

1. Arbitrary public IP scan refusal.
2. Unverified domain and CIDR scan refusal.
3. Approved router external IP scan path.
4. Private LAN IP reputation lookup refusal.
5. HaveIBeenPwned lookup refusal without explicit user-provided account context.
6. Raw screenshot logging/retention avoidance.
7. Prompt injection attempts that try to bypass scan or passive-intelligence
   restrictions.

Safety compliance target is 100% for prohibited scan behavior.
