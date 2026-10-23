import { bridgeFailure, callBridge, type BridgePayload } from "./bridge.js";
import { DISPLAY } from "./doctrine.js";
import { clamp } from "./redact.js";
import type { Connector, Deps, Intent, Policy, SeatId, SeatNote } from "./types.js";

const STANCE: Record<SeatId, string> = {
  grok: "Run one clean pass on the work computer, then consider a routine. Do not share that computer's credentials with another seat.",
  dots: "Own the outcome between turns and bring back the decision, not a pile of options.",
  muse: "Keep it as plain as a message. Stop before money, mail, or anything public.",
};

export function referenceNote(seat: SeatId, _subject: string, policy: Policy): SeatNote {
  const summary =
    seat === "grok"
      ? "Grok Bot would run this on its own computer and keep specialist work in parallel."
      : seat === "dots"
        ? "Dots would own this until it is finished the way you would finish it."
        : "Muse would turn this into a short plan and only come back for a decision.";
  const points = [
    policy.businessSensitive
      ? "Treat names, matters, and customer data as work material."
      : "Use only what was written in this request.",
    policy.payment ? "Any purchase stays held." : "No payment was asked of this read.",
    policy.forbadeSend ? "You already ruled out sending." : "Outbound work stays with Oriel's hold.",
  ];
  if (policy.personPassword || policy.personSignin || policy.personCode) {
    points.push("The password, sign-in, or code stays with the person. Do not type it.");
  }
  const handed: string[] = [];
  if (policy.replaces.includes("send")) handed.push("send");
  if (policy.replaces.includes("pay")) handed.push("payment");
  if (policy.replaces.includes("delete")) handed.push("deletion");
  if (policy.replaces.includes("post")) handed.push("post");
  if (handed.length) {
    const list = handed.length === 1 ? handed[0] : `${handed.slice(0, -1).join(", ")} and ${handed.at(-1)}`;
    points.push(`The ${list} stays with the person. Do not do that step from this read.`);
  }
  return { seat, mode: "reference", summary, points, stance: STANCE[seat] };
}

export async function consultSeat(options: {
  connector: Connector;
  subject: string;
  task: string;
  intents: Intent[];
  policy: Policy;
  deps: Deps;
}): Promise<SeatNote> {
  const { connector, subject, task, intents, policy, deps } = options;
  const base = referenceNote(connector.id, subject, policy);
  if (!connector.bridgeUrl) {
    connector.lastResult = "idle";
    connector.lastError = null;
    return base;
  }
  const payload: BridgePayload = {
    product: "Oriel",
    action: "convene",
    seat: connector.id,
    task,
    intents,
    businessSensitive: policy.businessSensitive,
  };
  try {
    const live = await callBridge({
      url: connector.bridgeUrl,
      token: connector.token,
      payload,
      fetchImpl: deps.fetchImpl,
    });
    connector.lastResult = "live";
    connector.lastError = null;
    return {
      seat: connector.id,
      mode: "live",
      summary: `Live bridge: ${live.summary}`,
      points: live.points.length ? live.points : base.points,
      stance: live.stance || STANCE[connector.id],
    };
  } catch (error) {
    const message = bridgeFailure(error, connector.token);
    connector.lastResult = "fallback";
    connector.lastError = message;
    return {
      ...base,
      liveError: message,
      summary: `The live bridge for ${DISPLAY[connector.id]} failed (${message}). ${base.summary}`,
    };
  }
}

export function subjectLine(text: string): string {
  return clamp(text, 160);
}
