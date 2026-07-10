import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import type { ChatMessage } from "./chat";
import type { RouterProfile } from "./types";

const AGENT_THREAD_NAMESPACE_UUID = "1b671a64-40d5-491e-99b0-da01ff1f3341";

type ChatReplyInput = {
  userId: string;
  messages: ChatMessage[];
  routerProfile: RouterProfile | null;
};

// Same deterministic per-user thread scheme used by the extraction client, so a
// user's chat history stays in an isolated LangGraph thread/namespace.
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

// Chat threads are namespaced separately from extraction threads for the same
// user so the two run histories don't collide.
function chatThreadId(userId: string) {
  return deterministicUuidV5(`chat:${userId}`, AGENT_THREAD_NAMESPACE_UUID);
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

// Lightweight profile summary passed to the agent for grounding.
function profileSummary(profile: RouterProfile | null) {
  if (!profile) {
    return null;
  }

  return {
    routerVendor: profile.routerVendor,
    routerModel: profile.routerModel,
    hardwareVersion: profile.hardwareVersion,
    firmwareVersion: profile.firmwareVersion,
    publicIp: profile.publicIp,
    upnpStatus: profile.upnpStatus,
    remoteAdminStatus: profile.remoteAdminStatus,
    portForwardingStatus: profile.portForwardingStatus,
    wifiSecurity: profile.wifiSecurity,
    missingFields: profile.missingFields
  };
}

// Deterministic, on-brand fallback used in local development (USE_MOCK_AGENT) or
// when no LangGraph deployment is configured. It mirrors the agent's scope and
// tone rules so the full chat flow can be exercised without an LLM.
function mockReply(input: ChatReplyInput): string {
  const lastUser = [...input.messages].reverse().find((m) => m.role === "user");
  const text = (lastUser?.content ?? "").toLowerCase();

  const offTopic = ["code", "recipe", "weather", "stock", "movie", "homework", "essay"];
  if (offTopic.some((word) => text.includes(word))) {
    return (
      "That's outside what I can help with \u2014 I focus on your home network and " +
      "router security. Want to review your Wi-Fi security, remote access, or a " +
      "specific finding from your dashboard instead?"
    );
  }

  const profile = input.routerProfile;
  const vendor = profile?.routerVendor;
  const wifi = profile?.wifiSecurity;

  const parts: string[] = [];
  parts.push(
    "(Local preview mode \u2014 connect the GridWatch agent to get full AI answers.)"
  );

  if (vendor) {
    parts.push(`I can see your router is a ${vendor}${profile?.routerModel ? ` ${profile.routerModel}` : ""}.`);
  } else {
    parts.push("I don't have your router details yet \u2014 add a screenshot on the dashboard so I can be specific.");
  }

  if (wifi) {
    parts.push(`Your Wi-Fi security is recorded as "${wifi}". WPA3 (or WPA2 at minimum) is the safe target.`);
  }

  parts.push("In plain terms: keep firmware updated, turn off remote admin and UPnP unless you truly need them, and use strong Wi-Fi encryption.");
  return parts.join(" ");
}

function extractReply(payload: Record<string, unknown>): string {
  const values = (payload.values ?? payload.output ?? payload) as Record<string, unknown>;
  const output = (values.output ?? values) as Record<string, unknown>;
  const reply = output.reply ?? values.reply ?? payload.reply;
  return typeof reply === "string" && reply.trim().length > 0
    ? reply
    : "Sorry, I couldn't generate a response just now. Please try again.";
}

export async function getChatReply(input: ChatReplyInput): Promise<string> {
  const baseUrl = getLangGraphBaseUrl();

  if (process.env.USE_MOCK_AGENT === "true" || !baseUrl) {
    return mockReply(input);
  }

  if (!input.userId) {
    throw new Error("A userId is required to namespace the chat request.");
  }

  if (!process.env.LANGGRAPH_API_KEY) {
    throw new Error("LANGGRAPH_API_KEY is not configured.");
  }

  const headers = {
    "content-type": "application/json",
    authorization: `Bearer ${process.env.LANGGRAPH_API_KEY}`
  };
  const namespace = agentNamespace(input.userId);
  const threadId = chatThreadId(input.userId);
  const assistantId = process.env.LANGGRAPH_CHAT_ASSISTANT_ID ?? "security_chat";

  const threadResponse = await fetch(`${baseUrl}/threads`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      thread_id: threadId,
      metadata: { user_id: input.userId, namespace, kind: "security_chat" },
      if_exists: "do_nothing"
    })
  });

  if (!threadResponse.ok && threadResponse.status !== 409) {
    const errorText = await threadResponse.text();
    throw new Error(`Failed to open chat thread: ${threadResponse.status} ${errorText}`);
  }

  const response = await fetch(`${baseUrl}/threads/${threadId}/runs/wait`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      assistant_id: assistantId,
      input: {
        messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
        routerProfile: profileSummary(input.routerProfile)
      },
      config: { configurable: { user_id: input.userId, namespace } }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();

    // The chat graph may not be registered/deployed yet (the deployment only
    // knows the graphs it was started with). Degrade gracefully to the local
    // reply instead of hard-failing the whole chat.
    const assistantUnavailable =
      (response.status === 422 || response.status === 404) &&
      /invalid assistant|not found|assistant/i.test(errorText);

    if (assistantUnavailable) {
      return `${mockReply(input)}\n\n(Note: the "${assistantId}" chat agent isn't available on the configured LangGraph deployment yet, so this is a local preview answer.)`;
    }

    throw new Error(`Chat request failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  return extractReply(payload);
}
