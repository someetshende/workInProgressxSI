import { assertBridgeUrl, bridgeFailure, callBridge, describeBridge } from "./bridge.js";
import { APPROVAL_TITLE, approvalDetail, composeBrief, DENIAL_COPY, releaseCopy } from "./brief.js";
import { nextInstant } from "./cadence.js";
import { DISPLAY, chooseSeats, isSeatId } from "./doctrine.js";
import { OrielError } from "./errors.js";
import { extractLoops, isBareDecision, isMemoryOnly, isMemoryQuery, recall, remember } from "./memory.js";
import { pauseCopy, readDeskCommand } from "./pause.js";
import { kindsFor, readPolicy } from "./policy.js";
import { clamp, redactSecrets } from "./redact.js";
import { consultSeat, subjectLine } from "./seats.js";
import { awayBrief, goalStatus, titleFrom } from "./state.js";
import type {
  ActorId,
  AppState,
  ApprovalKind,
  Cadence,
  Deps,
  Goal,
  LedgerEvent,
  Message,
  PlanStep,
  SeatId,
} from "./types.js";

export { initialState } from "./state.js";

function nid(draft: AppState, prefix: string): string {
  draft.seq += 1;
  return `${prefix}_${draft.seq}`;
}

function at(deps: Deps): string {
  return deps.now().toISOString();
}

function pushEvent(draft: AppState, goalId: string | null, type: string, detail: string, deps: Deps): LedgerEvent {
  const event: LedgerEvent = { id: nid(draft, "event"), at: at(deps), goalId, type, detail: redactSecrets(detail) };
  draft.events.push(event);
  return event;
}

function pushMessage(draft: AppState, message: Omit<Message, "id" | "at">, deps: Deps): Message {
  const full: Message = { ...message, id: nid(draft, "msg"), at: at(deps), text: redactSecrets(message.text) };
  draft.messages.push(full);
  return full;
}

function step(
  draft: AppState,
  title: string,
  detail: string,
  seat: ActorId,
  status: PlanStep["status"],
  kind?: ApprovalKind,
): PlanStep {
  return { id: nid(draft, "step"), title, detail, seat, status, ...(kind ? { kind } : {}) };
}

