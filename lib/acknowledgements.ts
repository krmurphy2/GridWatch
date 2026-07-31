import { sql } from "./db-client";
import { ensureSchema } from "./db";
import {
  localGetAcknowledgedFindingKeys,
  localSetAcknowledgedFindingKeys
} from "./local-store";

// Stable keys of the router-check findings that may be acknowledged. Kept in sync
// with the finding keys built in the dashboard's buildPosture(); validating against
// this set stops arbitrary keys from being persisted.
export const ACKNOWLEDGEABLE_FINDING_KEYS = [
  "upnp",
  "remoteAdmin",
  "portForwarding",
  "wifi",
  "firmware"
] as const;

export type AcknowledgeableFindingKey = (typeof ACKNOWLEDGEABLE_FINDING_KEYS)[number];

function useLocalFileDb() {
  return process.env.USE_LOCAL_FILE_DB === "true";
}

// Stable keys of the router-check findings a user has acknowledged ("I'm keeping
// this on purpose"), so they drop out of the action list. Scoped by userId so one
// user can never read or change another's acknowledgements.
export async function getAcknowledgedFindingKeys(userId: string): Promise<string[]> {
  if (useLocalFileDb()) {
    return localGetAcknowledgedFindingKeys(userId);
  }

  await ensureSchema();

  const result = await sql<{ keys: unknown }>`
    select keys from acknowledged_findings where user_id = ${userId} limit 1
  `;

  const row = result.rows[0];
  if (!row) {
    return [];
  }

  const value = typeof row.keys === "string" ? JSON.parse(row.keys) : row.keys;
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

// Add or remove a single finding key from the user's acknowledged set and upsert.
export async function setFindingAcknowledged(
  userId: string,
  key: string,
  acknowledged: boolean
): Promise<void> {
  const current = new Set(await getAcknowledgedFindingKeys(userId));

  if (acknowledged) {
    current.add(key);
  } else {
    current.delete(key);
  }

  const keys = Array.from(current);

  if (useLocalFileDb()) {
    await localSetAcknowledgedFindingKeys(userId, keys);
    return;
  }

  await ensureSchema();

  await sql`
    insert into acknowledged_findings (user_id, keys, updated_at)
    values (${userId}, ${JSON.stringify(keys)}::jsonb, now())
    on conflict (user_id) do update set keys = excluded.keys, updated_at = excluded.updated_at
  `;
}
