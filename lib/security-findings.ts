import { sql } from "./db-client";
import { ensureSchema } from "./db";
import { localGetSecurityFindings, localSaveSecurityFindings } from "./local-store";
import type { SecurityFindings } from "./types";

function useLocalFileDb() {
  return process.env.USE_LOCAL_FILE_DB === "true";
}

// All access is scoped by userId so one user can never read another user's
// vulnerability/exposure findings.
export async function getSecurityFindings(userId: string): Promise<SecurityFindings | null> {
  if (useLocalFileDb()) {
    return localGetSecurityFindings(userId);
  }

  await ensureSchema();

  const result = await sql<{ findings: unknown }>`
    select findings from security_findings where user_id = ${userId} limit 1
  `;

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  const value = row.findings;
  return (typeof value === "string" ? JSON.parse(value) : value) as SecurityFindings;
}

export async function saveSecurityFindings(userId: string, findings: SecurityFindings): Promise<void> {
  if (useLocalFileDb()) {
    await localSaveSecurityFindings(userId, findings);
    return;
  }

  await ensureSchema();

  await sql`
    insert into security_findings (user_id, findings, checked_at)
    values (${userId}, ${JSON.stringify(findings)}::jsonb, ${findings.checkedAt})
    on conflict (user_id)
    do update set findings = excluded.findings, checked_at = excluded.checked_at
  `;
}