export async function convene(
  state: AppState,
  raw: string,
  goalId: string | undefined,
  deps: Deps,
): Promise<AppState> {
  const original = raw.trim();
  if (!original) throw new OrielError("Say what you want finished.");
  if (original.length > 8000) throw new OrielError("That is too long to convene in one turn.");

  const desk = readDeskCommand(original);
  if (desk) return setPaused(state, desk === "pause", deps);

  const decision = isBareDecision(original);
  if (decision) {
    const open = [...state.approvals].reverse().find((approval) => approval.status === "open");
    if (!open) throw new OrielError("Nothing is waiting on you.");
    return settle(state, open.id, decision, deps);
  }

  const draft = structuredClone(state);
  const stored = redactSecrets(original);
  draft.memory = remember(draft.memory, stored);
  const policy = readPolicy(original, draft.memory);

  let goal: Goal | null = null;
  if (goalId) {
    const existing = draft.goals.find((item) => item.id === goalId);
    if (!existing) throw new OrielError("That goal is not in the record.", 404);
    goal = existing;
    for (const approval of draft.approvals) {
      if (approval.goalId === goal.id && approval.status === "open") {
        approval.status = "denied";
        approval.resolution = "Superseded by a newer request on this goal.";
        approval.settledAt = at(deps);
        const old = goal.plan.find((item) => item.id === approval.stepId);
        if (old && old.status === "waiting") old.status = "denied";
      }
    }
  }

  pushMessage(draft, { role: "you", text: stored, ...(goal ? { goalId: goal.id } : {}) }, deps);

  if (isMemoryQuery(stored)) {
    pushMessage(draft, { role: "oriel", text: recall(draft.memory) }, deps);
    pushEvent(draft, null, "memory", "Recalled what Oriel has been asked to keep.", deps);
    return draft;
  }

  if (isMemoryOnly(stored)) {
    const latest = draft.memory.preferences.at(-1);
    pushMessage(draft, { role: "oriel", text: `I'll keep that. ${latest ?? ""}`.trim() }, deps);
    pushEvent(draft, null, "memory", "Stored a preference.", deps);
    return draft;
  }

  const choice = chooseSeats(original, policy.businessSensitive, draft.connectors);
  const { held, skipped } = kindsFor(policy);
  const subject = subjectLine(stored);
  const now = at(deps);
  const created = !goal;
  if (!goal) {
    goal = {
      id: nid(draft, "goal"),
      title: titleFrom(stored),
      origin: stored,
      text: stored,
      status: "done",
      createdAt: now,
      updatedAt: now,
      lead: choice.lead,
      plan: [],
      brief: composeBrief({ title: titleFrom(stored), choice, policy, notes: [], held, skipped }),
      openLoops: extractLoops(stored),
      prose: null,
    };
    draft.goals.push(goal);
  } else {
    goal.text = stored;
    goal.title = titleFrom(stored);
    goal.updatedAt = now;
    goal.lead = choice.lead;
    const extracted = extractLoops(stored);
    const stopWatch = /\b(stop watching|drop the watch|never mind the watch)\b/i.test(stored);
    goal.openLoops = stopWatch || extracted.length ? extracted : goal.openLoops;
    goal.prose = null;
  }
  const you = draft.messages.at(-1);
  if (you && you.role === "you") you.goalId = goal.id;

  const plan: PlanStep[] = [
    step(draft, "Frame the outcome", "Oriel states one recommendation and keeps the record.", "oriel", "done"),
  ];
  const consulted = await Promise.all(
    choice.picked.map(async (seat) => {
      const connector = draft.connectors.find((item) => item.id === seat);
      if (!connector) return null;
      return consultSeat({ connector, subject, task: stored, intents: choice.intents, policy, deps });
    }),
  );
  const notes = [];
  for (const note of consulted) {
    if (!note) continue;
    notes.push(note);
    plan.push(
      step(
        draft,
        `Read from ${DISPLAY[note.seat]}`,
        note.liveError ? `Fell back to a reference read. ${note.liveError}` : note.summary,
        note.seat,
        "done",
      ),
    );
  }

  const approvalIds: string[] = [];
  for (const kind of skipped) {
    plan.push(step(draft, `Leave the ${kind} undone`, approvalDetail(kind, stored), "oriel", "skipped", kind));
  }
  for (const kind of held) {
    const planned = step(draft, APPROVAL_TITLE[kind], approvalDetail(kind, stored), "oriel", "waiting", kind);
    plan.push(planned);
    const approval = {
      id: nid(draft, "approval"),
      goalId: goal.id,
      stepId: planned.id,
      title: APPROVAL_TITLE[kind],
      detail: planned.detail,
      kind,
      status: "open" as const,
      resolution: null,
      createdAt: now,
      settledAt: null,
    };
    draft.approvals.push(approval);
    approvalIds.push(approval.id);
  }

  goal.plan = plan;
  goal.brief = composeBrief({
    title: goal.title,
    choice,
    policy,
    notes,
    held,
    skipped,
  });
  goal.status = goalStatus(goal, draft.approvals);

  let spoken = goal.brief.voice;
  if (!goal.brief.tight && deps.refine) {
    const prose = await deps.refine(goal.brief.synthesis);
    if (prose) {
      goal.prose = prose;
      spoken = prose;
    }
  }

  pushMessage(
    draft,
    { role: "oriel", text: spoken, goalId: goal.id, approvalIds, tight: goal.brief.tight },
    deps,
  );
  const convened = choice.picked.map((id) => DISPLAY[id]).join(", ") || "no work seat";
  pushEvent(
    draft,
    goal.id,
    created ? "convened" : "continued",
    `${created ? "Convened" : "Continued with"} ${convened}.`,
    deps,
  );
  for (const note of notes) {
    if (note.liveError) {
      pushEvent(draft, goal.id, "fallback", `${DISPLAY[note.seat]} fell back: ${note.liveError}`, deps);
    }
  }
  return draft;
}

