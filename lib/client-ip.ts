import { headers } from "next/headers";
import { isValidPublicIp } from "./ip";

// Best-effort guess of the router's public IP based on the request's client IP.
//
// A home browser and its router normally share the same public IP (the ISP
// address behind NAT), so the client IP is a reasonable *suggestion* for the
// router's public IP when it could not be read from the uploaded screenshots.
// This is only a suggestion — the user must confirm it before it is saved.
export function getClientPublicIpSuggestion(): string | null {
  const headerList = headers();
  const candidates: string[] = [];

  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) {
    candidates.push(...forwardedFor.split(",").map((entry) => entry.trim()));
  }

  const realIp = headerList.get("x-real-ip");
  if (realIp) {
    candidates.push(realIp.trim());
  }

  for (const candidate of candidates) {
    // Strip IPv6 brackets and any ":port" suffix on IPv4 candidates.
    const cleaned = candidate.replace(/^\[|\]$/g, "").replace(/^(\d+\.\d+\.\d+\.\d+):\d+$/, "$1");
    if (isValidPublicIp(cleaned)) {
      return cleaned;
    }
  }

  return null;
}
