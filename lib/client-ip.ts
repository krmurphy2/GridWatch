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
    const cleaned = candidate
      .replace(/^\[|\]$/g, "") // strip IPv6 brackets
      .replace(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/, "$1") // strip ":port" on IPv4
      .replace(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i, "$1"); // unwrap IPv4-mapped IPv6
    if (isValidPublicIp(cleaned)) {
      return cleaned;
    }
  }

  return null;
}
