import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getClientPublicIpSuggestion } from "@/lib/client-ip";
import { getLatestRouterProfile } from "@/lib/router-profile";
import { getSecurityFindings } from "@/lib/security-findings";
import { getScanSettings } from "@/lib/scan-settings";
import { getAcknowledgedFindingKeys } from "@/lib/acknowledgements";
import { buildPosture, type Finding, type PostureLevel } from "@/lib/posture";
import type { AssessmentAction, CveFinding, FindingsAssessment, RouterProfile, ScanSettings, SecurityFindings } from "@/lib/types";
import { signOutAction, toggleFindingAcknowledgementAction } from "../actions";
import { ProfileEditForm } from "./profile-edit-form";
import { SecurityChecksForm } from "./security-checks-form";
import { RecurringScanForm } from "./recurring-scan-form";
import { DashboardTabs } from "./dashboard-tabs";

const levelLabel: Record<PostureLevel, string> = {
  good: "OK",
  attention: "Action",
  unknown: "Not checked"
};

// The router-config posture ("Router checks" tab). Attention findings the user is
// intentionally keeping (e.g. a deliberate port-forwarding rule) can be acknowledged
// — they drop out of the action list into a separate "Acknowledged" section and stop
// counting toward the tab badge. A stale acknowledgement on a finding that's no longer
// attention (e.g. UPnP later turned off) is simply ignored — it shows normally.
function RouterChecksCard({
  findings,
  acknowledgedKeys,
  attentionCount,
  unknownCount
}: {
  findings: Finding[];
  acknowledgedKeys: string[];
  attentionCount: number;
  unknownCount: number;
}) {
  const acknowledgedSet = new Set(acknowledgedKeys);
  const isAcknowledged = (finding: Finding) =>
    finding.level === "attention" && acknowledgedSet.has(finding.key);
  const activeFindings = findings.filter((finding) => !isAcknowledged(finding));
  const acknowledgedFindings = findings.filter(isAcknowledged);

  return (
    <section className="card">
      <div className="card-inner stack">
        <div>
          <p className="eyebrow">Your router settings</p>
          <h2>
            {attentionCount > 0
              ? `${attentionCount} setting${attentionCount > 1 ? "s" : ""} worth changing`
              : "Your main settings look safe"}
          </h2>
          <p className="muted">
            This is based on the router screenshots you uploaded. Here is what each important
            setting means and why it matters.
            {unknownCount > 0
              ? ` We couldn't read ${unknownCount} of them yet — add more screenshots to complete the picture.`
              : " We were able to check every setting we look for."}
          </p>
        </div>
        <ul className="finding-list">
          {activeFindings.map((finding) => (
            <li className="finding" key={finding.key}>
              <span className={`badge badge-${finding.level}`}>{levelLabel[finding.level]}</span>
              <div>
                <b>{finding.label}</b>
                <p className="muted">{finding.detail}</p>
                <p className="why">
                  <b>Why it matters:</b> {finding.why}
                </p>
                {finding.level === "attention" ? (
                  <form action={toggleFindingAcknowledgementAction} className="ack-form">
                    <input type="hidden" name="key" value={finding.key} />
                    <input type="hidden" name="acknowledged" value="true" />
                    <button type="submit" className="ack-button">
                      I&apos;m keeping this on purpose — acknowledge
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>

        {acknowledgedFindings.length > 0 ? (
          <details className="acknowledged-section" open>
            <summary>Acknowledged — you&apos;re keeping these ({acknowledgedFindings.length})</summary>
            <ul className="finding-list">
              {acknowledgedFindings.map((finding) => (
                <li className="finding" key={finding.key}>
                  <span className="badge badge-acknowledged">Acknowledged</span>
                  <div>
                    <b>{finding.label}</b>
                    <p className="muted">{finding.detail}</p>
                    <form action={toggleFindingAcknowledgementAction} className="ack-form">
                      <input type="hidden" name="key" value={finding.key} />
                      <input type="hidden" name="acknowledged" value="false" />
                      <button type="submit" className="ack-button">
                        Move back to actions
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </section>
  );
}

// Map a CVSS base score / NVD severity string to one of our posture levels so
// CVEs render with the same visual language as the rest of the dashboard.
function cveLevel(finding: CveFinding): PostureLevel {
  const severity = finding.severity?.toUpperCase();
  if (severity === "CRITICAL" || severity === "HIGH") return "attention";
  if ((finding.cvssScore ?? 0) >= 7) return "attention";
  if (severity === "MEDIUM" || (finding.cvssScore ?? 0) >= 4) return "unknown";
  return "good";
}

function formatCheckedAt(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "unknown time" : date.toLocaleString();
}

const riskLabel: Record<FindingsAssessment["riskLevel"], string> = {
  high: "High risk",
  medium: "Medium risk",
  low: "Low risk"
};

const priorityLabel: Record<AssessmentAction["priority"], string> = {
  high: "Do first",
  medium: "Next",
  low: "When you can"
};

// The plain-English assessment users read first. Raw CVE/exposure data stays
// available underneath in a collapsed section for anyone who wants the detail.
function AssessmentSummary({ assessment }: { assessment: FindingsAssessment }) {
  // Findings persisted before newer fields existed may lack `sources` (and, defensively,
  // `actions`). Default them so a legacy row can't crash the server-rendered dashboard.
  const actions = assessment.actions ?? [];
  const sources = assessment.sources ?? [];

  return (
    <div className="assessment stack">
      <div className="assessment-head">
        <span className={`badge badge-risk-${assessment.riskLevel}`}>{riskLabel[assessment.riskLevel]}</span>
        <h3>{assessment.headline}</h3>
      </div>
      <p>{assessment.summary}</p>
      <ul className="finding-list">
        {actions.map((action) => (
          <li className="finding" key={action.title}>
            <span className={`badge badge-risk-${action.priority}`}>{priorityLabel[action.priority]}</span>
            <div>
              <b>{action.title}</b>
              <p className="muted">{action.detail}</p>
            </div>
          </li>
        ))}
      </ul>
      {sources.length > 0 ? (
        <p className="muted">Based on GridWatch guidance: {sources.join(", ")}.</p>
      ) : null}
      {assessment.source === "heuristic" ? (
        <p className="muted">
          This summary was generated locally from the raw results. Connect the GridWatch agent for a
          richer, AI-written explanation.
        </p>
      ) : null}
    </div>
  );
}

type CoverageRow = { name: string; level: PostureLevel; detail: string };

// Per-tool coverage so a clean result is still visibly confirmed (not silent).
// This mirrors what drove the risk level but never adds to the action list — it's
// a "what we checked" summary, using the same OK/Action/Not checked language as
// the router-settings posture. Defensive against legacy findings missing newer
// fields (e.g. `reputation`).
function buildChecksCoverage(findings: SecurityFindings): CoverageRow[] {
  const rows: CoverageRow[] = [];

  const cveCount = findings.cve.results.length;
  if (findings.cve.query === null) {
    rows.push({ name: "Known vulnerabilities", level: "unknown", detail: "NVD — add your router model to check" });
  } else if (cveCount > 0) {
    rows.push({ name: "Known vulnerabilities", level: "attention", detail: `NVD — ${cveCount} found` });
  } else {
    rows.push({ name: "Known vulnerabilities", level: "good", detail: "NVD — none found" });
  }

  const exposure = findings.passive.exposure;
  if (!exposure) {
    rows.push({ name: "Internet exposure", level: "unknown", detail: "InternetDB — add a public IP to check" });
  } else if (exposure.found && (exposure.ports.length > 0 || exposure.vulns.length > 0)) {
    const bits: string[] = [];
    if (exposure.ports.length > 0) bits.push(`${exposure.ports.length} open port${exposure.ports.length === 1 ? "" : "s"}`);
    if (exposure.vulns.length > 0) bits.push(`${exposure.vulns.length} flagged CVE${exposure.vulns.length === 1 ? "" : "s"}`);
    rows.push({ name: "Internet exposure", level: "attention", detail: `InternetDB — ${bits.join(", ")}` });
  } else {
    rows.push({ name: "Internet exposure", level: "good", detail: "InternetDB — nothing exposed" });
  }

  const rep = findings.reputation?.result;
  if (!rep || !rep.found) {
    rows.push({ name: "IP reputation", level: "unknown", detail: "AbuseIPDB — not checked" });
  } else if (rep.abuseConfidenceScore > 0) {
    rows.push({ name: "IP reputation", level: "attention", detail: `AbuseIPDB — ${rep.abuseConfidenceScore}/100` });
  } else {
    rows.push({ name: "IP reputation", level: "good", detail: "AbuseIPDB — 0/100 (clean)" });
  }

  return rows;
}

// A compact "what we checked" strip so clean checks are acknowledged rather than
// invisible. Sits between the plain-English assessment and the raw technical details.
function ChecksCoverage({ findings }: { findings: SecurityFindings }) {
  const rows = buildChecksCoverage(findings);

  return (
    <div className="checks-coverage stack">
      <b>What we checked</b>
      <ul className="finding-list">
        {rows.map((row) => (
          <li className="finding" key={row.name}>
            <span className={`badge badge-${row.level}`}>{levelLabel[row.level]}</span>
            <div>
              <b>{row.name}</b>
              <p className="muted">{row.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SecurityChecksCard({
  findings,
  scanSettings,
  userEmail
}: {
  findings: SecurityFindings | null;
  scanSettings: ScanSettings;
  userEmail: string;
}) {
  return (
    <section className="card">
      <div className="card-inner stack">
        <div>
          <p className="eyebrow">Vulnerability &amp; exposure</p>
          <h2>External security checks</h2>
          <p className="muted">
            Read-only lookups using your saved router model and verified public IP. We query NIST NVD for
            known vulnerabilities, Shodan InternetDB for what public scanners already see, and AbuseIPDB for
            your public IP&apos;s reputation. Nothing is actively scanned.
          </p>
        </div>

        <SecurityChecksForm hasResults={findings !== null} />

        {findings ? (
          <p className="muted">Last checked {formatCheckedAt(findings.checkedAt)}.</p>
        ) : (
          <p className="muted">No checks have been run yet.</p>
        )}

        {findings?.assessment ? <AssessmentSummary assessment={findings.assessment} /> : null}

        {findings ? <ChecksCoverage findings={findings} /> : null}

        {findings ? (
          <details className="tech-details">
            <summary>See full technical details</summary>
            <div className="stack">
            <div>
              <b>Known vulnerabilities (NVD)</b>
              {findings.cve.query ? (
                <p className="muted">Matched against &quot;{findings.cve.query}&quot;.</p>
              ) : null}
              {findings.cve.note ? <p className="muted">{findings.cve.note}</p> : null}
              {findings.cve.results.length > 0 ? (
                <ul className="finding-list">
                  {findings.cve.results.map((cve) => {
                    const level = cveLevel(cve);
                    return (
                      <li className="finding" key={cve.id}>
                        <span className={`badge badge-${level}`}>
                          {cve.severity ?? (cve.cvssScore !== null ? String(cve.cvssScore) : "N/A")}
                        </span>
                        <div>
                          <b>
                            <a href={cve.url} target="_blank" rel="noreferrer noopener">
                              {cve.id}
                            </a>
                            {cve.cvssScore !== null ? ` — CVSS ${cve.cvssScore}` : ""}
                          </b>
                          <p className="muted">{cve.description}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>

            <div>
              <b>Passive internet exposure (InternetDB)</b>
              {findings.passive.note ? <p className="muted">{findings.passive.note}</p> : null}
              {findings.passive.exposure && findings.passive.exposure.found ? (
                <ul className="result-list">
                  <li>
                    <b>Open ports:</b>{" "}
                    {findings.passive.exposure.ports.length > 0
                      ? findings.passive.exposure.ports.join(", ")
                      : "none observed"}
                  </li>
                  {findings.passive.exposure.hostnames.length > 0 ? (
                    <li>
                      <b>Hostnames:</b> {findings.passive.exposure.hostnames.join(", ")}
                    </li>
                  ) : null}
                  {findings.passive.exposure.tags.length > 0 ? (
                    <li>
                      <b>Tags:</b> {findings.passive.exposure.tags.join(", ")}
                    </li>
                  ) : null}
                  {findings.passive.exposure.vulns.length > 0 ? (
                    <li>
                      <b>Flagged CVEs:</b> {findings.passive.exposure.vulns.join(", ")}
                    </li>
                  ) : null}
                </ul>
              ) : null}
            </div>

            <div>
              <b>Public IP reputation (AbuseIPDB)</b>
              {findings.reputation?.note ? <p className="muted">{findings.reputation.note}</p> : null}
              {findings.reputation?.result && findings.reputation.result.found ? (
                <ul className="result-list">
                  <li>
                    <b>Abuse confidence score:</b> {findings.reputation.result.abuseConfidenceScore}/100
                  </li>
                  <li>
                    <b>Reports (last 90 days):</b> {findings.reputation.result.totalReports}
                  </li>
                  {findings.reputation.result.isp ? (
                    <li>
                      <b>ISP:</b> {findings.reputation.result.isp}
                    </li>
                  ) : null}
                  {findings.reputation.result.isTor ? (
                    <li>
                      <b>Tor exit node:</b> yes
                    </li>
                  ) : null}
                </ul>
              ) : null}
            </div>

            <details className="raw-json">
              <summary>Raw tool output (JSON)</summary>
              <p className="muted">
                The unprocessed results from the security tools (NIST NVD, Shodan InternetDB,
                and AbuseIPDB) that GridWatch condenses into the plain-English assessment above.
              </p>
              <pre>{JSON.stringify({ nist_nvd: findings.cve ?? null, shodan_internetdb: findings.passive ?? null, abuseipdb: findings.reputation ?? null }, null, 2)}</pre>
            </details>
            </div>
          </details>
        ) : null}

        <div className="stack recurring-scan">
          <div>
            <p className="eyebrow">Recurring scans</p>
            <h3>Automatic monitoring &amp; email alerts</h3>
            <p className="muted">
              Turn on a daily re-scan so GridWatch keeps watching for new vulnerabilities and exposure, and
              emails you a plain-English summary. Use &quot;Run scan &amp; email now&quot; to see exactly what that
              email looks like.
            </p>
          </div>
          <RecurringScanForm
            enabled={scanSettings.recurringEnabled}
            email={scanSettings.notifyEmail ?? userEmail}
            lastNotification={scanSettings.lastNotification}
          />
        </div>
      </div>
    </section>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: { updated?: string } }) {
  const user = await requireUser();
  const profile = await getLatestRouterProfile(user.id);

  // No evidence captured yet — the dashboard has nothing to summarize, so send
  // the user to the upload flow instead.
  if (!profile) {
    redirect("/setup");
  }

  const findings = buildPosture(profile);
  const acknowledgedKeys = await getAcknowledgedFindingKeys(user.id);
  const acknowledgedSet = new Set(acknowledgedKeys);
  // Acknowledged attention findings drop out of the "worth changing" count so they
  // leave the to-do list (and the tab badge).
  const attentionCount = findings.filter(
    (finding) => finding.level === "attention" && !acknowledgedSet.has(finding.key)
  ).length;
  const unknownCount = findings.filter((finding) => finding.level === "unknown").length;
  const securityFindings = await getSecurityFindings(user.id);
  const scanSettings = await getScanSettings(user.id);

  // Only suggest a browser-derived public IP when the profile doesn't have one.
  const publicIpSuggestion = profile.publicIp ? null : getClientPublicIpSuggestion();

  return (
    <main className="page-shell">
      <div className="container">
        <div className="header-row">
          <div>
            <p className="eyebrow">Home network overview</p>
            <h1>Security dashboard</h1>
            <p className="muted">Signed in as {user.email}</p>
          </div>
          <div className="header-actions">
            <Link className="secondary-button" href="/chat">
              Ask the assistant
            </Link>
            <Link className="secondary-button" href="/setup">
              Add more evidence
            </Link>
            <form action={signOutAction}>
              <button className="secondary-button" type="submit">Sign out</button>
            </form>
          </div>
        </div>

        {searchParams.updated === "1" ? (
          <p className="success">Router evidence saved. Your security overview is updated below.</p>
        ) : null}

        <DashboardTabs
          defaultTabId="settings"
          tabs={[
            {
              id: "settings",
              label: "Router checks",
              badge: attentionCount,
              content: (
                <RouterChecksCard
                  findings={findings}
                  acknowledgedKeys={acknowledgedKeys}
                  attentionCount={attentionCount}
                  unknownCount={unknownCount}
                />
              )
            },
            {
              id: "checks",
              label: "External checks",
              content: (
                <SecurityChecksCard findings={securityFindings} scanSettings={scanSettings} userEmail={user.email} />
              )
            },
            {
              id: "details",
              label: "Router details",
              badge: profile.missingFields.length,
              content: (
                <div className="two-column">
                  <section className="card">
                    <div className="card-inner stack">
                      <div>
                        <p className="eyebrow">Saved profile</p>
                        <h2>Router details</h2>
                        <p className="muted">
                          Review and complete anything the extractor couldn&apos;t read from your upload
                          ({profile.imageName ?? "unknown file"}).
                        </p>
                      </div>
                      <ProfileEditForm
                        values={{
                          routerVendor: profile.routerVendor,
                          routerModel: profile.routerModel,
                          hardwareVersion: profile.hardwareVersion,
                          firmwareVersion: profile.firmwareVersion,
                          publicIp: profile.publicIp,
                          routerAdminUrl: profile.routerAdminUrl,
                          upnpStatus: profile.upnpStatus,
                          remoteAdminStatus: profile.remoteAdminStatus,
                          portForwardingStatus: profile.portForwardingStatus,
                          wifiSecurity: profile.wifiSecurity
                        }}
                        publicIpSuggestion={publicIpSuggestion}
                      />
                      <div className="label-value">
                        <b>Scan approved</b>
                        <span>
                          {profile.scanApproved
                            ? `Yes${profile.scanTargetIp ? ` for ${profile.scanTargetIp}` : ""}`
                            : "No"}
                        </span>
                      </div>
                    </div>
                  </section>

                  <section className="card">
                    <div className="card-inner stack">
                      <div>
                        <p className="eyebrow">Next evidence needed</p>
                        <h2>Missing from evidence</h2>
                      </div>
                      {profile.missingFields.length > 0 ? (
                        <ul className="result-list">
                          {profile.missingFields.map((field) => (
                            <li key={field}>{field}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="success">No required fields were reported missing by the extractor.</p>
                      )}
                      {profile.extraction.notes.length > 0 ? (
                        <div className="notice">
                          {profile.extraction.notes.map((note) => (
                            <p key={note}>{note}</p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </section>
                </div>
              )
            }
          ]}
        />
      </div>
    </main>
  );
}
