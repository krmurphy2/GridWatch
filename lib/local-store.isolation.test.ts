import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RouterExtraction } from "./types";

// Regression guard for per-user data isolation in the local file-backed store.
// This is the code path that runs in local development, and it mirrors the
// user_id filtering used by the Postgres path in router-profile.ts.

let tempDir: string;

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

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "gridwatch-isolation-"));
  process.env.LOCAL_DATA_PATH = join(tempDir, "store.json");
});

afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("local store per-user isolation", () => {
  it("returns only the requesting user's latest router profile", async () => {
    const { localSaveRouterProfile, localGetLatestRouterProfile } = await import("./local-store");

    const userA = "11111111-1111-1111-1111-111111111111";
    const userB = "22222222-2222-2222-2222-222222222222";

    await localSaveRouterProfile({
      userId: userA,
      extraction: extraction({ routerVendor: "TP-Link", publicIp: "203.0.113.10" }),
      scanApproved: false,
      scanTargetIp: null,
      imageName: "a.png",
      imageMime: "image/png",
      imageSize: 10,
      imageBase64: "AAAA"
    });

    await localSaveRouterProfile({
      userId: userB,
      extraction: extraction({ routerVendor: "Linksys", publicIp: "198.51.100.20" }),
      scanApproved: false,
      scanTargetIp: null,
      imageName: "b.png",
      imageMime: "image/png",
      imageSize: 10,
      imageBase64: "BBBB"
    });

    const profileA = await localGetLatestRouterProfile(userA);
    const profileB = await localGetLatestRouterProfile(userB);

    expect(profileA?.userId).toBe(userA);
    expect(profileA?.routerVendor).toBe("TP-Link");
    expect(profileA?.publicIp).toBe("203.0.113.10");

    expect(profileB?.userId).toBe(userB);
    expect(profileB?.routerVendor).toBe("Linksys");

    // User A must never see User B's data, and vice versa.
    expect(profileA?.routerVendor).not.toBe("Linksys");
    expect(profileA?.publicIp).not.toBe("198.51.100.20");
  });

  it("returns null for a user with no saved profile", async () => {
    const { localGetLatestRouterProfile } = await import("./local-store");
    const unknownUser = "99999999-9999-9999-9999-999999999999";
    expect(await localGetLatestRouterProfile(unknownUser)).toBeNull();
  });
});
