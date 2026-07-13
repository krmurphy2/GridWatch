export type RouterExtraction = {
  routerVendor: string | null;
  routerModel: string | null;
  hardwareVersion: string | null;
  firmwareVersion: string | null;
  publicIp: string | null;
  routerAdminUrl: string | null;
  upnpStatus: string | null;
  remoteAdminStatus: string | null;
  portForwardingStatus: string | null;
  wifiSecurity: string | null;
  confidence: Record<string, string>;
  missingFields: string[];
  notes: string[];
};

// A single known vulnerability from NIST NVD, normalized for plain-English display.
export type CveFinding = {
  id: string;
  description: string;
  cvssScore: number | null;
  severity: string | null;
  published: string | null;
  lastModified: string | null;
  url: string;
};

// What public internet scanners (Shodan InternetDB) already observe for an IP.
export type PassiveExposure = {
  ip: string;
  found: boolean;
  ports: number[];
  hostnames: string[];
  cpes: string[];
  tags: string[];
  vulns: string[];
};

// A single prioritized, plain-English recommendation for the user.
export type AssessmentAction = {
  title: string;
  detail: string;
  priority: "high" | "medium" | "low";
};

// Plain-English interpretation of the raw findings, produced by the LLM after a
// scan (with a deterministic heuristic fallback). This is what non-technical
// users read first; the raw CVE/exposure data stays available underneath.
export type FindingsAssessment = {
  headline: string;
  riskLevel: "low" | "medium" | "high";
  summary: string;
  actions: AssessmentAction[];
  source: "llm" | "heuristic";
  // Titles of the trusted-guidance documents that informed an LLM assessment
  // (empty for the heuristic fallback, which uses no retrieval).
  sources: string[];
};

// Latest CVE + passive-intel results for a user, retained as assessment memory.
export type SecurityFindings = {
  cve: {
    query: string | null;
    results: CveFinding[];
    note: string | null;
  };
  passive: {
    exposure: PassiveExposure | null;
    note: string | null;
  };
  assessment: FindingsAssessment | null;
  checkedAt: string;
};

export type RouterProfile = {
  id: string;
  userId: string;
  routerVendor: string | null;
  routerModel: string | null;
  hardwareVersion: string | null;
  firmwareVersion: string | null;
  publicIp: string | null;
  routerAdminUrl: string | null;
  upnpStatus: string | null;
  remoteAdminStatus: string | null;
  portForwardingStatus: string | null;
  wifiSecurity: string | null;
  extraction: RouterExtraction;
  missingFields: string[];
  scanApproved: boolean;
  scanApprovedAt: string | null;
  scanTargetIp: string | null;
  imageName: string | null;
  imageMime: string | null;
  createdAt: string;
};
