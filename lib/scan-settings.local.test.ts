import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Roundtrip guard for the recurring-scan settings store on the local file-backed
// path (local development). Mirrors the user_id scoping used by the Postgres path
// in scan-settings.ts.

let tempDir: string;

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "gridwatch-scan-settings-"));
  process.env.LOCAL_DATA_PATH = join(tempDir, "store.json");
  process.env.USE_LOCAL_FILE_DB = "true";
});

afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("scan settings (local store)", () => {
  it("defaults to disabled with no email", async () => {
    const { getScanSettings } = await import("./scan-settings");
    const settings = await getScanSettings("user-none");
    expect(settings.recurringEnabled).toBe(false);
    expect(settings.notifyEmail).toBeNull();
    expect(settings.lastNotification).toBeNull();
  });

  it("saves and merges partial updates without clobbering other fields", async () => {
    const { getScanSettings, saveScanSettings } = await import("./scan-settings");

    await saveScanSettings("user-a", { recurringEnabled: true, notifyEmail: "a@example.com" });
    let settings = await getScanSettings("user-a");
    expect(settings.recurringEnabled).toBe(true);
    expect(settings.notifyEmail).toBe("a@example.com");

    // A partial update (e.g. saving a notification) must not reset the toggle/email.
    await saveScanSettings("user-a", {
      lastNotification: {
        to: "a@example.com",
        subject: "GridWatch scan",
        body: "…",
        sentAt: "2026-07-16T00:00:00.000Z",
        delivery: "logged"
      }
    });
    settings = await getScanSettings("user-a");
    expect(settings.recurringEnabled).toBe(true);
    expect(settings.notifyEmail).toBe("a@example.com");
    expect(settings.lastNotification?.subject).toBe("GridWatch scan");
  });

  it("lists only users with recurring enabled AND an email set", async () => {
    const { saveScanSettings, getRecurringScanUserIds } = await import("./scan-settings");

    await saveScanSettings("user-b", { recurringEnabled: true, notifyEmail: "b@example.com" });
    await saveScanSettings("user-c", { recurringEnabled: true, notifyEmail: null });
    await saveScanSettings("user-d", { recurringEnabled: false, notifyEmail: "d@example.com" });

    const ids = await getRecurringScanUserIds();
    expect(ids).toContain("user-a");
    expect(ids).toContain("user-b");
    expect(ids).not.toContain("user-c");
    expect(ids).not.toContain("user-d");
  });
});
