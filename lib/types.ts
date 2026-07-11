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
