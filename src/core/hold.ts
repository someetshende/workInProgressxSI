import type { Deps } from "./types.js";

/** Grok Bot expires an unattended approval after about ten minutes. */
export const HOLD_WINDOW_MS = 10 * 60 * 1000;

export const EXPIRED_COPY =
  "This hold expired. The action did not run. Ask Oriel to try again. There is no always-allow.";

export const AWAY_HOLD_COPY =
  "This hold was raised while you were away. It expires if you do not answer, and then the action does not run. There is no always-allow.";

export function holdWindowMs(deps: Deps): number {
  const custom = deps.holdWindowMs;
  if (typeof custom === "number" && Number.isFinite(custom) && custom >= 0 && custom <= HOLD_WINDOW_MS) {
    return Math.floor(custom);
  }
  return HOLD_WINDOW_MS;
}

export function expiresAtFor(presence: "present" | "away", createdAt: string, deps: Deps): string | null {
  if (presence !== "away") return null;
  return new Date(new Date(createdAt).getTime() + holdWindowMs(deps)).toISOString();
}
