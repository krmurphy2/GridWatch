import { describe, expect, it } from "vitest";
import { buildHeuristicAssessment, parseAssessment, type SummaryInput } from "./findings-summary";
import type { CveFinding, IpReputation, PassiveExposure, RouterProfile } from "./types";

function profile(overrides: Partial<RouterProfile> = {}): RouterProfile {
  return {
    id: "p1",
    userId: "u1",
    routerVendor: "TP-Link",
    routerModel: "Archer AX55",
    hardwareVersion: null,
    firmwareVersion: null,
    publicIp: null,
    routerAdminUrl: null,
    upnpStatus: null,
    remoteAdminStatus: null,
    portForwardingStatus: null,
    wifiSecurity: null,
    extraction: {
      routerVendor: null,
      routerModel: null,
      hardwareVersion: null,
      firmwareVersion: null,
      publicIp: null,
      routerAdminUrl: null,
      upnpStatus: null,
      remoteAdminStatus: null,
      portForwardingStatus: null,
      wifiSecurity: null,
      confidence: {},
      missingFields: [],
      notes: []
    },
    missingFields: [],
    scanApproved: false,
    scanApprovedAt: null,
    scanTargetIp: null,
    imageName: null,
    imageMime: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

function cve(overrides: Partial<CveFinding> = {}): CveFinding {
  return {
    id: "CVE-2023-0001",
    description: "A flaw.",
    cvssScore: null,
    severity: null,
    published: null,
    lastModified: null,
    url: "https://nvd.nist.gov/vuln/detail/CVE-2023-0001",
    ...overrides
  };
}

function exposure(overrides: Partial<PassiveExposure> = {}): PassiveExposure {
  return {
    ip: "203.0.113.10",
    found: true,
    ports: [],
    hostnames: [],
    cpes: [],
    tags: [],
    vulns: [],
    ...overrides
  };
}

function reputation(overrides: Partial<IpReputation> = {}): IpReputation {
  return {
    ip: "203.0.113.10",
    found: true,
    abuseConfidenceScore: 0,
    totalReports: 0,
    countryCode: null,
    isp: null,
    domain: null,
    usageType: null,
    isTor: false,
    lastReportedAt: null,
    ...overrides
  };
}

function input(overrides: Partial<SummaryInput> = {}): SummaryInput {
  return {
    profile: profile(),
    cve: { query: "TP-Link Archer AX55", results: [], note: null },
    passive: { exposure: null, note: null },
    reputation: { result: null, note: null },
    ...overrides
  };
}

describe("buildHeuristicAssessment", () => {
  it("returns low risk and an upkeep action when nothing is found", () => {
    const result = buildHeuristicAssessment(input());
    expect(result.riskLevel).toBe("low");
    expect(result.source).toBe("heuristic");
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].priority).toBe("low");
    expect(result.sources).toEqual([]);
  });

  it("flags high risk for a severe CVE by severity", () => {
    const result = buildHeuristicAssessment(
      input({ cve: { query: "q", results: [cve({ severity: "CRITICAL" })], note: null } })
    );
    expect(result.riskLevel).toBe("high");
    expect(result.actions[0].title).toMatch(/firmware/i);
    expect(result.actions[0].priority).toBe("high");
  });

  it("treats a high CVSS score as severe even without a severity label", () => {
    const result = buildHeuristicAssessment(
      input({ cve: { query: "q", results: [cve({ cvssScore: 8.1 })], note: null } })
    );
    expect(result.riskLevel).toBe("high");
  });

  it("is medium risk for a low-severity CVE with no exposure", () => {
    const result = buildHeuristicAssessment(
      input({ cve: { query: "q", results: [cve({ cvssScore: 3.2, severity: "LOW" })], note: null } })
    );
    expect(result.riskLevel).toBe("medium");
  });

  it("flags high risk and names risky open ports", () => {
    const result = buildHeuristicAssessment(
      input({ passive: { exposure: exposure({ ports: [23, 8080] }), note: null } })
    );
    expect(result.riskLevel).toBe("high");
    const closeAction = result.actions.find((a) => /close services/i.test(a.title));
    expect(closeAction).toBeDefined();
    expect(closeAction?.detail).toContain("23");
    expect(closeAction?.detail).toContain("Telnet");
  });

  it("is medium risk when only non-risky ports are open", () => {
    const result = buildHeuristicAssessment(
      input({ passive: { exposure: exposure({ ports: [12345] }), note: null } })
    );
    expect(result.riskLevel).toBe("medium");
    expect(result.actions.some((a) => /reachable from the internet/i.test(a.title))).toBe(true);
  });

  it("flags high risk when passive intel lists vulns", () => {
    const result = buildHeuristicAssessment(
      input({ passive: { exposure: exposure({ vulns: ["CVE-2020-1234"] }), note: null } })
    );
    expect(result.riskLevel).toBe("high");
    expect(result.actions.some((a) => /internet-facing vulnerabilities/i.test(a.title))).toBe(true);
  });

  it("flags high risk for a bad IP reputation score", () => {
    const result = buildHeuristicAssessment(
      input({ reputation: { result: reputation({ abuseConfidenceScore: 80, totalReports: 12 }), note: null } })
    );
    expect(result.riskLevel).toBe("high");
    const repAction = result.actions.find((a) => /reputation/i.test(a.title));
    expect(repAction).toBeDefined();
    expect(repAction?.priority).toBe("high");
    expect(repAction?.detail).toContain("80/100");
  });

  it("is medium risk for a low non-zero reputation score", () => {
    const result = buildHeuristicAssessment(
      input({ reputation: { result: reputation({ abuseConfidenceScore: 15 }), note: null } })
    );
    expect(result.riskLevel).toBe("medium");
    expect(result.actions.some((a) => /reputation/i.test(a.title) && a.priority === "low")).toBe(true);
  });

  it("stays low risk when the reputation score is zero", () => {
    const result = buildHeuristicAssessment(
      input({ reputation: { result: reputation({ abuseConfidenceScore: 0 }), note: null } })
    );
    expect(result.riskLevel).toBe("low");
    expect(result.actions.some((a) => /reputation/i.test(a.title))).toBe(false);
  });

  it("uses a generic label when vendor/model are missing", () => {
    const result = buildHeuristicAssessment(
      input({ profile: profile({ routerVendor: null, routerModel: null }) })
    );
    expect(result.summary).toContain("your router");
  });
});

