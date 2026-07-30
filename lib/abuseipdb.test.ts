import { describe, expect, it } from "vitest";
import { lookupIpReputation, parseAbuseIpDbResponse } from "./abuseipdb";

describe("parseAbuseIpDbResponse", () => {
  it("normalizes the AbuseIPDB /check payload", () => {
    const rep = parseAbuseIpDbResponse("203.0.113.10", {
      data: {
        abuseConfidenceScore: 72,
        totalReports: 9,
        countryCode: "US",
        isp: "Example ISP",
        domain: "example.net",
        usageType: "Data Center/Web Hosting/Transit",
        isTor: true,
        lastReportedAt: "2026-07-01T00:00:00+00:00"
      }
    });

    expect(rep.ip).toBe("203.0.113.10");
    expect(rep.found).toBe(true);
    expect(rep.abuseConfidenceScore).toBe(72);
    expect(rep.totalReports).toBe(9);
    expect(rep.isp).toBe("Example ISP");
    expect(rep.isTor).toBe(true);
    expect(rep.lastReportedAt).toBe("2026-07-01T00:00:00+00:00");
  });

  it("tolerates missing and malformed fields", () => {
    const rep = parseAbuseIpDbResponse("8.8.8.8", { data: { abuseConfidenceScore: "nope" } });
    expect(rep.abuseConfidenceScore).toBe(0);
    expect(rep.totalReports).toBe(0);
    expect(rep.isp).toBeNull();
    expect(rep.isTor).toBe(false);
    expect(rep.found).toBe(true);
  });
});

describe("lookupIpReputation guards", () => {
  it("returns a note without querying when no IP is provided", async () => {
    const result = await lookupIpReputation(null);
    expect(result.result).toBeNull();
    expect(result.note).toMatch(/Add your router's public IP/i);
  });

  it("refuses to query private/LAN addresses (no third-party leak)", async () => {
    for (const ip of ["192.168.1.1", "10.0.0.5", "127.0.0.1", "::ffff:127.0.0.1"]) {
      const result = await lookupIpReputation(ip);
      expect(result.result).toBeNull();
      expect(result.note).toMatch(/verified public IP/i);
    }
  });
});