export async function settle(
  state: AppState,
  approvalId: string,
  decision: "approve" | "deny",
  deps: Deps,
): Promise<AppState> {
  const draft = structuredClone(state);
  const approval = draft.approvals.find((item) => item.id === approvalId);
  if (!approval) throw new OrielError("That hold is not in the record.", 404);
  if (approval.status !== "open") throw new OrielError("That hold is already settled.", 409);
  const goal = draft.goals.find((item) => item.id === approval.goalId);
  if (!goal) throw new OrielError("That goal is not in the record.", 404);
  const planned = goal.plan.find((item) => item.id === approval.stepId);

  approval.settledAt = at(deps);
  if (decision === "deny") {
    approval.status = "denied";
    approval.resolution = DENIAL_COPY;
    if (planned) planned.status = "denied";
    pushEvent(draft, goal.id, "denied", `${approval.title} was held back.`, deps);
  } else {
    approval.status = "approved";
    if (planned) planned.status = "done";
    let liveSummary: string | null = null;
    const lead = goal.lead ? draft.connectors.find((connector) => connector.id === goal.lead) : undefined;
    if (lead?.bridgeUrl) {
      try {
        const reply = await callBridge({
          url: lead.bridgeUrl,
          token: lead.token,
          fetchImpl: deps.fetchImpl,
          payload: {
            product: "Oriel",
            action: "released",
            seat: lead.id,
            task: goal.text,
            intents: [],
            businessSensitive: /client|patient|confidential/i.test(goal.text),
            kind: approval.kind,
          },
        });
        liveSummary = reply.summary;
        lead.lastResult = "live";
        lead.lastError = null;
      } catch (error) {
        const message = bridgeFailure(error, lead.token);
        lead.lastResult = "fallback";
        lead.lastError = message;
        pushEvent(draft, goal.id, "fallback", `${DISPLAY[lead.id]} could not take the release: ${message}`, deps);
      }
    }
    approval.resolution = releaseCopy(approval.kind, liveSummary);
    pushEvent(draft, goal.id, "approved", approval.resolution, deps);
  }

  goal.updatedAt = at(deps);
  goal.status = goalStatus(goal, draft.approvals);
  pushMessage(draft, { role: "oriel", text: approval.resolution ?? DENIAL_COPY, goalId: goal.id }, deps);
  return draft;
}

export function setConnector(
  state: AppState,
  id: string,
  patch: { enabled?: boolean; bridgeUrl?: string | null; token?: string },
  deps: Deps,
): AppState {
  if (!isSeatId(id)) throw new OrielError("Unknown seat.", 404);
  const draft = structuredClone(state);
  const connector = draft.connectors.find((item) => item.id === id);
  if (!connector) throw new OrielError("Unknown seat.", 404);
  if (typeof patch.enabled === "boolean") connector.enabled = patch.enabled;
  if (patch.bridgeUrl === null) {
    connector.bridgeUrl = null;
    connector.lastResult = "idle";
    connector.lastError = null;
  } else if (typeof patch.bridgeUrl === "string") {
    connector.bridgeUrl = assertBridgeUrl(patch.bridgeUrl);
    connector.lastResult = "idle";
    connector.lastError = null;
    pushEvent(draft, null, "bridge", `Bridge saved for ${DISPLAY[id]} at ${describeBridge(connector.bridgeUrl)}.`, deps);
  }
  if (patch.token === "") connector.token = null;
  else if (typeof patch.token === "string") {
    connector.token = patch.token;
    pushEvent(draft, null, "bridge", `Token updated for ${DISPLAY[id]}.`, deps);
  }
  if (typeof patch.enabled === "boolean") {
    pushEvent(draft, null, "seat", `${DISPLAY[id]} is ${connector.enabled ? "on" : "off"}.`, deps);
  }
  return draft;
}

