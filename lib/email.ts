import type { NotificationPayload, RouterProfile, SecurityFindings } from "./types";

// Compose a plain-text notification email from a completed scan. Kept separate
// from delivery so it can be unit-tested and reused by any provider.
export function buildScanNotification(
  to: string,
  findings: SecurityFindings,
  profile: RouterProfile | null
): NotificationPayload {
  const assessment = findings.assessment;
  const riskLevel = assessment?.riskLevel ?? "low";
  const routerLabel =
    [profile?.routerVendor, profile?.routerModel].filter(Boolean).join(" ") || "your router";

  const riskWord = riskLevel === "high" ? "Action needed" : riskLevel === "medium" ? "A few things to review" : "All clear";
  const subject = `GridWatch scan: ${riskWord} for ${routerLabel}`;

  const lines: string[] = [];
  lines.push(assessment?.headline ?? "GridWatch ran your scheduled security scan.");
  lines.push("");
  if (assessment?.summary) {
    lines.push(assessment.summary);
    lines.push("");
  }

  const actions = assessment?.actions ?? [];
  if (actions.length > 0) {
    lines.push("What to do:");
    for (const action of actions) {
      lines.push(`- [${action.priority.toUpperCase()}] ${action.title}: ${action.detail}`);
    }
    lines.push("");
  }

  const cveCount = findings.cve.results.length;
  const openPorts = findings.passive.exposure?.found ? findings.passive.exposure.ports.length : 0;
  const abuseScore = findings.reputation.result?.found ? findings.reputation.result.abuseConfidenceScore : 0;
  lines.push(
    `Scan summary: ${cveCount} known vulnerabilit${cveCount === 1 ? "y" : "ies"}, ` +
      `${openPorts} exposed port${openPorts === 1 ? "" : "s"}, IP reputation ${abuseScore}/100.`
  );
  lines.push("");
  lines.push("Open your GridWatch dashboard for the full breakdown.");

  return {
    to,
    subject,
    body: lines.join("\n"),
    sentAt: new Date().toISOString(),
    delivery: "logged"
  };
}

// "Send" a scan notification. In the current build this is a STUB: it builds the
// email and logs it to the server console instead of calling a real provider, so
// the recurring-scan feature works end-to-end for the demo without an external
// email account. Swap the logging block for a provider call (Resend, SES, ...)
// to go live; callers and the returned payload stay the same.
export async function sendScanNotification(
  to: string,
  findings: SecurityFindings,
  profile: RouterProfile | null
): Promise<NotificationPayload> {
  const payload = buildScanNotification(to, findings, profile);

  // eslint-disable-next-line no-console
  console.info(
    `[email:stub] would send scan notification\n` +
      `  to: ${payload.to}\n  subject: ${payload.subject}\n` +
      payload.body
        .split("\n")
        .map((line) => `  | ${line}`)
        .join("\n")
  );

  return payload;
}
