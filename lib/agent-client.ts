import { z } from "zod";
import type { RouterExtraction } from "./types";

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

function getLangGraphRunUrl() {
  const deploymentUrl = process.env.LANGGRAPH_DEPLOYMENT_URL;

  if (!deploymentUrl) {
    return null;
  }

  const normalized = deploymentUrl.replace(/\/$/, "");

  if (normalized.endsWith("/runs/wait") || normalized.includes("/threads/")) {
    return normalized;
  }

  return `${normalized}/runs/wait`;
}

function extractOutput(payload: Record<string, unknown>) {
  const values = payload.values as Record<string, unknown> | undefined;
  return payload.output ?? payload.result ?? values?.output ?? values ?? payload;
}

export async function extractRouterDetails(input: ExtractRouterInput) {
  const runUrl = getLangGraphRunUrl();

  if (process.env.USE_MOCK_AGENT === "true" || !runUrl) {
    return mockExtraction();
  }

  if (!process.env.LANGGRAPH_API_KEY) {
    throw new Error("LANGGRAPH_API_KEY is not configured.");
  }

  const response = await fetch(runUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.LANGGRAPH_API_KEY}`
    },
    body: JSON.stringify({
      assistant_id: process.env.LANGGRAPH_ASSISTANT_ID ?? "router_extraction",
      input
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Router extraction failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  return extractionSchema.parse(extractOutput(payload));
}
