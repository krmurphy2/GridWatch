import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { parseAssessment } from "./findings-summary";
import type { SummaryInput } from "./findings-summary";
import type { FindingsAssessment, RouterProfile } from "./types";

const AGENT_THREAD_NAMESPACE_UUID = "1b671a64-40d5-491e-99b0-da01ff1f3341";

// Same deterministic per-user thread scheme as the extraction/chat clients, so a
// user's summary runs stay in an isolated LangGraph thread/namespace.
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

// Summary threads are namespaced separately from extraction/chat threads for the
// same user so the run histories don't collide.
function summaryThreadId(userId: string) {
  return deterministicUuidV5(`findings:${userId}`, AGENT_THREAD_NAMESPACE_UUID);
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

// Compact, non-sensitive profile summary passed to the summary graph for grounding.
function profileSummary(profile: RouterProfile) {
  return {
    routerVendor: profile.routerVendor,
    routerModel: profile.routerModel,
    firmwareVersion: profile.firmwareVersion,
    upnpStatus: profile.upnpStatus,
    remoteAdminStatus: profile.remoteAdminStatus,
    portForwardingStatus: profile.portForwardingStatus,
    wifiSecurity: profile.wifiSecurity
  };
}

function extractOutput(payload: Record<string, unknown>): unknown {
  const values = payload.values as Record<string, unknown> | undefined;
  const output = (payload.output ?? values?.output ?? values ?? payload) as Record<string, unknown>;
  // The graph nests the assessment under `output`; unwrap one more level if so.
  return (output.output as unknown) ?? output;
}

// Ask the hosted findings_summary graph for a plain-English assessment of the
// scan results. Returns null (never throws) when the agent is unavailable
// (mock/local/undeployed), the call fails, or the output is unusable — callers
// then fall back to the deterministic heuristic. The `baseline` heuristic is
// sent along so the LLM improves on a known-good starting point.
export async function getFindingsAssessment(
  input: SummaryInput,
  userId: string,
  baseline: FindingsAssessment
): Promise<FindingsAssessment | null> {
  const baseUrl = getLangGraphBaseUrl();

  if (process.env.USE_MOCK_AGENT === "true" || !baseUrl || !userId) {
    return null;
  }

  const apiKey = process.env.LANGGRAPH_API_KEY;
  if (!apiKey) {
    return null;
  }

  // LangGraph Platform authenticates via the x-api-key header, not Bearer.
  const headers = {
    "content-type": "application/json",
    "x-api-key": apiKey
  };
  const namespace = agentNamespace(userId);
  const threadId = summaryThreadId(userId);
  const assistantId = process.env.LANGGRAPH_SUMMARY_ASSISTANT_ID ?? "findings_summary";

  try {
    const threadResponse = await fetch(`${baseUrl}/threads`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        thread_id: threadId,
        metadata: { user_id: userId, namespace, kind: "findings_summary" },
        if_exists: "do_nothing"
      })
    });

    if (!threadResponse.ok && threadResponse.status !== 409) {
      return null;
    }

    const response = await fetch(`${baseUrl}/threads/${threadId}/runs/wait`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        assistant_id: assistantId,
        input: {
          profile: profileSummary(input.profile),
          cve: { query: input.cve.query, results: input.cve.results, note: input.cve.note },
          passive: { exposure: input.passive.exposure, note: input.passive.note },
          baseline
        },
        config: { configurable: { user_id: userId, namespace } }
      })
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    return parseAssessment(extractOutput(payload));
  } catch {
    // Summaries are best-effort enrichment; any failure degrades to the heuristic.
    return null;
  }
}
