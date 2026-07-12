import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import type { RouterExtraction, RouterProfile, SecurityFindings } from "./types";

type LocalUser = {
  id: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
};

type LocalSession = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
};

type LocalRouterProfile = RouterProfile & {
  imageSize: number;
  imageBase64: string;
};

type LocalChatMessage = {
  id: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

type LocalSecurityFindings = {
  userId: string;
  findings: SecurityFindings;
};

type LocalData = {
  users: LocalUser[];
  sessions: LocalSession[];
  routerProfiles: LocalRouterProfile[];
  chatMessages: LocalChatMessage[];
  securityFindings: LocalSecurityFindings[];
};

type SaveRouterProfileInput = {
  userId: string;
  extraction: RouterExtraction;
  scanApproved: boolean;
  scanTargetIp: string | null;
  imageName: string;
  imageMime: string;
  imageSize: number;
  imageBase64: string;
};

const defaultData: LocalData = {
  users: [],
  sessions: [],
  routerProfiles: [],
  chatMessages: [],
  securityFindings: []
};

function getLocalDataPath() {
  return process.env.LOCAL_DATA_PATH ?? join(process.cwd(), ".data", "gridwatch-local.json");
}

async function readLocalData(): Promise<LocalData> {
  const path = getLocalDataPath();

  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<LocalData>;
    return {
      users: parsed.users ?? [],
      sessions: parsed.sessions ?? [],
      routerProfiles: parsed.routerProfiles ?? [],
      chatMessages: parsed.chatMessages ?? [],
      securityFindings: parsed.securityFindings ?? []
    };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return defaultData;
    }

    throw error;
  }
}

async function writeLocalData(data: LocalData) {
  const path = getLocalDataPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2));
}

function toRouterProfile(profile: LocalRouterProfile): RouterProfile {
  return {
    id: profile.id,
    userId: profile.userId,
    routerVendor: profile.routerVendor,
    routerModel: profile.routerModel,
    hardwareVersion: profile.hardwareVersion,
    firmwareVersion: profile.firmwareVersion,
    publicIp: profile.publicIp,
    routerAdminUrl: profile.routerAdminUrl,
    upnpStatus: profile.upnpStatus,
    remoteAdminStatus: profile.remoteAdminStatus,
    portForwardingStatus: profile.portForwardingStatus,
    wifiSecurity: profile.wifiSecurity,
    extraction: profile.extraction,
    missingFields: profile.missingFields,
    scanApproved: profile.scanApproved,
    scanApprovedAt: profile.scanApprovedAt,
    scanTargetIp: profile.scanTargetIp,
    imageName: profile.imageName,
    imageMime: profile.imageMime,
    createdAt: profile.createdAt
  };
}

export async function localGetUserCount() {
  const data = await readLocalData();
  return data.users.length;
}

export async function localCreateUser(input: {
  email: string;
  passwordHash: string;
  passwordSalt: string;
}) {
  const data = await readLocalData();

  const emailTaken = data.users.some(
    (existing) => existing.email.toLowerCase() === input.email.toLowerCase()
  );

  if (emailTaken) {
    throw new Error("An account with this email already exists.");
  }

  const user = {
    id: randomUUID(),
    email: input.email,
    passwordHash: input.passwordHash,
    passwordSalt: input.passwordSalt,
    createdAt: new Date().toISOString()
  };

  await writeLocalData({ ...data, users: [...data.users, user] });
  return user;
}

