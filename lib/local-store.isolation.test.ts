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

  it("applies a scoped manual update and does not touch another user's profile", async () => {
    const { localSaveRouterProfile, localGetLatestRouterProfile } = await import("./local-store");
    const { updateRouterProfile } = await import("./router-profile");

    process.env.USE_LOCAL_FILE_DB = "true";

    const userA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const userB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

    await localSaveRouterProfile({
      userId: userA,
      extraction: extraction({ routerVendor: "Netgear", missingFields: ["firmwareVersion", "publicIp"] }),
      scanApproved: false,
      scanTargetIp: null,
      imageName: "a.png",
      imageMime: "image/png",
      imageSize: 10,
      imageBase64: "AAAA"
    });

    await localSaveRouterProfile({
      userId: userB,
      extraction: extraction({ routerVendor: "Asus" }),
      scanApproved: false,
      scanTargetIp: null,
      imageName: "b.png",
      imageMime: "image/png",
      imageSize: 10,
      imageBase64: "BBBB"
    });

    const updated = await updateRouterProfile(userA, {
      firmwareVersion: "1.0.9",
      publicIp: "93.184.216.34"
    });

    // User A's manual fills are saved and drop out of missingFields.
    expect(updated?.firmwareVersion).toBe("1.0.9");
    expect(updated?.publicIp).toBe("93.184.216.34");
    expect(updated?.missingFields).not.toContain("firmwareVersion");
    expect(updated?.missingFields).not.toContain("publicIp");

    // User B is completely unaffected.
    const profileB = await localGetLatestRouterProfile(userB);
    expect(profileB?.routerVendor).toBe("Asus");
    expect(profileB?.firmwareVersion).toBeNull();
    expect(profileB?.publicIp).toBeNull();
  });

  it("rejects an invalid (private) public IP on manual update", async () => {
    const { localSaveRouterProfile } = await import("./local-store");
    const { updateRouterProfile } = await import("./router-profile");

    process.env.USE_LOCAL_FILE_DB = "true";
    const userC = "cccccccc-cccc-cccc-cccc-cccccccccccc";

    await localSaveRouterProfile({
      userId: userC,
      extraction: extraction({ routerVendor: "TP-Link" }),
      scanApproved: false,
      scanTargetIp: null,
      imageName: "c.png",
      imageMime: "image/png",
      imageSize: 10,
      imageBase64: "CCCC"
    });

    await expect(updateRouterProfile(userC, { publicIp: "192.168.1.1" })).rejects.toThrow(
      /valid public IP/i
    );
  });

  it("keeps each user's chat history isolated", async () => {
    const { appendChatMessage, getChatMessages } = await import("./chat");

    process.env.USE_LOCAL_FILE_DB = "true";
    const userD = "dddddddd-dddd-dddd-dddd-dddddddddddd";
    const userE = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";

    await appendChatMessage(userD, "user", "Is UPnP safe to leave on?");
    await appendChatMessage(userD, "assistant", "Generally disable UPnP unless a device needs it.");
    await appendChatMessage(userE, "user", "What is WPA3?");

    const historyD = await getChatMessages(userD);
    const historyE = await getChatMessages(userE);

    expect(historyD).toHaveLength(2);
    expect(historyD.every((m) => m.content.includes("WPA3") === false)).toBe(true);
    expect(historyD[0].role).toBe("user");
    expect(historyD[1].role).toBe("assistant");

    expect(historyE).toHaveLength(1);
    expect(historyE[0].content).toBe("What is WPA3?");
  });
});
