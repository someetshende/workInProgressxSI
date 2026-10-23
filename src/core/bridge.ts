import { OrielError } from "./errors.js";
import { redactValue, safeUrl } from "./redact.js";

const BLOCKED = new Set([
  "169.254.169.254",
  "169.254.170.2",
  "metadata.google.internal",
  "fd00:ec2::254",
]);

export function assertBridgeUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new OrielError("Bridge URL must be a full http(s) address.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new OrielError("Bridge URL must use http or https.");
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED.has(host) || host.endsWith(".metadata.google.internal")) {
    throw new OrielError("That address is not allowed as a bridge.");
  }
  return url.toString();
}

export type BridgePayload = {
  product: "Oriel";
  action: "convene" | "released";
  seat: string;
  task: string;
  intents: string[];
  businessSensitive: boolean;
  kind?: string;
};

export type BridgeReply = {
  summary: string;
  points: string[];
  stance: string;
};

export function bridgeFailure(error: unknown, token: string | null): string {
  const raw = error instanceof Error ? error.message : "Bridge failed";
  return redactValue(raw, token).replace(/https?:\/\/\S+/g, "[bridge]").slice(0, 180);
}

export async function callBridge(options: {
  url: string;
  token: string | null;
  payload: BridgePayload;
  fetchImpl: typeof fetch;
}): Promise<BridgeReply> {
  const response = await options.fetchImpl(options.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: JSON.stringify(options.payload),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Bridge responded ${response.status}`);
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error("Bridge response was not JSON");
  }
  if (!data || typeof data !== "object") throw new Error("Bridge response had no summary");
  const record = data as { summary?: unknown; points?: unknown; stance?: unknown };
  if (typeof record.summary !== "string" || !record.summary.trim()) {
    throw new Error("Bridge response had no summary");
  }
  const points = Array.isArray(record.points)
    ? record.points
        .filter((point): point is string => typeof point === "string")
        .slice(0, 4)
        .map((point) => redactValue(point, options.token).slice(0, 300))
    : [];
  return {
    summary: redactValue(record.summary, options.token).slice(0, 2000),
    points,
    stance: typeof record.stance === "string" ? redactValue(record.stance, options.token).slice(0, 300) : "",
  };
}

export function describeBridge(url: string): string {
  return safeUrl(url);
}
