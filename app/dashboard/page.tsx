import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getClientPublicIpSuggestion } from "@/lib/client-ip";
import { getLatestRouterProfile } from "@/lib/router-profile";
import { getSecurityFindings } from "@/lib/security-findings";
import { getScanSettings } from "@/lib/scan-settings";
import type { AssessmentAction, CveFinding, FindingsAssessment, RouterProfile, ScanSettings, SecurityFindings } from "@/lib/types";
import { signOutAction } from "../actions";
import { ProfileEditForm } from "./profile-edit-form";
import { SecurityChecksForm } from "./security-checks-form";
import { RecurringScanForm } from "./recurring-scan-form";

type PostureLevel = "good" | "attention" | "unknown";
// `detail` says what we saw and what to do; `why` is a plain-English reason the
// setting matters, so a non-technical user understands the stakes, not just the verdict.
type Finding = { label: string; level: PostureLevel; detail: string; why: string };

function contains(value: string | null, needles: string[]) {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return needles.some((needle) => normalized.includes(needle));
}

function toggleFinding(
  label: string,
  value: string | null,
  { riskyWhenOn, why, offDetail, onDetail, unknownDetail }: {
    riskyWhenOn: boolean;
    why: string;
    offDetail: string;
    onDetail: string;
    unknownDetail: string;
  }
): Finding {
  if (!value) {
    return { label, level: "unknown", detail: unknownDetail, why };
  }

  const isOff = contains(value, ["disable", "off", "not "]);
  const isOn = !isOff && contains(value, ["enable", "active", "on"]);

  if (isOff) {
    return { label, level: riskyWhenOn ? "good" : "attention", detail: offDetail, why };
  }

  if (isOn) {
    return { label, level: riskyWhenOn ? "attention" : "good", detail: onDetail, why };
  }

  return {
    label,
    level: "unknown",
    detail: `We saw "${value}" but couldn't tell whether it's on or off. ${unknownDetail}`,
    why
  };
}

function buildPosture(profile: RouterProfile): Finding[] {
  const findings: Finding[] = [];

  findings.push(
    toggleFinding("Automatic port opening (UPnP)", profile.upnpStatus, {
      riskyWhenOn: true,
      why: "UPnP lets devices open doors to the internet by themselves, without asking you. It's convenient, but something can end up exposed without your knowledge.",
      onDetail: "This is turned on. Unless a specific device (like a game console) really needs it, it's safer to switch it off in your router settings.",
      offDetail: "This is turned off — good. Devices can't quietly open your network to the internet.",
      unknownDetail: "Add a screenshot of the page that shows UPnP so we can check it."
    })
  );

  findings.push(
    toggleFinding("Remote access to router settings", profile.remoteAdminStatus, {
      riskyWhenOn: true,
      why: "This controls whether your router's settings page can be opened from anywhere on the internet, not just from home. If it's on, strangers can try to log in and guess your password.",
      onDetail: "This is on, so your router's control panel can be reached from the internet. Unless you specifically need it, turn it off.",
      offDetail: "This is off — good. Your settings can only be changed from inside your home network.",
      unknownDetail: "This is a common way routers get attacked, so it's worth adding a screenshot of that setting."
    })
  );

  findings.push(
    toggleFinding("Port forwarding rules", profile.portForwardingStatus, {
      riskyWhenOn: true,
      why: "Port forwarding deliberately opens a specific door from the internet to one device at home — often set up for cameras or game servers. Old or forgotten rules can leave a device exposed.",
      onDetail: "One or more of these doors are open. Take a quick look and remove any you don't recognize or no longer use.",
      offDetail: "No open doors were found — nothing extra is exposed to the internet here.",
      unknownDetail: "Add a screenshot of that page so we can check for anything left open."
    })
  );

  const wifiWhy =
    'This is the type of lock on your Wi-Fi. Newer locks (WPA2 and WPA3) are very hard to break; older ones (WEP or "open") can let neighbors or passersby onto your network.';

  if (!profile.wifiSecurity) {
    findings.push({
      label: "Wi-Fi password protection",
      level: "unknown",
      detail: "We don't know what Wi-Fi protection you're using yet. Add a screenshot of your wireless security page so we can check it.",
      why: wifiWhy
    });
  } else if (contains(profile.wifiSecurity, ["wpa3"])) {
    findings.push({
      label: "Wi-Fi password protection",
      level: "good",
      detail: `You're using WPA3 (${profile.wifiSecurity}), the strongest Wi-Fi protection available. Nothing to do here.`,
      why: wifiWhy
    });
  } else if (contains(profile.wifiSecurity, ["wpa2"])) {
    findings.push({
      label: "Wi-Fi password protection",
      level: "good",
      detail: `You're using WPA2 (${profile.wifiSecurity}), which is strong and safe. If all your devices support WPA3, switching to it is an easy upgrade.`,
      why: wifiWhy
    });
  } else if (contains(profile.wifiSecurity, ["wep", "open", "none", "wpa "])) {
    findings.push({
      label: "Wi-Fi password protection",
      level: "attention",
      detail: `Your Wi-Fi is using older, weak protection (${profile.wifiSecurity}). Change it to WPA2 or WPA3 in your router settings so others can't easily join your network.`,
      why: wifiWhy
    });
  } else {
    findings.push({
      label: "Wi-Fi password protection",
      level: "unknown",
      detail: `We saw "${profile.wifiSecurity}" but couldn't tell how strong it is. Aim for WPA2 or WPA3.`,
      why: wifiWhy
    });
  }

  const firmwareWhy =
    "Firmware is the software that runs your router. Just like a phone, updates fix security holes — running an old version leaves known problems unpatched.";

  if (profile.firmwareVersion) {
    findings.push({
      label: "Router software (firmware)",
      level: "unknown",
      detail: `You're on version ${profile.firmwareVersion}. Check your router's admin page or the maker's website for a newer version and install it if one is available.`,
      why: firmwareWhy
    });
  } else {
    findings.push({
      label: "Router software (firmware)",
      level: "unknown",
      detail: "We don't know your firmware version yet. Add a screenshot of the page that shows it so we can check whether it's up to date.",
      why: firmwareWhy
    });
  }

  return findings;
}

const levelLabel: Record<PostureLevel, string> = {
  good: "OK",
  attention: "Action",
  unknown: "Not checked"
};

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
  const attentionCount = findings.filter((finding) => finding.level === "attention").length;
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
              {findings.map((finding) => (
                <li className="finding" key={finding.label}>
                  <span className={`badge badge-${finding.level}`}>{levelLabel[finding.level]}</span>
                  <div>
                    <b>{finding.label}</b>
                    <p className="muted">{finding.detail}</p>
                    <p className="why">
                      <b>Why it matters:</b> {finding.why}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <SecurityChecksCard findings={securityFindings} scanSettings={scanSettings} userEmail={user.email} />

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
      </div>
    </main>
  );
}
