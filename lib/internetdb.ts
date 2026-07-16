import { isValidPublicIp } from "./ip";
import type { PassiveExposure } from "./types";

const INTERNETDB_ENDPOINT = "https://internetdb.shodan.io";
const REQUEST_TIMEOUT_MS = 10_000;

export type PassiveLookupResult = {
  exposure: PassiveExposure | null;
  note: string | null;
};

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function toNumberArray(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === "number") : [];
}

// Normalize a raw InternetDB payload for a given IP. Exported for unit testing.
export function parseInternetDbResponse(ip: string, payload: unknown): PassiveExposure {
  const data = (payload ?? {}) as Record<string, unknown>;
  return {
    ip,
    found: true,
    ports: toNumberArray(data.ports).sort((a, b) => a - b),
    hostnames: toStringArray(data.hostnames),
    cpes: toStringArray(data.cpes),
    tags: toStringArray(data.tags),
    vulns: toStringArray(data.vulns)
  };
}

// Passively look up what public internet scanners (Shodan InternetDB) already
// observe for a public router IP. Read-only and free (no API key).
//
// SAFETY: private/LAN and non-public addresses are rejected here as a hard guard so
// we never send internal topology to a third-party service. Note: this does NOT yet
// verify the public IP belongs to the user — any public IP in the profile is queried
// (ownership verification is planned; see docs/roadmap.md).
export async function lookupPassiveExposure(ip: string | null | undefined): Promise<PassiveLookupResult> {
  if (!ip) {
    return {
      exposure: null,
      note: "Add your router's public IP on the dashboard to check passive internet exposure."
    };
  }

  if (!isValidPublicIp(ip)) {
    return {
      exposure: null,
      note: "Passive intelligence only runs against a verified public IP, never a private or local address."
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${INTERNETDB_ENDPOINT}/${ip}`, {
      headers: { accept: "application/json" },
      signal: controller.signal
    });

    if (response.status === 404) {
      return {
        exposure: { ip, found: false, ports: [], hostnames: [], cpes: [], tags: [], vulns: [] },
        note: "No public exposure records were found for this IP. That is generally a good sign."
      };
    }

    if (!response.ok) {
      return { exposure: null, note: `Passive exposure lookup failed (HTTP ${response.status}).` };
    }

    const payload = await response.json();
    return { exposure: parseInternetDbResponse(ip, payload), note: null };
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError" ? "timed out" : "could not be reached";
    return { exposure: null, note: `Passive exposure source ${reason}. Try again shortly.` };
  } finally {
    clearTimeout(timeout);
  }
}
