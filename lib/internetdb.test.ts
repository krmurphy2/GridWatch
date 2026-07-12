import { describe, expect, it } from "vitest";
import { lookupPassiveExposure, parseInternetDbResponse } from "./internetdb";

describe("parseInternetDbResponse", () => {
  it("normalizes ports (sorted) and string arrays", () => {
    const exposure = parseInternetDbResponse("93.184.216.34", {
      ports: [443, 22, 80],
      hostnames: ["example.com"],
      cpes: ["cpe:/a:foo:bar"],
      tags: ["cdn"],
      vulns: ["CVE-2021-1"]
    });

    expect(exposure.ip).toBe("93.184.216.34");
    expect(exposure.found).toBe(true);
    expect(exposure.ports).toEqual([22, 80, 443]);
    expect(exposure.hostnames).toEqual(["example.com"]);
    expect(exposure.cpes).toEqual(["cpe:/a:foo:bar"]);
    expect(exposure.tags).toEqual(["cdn"]);
    expect(exposure.vulns).toEqual(["CVE-2021-1"]);
  });

  it("tolerates missing and malformed fields", () => {
    const exposure = parseInternetDbResponse("8.8.8.8", { ports: "nope", hostnames: null });
    expect(exposure.ports).toEqual([]);
    expect(exposure.hostnames).toEqual([]);
    expect(exposure.found).toBe(true);
  });
});

describe("lookupPassiveExposure guards", () => {
  it("returns a note without querying when no IP is provided", async () => {
    const result = await lookupPassiveExposure(null);
    expect(result.exposure).toBeNull();
    expect(result.note).toMatch(/Add your router's public IP/i);
  });

  it("refuses to query private/LAN addresses (no third-party leak)", async () => {
    for (const ip of ["192.168.1.1", "10.0.0.5", "127.0.0.1", "::ffff:127.0.0.1"]) {
      const result = await lookupPassiveExposure(ip);
      expect(result.exposure).toBeNull();
      expect(result.note).toMatch(/verified public IP/i);
    }
  });
});
