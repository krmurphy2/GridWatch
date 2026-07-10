import { Buffer } from "node:buffer";
import { extractRouterDetails } from "./agent-client";
import { isValidPublicIp } from "./ip";
import { saveRouterProfile } from "./router-profile";

const maxImageBytes = 4 * 1024 * 1024;

export async function processRouterSetup(formData: FormData, userId: string) {
  const image = formData.get("routerImage");
  const userNotesValue = formData.get("userNotes");
  const scanApproved = formData.get("scanApproved") === "on" || formData.get("scanApproved") === "true";
  const scanTargetIpValue = formData.get("scanTargetIp");

  if (!(image instanceof File) || image.size === 0) {
    throw new Error("Router admin screenshot is required.");
  }

  if (!image.type.startsWith("image/")) {
    throw new Error("Upload must be an image file.");
  }

  if (image.size > maxImageBytes) {
    throw new Error("Image must be 4 MB or smaller for this first version.");
  }

  const scanTargetIp = typeof scanTargetIpValue === "string" && scanTargetIpValue.trim().length > 0
    ? scanTargetIpValue.trim()
    : null;

  if (scanTargetIp && !isValidPublicIp(scanTargetIp)) {
    throw new Error("The entered scan target must be a valid public router IP address.");
  }

  const buffer = Buffer.from(await image.arrayBuffer());
  const imageBase64 = buffer.toString("base64");
  const userNotes = typeof userNotesValue === "string" ? userNotesValue.trim() : "";

  const extraction = await extractRouterDetails({
    imageBase64,
    imageMime: image.type,
    userNotes
  });

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
    imageName: image.name,
    imageMime: image.type,
    imageSize: image.size,
    imageBase64
  });
}
