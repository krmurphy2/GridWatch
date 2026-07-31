import type { Finding } from "./posture";
import type { NotificationPayload, RouterProfile, SecurityFindings } from "./types";

// Compose a plain-text notification email from a completed scan. Kept separate
// from delivery so it can be unit-tested and reused by any provider.
//
// `routerActions` are the unacknowledged router-config "action needed" items from
// the posture (Router checks) — passed in already filtered so the email respects
// acknowledgements exactly like the dashboard does.
export function buildScanNotification(
  to: string,
  findings: SecurityFindings,
  profile: RouterProfile | null,
  routerActions: Finding[] = []
): NotificationPayload {
  const assessment = findings.assessment;
  const externalRisk = assessment?.riskLevel ?? "low";
  const hasRouterActions = routerActions.length > 0;
  const routerLabel =
    [profile?.routerVendor, profile?.routerModel].filter(Boolean).join(" ") || "your router";

  // Router config actions count toward "needs attention" so the subject line isn't
  // "All clear" when there are unacknowledged settings to review.
  const effectiveRisk =
    externalRisk === "high" ? "high" : externalRisk === "medium" || hasRouterActions ? "medium" : "low";
  const riskWord =
    effectiveRisk === "high" ? "Action needed" : effectiveRisk === "medium" ? "A few things to review" : "All clear";
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
    lines.push("What to do (vulnerabilities & exposure):");
    for (const action of actions) {
      lines.push(`- [${action.priority.toUpperCase()}] ${action.title}: ${action.detail}`);
    }
    lines.push("");
  }

  if (hasRouterActions) {
    lines.push("Router settings to review:");
    for (const action of routerActions) {
      lines.push(`- ${action.label}: ${action.detail}`);
    }
    lines.push("");
  }

  const cveCount = findings.cve.results.length;
  const openPorts = findings.passive.exposure?.found ? findings.passive.exposure.ports.length : 0;
  const abuseScore = findings.reputation.result?.found ? findings.reputation.result.abuseConfidenceScore : 0;
  lines.push(
    `Scan summary: ${cveCount} known vulnerabilit${cveCount === 1 ? "y" : "ies"}, ` +
      `${openPorts} exposed port${openPorts === 1 ? "" : "s"}, IP reputation ${abuseScore}/100, ` +
      `${routerActions.length} router setting${routerActions.length === 1 ? "" : "s"} to review.`
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
  profile: RouterProfile | null,
  routerActions: Finding[] = []
): Promise<NotificationPayload> {
  const payload = buildScanNotification(to, findings, profile, routerActions);

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
