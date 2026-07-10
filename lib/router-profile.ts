import { randomUUID } from "node:crypto";
import { sql } from "@vercel/postgres";
import { ensureSchema } from "./db";
import { localGetLatestRouterProfile, localSaveRouterProfile } from "./local-store";
import type { RouterExtraction, RouterProfile } from "./types";

function useLocalFileDb() {
  return process.env.USE_LOCAL_FILE_DB === "true";
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
