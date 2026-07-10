import { Buffer } from "node:buffer";
import { extractRouterDetails } from "./agent-client";
import { isValidPublicIp } from "./ip";
import { saveRouterProfile } from "./router-profile";
import type { RouterExtraction } from "./types";

const maxImageBytes = 4 * 1024 * 1024;
const maxImages = 6;

// Scalar (string|null) fields on RouterExtraction. Narrowing to just these keys
// keeps the merge below type-safe (excludes confidence/missingFields/notes).
type ScalarField = {
  [K in keyof RouterExtraction]: RouterExtraction[K] extends string | null ? K : never;
}[keyof RouterExtraction];

// When merging several screenshots we keep the first non-empty value seen
// (upload order).
const scalarFields: ScalarField[] = [
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
];

// Fields that count as required evidence; still-empty ones after merging are
// reported as missing.
const requiredFields: ScalarField[] = [
  "routerVendor",
  "routerModel",
  "firmwareVersion",
  "publicIp",
  "upnpStatus",
  "remoteAdminStatus",
  "portForwardingStatus",
  "wifiSecurity"
];

function isFilled(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// Combine multiple per-screenshot extractions into one profile. Different router
// admin pages surface different fields, so we take the first non-empty value for
// each field, merge confidence/notes, and recompute which required fields are
// still missing across everything uploaded.
export function mergeExtractions(extractions: RouterExtraction[]): RouterExtraction {
  const merged: RouterExtraction = {
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
  };

  const notes = new Set<string>();

  for (const extraction of extractions) {
    for (const field of scalarFields) {
      const candidate = extraction[field];
      if (!isFilled(merged[field]) && isFilled(candidate)) {
        merged[field] = candidate.trim();
      }
    }

    if (extraction.confidence) {
      for (const [key, value] of Object.entries(extraction.confidence)) {
        if (!(key in merged.confidence)) {
          merged.confidence[key] = value;
        }
      }
    }

    for (const note of extraction.notes ?? []) {
      notes.add(note);
    }
  }

  merged.notes = Array.from(notes);
  merged.missingFields = requiredFields.filter((field) => !isFilled(merged[field]));
  return merged;
}

export async function processRouterSetup(formData: FormData, userId: string) {
  const userNotesValue = formData.get("userNotes");
  const scanApproved = formData.get("scanApproved") === "on" || formData.get("scanApproved") === "true";
  const scanTargetIpValue = formData.get("scanTargetIp");

  const images = formData
    .getAll("routerImage")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (images.length === 0) {
    throw new Error("At least one router admin screenshot is required.");
  }

  if (images.length > maxImages) {
    throw new Error(`Upload at most ${maxImages} screenshots at a time.`);
  }

  for (const image of images) {
    if (!image.type.startsWith("image/")) {
      throw new Error("Every upload must be an image file.");
    }

    if (image.size > maxImageBytes) {
      throw new Error("Each image must be 4 MB or smaller for this first version.");
    }
  }

  const scanTargetIp = typeof scanTargetIpValue === "string" && scanTargetIpValue.trim().length > 0
    ? scanTargetIpValue.trim()
    : null;

  if (scanTargetIp && !isValidPublicIp(scanTargetIp)) {
    throw new Error("The entered scan target must be a valid public router IP address.");
  }

  const userNotes = typeof userNotesValue === "string" ? userNotesValue.trim() : "";

  // Read each image once so we can both send it to the extractor and keep the
  // first image's bytes as the representative stored screenshot.
  const imagePayloads = await Promise.all(
    images.map(async (image) => ({
      name: image.name,
      mime: image.type,
      size: image.size,
      base64: Buffer.from(await image.arrayBuffer()).toString("base64")
    }))
  );

  // Extract sequentially: each user maps to a single LangGraph thread, which
  // cannot process concurrent runs.
  const extractions: RouterExtraction[] = [];
  for (const payload of imagePayloads) {
    const extraction = await extractRouterDetails(
      { imageBase64: payload.base64, imageMime: payload.mime, userNotes },
      userId
    );
    extractions.push(extraction);
  }

  const extraction = mergeExtractions(extractions);

  if (imagePayloads.length > 1) {
    extraction.notes = [
      `Merged from ${imagePayloads.length} screenshots: ${imagePayloads
        .map((payload) => payload.name || "unnamed")
        .join(", ")}.`,
      ...extraction.notes
    ];
  }

  const primary = imagePayloads[0];
  const imageName =
    imagePayloads.length > 1
      ? `${primary.name || "screenshot"} (+${imagePayloads.length - 1} more)`
      : primary.name;

  const resolvedScanTarget = scanTargetIp ?? extraction.publicIp;

  if (scanApproved && !isValidPublicIp(resolvedScanTarget)) {
    extraction.missingFields = Array.from(new Set([...extraction.missingFields, "publicIp"]));
    extraction.notes = [
      ...extraction.notes,
      "Scan approval was captured, but no valid public IP was extracted or provided yet."
    ];
  }

  return saveRouterProfile({
    userId,
    extraction,
    scanApproved,
    scanTargetIp: scanApproved && isValidPublicIp(resolvedScanTarget) ? resolvedScanTarget : null,
    imageName,
    imageMime: primary.mime,
    imageSize: primary.size,
    imageBase64: primary.base64
  });
}
