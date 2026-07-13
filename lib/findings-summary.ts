import type {
  AssessmentAction,
  CveFinding,
  FindingsAssessment,
  PassiveExposure,
  RouterProfile
} from "./types";

// Ports that are notable when exposed to the public internet on a home router.
// These are the ones a non-technical user should act on if they show up.
const RISKY_PORTS: Record<number, string> = {
  21: "FTP file sharing",
  22: "SSH remote login",
  23: "Telnet (insecure remote login)",
  25: "email relay",
  53: "DNS",
  80: "an unencrypted admin web page",
  443: "an admin web page",
  445: "Windows file sharing",
  3389: "Windows Remote Desktop",
  5555: "Android debug bridge",
  7547: "the TR-069 remote-management port",
  8080: "an alternate admin web page",
  8443: "an alternate admin web page",
  9929: "a diagnostic service",
  31337: "a service commonly associated with backdoors"
};

export type SummaryInput = {
  profile: RouterProfile;
  cve: { query: string | null; results: CveFinding[]; note: string | null };
  passive: { exposure: PassiveExposure | null; note: string | null };
};

function isSevereCve(finding: CveFinding): boolean {
  const severity = finding.severity?.toUpperCase();
  return severity === "CRITICAL" || severity === "HIGH" || (finding.cvssScore ?? 0) >= 7;
}

// Build a plain-English assessment purely from the data, with no LLM. Used as the
// fallback when the agent is unavailable (local/mock/undeployed) and as the
// baseline the LLM is asked to improve on.
export function buildHeuristicAssessment(input: SummaryInput): FindingsAssessment {
  const { profile, cve, passive } = input;
  const actions: AssessmentAction[] = [];

  const severeCves = cve.results.filter(isSevereCve);
  const hasCves = cve.results.length > 0;

  const exposure = passive.exposure;
  const openPorts = exposure?.found ? exposure.ports : [];
  const riskyOpenPorts = openPorts.filter((port) => port in RISKY_PORTS);
  const flaggedVulns = exposure?.found ? exposure.vulns : [];

  let riskLevel: FindingsAssessment["riskLevel"] = "low";
  if (severeCves.length > 0 || flaggedVulns.length > 0 || riskyOpenPorts.length > 0) {
    riskLevel = "high";
  } else if (hasCves || openPorts.length > 0) {
    riskLevel = "medium";
  }

  const routerLabel = [profile.routerVendor, profile.routerModel].filter(Boolean).join(" ") || "your router";

  // Highest-priority action first.
  if (severeCves.length > 0 || hasCves) {
    actions.push({
      title: "Update your router's firmware",
      detail:
        `We found ${cve.results.length} known security issue${cve.results.length === 1 ? "" : "s"} associated with ` +
        `${routerLabel}. Installing the latest firmware from the manufacturer usually fixes these. ` +
        "Check the admin page or the vendor's support site for an update.",
      priority: severeCves.length > 0 ? "high" : "medium"
    });
  }

  if (riskyOpenPorts.length > 0) {
    const described = riskyOpenPorts
      .map((port) => `${port} (${RISKY_PORTS[port]})`)
      .join(", ");
    actions.push({
      title: "Close services exposed to the internet",
      detail:
        `Your public IP is reachable on port${riskyOpenPorts.length === 1 ? "" : "s"} ${described}. ` +
        "Unless you deliberately set these up, turn off remote management/port forwarding for them in your " +
        "router settings so they aren't open to the whole internet.",
      priority: "high"
    });
  } else if (openPorts.length > 0) {
    actions.push({
      title: "Review what's reachable from the internet",
      detail:
        `Public scanners can see ${openPorts.length} open port${openPorts.length === 1 ? "" : "s"} on your ` +
        "connection. Confirm each one is something you intentionally enabled; disable anything you don't recognize.",
      priority: "medium"
    });
  }

  if (flaggedVulns.length > 0) {
    actions.push({
      title: "Address flagged internet-facing vulnerabilities",
      detail:
        `Public scan data flagged ${flaggedVulns.length} known vulnerabilit${flaggedVulns.length === 1 ? "y" : "ies"} on ` +
        "a service exposed by your connection. Updating firmware and closing unused services typically resolves these.",
      priority: "high"
    });
  }

  // A safe default when nothing needs attention.
  if (actions.length === 0) {
    actions.push({
      title: "Keep doing what you're doing",
      detail:
        "No known vulnerabilities or risky internet-facing services were found. Keep firmware updated and re-run " +
        "this check occasionally to stay current.",
      priority: "low"
    });
  }

  let headline: string;
  let summary: string;

  if (riskLevel === "high") {
    headline = "Action needed to secure your network";
    summary =
      `We found issues on ${routerLabel} that are worth fixing soon. ` +
      "The steps below are ordered by importance — start at the top. None of this requires deep technical skill.";
  } else if (riskLevel === "medium") {
    headline = "A few things worth checking";
    summary =
      `${routerLabel} looks mostly okay, but there are a couple of items to review. ` +
      "Work through the steps below when you get a chance.";
  } else {
    headline = "No urgent problems found";
    summary =
      `Good news — we didn't find known vulnerabilities or risky internet-facing services for ${routerLabel}. ` +
      "Keep your firmware up to date and check back periodically.";
  }

  return { headline, riskLevel, summary, actions, source: "heuristic", sources: [] };
}

const PRIORITIES = new Set(["high", "medium", "low"]);
const RISK_LEVELS = new Set(["low", "medium", "high"]);

// Validate/normalize an assessment object coming from the LLM. Returns null when
// the shape is unusable so callers can fall back to the heuristic. This keeps us
// resilient to model drift and prevents malformed output from reaching the UI.
export function parseAssessment(value: unknown): FindingsAssessment | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const headline = typeof raw.headline === "string" ? raw.headline.trim() : "";
  const summary = typeof raw.summary === "string" ? raw.summary.trim() : "";
  const riskLevel = typeof raw.riskLevel === "string" ? raw.riskLevel.toLowerCase() : "";

  if (!headline || !summary || !RISK_LEVELS.has(riskLevel)) {
    return null;
  }

  const actionsRaw = Array.isArray(raw.actions) ? raw.actions : [];
  const actions: AssessmentAction[] = actionsRaw
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const action = item as Record<string, unknown>;
      const title = typeof action.title === "string" ? action.title.trim() : "";
      const detail = typeof action.detail === "string" ? action.detail.trim() : "";
      const priority = typeof action.priority === "string" ? action.priority.toLowerCase() : "medium";
      if (!title || !detail) {
        return null;
      }
      return {
        title,
        detail,
        priority: (PRIORITIES.has(priority) ? priority : "medium") as AssessmentAction["priority"]
      } satisfies AssessmentAction;
    })
    .filter((action): action is AssessmentAction => action !== null)
    .slice(0, 6);

  if (actions.length === 0) {
    return null;
  }

  const sources = Array.isArray(raw.sources)
    ? raw.sources.filter((item): item is string => typeof item === "string")
    : [];

  return {
    headline,
    summary,
    riskLevel: riskLevel as FindingsAssessment["riskLevel"],
    actions,
    source: "llm",
    sources
  };
}