export async function localFindUserByEmail(email: string) {
  const data = await readLocalData();
  return data.users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function localCreateSession(input: {
  userId: string;
  tokenHash: string;
  expiresAt: string;
}) {
  const data = await readLocalData();
  const session = {
    id: randomUUID(),
    userId: input.userId,
    tokenHash: input.tokenHash,
    expiresAt: input.expiresAt,
    createdAt: new Date().toISOString()
  };

  await writeLocalData({ ...data, sessions: [...data.sessions, session] });
}

export async function localDeleteSession(tokenHash: string) {
  const data = await readLocalData();
  await writeLocalData({
    ...data,
    sessions: data.sessions.filter((session) => session.tokenHash !== tokenHash)
  });
}

export async function localGetUserBySession(tokenHash: string) {
  const data = await readLocalData();
  const now = Date.now();
  const session = data.sessions.find(
    (item) => item.tokenHash === tokenHash && new Date(item.expiresAt).getTime() > now
  );

  if (!session) {
    return null;
  }

  const user = data.users.find((item) => item.id === session.userId);
  return user ? { id: user.id, email: user.email } : null;
}

export async function localGetLatestRouterProfile(userId: string) {
  const data = await readLocalData();
  const latestProfile = data.routerProfiles
    .filter((profile) => profile.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  return latestProfile ? toRouterProfile(latestProfile) : null;
}

export async function localUpdateRouterProfile(
  userId: string,
  profileId: string,
  extraction: RouterExtraction,
  missingFields: string[]
) {
  const data = await readLocalData();
  const index = data.routerProfiles.findIndex(
    (profile) => profile.id === profileId && profile.userId === userId
  );

  if (index === -1) {
    throw new Error("Router profile not found for this user.");
  }

  const existing = data.routerProfiles[index];
  const updated: LocalRouterProfile = {
    ...existing,
    routerVendor: extraction.routerVendor,
    routerModel: extraction.routerModel,
    hardwareVersion: extraction.hardwareVersion,
    firmwareVersion: extraction.firmwareVersion,
    publicIp: extraction.publicIp,
    routerAdminUrl: extraction.routerAdminUrl,
    upnpStatus: extraction.upnpStatus,
    remoteAdminStatus: extraction.remoteAdminStatus,
    portForwardingStatus: extraction.portForwardingStatus,
    wifiSecurity: extraction.wifiSecurity,
    extraction,
    missingFields
  };

  const routerProfiles = [...data.routerProfiles];
  routerProfiles[index] = updated;
  await writeLocalData({ ...data, routerProfiles });

  return toRouterProfile(updated);
}

export async function localGetChatMessages(userId: string) {
  const data = await readLocalData();
  return data.chatMessages
    .filter((message) => message.userId === userId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt
    }));
}

export async function localAppendChatMessage(input: {
  userId: string;
  role: "user" | "assistant";
  content: string;
}) {
  const data = await readLocalData();
  const message: LocalChatMessage = {
    id: randomUUID(),
    userId: input.userId,
    role: input.role,
    content: input.content,
    createdAt: new Date().toISOString()
  };

  await writeLocalData({ ...data, chatMessages: [...data.chatMessages, message] });
  return { id: message.id, role: message.role, content: message.content, createdAt: message.createdAt };
}

export async function localClearChatMessages(userId: string) {
  const data = await readLocalData();
  await writeLocalData({
    ...data,
    chatMessages: data.chatMessages.filter((message) => message.userId !== userId)
  });
}

export async function localGetSecurityFindings(userId: string) {
  const data = await readLocalData();
  return data.securityFindings.find((entry) => entry.userId === userId)?.findings ?? null;
}

export async function localSaveSecurityFindings(userId: string, findings: SecurityFindings) {
  const data = await readLocalData();
  const others = data.securityFindings.filter((entry) => entry.userId !== userId);
  await writeLocalData({
    ...data,
    securityFindings: [...others, { userId, findings }]
  });
}

export async function localSaveRouterProfile(input: SaveRouterProfileInput) {
  const data = await readLocalData();
  const profile: LocalRouterProfile = {
    id: randomUUID(),
    userId: input.userId,
    routerVendor: input.extraction.routerVendor,
    routerModel: input.extraction.routerModel,
    hardwareVersion: input.extraction.hardwareVersion,
    firmwareVersion: input.extraction.firmwareVersion,
    publicIp: input.extraction.publicIp,
    routerAdminUrl: input.extraction.routerAdminUrl,
    upnpStatus: input.extraction.upnpStatus,
    remoteAdminStatus: input.extraction.remoteAdminStatus,
    portForwardingStatus: input.extraction.portForwardingStatus,
    wifiSecurity: input.extraction.wifiSecurity,
    extraction: input.extraction,
    missingFields: input.extraction.missingFields,
    scanApproved: input.scanApproved,
    scanApprovedAt: input.scanApproved ? new Date().toISOString() : null,
    scanTargetIp: input.scanTargetIp,
    imageName: input.imageName,
    imageMime: input.imageMime,
    imageSize: input.imageSize,
    imageBase64: input.imageBase64,
    createdAt: new Date().toISOString()
  };

  await writeLocalData({
    ...data,
    routerProfiles: [...data.routerProfiles, profile]
  });

  return toRouterProfile(profile);
}
