import type { CveFinding } from "./types";

const NVD_ENDPOINT = "https://services.nvd.nist.gov/rest/json/cves/2.0";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESULTS = 10;

type NvdCvssMetric = {
  cvssData?: { baseScore?: number; baseSeverity?: string };
  baseSeverity?: string;
};

type NvdMetrics = {
  cvssMetricV31?: NvdCvssMetric[];
  cvssMetricV30?: NvdCvssMetric[];
  cvssMetricV2?: NvdCvssMetric[];
};

type NvdVulnerability = {
  cve?: {
    id?: string;
    published?: string;
    lastModified?: string;
    descriptions?: { lang?: string; value?: string }[];
    metrics?: NvdMetrics;
  };
};

export type NvdLookupResult = {
  query: string | null;
  results: CveFinding[];
  note: string | null;
};

// Build an NVD keyword query from the router facts we have. Vendor + model is
// the most reliable signal; firmware versions are usually too specific to match
// NVD product names, so we keep the query broad and surface firmware separately.
export function buildNvdQuery(input: {
  routerVendor: string | null;
  routerModel: string | null;
}): string | null {
  const parts = [input.routerVendor, input.routerModel]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter((part) => part.length > 0);

  return parts.length > 0 ? parts.join(" ") : null;
}

function pickEnglishDescription(descriptions: { lang?: string; value?: string }[] | undefined): string {
  if (!descriptions || descriptions.length === 0) {
    return "No description provided by NVD.";
  }

  const english = descriptions.find((entry) => entry.lang === "en");
  return (english?.value ?? descriptions[0]?.value ?? "No description provided by NVD.").trim();
}

function pickMetric(metrics: NvdMetrics | undefined): { score: number | null; severity: string | null } {
  const candidates = [
    metrics?.cvssMetricV31?.[0],
    metrics?.cvssMetricV30?.[0],
    metrics?.cvssMetricV2?.[0]
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const score = candidate.cvssData?.baseScore ?? null;
    const severity = candidate.cvssData?.baseSeverity ?? candidate.baseSeverity ?? null;

    if (score !== null || severity !== null) {
      return { score, severity };
    }
  }

  return { score: null, severity: null };
}

// Normalize a raw NVD API payload into our display-ready CVE findings, sorted by
// severity (highest CVSS first). Exported for unit testing without network access.
export function parseNvdResponse(payload: unknown): CveFinding[] {
  const vulnerabilities = (payload as { vulnerabilities?: NvdVulnerability[] })?.vulnerabilities ?? [];

  const findings: CveFinding[] = vulnerabilities
    .map((entry) => {
      const cve = entry.cve;
      if (!cve?.id) {
        return null;
      }

      const { score, severity } = pickMetric(cve.metrics);

      return {
        id: cve.id,
        description: pickEnglishDescription(cve.descriptions),
        cvssScore: score,
        severity: severity ? severity.toUpperCase() : null,
        published: cve.published ?? null,
        lastModified: cve.lastModified ?? null,
        url: `https://nvd.nist.gov/vuln/detail/${cve.id}`
      } satisfies CveFinding;
    })
    .filter((finding): finding is CveFinding => finding !== null);

  findings.sort((a, b) => (b.cvssScore ?? -1) - (a.cvssScore ?? -1));
  return findings.slice(0, MAX_RESULTS);
}

// Look up known CVEs for the router by keyword. Read-only, no user data is sent
// beyond the vendor/model keyword. An optional NVD_API_KEY raises rate limits.
export async function lookupRouterCves(input: {
  routerVendor: string | null;
  routerModel: string | null;
}): Promise<NvdLookupResult> {
  const query = buildNvdQuery(input);

  if (!query) {
    return {
      query: null,
      results: [],
      note: "Add your router vendor and model on the dashboard to check for known vulnerabilities."
    };
  }

  const url = new URL(NVD_ENDPOINT);
  url.searchParams.set("keywordSearch", query);
  url.searchParams.set("resultsPerPage", "20");

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (process.env.NVD_API_KEY) {
    headers.apiKey = process.env.NVD_API_KEY;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { headers, signal: controller.signal });

    if (response.status === 403 || response.status === 429) {
      return {
        query,
        results: [],
        note: "NVD rate limit reached. Wait a moment and try again (set NVD_API_KEY for higher limits)."
      };
    }

    if (!response.ok) {
      return { query, results: [], note: `NVD lookup failed (HTTP ${response.status}).` };
    }

    const payload = await response.json();
    const results = parseNvdResponse(payload);

    return {
      query,
      results,
      note:
        results.length === 0
          ? "No CVEs matched this vendor/model in NVD. That is not a guarantee of safety."
          : null
    };
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError" ? "timed out" : "could not be reached";
    return { query, results: [], note: `NVD ${reason}. Try again shortly.` };
  } finally {
    clearTimeout(timeout);
  }
}
