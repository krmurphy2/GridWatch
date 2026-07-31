import type { RouterProfile } from "./types";

export type PostureLevel = "good" | "attention" | "unknown";

// `key` is a stable identifier (independent of the display label) used to persist
// acknowledgements. `detail` says what we saw and what to do; `why` is a plain-English
// reason the setting matters, so a non-technical user understands the stakes.
export type Finding = { key: string; label: string; level: PostureLevel; detail: string; why: string };

function contains(value: string | null, needles: string[]) {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return needles.some((needle) => normalized.includes(needle));
}

function toggleFinding(
  key: string,
  label: string,
  value: string | null,
  { riskyWhenOn, why, offDetail, onDetail, unknownDetail }: {
    riskyWhenOn: boolean;
    why: string;
    offDetail: string;
    onDetail: string;
    unknownDetail: string;
  }
): Finding {
  if (!value) {
    return { key, label, level: "unknown", detail: unknownDetail, why };
  }

  const isOff = contains(value, ["disable", "off", "not "]);
  const isOn = !isOff && contains(value, ["enable", "active", "on"]);

  if (isOff) {
    return { key, label, level: riskyWhenOn ? "good" : "attention", detail: offDetail, why };
  }

  if (isOn) {
    return { key, label, level: riskyWhenOn ? "attention" : "good", detail: onDetail, why };
  }

  return {
    key,
    label,
    level: "unknown",
    detail: `We saw "${value}" but couldn't tell whether it's on or off. ${unknownDetail}`,
    why
  };
}

// Plain-English posture of the router configuration, derived from the extracted
// profile. This is the "Router checks" tab on the dashboard; it's also used by the
// recurring-scan email so notifications cover config posture, not just external checks.
export function buildPosture(profile: RouterProfile): Finding[] {
  const findings: Finding[] = [];

  findings.push(
    toggleFinding("upnp", "Automatic port opening (UPnP)", profile.upnpStatus, {
      riskyWhenOn: true,
      why: "UPnP lets devices open doors to the internet by themselves, without asking you. It's convenient, but something can end up exposed without your knowledge.",
      onDetail: "This is turned on. Unless a specific device (like a game console) really needs it, it's safer to switch it off in your router settings.",
      offDetail: "This is turned off — good. Devices can't quietly open your network to the internet.",
      unknownDetail: "Add a screenshot of the page that shows UPnP so we can check it."
    })
  );

  findings.push(
    toggleFinding("remoteAdmin", "Remote access to router settings", profile.remoteAdminStatus, {
      riskyWhenOn: true,
      why: "This controls whether your router's settings page can be opened from anywhere on the internet, not just from home. If it's on, strangers can try to log in and guess your password.",
      onDetail: "This is on, so your router's control panel can be reached from the internet. Unless you specifically need it, turn it off.",
      offDetail: "This is off — good. Your settings can only be changed from inside your home network.",
      unknownDetail: "This is a common way routers get attacked, so it's worth adding a screenshot of that setting."
    })
  );

  findings.push(
    toggleFinding("portForwarding", "Port forwarding rules", profile.portForwardingStatus, {
      riskyWhenOn: true,
      why: "Port forwarding deliberately opens a specific door from the internet to one device at home — often set up for cameras or game servers. Old or forgotten rules can leave a device exposed.",
      onDetail: "One or more of these doors are open. Take a quick look and remove any you don't recognize or no longer use.",
      offDetail: "No open doors were found — nothing extra is exposed to the internet here.",
      unknownDetail: "Add a screenshot of that page so we can check for anything left open."
    })
  );

  const wifiWhy =
    'This is the type of lock on your Wi-Fi. Newer locks (WPA2 and WPA3) are very hard to break; older ones (WEP or "open") can let neighbors or passersby onto your network.';

  if (!profile.wifiSecurity) {
    findings.push({
      key: "wifi",
      label: "Wi-Fi password protection",
      level: "unknown",
      detail: "We don't know what Wi-Fi protection you're using yet. Add a screenshot of your wireless security page so we can check it.",
      why: wifiWhy
    });
  } else if (contains(profile.wifiSecurity, ["wpa3"])) {
    findings.push({
      key: "wifi",
      label: "Wi-Fi password protection",
      level: "good",
      detail: `You're using WPA3 (${profile.wifiSecurity}), the strongest Wi-Fi protection available. Nothing to do here.`,
      why: wifiWhy
    });
  } else if (contains(profile.wifiSecurity, ["wpa2"])) {
    findings.push({
      key: "wifi",
      label: "Wi-Fi password protection",
      level: "good",
      detail: `You're using WPA2 (${profile.wifiSecurity}), which is strong and safe. If all your devices support WPA3, switching to it is an easy upgrade.`,
      why: wifiWhy
    });
  } else if (contains(profile.wifiSecurity, ["wep", "open", "none", "wpa "])) {
    findings.push({
      key: "wifi",
      label: "Wi-Fi password protection",
      level: "attention",
      detail: `Your Wi-Fi is using older, weak protection (${profile.wifiSecurity}). Change it to WPA2 or WPA3 in your router settings so others can't easily join your network.`,
      why: wifiWhy
    });
  } else {
    findings.push({
      key: "wifi",
      label: "Wi-Fi password protection",
      level: "unknown",
      detail: `We saw "${profile.wifiSecurity}" but couldn't tell how strong it is. Aim for WPA2 or WPA3.`,
      why: wifiWhy
    });
  }

  const firmwareWhy =
    "Firmware is the software that runs your router. Just like a phone, updates fix security holes — running an old version leaves known problems unpatched.";

  if (profile.firmwareVersion) {
    findings.push({
      key: "firmware",
      label: "Router software (firmware)",
      level: "unknown",
      detail: `You're on version ${profile.firmwareVersion}. Check your router's admin page or the maker's website for a newer version and install it if one is available.`,
      why: firmwareWhy
    });
  } else {
    findings.push({
      key: "firmware",
      label: "Router software (firmware)",
      level: "unknown",
      detail: "We don't know your firmware version yet. Add a screenshot of the page that shows it so we can check whether it's up to date.",
      why: firmwareWhy
    });
  }

  return findings;
}

// The router-config "action needed" items: attention findings the user has NOT
// acknowledged. Shared by the dashboard action list and the recurring-scan email so
// both respect acknowledgements identically.
export function unacknowledgedActions(profile: RouterProfile, acknowledgedKeys: string[]): Finding[] {
  const acknowledged = new Set(acknowledgedKeys);
  return buildPosture(profile).filter(
    (finding) => finding.level === "attention" && !acknowledged.has(finding.key)
  );
}