export function saveRoutine(
  state: AppState,
  goalId: string,
  name: string | undefined,
  deps: Deps,
  cadence: Cadence = "manual",
): AppState {
  const goal = state.goals.find((item) => item.id === goalId);
  if (!goal) throw new OrielError("That goal is not in the record.", 404);
  const existing = state.routines.find((routine) => routine.instruction === goal.text);
  if (existing) return state;
  const draft = structuredClone(state);
  const routine = {
    id: nid(draft, "routine"),
    name: (name?.trim() || titleFrom(goal.text)).slice(0, 80),
    instruction: goal.text,
    cadence,
    createdAt: at(deps),
    lastRunAt: null,
    nextRunAt: nextInstant(cadence, deps.now()),
  };
  draft.routines.push(routine);
  pushEvent(draft, goal.id, "routine_saved", `Saved routine “${routine.name}”. Holds still apply when it runs.`, deps);
  return draft;
}

export function setRoutineCadence(state: AppState, routineId: string, cadence: Cadence, deps: Deps): AppState {
  const draft = structuredClone(state);
  const routine = draft.routines.find((item) => item.id === routineId);
  if (!routine) throw new OrielError("That routine is not in the record.", 404);
  if (routine.cadence === cadence) return state;
  routine.cadence = cadence;
  routine.nextRunAt = nextInstant(cadence, deps.now());
  const when = cadence === "manual" ? "only when you run it" : `every ${cadence === "hourly" ? "hour" : "day"}`;
  pushEvent(draft, null, "cadence", `“${routine.name}” wakes ${when}. A wake does not approve a hold.`, deps);
  return draft;
}

export async function runRoutine(
  state: AppState,
  routineId: string,
  deps: Deps,
  via?: "wake",
): Promise<AppState> {
  const routine = state.routines.find((item) => item.id === routineId);
  if (!routine) throw new OrielError("That routine is not in the record.", 404);
  const next = await convene(state, routine.instruction, undefined, deps);
  const saved = next.routines.find((item) => item.id === routineId);
  if (saved) {
    saved.lastRunAt = at(deps);
    if (via === "wake") saved.nextRunAt = nextInstant(saved.cadence, deps.now());
  }
  const goal = next.goals.at(-1);
  if (via === "wake" && goal) {
    const spoken = [...next.messages].reverse().find((message) => message.role === "you" && message.goalId === goal.id);
    if (spoken) spoken.via = "wake";
  }
  pushEvent(next, goal?.id ?? null, "routine_ran", `Ran routine “${routine.name}”.`, deps);
  return next;
}

export function setPaused(state: AppState, paused: boolean, deps: Deps): AppState {
  const draft = structuredClone(state);
  const already = state.paused === true;
  if (already !== paused) draft.paused = paused;
  const spoken = pauseCopy(paused, already === paused);
  pushMessage(draft, { role: "oriel", text: spoken }, deps);
  if (already !== paused) {
    pushEvent(
      draft,
      null,
      paused ? "paused" : "resumed",
      paused
        ? "Wakes are paused. Routines stay saved. Open holds stay open. Nothing was sent or spent."
        : "Wakes are on again. A wake does not approve a hold, send mail, or move money.",
      deps,
    );
  }
  return draft;
}

export async function wakeDue(state: AppState, deps: Deps): Promise<AppState> {
  if (state.paused === true) return state;
  const now = at(deps);
  const due = state.routines
    .filter((routine) => routine.cadence !== "manual" && routine.nextRunAt !== null && routine.nextRunAt <= now)
    .sort((a, b) => (a.nextRunAt ?? "").localeCompare(b.nextRunAt ?? ""));
  const routine = due[0];
  if (!routine) return state;
  try {
    const next = await runRoutine(state, routine.id, deps, "wake");
    pushEvent(
      next,
      next.goals.at(-1)?.id ?? null,
      "woke",
      `Oriel woke “${routine.name}” on its ${routine.cadence} cadence. Holds still apply. Nothing was sent or spent.`,
      deps,
    );
    return next;
  } catch (error) {
    const draft = structuredClone(state);
    const saved = draft.routines.find((item) => item.id === routine.id);
    if (saved) saved.nextRunAt = nextInstant(saved.cadence, deps.now());
    const message = error instanceof Error ? error.message : "The routine could not run.";
    pushEvent(draft, null, "wake_failed", `Oriel could not wake “${routine.name}”: ${clamp(message, 160)}`, deps);
    return draft;
  }
}

