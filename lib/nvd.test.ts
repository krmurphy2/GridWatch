import { describe, expect, it } from "vitest";
import { buildNvdQuery, parseNvdResponse } from "./nvd";

describe("buildNvdQuery", () => {
  it("joins vendor and model", () => {
    expect(buildNvdQuery({ routerVendor: "TP-Link", routerModel: "Archer AX55" })).toBe(
      "TP-Link Archer AX55"
    );
  });

  it("uses whichever field is present", () => {
    expect(buildNvdQuery({ routerVendor: "Netgear", routerModel: null })).toBe("Netgear");
    expect(buildNvdQuery({ routerVendor: null, routerModel: "R7000" })).toBe("R7000");
  });

  it("returns null when nothing usable is present", () => {
    expect(buildNvdQuery({ routerVendor: null, routerModel: null })).toBeNull();
    expect(buildNvdQuery({ routerVendor: "  ", routerModel: "" })).toBeNull();
  });
});

describe("parseNvdResponse", () => {
  const payload = {
    vulnerabilities: [
      {
        cve: {
          id: "CVE-2023-0001",
          published: "2023-01-01T00:00:00.000",
          lastModified: "2023-02-01T00:00:00.000",
          descriptions: [
            { lang: "es", value: "descripcion" },
            { lang: "en", value: "A serious flaw." }
          ],
          metrics: {
            cvssMetricV31: [{ cvssData: { baseScore: 9.8, baseSeverity: "critical" } }]
          }
        }
      },
      {
        cve: {
          id: "CVE-2022-0002",
          descriptions: [{ lang: "en", value: "A medium flaw." }],
          metrics: {
            cvssMetricV2: [{ cvssData: { baseScore: 5.0 }, baseSeverity: "MEDIUM" }]
          }
        }
      }
    ]
  };

  it("normalizes and sorts by CVSS score descending", () => {
    const results = parseNvdResponse(payload);
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe("CVE-2023-0001");
    expect(results[0].cvssScore).toBe(9.8);
    expect(results[0].severity).toBe("CRITICAL");
    expect(results[0].description).toBe("A serious flaw.");
    expect(results[0].url).toBe("https://nvd.nist.gov/vuln/detail/CVE-2023-0001");
    expect(results[1].id).toBe("CVE-2022-0002");
    expect(results[1].cvssScore).toBe(5.0);
    expect(results[1].severity).toBe("MEDIUM");
  });

  it("prefers English descriptions and falls back gracefully", () => {
    const results = parseNvdResponse({
      vulnerabilities: [{ cve: { id: "CVE-1", descriptions: [{ lang: "fr", value: "bonjour" }] } }]
    });
    expect(results[0].description).toBe("bonjour");
    expect(results[0].cvssScore).toBeNull();
    expect(results[0].severity).toBeNull();
  });

  it("handles empty or malformed payloads", () => {
    expect(parseNvdResponse({})).toEqual([]);
    expect(parseNvdResponse(null)).toEqual([]);
    expect(parseNvdResponse({ vulnerabilities: [{}] })).toEqual([]);
  });
});
