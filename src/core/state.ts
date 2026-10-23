import { AS_OF, DISPLAY, TRUST } from "./doctrine.js";
import type { AppState, Approval, Away, Connector, Goal, PublicState } from "./types.js";

export function initialState(): AppState {
  const connector = (id: Connector["id"]): Connector => ({
    id,
    displayName: DISPLAY[id],
    enabled: true,
    bridgeUrl: null,
    token: null,
    lastResult: "idle",
    lastError: null,
  });
  return {
    seq: 0,
    paused: false,
    memory: { preferences: [], people: [] },
    connectors: [connector("grok"), connector("dots"), connector("muse")],
    goals: [],
    messages: [],
    approvals: [],
    handoffs: [],
    handoffRules: [],
    routines: [],
    skills: [],
    events: [],
  };
}

export function awayBrief(state: AppState): Away {
  const lines: string[] = [];
  for (const approval of state.approvals) {
    if (approval.status === "open") lines.push(`Waiting on you: ${approval.title}`);
  }
  for (const handoff of state.handoffs ?? []) {
    if (handoff.status === "open") lines.push(`Handed to you: ${handoff.title}`);
  }
  for (const goal of state.goals) {
    for (const loop of goal.openLoops) lines.push(loop);
  }
  if (!lines.length) return null;
  return { title: "While you were away", lines };
}

export function toPublic(state: AppState, atlasCount: number): PublicState {
  return {
    product: "Oriel",
    asOf: AS_OF,
    paused: state.paused === true,
    memory: state.memory,
    connectors: state.connectors.map(({ token, ...connector }) => ({
      ...connector,
      hasToken: Boolean(token),
    })),
    goals: state.goals,
    messages: state.messages,
    approvals: state.approvals,
    handoffs: state.handoffs ?? [],
    handoffRules: state.handoffRules ?? [],
    routines: state.routines,
    skills: state.skills ?? [],
    events: state.events,
    away: awayBrief(state),
    atlas: { count: atlasCount },
    trust: TRUST,
  };
}

export function goalStatus(goal: Goal, approvals: Approval[], handoffs: AppState["handoffs"] = []): Goal["status"] {
  if (approvals.some((approval) => approval.goalId === goal.id && approval.status === "open")) return "waiting";
  if (handoffs.some((handoff) => handoff.goalId === goal.id && handoff.status === "open")) return "waiting";
  if (goal.openLoops.length) return "active";
  return "done";
}

export function titleFrom(text: string): string {
  const one = text.replace(/\s+/g, " ").trim();
  if (one.length <= 72) return one;
  return `${one.slice(0, 71).trimEnd()}…`;
}
