import { isValidPublicIp } from "./ip";
import type { IpReputation } from "./types";

const ABUSEIPDB_ENDPOINT = "https://api.abuseipdb.com/api/v2/check";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_AGE_DAYS = 90;

export type IpReputationResult = {
  result: IpReputation | null;
  note: string | null;
};

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

// Normalize a raw AbuseIPDB `/check` payload. Exported for unit testing.
export function parseAbuseIpDbResponse(ip: string, payload: unknown): IpReputation {
  const root = (payload ?? {}) as Record<string, unknown>;
  const data = (root.data ?? {}) as Record<string, unknown>;
  return {
    ip,
    found: true,
    abuseConfidenceScore: toNumber(data.abuseConfidenceScore),
    totalReports: toNumber(data.totalReports),
    countryCode: toStringOrNull(data.countryCode),
    isp: toStringOrNull(data.isp),
    domain: toStringOrNull(data.domain),
    usageType: toStringOrNull(data.usageType),
    isTor: Boolean(data.isTor),
    lastReportedAt: toStringOrNull(data.lastReportedAt)
  };
}

// Look up an IP's community abuse/reputation score from AbuseIPDB. Read-only.
//
// SAFETY: same guard as the passive exposure lookup — private/LAN and non-public
// addresses are rejected so internal topology is never sent to a third party.
// Requires ABUSEIPDB_API_KEY; without it we degrade gracefully (no throw) so the
// rest of the scan still runs. Ownership of the public IP is not yet verified
// (see docs/roadmap.md).
export async function lookupIpReputation(ip: string | null | undefined): Promise<IpReputationResult> {
  if (!ip) {
    return {
      result: null,
      note: "Add your router's public IP on the dashboard to check its reputation."
    };
  }

  if (!isValidPublicIp(ip)) {
    return {
      result: null,
      note: "Reputation lookups only run against a verified public IP, never a private or local address."
    };
  }

  const apiKey = process.env.ABUSEIPDB_API_KEY;
  if (!apiKey) {
    return { result: null, note: "IP reputation is not configured (no ABUSEIPDB_API_KEY)." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const url = `${ABUSEIPDB_ENDPOINT}?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=${MAX_AGE_DAYS}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json", Key: apiKey },
      signal: controller.signal
    });

    if (!response.ok) {
      return { result: null, note: `IP reputation lookup failed (HTTP ${response.status}).` };
    }

    const payload = await response.json();
    return { result: parseAbuseIpDbResponse(ip, payload), note: null };
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError" ? "timed out" : "could not be reached";
    return { result: null, note: `IP reputation source ${reason}. Try again shortly.` };
  } finally {
    clearTimeout(timeout);
  }
}
