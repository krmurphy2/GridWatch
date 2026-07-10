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
