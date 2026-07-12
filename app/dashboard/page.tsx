import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getClientPublicIpSuggestion } from "@/lib/client-ip";
import { getLatestRouterProfile } from "@/lib/router-profile";
import { getSecurityFindings } from "@/lib/security-findings";
import type { AssessmentAction, CveFinding, FindingsAssessment, RouterProfile, SecurityFindings } from "@/lib/types";
import { signOutAction } from "../actions";
import { ProfileEditForm } from "./profile-edit-form";
import { SecurityChecksForm } from "./security-checks-form";

type PostureLevel = "good" | "attention" | "unknown";
type Finding = { label: string; level: PostureLevel; detail: string };

function contains(value: string | null, needles: string[]) {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return needles.some((needle) => normalized.includes(needle));
}

function toggleFinding(
  label: string,
  value: string | null,
  { riskyWhenOn, offDetail, onDetail, unknownDetail }: {
    riskyWhenOn: boolean;
    offDetail: string;
    onDetail: string;
    unknownDetail: string;
  }
): Finding {
  if (!value) {
    return { label, level: "unknown", detail: unknownDetail };
  }

  const isOff = contains(value, ["disable", "off", "not "]);
  const isOn = !isOff && contains(value, ["enable", "active", "on"]);

  if (isOff) {
    return { label, level: riskyWhenOn ? "good" : "attention", detail: offDetail };
  }

  if (isOn) {
    return { label, level: riskyWhenOn ? "attention" : "good", detail: onDetail };
  }

  return { label, level: "unknown", detail: `Captured as "${value}". ${unknownDetail}` };
}

function buildPosture(profile: RouterProfile): Finding[] {
  const findings: Finding[] = [];

  findings.push(
    toggleFinding("UPnP", profile.upnpStatus, {
      riskyWhenOn: true,
      onDetail: "UPnP appears enabled. It can silently open inbound ports — disable it unless a device truly needs it.",
      offDetail: "UPnP appears disabled, which reduces the risk of silently opened ports.",
      unknownDetail: "Capture the UPnP setting so exposure from auto-opened ports can be assessed."
    })
  );

  findings.push(
    toggleFinding("Remote administration", profile.remoteAdminStatus, {
      riskyWhenOn: true,
      onDetail: "Remote admin appears enabled. This exposes the router's admin interface to the internet — disable it unless required.",
      offDetail: "Remote admin appears disabled, keeping the admin interface off the public internet.",
      unknownDetail: "Capture the remote administration setting; if enabled it is a common attack surface."
    })
  );

  findings.push(
    toggleFinding("Port forwarding", profile.portForwardingStatus, {
      riskyWhenOn: true,
      onDetail: "Port forwarding rules appear active. Review each rule and remove any that are no longer needed.",
      offDetail: "No active port forwarding was detected.",
      unknownDetail: "Capture the port forwarding page to review any inbound rules."
    })
  );

  if (!profile.wifiSecurity) {
    findings.push({
      label: "Wi-Fi security",
      level: "unknown",
      detail: "Capture the wireless security mode so weak encryption can be flagged."
    });
  } else if (contains(profile.wifiSecurity, ["wpa3"])) {
    findings.push({ label: "Wi-Fi security", level: "good", detail: `Strong Wi-Fi encryption detected (${profile.wifiSecurity}).` });
  } else if (contains(profile.wifiSecurity, ["wpa2"])) {
    findings.push({ label: "Wi-Fi security", level: "good", detail: `Modern Wi-Fi encryption detected (${profile.wifiSecurity}). WPA3 is stronger if your devices support it.` });
  } else if (contains(profile.wifiSecurity, ["wep", "open", "none", "wpa "])) {
    findings.push({ label: "Wi-Fi security", level: "attention", detail: `Weak or open Wi-Fi encryption detected (${profile.wifiSecurity}). Move to WPA2 or WPA3.` });
  } else {
    findings.push({ label: "Wi-Fi security", level: "unknown", detail: `Captured as "${profile.wifiSecurity}". Confirm it is WPA2 or WPA3.` });
  }

  if (profile.firmwareVersion) {
    findings.push({
      label: "Firmware",
      level: "unknown",
      detail: `Firmware ${profile.firmwareVersion} captured. Check the vendor site for a newer release and known advisories.`
    });
  } else {
    findings.push({
      label: "Firmware",
      level: "unknown",
      detail: "Capture the firmware version so it can be checked against known vulnerabilities."
    });
  }

  return findings;
}

const levelLabel: Record<PostureLevel, string> = {
  good: "OK",
  attention: "Attention",
  unknown: "Unknown"
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
  return (
    <div className="assessment stack">
      <div className="assessment-head">
        <span className={`badge badge-risk-${assessment.riskLevel}`}>{riskLabel[assessment.riskLevel]}</span>
        <h3>{assessment.headline}</h3>
      </div>
      <p>{assessment.summary}</p>
      <ul className="finding-list">
        {assessment.actions.map((action) => (
          <li className="finding" key={action.title}>
            <span className={`badge badge-risk-${action.priority}`}>{priorityLabel[action.priority]}</span>
            <div>
              <b>{action.title}</b>
              <p className="muted">{action.detail}</p>
            </div>
          </li>
        ))}
      </ul>
      {assessment.source === "heuristic" ? (
        <p className="muted">
          This summary was generated locally from the raw results. Connect the GridWatch agent for a
          richer, AI-written explanation.
        </p>
      ) : null}
    </div>
  );
}

function SecurityChecksCard({ findings }: { findings: SecurityFindings | null }) {
  return (
    <section className="card">
      <div className="card-inner stack">
        <div>
          <p className="eyebrow">Vulnerability &amp; exposure</p>
          <h2>External security checks</h2>
          <p className="muted">
            Read-only lookups using your saved router model and verified public IP. We query NIST NVD for
            known vulnerabilities and Shodan InternetDB for what public scanners already see. Nothing is
            actively scanned.
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
            </div>
          </details>
        ) : null}
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
              <p className="eyebrow">Posture summary</p>
              <h2>
                {attentionCount > 0
                  ? `${attentionCount} item${attentionCount > 1 ? "s" : ""} need attention`
                  : "No high-risk settings flagged"}
              </h2>
              <p className="muted">
                {unknownCount > 0
                  ? `${unknownCount} setting${unknownCount > 1 ? "s are" : " is"} not captured yet. Add more router screenshots to complete the picture.`
                  : "All monitored settings were captured from your router evidence."}
              </p>
            </div>
            <ul className="finding-list">
              {findings.map((finding) => (
                <li className="finding" key={finding.label}>
                  <span className={`badge badge-${finding.level}`}>{levelLabel[finding.level]}</span>
                  <div>
                    <b>{finding.label}</b>
                    <p className="muted">{finding.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <SecurityChecksCard findings={securityFindings} />

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
