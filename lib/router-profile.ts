import { randomUUID } from "node:crypto";
import { sql } from "./db-client";
import { ensureSchema } from "./db";
import { isValidPublicIp } from "./ip";
import {
  localGetLatestRouterProfile,
  localSaveRouterProfile,
  localUpdateRouterProfile
} from "./local-store";
import type { RouterExtraction, RouterProfile } from "./types";

// Fields a user is allowed to fill in or correct manually from the dashboard.
export const editableProfileFields = [
  "routerVendor",
  "routerModel",
  "hardwareVersion",
  "firmwareVersion",
  "publicIp",
  "routerAdminUrl",
  "upnpStatus",
  "remoteAdminStatus",
  "portForwardingStatus",
  "wifiSecurity"
] as const;

export type EditableProfileField = (typeof editableProfileFields)[number];
export type RouterProfileUpdates = Partial<Record<EditableProfileField, string | null>>;

// Fields that count as "missing evidence" when empty.
const missingCandidateFields: EditableProfileField[] = [
  "routerVendor",
  "routerModel",
  "firmwareVersion",
  "publicIp",
  "upnpStatus",
  "remoteAdminStatus",
  "portForwardingStatus",
  "wifiSecurity"
];

function useLocalFileDb() {
  return process.env.USE_LOCAL_FILE_DB === "true";
}

// Merge manual updates into the existing extraction and recompute missing fields.
// Empty/blank values clear the field back to null.
function applyProfileUpdates(current: RouterProfile, updates: RouterProfileUpdates) {
  const extraction: RouterExtraction = { ...current.extraction };

  for (const field of editableProfileFields) {
    if (field in updates) {
      const raw = updates[field];
      const value = typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
      extraction[field] = value;
    }
  }

  const missingFields = missingCandidateFields.filter((field) => !extraction[field]);
  extraction.missingFields = missingFields;

  return { extraction, missingFields };
}

function parseJsonValue<T>(value: unknown, fallback: T): T {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  return (value ?? fallback) as T;
}

function rowToProfile(row: Record<string, unknown>): RouterProfile {
  const extraction = parseJsonValue<RouterExtraction>(row.extraction_json, {
    routerVendor: null,
    routerModel: null,
    hardwareVersion: null,
    firmwareVersion: null,
    publicIp: null,
    routerAdminUrl: null,
    upnpStatus: null,
    remoteAdminStatus: null,
    portForwardingStatus: null,
    wifiSecurity: null,
    confidence: {},
    missingFields: [],
    notes: []
  });
  const missingFields = parseJsonValue<string[]>(row.missing_fields, []);

  return {
    id: String(row.id),
    userId: String(row.user_id),
    routerVendor: row.router_vendor ? String(row.router_vendor) : null,
    routerModel: row.router_model ? String(row.router_model) : null,
    hardwareVersion: row.hardware_version ? String(row.hardware_version) : null,
    firmwareVersion: row.firmware_version ? String(row.firmware_version) : null,
    publicIp: row.public_ip ? String(row.public_ip) : null,
    routerAdminUrl: row.router_admin_url ? String(row.router_admin_url) : null,
    upnpStatus: row.upnp_status ? String(row.upnp_status) : null,
    remoteAdminStatus: row.remote_admin_status ? String(row.remote_admin_status) : null,
    portForwardingStatus: row.port_forwarding_status ? String(row.port_forwarding_status) : null,
    wifiSecurity: row.wifi_security ? String(row.wifi_security) : null,
    extraction,
    missingFields,
    scanApproved: Boolean(row.scan_approved),
    scanApprovedAt: row.scan_approved_at ? new Date(String(row.scan_approved_at)).toISOString() : null,
    scanTargetIp: row.scan_target_ip ? String(row.scan_target_ip) : null,
    imageName: row.image_name ? String(row.image_name) : null,
    imageMime: row.image_mime ? String(row.image_mime) : null,
    createdAt: new Date(String(row.created_at)).toISOString()
  };
}

