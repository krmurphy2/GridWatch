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

// Public abuse/reputation signal for an IP (AbuseIPDB). `abuseConfidenceScore` is
// 0-100; higher means more community abuse reports. Read-only, public-IP only.
export type IpReputation = {
  ip: string;
  found: boolean;
  abuseConfidenceScore: number;
  totalReports: number;
  countryCode: string | null;
  isp: string | null;
  domain: string | null;
  usageType: string | null;
  isTor: boolean;
  lastReportedAt: string | null;
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
  reputation: {
    result: IpReputation | null;
    note: string | null;
  };
  assessment: FindingsAssessment | null;
  checkedAt: string;
};

// A notification email GridWatch produced after a scan. In the current build the
// "delivery" is a stub (logged, not actually sent) so the payload can be shown in
// the UI and swapped onto a real provider later without changing callers.
export type NotificationPayload = {
  to: string;
  subject: string;
  body: string;
  sentAt: string;
  delivery: "logged" | "sent";
};

// Per-user recurring-scan preferences plus the last notification we produced, so
// the dashboard can show what the most recent scheduled email looked like.
export type ScanSettings = {
  recurringEnabled: boolean;
  notifyEmail: string | null;
  lastNotification: NotificationPayload | null;
  updatedAt: string;
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
