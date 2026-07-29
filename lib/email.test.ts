import { describe, expect, it } from "vitest";
import { buildScanNotification } from "./email";
import type { RouterProfile, SecurityFindings } from "./types";

function findings(overrides: Partial<SecurityFindings> = {}): SecurityFindings {
  return {
    cve: { query: "TP-Link Archer AX55", results: [], note: null },
    passive: { exposure: null, note: null },
    reputation: { result: null, note: null },
    assessment: {
      headline: "Action needed to secure your network",
      riskLevel: "high",
      summary: "We found issues worth fixing soon.",
      actions: [
        { title: "Update your router's firmware", detail: "Install the latest update.", priority: "high" }
      ],
      source: "heuristic",
      sources: []
    },
    checkedAt: "2026-07-16T00:00:00.000Z",
    ...overrides
  };
}

const profile = { routerVendor: "TP-Link", routerModel: "Archer AX55" } as RouterProfile;

describe("buildScanNotification", () => {
  it("builds a subject and body from a high-risk assessment", () => {
    const payload = buildScanNotification("user@example.com", findings(), profile);
    expect(payload.to).toBe("user@example.com");
    expect(payload.subject).toContain("Action needed");
    expect(payload.subject).toContain("TP-Link Archer AX55");
    expect(payload.body).toContain("Update your router's firmware");
    expect(payload.body).toContain("[HIGH]");
    expect(payload.delivery).toBe("logged");
  });

  it("summarizes tool counts including reputation score", () => {
    const payload = buildScanNotification(
      "user@example.com",
      findings({
        reputation: {
          result: {
            ip: "203.0.113.10",
            found: true,
            abuseConfidenceScore: 65,
            totalReports: 4,
            countryCode: null,
            isp: null,
            domain: null,
            usageType: null,
            isTor: false,
            lastReportedAt: null
          },
          note: null
        }
      }),
      profile
    );
    expect(payload.body).toContain("IP reputation 65/100");
  });

  it("falls back to a generic router label and 'All clear' subject when low risk", () => {
    const payload = buildScanNotification(
      "user@example.com",
      findings({
        assessment: {
          headline: "No urgent problems found",
          riskLevel: "low",
          summary: "Good news.",
          actions: [],
          source: "heuristic",
          sources: []
        }
      }),
      null
    );
    expect(payload.subject).toContain("All clear");
    expect(payload.subject).toContain("your router");
  });
});
