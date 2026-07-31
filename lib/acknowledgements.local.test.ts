import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Roundtrip guard for acknowledged router-check findings on the local file-backed
// path. Scoped by userId, add/remove semantics, mirrors the Postgres path.

let tempDir: string;

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "gridwatch-ack-"));
  process.env.LOCAL_DATA_PATH = join(tempDir, "store.json");
  process.env.USE_LOCAL_FILE_DB = "true";
});

afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("acknowledged findings (local store)", () => {
  it("starts empty and adds a key on acknowledge", async () => {
    const { getAcknowledgedFindingKeys, setFindingAcknowledged } = await import("./acknowledgements");

    expect(await getAcknowledgedFindingKeys("user-a")).toEqual([]);

    await setFindingAcknowledged("user-a", "portForwarding", true);
    expect(await getAcknowledgedFindingKeys("user-a")).toEqual(["portForwarding"]);
  });

  it("is idempotent and removes on un-acknowledge", async () => {
    const { getAcknowledgedFindingKeys, setFindingAcknowledged } = await import("./acknowledgements");

    await setFindingAcknowledged("user-a", "upnp", true);
    await setFindingAcknowledged("user-a", "upnp", true); // no duplicate
    expect((await getAcknowledgedFindingKeys("user-a")).sort()).toEqual(["portForwarding", "upnp"]);

    await setFindingAcknowledged("user-a", "portForwarding", false);
    expect(await getAcknowledgedFindingKeys("user-a")).toEqual(["upnp"]);
  });

  it("keeps each user's acknowledgements isolated", async () => {
    const { getAcknowledgedFindingKeys, setFindingAcknowledged } = await import("./acknowledgements");

    await setFindingAcknowledged("user-b", "remoteAdmin", true);
    expect(await getAcknowledgedFindingKeys("user-b")).toEqual(["remoteAdmin"]);
    // user-a unaffected by user-b's change
    expect(await getAcknowledgedFindingKeys("user-a")).toEqual(["upnp"]);
  });
});
