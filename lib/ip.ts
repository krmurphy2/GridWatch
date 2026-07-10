import { isIP } from "node:net";

export function isValidPublicIp(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  // Normalize IPv4-mapped IPv6 (e.g. "::ffff:127.0.0.1") down to the embedded
  // IPv4 so loopback/private ranges are evaluated by the IPv4 rules below.
  // Without this, isIP() reports version 6 and the mapped loopback slips through.
  const ip = value.trim().replace(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i, "$1");
  const version = isIP(ip);

  if (version === 0) {
    return false;
  }

  if (version === 4) {
    const parts = ip.split(".").map((part) => Number(part));
    const [a, b, c] = parts;

    if (a === 0 || a === 10 || a === 127 || a >= 224) {
      return false;
    }

    if (a === 100 && b >= 64 && b <= 127) {
      return false;
    }

    if (a === 169 && b === 254) {
      return false;
    }

    if (a === 172 && b >= 16 && b <= 31) {
      return false;
    }

    if (a === 192 && (b === 0 || b === 168)) {
      return false;
    }

    if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) {
      return false;
    }

    if ((a === 203 && b === 0 && c === 113) || (a === 192 && b === 0 && c === 2)) {
      return false;
    }

    return true;
  }

  const lower = ip.toLowerCase();
  return !(
    lower === "::" ||
    lower === "::1" ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    lower.startsWith("fe80") ||
    lower.startsWith("ff")
  );
}
