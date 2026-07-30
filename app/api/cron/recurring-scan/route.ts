import { NextResponse } from "next/server";
import { getLatestRouterProfile } from "@/lib/router-profile";
import { runSecurityChecksForUser } from "@/lib/security-scan";
import { sendScanNotification } from "@/lib/email";
import { getRecurringScanUserIds, getScanSettings, saveScanSettings } from "@/lib/scan-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Recurring external scan, invoked on a schedule by Vercel Cron (see vercel.json).
// For every user who has opted in and set a notification email, it re-runs the
// read-only security checks and "sends" (currently logs) a summary email.
//
// SECURITY: this endpoint runs paid scans and sends mail, so it must not be open.
// It requires CRON_SECRET to be configured and the caller to present it as a
// Bearer token (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Recurring scan is not configured (no CRON_SECRET)." },
      { status: 503 }
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userIds = await getRecurringScanUserIds();
  const results: Array<{ userId: string; status: string; risk?: string }> = [];

  for (const userId of userIds) {
    try {
      const settings = await getScanSettings(userId);
      if (!settings.notifyEmail) {
        results.push({ userId, status: "skipped-no-email" });
        continue;
      }

      const findings = await runSecurityChecksForUser(userId);
      if (!findings) {
        results.push({ userId, status: "skipped-no-profile" });
        continue;
      }

      const profile = await getLatestRouterProfile(userId);
      const payload = await sendScanNotification(settings.notifyEmail, findings, profile);
      await saveScanSettings(userId, { lastNotification: payload });
      results.push({ userId, status: "notified", risk: findings.assessment?.riskLevel });
    } catch {
      // One user's failure must not abort the rest of the run.
      results.push({ userId, status: "error" });
    }
  }

  return NextResponse.json({ ok: true, scanned: results.length, results });
}
