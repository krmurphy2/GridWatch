import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { z } from "zod";
import type { RouterExtraction } from "./types";

const AGENT_THREAD_NAMESPACE_UUID = "1b671a64-40d5-491e-99b0-da01ff1f3341";

const extractionSchema = z.object({
  routerVendor: z.string().nullable().default(null),
  routerModel: z.string().nullable().default(null),
  hardwareVersion: z.string().nullable().default(null),
  firmwareVersion: z.string().nullable().default(null),
  publicIp: z.string().nullable().default(null),
  routerAdminUrl: z.string().nullable().default(null),
  upnpStatus: z.string().nullable().default(null),
  remoteAdminStatus: z.string().nullable().default(null),
  portForwardingStatus: z.string().nullable().default(null),
  wifiSecurity: z.string().nullable().default(null),
  confidence: z.record(z.string()).default({}),
  missingFields: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([])
});

type ExtractRouterInput = {
  imageBase64: string;
  imageMime: string;
  userNotes: string;
};

// Derive a stable RFC-4122 v5 UUID from a name so each user maps to exactly one
// LangGraph thread. This keeps every user's agent run history in an isolated
// thread namespace and prevents router details from cross-pollinating between users.
function deterministicUuidV5(name: string, namespaceUuid: string) {
  const nsBytes = Buffer.from(namespaceUuid.replace(/-/g, ""), "hex");
  const hash = createHash("sha1").update(nsBytes).update(Buffer.from(name, "utf8")).digest();
  const bytes = hash.subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC-4122 variant
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function agentNamespace(userId: string) {
  return `user:${userId}`;
}

function agentThreadId(userId: string) {
  return deterministicUuidV5(userId, AGENT_THREAD_NAMESPACE_UUID);
}

function mockExtraction(): RouterExtraction {
  return {
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
    missingFields: [
      "routerVendor",
      "routerModel",
      "firmwareVersion",
      "publicIp",
      "upnpStatus",
      "remoteAdminStatus",
      "portForwardingStatus",
      "wifiSecurity"
    ],
    notes: [
      "Mock extraction is enabled. Configure LANGGRAPH_DEPLOYMENT_URL and LANGGRAPH_API_KEY to call the hosted agent."
    ]
  };
}

function getLangGraphBaseUrl() {
  const deploymentUrl = process.env.LANGGRAPH_DEPLOYMENT_URL;

  if (!deploymentUrl) {
    return null;
  }

  return deploymentUrl
    .replace(/\/$/, "")
    .replace(/\/runs\/wait$/, "")
    .replace(/\/threads\/.*$/, "");
}

function extractOutput(payload: Record<string, unknown>) {
  const values = payload.values as Record<string, unknown> | undefined;
  return payload.output ?? payload.result ?? values?.output ?? values ?? payload;
}

export async function extractRouterDetails(input: ExtractRouterInput, userId: string) {
  const baseUrl = getLangGraphBaseUrl();

  if (process.env.USE_MOCK_AGENT === "true" || !baseUrl) {
    return mockExtraction();
  }

  if (!userId) {
    throw new Error("A userId is required to namespace the agent request.");
  }

  const apiKey = process.env.LANGGRAPH_API_KEY;

  if (!apiKey) {
    throw new Error("LANGGRAPH_API_KEY is not configured.");
  }

  // LangGraph Platform authenticates via the x-api-key header. (The local
  // `langgraph dev` server ignores auth, which is why Bearer "worked" in dev but
  // the hosted deployment returns 403 "Invalid token".)
  const headers = {
    "content-type": "application/json",
    "x-api-key": apiKey
  };
  const namespace = agentNamespace(userId);
  const threadId = agentThreadId(userId);
  const assistantId = process.env.LANGGRAPH_ASSISTANT_ID ?? "router_extraction";

  // Ensure the caller's per-user thread exists (idempotent). Each user maps to a
  // single deterministic thread, so agent history is isolated per user.
  const threadResponse = await fetch(`${baseUrl}/threads`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      thread_id: threadId,
      metadata: { user_id: userId, namespace },
      if_exists: "do_nothing"
    })
  });

  if (!threadResponse.ok && threadResponse.status !== 409) {
    const errorText = await threadResponse.text();
    throw new Error(`Failed to open agent thread: ${threadResponse.status} ${errorText}`);
  }

  const response = await fetch(`${baseUrl}/threads/${threadId}/runs/wait`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      assistant_id: assistantId,
      input,
      config: { configurable: { user_id: userId, namespace } }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Router extraction failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  return extractionSchema.parse(extractOutput(payload));
}