describe("parseAssessment", () => {
  const valid = {
    headline: "You're in good shape",
    riskLevel: "LOW",
    summary: "Nothing needs attention right now.",
    actions: [{ title: "Keep firmware updated", detail: "Check monthly.", priority: "LOW" }]
  };

  it("normalizes a valid LLM object and marks the source llm", () => {
    const result = parseAssessment(valid);
    expect(result).not.toBeNull();
    expect(result?.source).toBe("llm");
    expect(result?.riskLevel).toBe("low");
    expect(result?.actions[0].priority).toBe("low");
  });

  it("parses guidance sources when present and defaults to empty", () => {
    expect(parseAssessment(valid)?.sources).toEqual([]);
    const withSources = parseAssessment({ ...valid, sources: ["Wi-Fi encryption", 42, "Firmware updates"] });
    expect(withSources?.sources).toEqual(["Wi-Fi encryption", "Firmware updates"]);
  });

  it("defaults an unknown priority to medium", () => {
    const result = parseAssessment({ ...valid, actions: [{ title: "t", detail: "d", priority: "urgent" }] });
    expect(result?.actions[0].priority).toBe("medium");
  });

  it("rejects a missing or invalid risk level", () => {
    expect(parseAssessment({ ...valid, riskLevel: "" })).toBeNull();
    expect(parseAssessment({ ...valid, riskLevel: "extreme" })).toBeNull();
  });

  it("rejects missing headline or summary", () => {
    expect(parseAssessment({ ...valid, headline: "" })).toBeNull();
    expect(parseAssessment({ ...valid, summary: "   " })).toBeNull();
  });

  it("returns null when no action has both a title and detail", () => {
    expect(parseAssessment({ ...valid, actions: [{ title: "t" }, { detail: "d" }] })).toBeNull();
    expect(parseAssessment({ ...valid, actions: [] })).toBeNull();
  });

  it("caps the action list at six", () => {
    const actions = Array.from({ length: 10 }, (_, i) => ({ title: `t${i}`, detail: `d${i}`, priority: "low" }));
    expect(parseAssessment({ ...valid, actions })?.actions).toHaveLength(6);
  });

  it("rejects non-object input", () => {
    expect(parseAssessment(null)).toBeNull();
    expect(parseAssessment("nope")).toBeNull();
  });
});
