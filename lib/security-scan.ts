import { lookupRouterCves } from "./nvd";
import { lookupPassiveExposure } from "./internetdb";
import { lookupIpReputation } from "./abuseipdb";
import { getLatestRouterProfile } from "./router-profile";
import { saveSecurityFindings } from "./security-findings";
import { buildHeuristicAssessment } from "./findings-summary";
import { getFindingsAssessment } from "./findings-summary-client";
import type { SecurityFindings } from "./types";

// Run the read-only external security checks (NVD CVE lookup + InternetDB passive
// exposure + AbuseIPDB reputation) for a user, synthesize an assessment, persist
// the results, and return them. Shared by the manual dashboard action, the "run
// now" action, and the recurring cron job so all three behave identically.
//
// All lookups only use the user's own vendor/model and verified public IP;
// private/LAN addresses are never sent to third parties. Returns null if the user
// has no router profile yet (nothing to scan).
export async function runSecurityChecksForUser(userId: string): Promise<SecurityFindings | null> {
  const profile = await getLatestRouterProfile(userId);
  if (!profile) {
    return null;
  }

  const scanIp = profile.publicIp ?? profile.scanTargetIp;

  const [cve, passive, reputation] = await Promise.all([
    lookupRouterCves({ routerVendor: profile.routerVendor, routerModel: profile.routerModel }),
    lookupPassiveExposure(scanIp),
    lookupIpReputation(scanIp)
  ]);

  const summaryInput = {
    profile,
    cve: { query: cve.query, results: cve.results, note: cve.note },
    passive: { exposure: passive.exposure, note: passive.note },
    reputation: { result: reputation.result, note: reputation.note }
  };

  // Deterministic assessment always available; the LLM improves on it when the
  // agent is reachable, otherwise we keep the heuristic (never blocks the scan).
  const heuristic = buildHeuristicAssessment(summaryInput);
  // Cost guardrail: a clean scan (no CVEs, no exposed ports/vulns, clean
  // reputation -> low risk) produces the same "all clear" summary from the
  // heuristic as from the LLM, so skip the paid call and only invoke the LLM when
  // there's something to explain.
  const assessment =
    heuristic.riskLevel === "low"
      ? heuristic
      : (await getFindingsAssessment(summaryInput, userId, heuristic)) ?? heuristic;

  const findings: SecurityFindings = {
    cve: summaryInput.cve,
    passive: summaryInput.passive,
    reputation: summaryInput.reputation,
    assessment,
    checkedAt: new Date().toISOString()
  };

  await saveSecurityFindings(userId, findings);
  return findings;
}