export async function probeConnector(state: AppState, id: string, deps: Deps): Promise<AppState> {
  if (!isSeatId(id)) throw new OrielError("Unknown seat.", 404);
  const draft = structuredClone(state);
  const connector = draft.connectors.find((item) => item.id === id);
  if (!connector) throw new OrielError("Unknown seat.", 404);
  if (!connector.bridgeUrl) throw new OrielError("Save a bridge before checking it.");
  try {
    const reply = await callBridge({
      url: connector.bridgeUrl,
      token: connector.token,
      fetchImpl: deps.fetchImpl,
      payload: {
        product: "Oriel",
        action: "status",
        seat: connector.id,
        task: "Confirm the bridge is reachable. Do not send, pay, delete, post, or sign in.",
        intents: ["direct"],
        businessSensitive: false,
      },
    });
    connector.lastResult = "live";
    connector.lastError = null;
    const spoken = `${DISPLAY[id]} answered. ${clamp(reply.summary, 240)} Nothing was sent or spent.`;
    pushMessage(draft, { role: "oriel", text: spoken }, deps);
    pushEvent(draft, null, "probe", spoken, deps);
  } catch (error) {
    const message = bridgeFailure(error, connector.token);
    connector.lastResult = "fallback";
    connector.lastError = message;
    const spoken = `${DISPLAY[id]} did not answer (${message}). Nothing was sent or spent.`;
    pushMessage(draft, { role: "oriel", text: spoken }, deps);
    pushEvent(draft, null, "probe", spoken, deps);
  }
  return draft;
}

export function leadSeat(goal: Goal): SeatId | null {
  return goal.lead;
}

function deskIsSensitive(state: AppState): boolean {
  return state.goals.some((goal) => /client|patient|confidential/i.test(`${goal.text}\n${goal.openLoops.join(" ")}`));
}

export async function reviewWatches(state: AppState, deps: Deps): Promise<AppState> {
  const draft = structuredClone(state);
  const away = awayBrief(draft);
  if (!away) {
    pushMessage(draft, { role: "oriel", text: "Nothing is waiting. There is no open hold and no watch." }, deps);
    pushEvent(draft, null, "watched", "Checked for open holds and watches. Nothing was waiting.", deps);
    return draft;
  }

  const sensitive = deskIsSensitive(draft);
  const lines = away.lines;
  const bridges = draft.connectors.filter((connector) => connector.enabled && connector.bridgeUrl);
  const notes = await Promise.all(
    bridges.map(async (connector) => {
      if (sensitive && connector.id === "muse") {
        return "Muse was not asked. A goal or watch on the desk is client, patient, or confidential work.";
      }
      const bridgeUrl = connector.bridgeUrl;
      if (!bridgeUrl) return "";
      try {
        const reply = await callBridge({
          url: bridgeUrl,
          token: connector.token,
          fetchImpl: deps.fetchImpl,
          payload: {
            product: "Oriel",
            action: "status",
            seat: connector.id,
            task: `Status only. Do not send, pay, delete, post, or sign in. ${lines.join(" ")}`,
            intents: ["direct"],
            businessSensitive: sensitive,
          },
        });
        connector.lastResult = "live";
        connector.lastError = null;
        return `${DISPLAY[connector.id]}: ${reply.summary}`;
      } catch (error) {
        const message = bridgeFailure(error, connector.token);
        connector.lastResult = "fallback";
        connector.lastError = message;
        return `${DISPLAY[connector.id]} bridge failed (${message}).`;
      }
    }),
  );

  const spokenLines = lines.map((line) => (line.endsWith(".") ? line : `${line}.`));
  const voice = ["Nothing moved. Here is what is still open.", ...spokenLines, ...notes.filter(Boolean)].join(" ");
  pushMessage(draft, { role: "oriel", text: voice }, deps);
  pushEvent(draft, null, "watched", "Checked open holds and watches. Nothing was sent or spent.", deps);
  return draft;
}
