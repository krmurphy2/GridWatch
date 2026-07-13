# Understanding vulnerability reports (CVEs)

A CVE is a publicly catalogued security flaw in a piece of software or hardware.
When GridWatch finds CVEs matching your router's make and model, it means known
issues have been documented for that product — not necessarily that you are being
attacked.

## Severity in plain terms

Each CVE usually has a CVSS score from 0 to 10 and a severity label:

- **Critical (9.0–10) / High (7.0–8.9)** — serious. Prioritize addressing these,
  usually by updating firmware.
- **Medium (4.0–6.9)** — worth fixing but generally less urgent.
- **Low (0.1–3.9)** — minor; handle as routine maintenance.

## Does a CVE actually affect me?

A CVE listed for your model may only apply to a specific firmware version, or only
when a certain feature is enabled. A match is a strong reason to update and review
settings, but it is not proof your device is currently exploitable. Where possible,
check whether your firmware version is in the affected range.

## What to do about CVEs

For almost all consumer-router CVEs, the fix is the same: install the latest
firmware from the manufacturer, and disable risky features (remote management,
UPnP, unused port forwards) that increase what an attacker can reach. If your model
is end-of-life and no fix exists, plan to replace it.

Avoid searching for or running exploit code — the goal is to close the hole, not
to test it.

## Sources

Reflects the NIST National Vulnerability Database (NVD) CVE/CVSS model and CISA
patching guidance.
