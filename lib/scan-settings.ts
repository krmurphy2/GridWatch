import { sql } from "./db-client";
import { ensureSchema } from "./db";
import {
  localGetScanSettings,
  localSaveScanSettings,
  localGetRecurringScanUserIds
} from "./local-store";
import type { NotificationPayload, ScanSettings } from "./types";

function useLocalFileDb() {
  return process.env.USE_LOCAL_FILE_DB === "true";
}

function defaults(): ScanSettings {
  return {
    recurringEnabled: false,
    notifyEmail: null,
    lastNotification: null,
    updatedAt: new Date(0).toISOString()
  };
}

// All access is scoped by userId so one user can never read or change another
// user's recurring-scan settings.
export async function getScanSettings(userId: string): Promise<ScanSettings> {
  if (useLocalFileDb()) {
    return (await localGetScanSettings(userId)) ?? defaults();
  }

  await ensureSchema();

  const result = await sql<{
    recurring_enabled: boolean;
    notify_email: string | null;
    last_notification: unknown;
    updated_at: string;
  }>`
    select recurring_enabled, notify_email, last_notification, updated_at
    from scan_settings where user_id = ${userId} limit 1
  `;

  const row = result.rows[0];
  if (!row) {
    return defaults();
  }

  const lastNotification = row.last_notification
    ? ((typeof row.last_notification === "string"
        ? JSON.parse(row.last_notification)
        : row.last_notification) as NotificationPayload)
    : null;

  return {
    recurringEnabled: Boolean(row.recurring_enabled),
    notifyEmail: row.notify_email,
    lastNotification,
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

// Merge a partial update into the user's existing settings and upsert.
export async function saveScanSettings(
  userId: string,
  updates: Partial<Omit<ScanSettings, "updatedAt">>
): Promise<ScanSettings> {
  const current = await getScanSettings(userId);
  const next: ScanSettings = {
    recurringEnabled: updates.recurringEnabled ?? current.recurringEnabled,
    notifyEmail: updates.notifyEmail !== undefined ? updates.notifyEmail : current.notifyEmail,
    lastNotification:
      updates.lastNotification !== undefined ? updates.lastNotification : current.lastNotification,
    updatedAt: new Date().toISOString()
  };

  if (useLocalFileDb()) {
    await localSaveScanSettings(userId, next);
    return next;
  }

  await ensureSchema();

  await sql`
    insert into scan_settings (user_id, recurring_enabled, notify_email, last_notification, updated_at)
    values (
      ${userId},
      ${next.recurringEnabled},
      ${next.notifyEmail},
      ${next.lastNotification ? JSON.stringify(next.lastNotification) : null}::jsonb,
      ${next.updatedAt}
    )
    on conflict (user_id) do update set
      recurring_enabled = excluded.recurring_enabled,
      notify_email = excluded.notify_email,
      last_notification = excluded.last_notification,
      updated_at = excluded.updated_at
  `;

  return next;
}

// User IDs that have recurring scans enabled AND a notification email set. Used by
// the cron job to decide who to scan.
export async function getRecurringScanUserIds(): Promise<string[]> {
  if (useLocalFileDb()) {
    return localGetRecurringScanUserIds();
  }

  await ensureSchema();

  const result = await sql<{ user_id: string }>`
    select user_id from scan_settings
    where recurring_enabled = true and notify_email is not null
  `;

  return result.rows.map((row) => row.user_id);
}