export async function getLatestRouterProfile(userId: string) {
  if (useLocalFileDb()) {
    return localGetLatestRouterProfile(userId);
  }

  await ensureSchema();

  const result = await sql`
    select * from router_profiles
    where user_id = ${userId}
    order by created_at desc
    limit 1
  `;

  const row = result.rows[0];
  return row ? rowToProfile(row) : null;
}

export async function saveRouterProfile(input: {
  userId: string;
  extraction: RouterExtraction;
  scanApproved: boolean;
  scanTargetIp: string | null;
  imageName: string;
  imageMime: string;
  imageSize: number;
  imageBase64: string;
}) {
  if (useLocalFileDb()) {
    return localSaveRouterProfile(input);
  }

  await ensureSchema();

  const id = randomUUID();
  const scanApprovedAt = input.scanApproved ? new Date().toISOString() : null;

  await sql`
    insert into router_profiles (
      id,
      user_id,
      router_vendor,
      router_model,
      hardware_version,
      firmware_version,
      public_ip,
      router_admin_url,
      upnp_status,
      remote_admin_status,
      port_forwarding_status,
      wifi_security,
      extraction_json,
      missing_fields,
      scan_approved,
      scan_approved_at,
      scan_target_ip,
      image_name,
      image_mime,
      image_size,
      image_data_base64
    ) values (
      ${id},
      ${input.userId},
      ${input.extraction.routerVendor},
      ${input.extraction.routerModel},
      ${input.extraction.hardwareVersion},
      ${input.extraction.firmwareVersion},
      ${input.extraction.publicIp},
      ${input.extraction.routerAdminUrl},
      ${input.extraction.upnpStatus},
      ${input.extraction.remoteAdminStatus},
      ${input.extraction.portForwardingStatus},
      ${input.extraction.wifiSecurity},
      ${JSON.stringify(input.extraction)}::jsonb,
      ${JSON.stringify(input.extraction.missingFields)}::jsonb,
      ${input.scanApproved},
      ${scanApprovedAt},
      ${input.scanTargetIp},
      ${input.imageName},
      ${input.imageMime},
      ${input.imageSize},
      ${input.imageBase64}
    )
  `;

  return getLatestRouterProfile(input.userId);
}

// Apply user-entered corrections/fills to their most recent router profile.
// All access is scoped by userId so one user can never edit another's data.
export async function updateRouterProfile(userId: string, updates: RouterProfileUpdates) {
  const current = await getLatestRouterProfile(userId);

  if (!current) {
    throw new Error("Add router evidence before completing the profile details.");
  }

  if ("publicIp" in updates) {
    const ip = updates.publicIp?.trim();
    if (ip && !isValidPublicIp(ip)) {
      throw new Error("Enter a valid public IP address (not a private or local range).");
    }
  }

  const { extraction, missingFields } = applyProfileUpdates(current, updates);

  if (useLocalFileDb()) {
    return localUpdateRouterProfile(userId, current.id, extraction, missingFields);
  }

  await ensureSchema();

  await sql`
    update router_profiles set
      router_vendor = ${extraction.routerVendor},
      router_model = ${extraction.routerModel},
      hardware_version = ${extraction.hardwareVersion},
      firmware_version = ${extraction.firmwareVersion},
      public_ip = ${extraction.publicIp},
      router_admin_url = ${extraction.routerAdminUrl},
      upnp_status = ${extraction.upnpStatus},
      remote_admin_status = ${extraction.remoteAdminStatus},
      port_forwarding_status = ${extraction.portForwardingStatus},
      wifi_security = ${extraction.wifiSecurity},
      extraction_json = ${JSON.stringify(extraction)}::jsonb,
      missing_fields = ${JSON.stringify(missingFields)}::jsonb
    where id = ${current.id} and user_id = ${userId}
  `;

  return getLatestRouterProfile(userId);
}
