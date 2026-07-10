import { describe, expect, it } from "vitest";
import { mergeExtractions } from "./router-setup";
import type { RouterExtraction } from "./types";

function extraction(overrides: Partial<RouterExtraction>): RouterExtraction {
  return {
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
    notes: [],
    ...overrides
  };
}

describe("mergeExtractions (multi-image upload)", () => {
  it("combines fields spread across multiple screenshots", () => {
    const statusPage = extraction({
      routerVendor: "TP-Link",
      routerModel: "Archer AX55",
      firmwareVersion: "1.2.6",
      notes: ["status page"]
    });
    const wanPage = extraction({
      publicIp: "93.184.216.34",
      wifiSecurity: "WPA3",
      notes: ["wan page"]
    });
    const advancedPage = extraction({
      upnpStatus: "Enabled",
      remoteAdminStatus: "Disabled",
      portForwardingStatus: "Disabled"
    });

    const merged = mergeExtractions([statusPage, wanPage, advancedPage]);

    expect(merged.routerVendor).toBe("TP-Link");
    expect(merged.routerModel).toBe("Archer AX55");
    expect(merged.firmwareVersion).toBe("1.2.6");
    expect(merged.publicIp).toBe("93.184.216.34");
    expect(merged.wifiSecurity).toBe("WPA3");
    expect(merged.upnpStatus).toBe("Enabled");
    expect(merged.notes).toEqual(expect.arrayContaining(["status page", "wan page"]));
    // Everything required was found across the three pages.
    expect(merged.missingFields).toHaveLength(0);
  });

  it("keeps the first non-empty value when pages disagree", () => {
    const first = extraction({ routerVendor: "Netgear", wifiSecurity: "WPA2" });
    const second = extraction({ routerVendor: "Asus", wifiSecurity: "WPA3" });

    const merged = mergeExtractions([first, second]);

    expect(merged.routerVendor).toBe("Netgear");
    expect(merged.wifiSecurity).toBe("WPA2");
  });

  it("reports required fields still missing after merging", () => {
    const merged = mergeExtractions([
      extraction({ routerVendor: "TP-Link", routerModel: "AX55" })
    ]);

    expect(merged.missingFields).toEqual(
      expect.arrayContaining([
        "firmwareVersion",
        "publicIp",
        "upnpStatus",
        "remoteAdminStatus",
        "portForwardingStatus",
        "wifiSecurity"
      ])
    );
    expect(merged.missingFields).not.toContain("routerVendor");
    expect(merged.missingFields).not.toContain("routerModel");
  });
});
