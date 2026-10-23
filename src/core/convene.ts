import { assertBridgeUrl, bridgeFailure, callBridge, describeBridge } from "./bridge.js";
import { APPROVAL_TITLE, approvalDetail, composeBrief, DENIAL_COPY, releaseCopy } from "./brief.js";
import { nextInstant } from "./cadence.js";
import { DISPLAY, chooseSeats, isSeatId } from "./doctrine.js";
import { OrielError } from "./errors.js";
import { HANDOFF_DONE, HANDOFF_LEFT, HANDOFF_TASK, cleanPhrase, handoffCardDetail, handoffTitle, isHandoffAction, isHandoffDecision, isSpokenNamed, isSpokenRead, isSpokenShared, isSpokenSharedWords, isSpokenUnnamed, isSpokenUnsharedWords, loosensHandoff, loosensSpokenAsk, loosensSpokenClear, loosensSpokenNamed, loosensSpokenRead, loosensSpokenShared, loosensSpokenSharedWords, loosensSpokenStep, loosensSpokenUnnamed, loosensSpokenUnsharedWords, loosensSpokenWords, readSpokenAsk, readSpokenAskPhrase, readSpokenClear, readSpokenRule, readSpokenStep, readSpokenWords, skillGuardsSeat, spokenAskCopy, spokenAskPhraseCopy, spokenBareClearCopy, spokenBareClearMissCopy, spokenClearCopy, spokenClearMissCopy, spokenNamedCopy, spokenPhraseMatches, spokenReadCopy, spokenRuleCopy, spokenSharedCopy, spokenSharedWordsCopy, spokenStepCopy, spokenUnnamedCopy, spokenUnsharedWordsCopy, spokenWordsCopy, taskSuffix } from "./handoff.js";
import type { SpokenAsk, SpokenAskPhrase, SpokenClear, SpokenRule, SpokenStep, SpokenWords } from "./handoff.js";
import { AWAY_HOLD_COPY, EXPIRED_COPY, expiresAtFor } from "./hold.js";
import { extractLoops, isBareDecision, isMemoryOnly, isMemoryQuery, recall, remember } from "./memory.js";
import { pauseCopy, readDeskCommand } from "./pause.js";
import { applyHandoffRules, kindsFor, readPolicy, withSkillProhibitions } from "./policy.js";
import { clamp, redactSecrets } from "./redact.js";
import { skillInstruction } from "./skill.js";
import { consultSeat, subjectLine } from "./seats.js";
import { awayBrief, goalStatus, titleFrom } from "./state.js";
import type {
  ActorId,
  AppState,
  Approval,
  ApprovalKind,
  Cadence,
  Deps,
  Goal,
  Handoff,
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

function holdIsDue(approval: Approval, deps: Deps): boolean {
  return approval.status === "open" && typeof approval.expiresAt === "string" && approval.expiresAt <= at(deps);
}

export function expireHolds(state: AppState, deps: Deps): AppState {
  const due = state.approvals.filter((approval) => holdIsDue(approval, deps));
  if (!due.length) return state;
  const draft = structuredClone(state);
  const now = at(deps);
  const ids = new Set(due.map((approval) => approval.id));
  const goals = new Set<string>();
  for (const approval of draft.approvals) {
    if (!ids.has(approval.id)) continue;
    approval.status = "expired";
    approval.resolution = EXPIRED_COPY;
    approval.settledAt = now;
    const goal = draft.goals.find((item) => item.id === approval.goalId);
    const planned = goal?.plan.find((item) => item.id === approval.stepId);
    if (planned && planned.status === "waiting") planned.status = "expired";
    goals.add(approval.goalId);
    pushEvent(
      draft,
      approval.goalId,
      "expired",
      `${approval.title} expired before you answered. The action did not run. Nothing was sent or spent.`,
      deps,
    );
  }
  for (const goal of draft.goals) {
    if (!goals.has(goal.id)) continue;
    goal.updatedAt = now;
    goal.status = goalStatus(goal, draft.approvals, draft.handoffs ?? []);
  }
  pushMessage(
    draft,
    {
      role: "oriel",
      text: due.length === 1 ? EXPIRED_COPY : "These holds expired. The actions did not run. Ask Oriel to try again. There is no always-allow.",
    },
    deps,
  );
  return draft;
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
  skillId?: string,
  presence: "present" | "away" = "present",
): Promise<AppState> {
  const original = raw.trim();
  if (!original) throw new OrielError("Say what you want finished.");
  if (original.length > 8000) throw new OrielError("That is too long to convene in one turn.");

  const swept = expireHolds(state, deps);
  const desk = readDeskCommand(original);
  if (desk) return setPaused(swept, desk === "pause", deps);

  const decision = isBareDecision(original);
  if (decision) {
    const open = [...swept.approvals].reverse().find((approval) => approval.status === "open");
    if (!open) {
      const handed = [...(swept.handoffs ?? [])].reverse().find((item) => item.status === "open");
      if (decision === "deny" && handed) return settleHandoff(swept, handed.id, "leave", deps);
      if (decision === "approve" && handed) {
        throw new OrielError("That step is yours. Say you did it, or leave it. Approve does not do it.");
      }
      if (swept !== state) return swept;
      throw new OrielError("Nothing is waiting on you.");
    }
    return settle(swept, open.id, decision, deps);
  }

  const handDecision = isHandoffDecision(original);
  if (handDecision) {
    const open = [...(swept.handoffs ?? [])].reverse().find((item) => item.status === "open");
    if (!open) {
      if (swept !== state) return swept;
      throw new OrielError("Nothing is waiting on you.");
    }
    return settleHandoff(swept, open.id, handDecision, deps);
  }

  const spokenRule = readSpokenRule(original);
  if (spokenRule?.kind === "reject" && spokenRule.reason === "phrase") {
    throw new OrielError("Name the step in a short phrase. Oriel will not run it.");
  }
  if (!spokenRule && loosensHandoff(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }
  if (spokenRule) return applySpokenRule(swept, original, spokenRule, deps);

  const spokenClear = readSpokenClear(original);
  if (spokenClear?.kind === "reject" && spokenClear.reason === "phrase") {
    throw new OrielError("Name the step in a short phrase. Oriel will not run it.");
  }
  if (!spokenClear && loosensSpokenClear(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }
  if (spokenClear) return applySpokenClear(swept, original, spokenClear, deps);

  if (isSpokenRead(original)) return applySpokenRead(swept, original, deps);
  const spokenAskPhrase = readSpokenAskPhrase(original);
  if (spokenAskPhrase?.kind === "reject" && spokenAskPhrase.reason === "phrase") {
    throw new OrielError("Name the step in a short phrase. Oriel will not run it.");
  }
  if (spokenAskPhrase) return applySpokenAskPhrase(swept, original, spokenAskPhrase, deps);
  const spokenAsk = readSpokenAsk(original);
  if (spokenAsk) return applySpokenAsk(swept, original, spokenAsk, deps);
  const spokenWords = readSpokenWords(original);
  if (spokenWords) return applySpokenWords(swept, original, spokenWords, deps);
  const spokenStep = readSpokenStep(original);
  if (spokenStep) {
    if (spokenStep.kind === "reject") {
      throw new OrielError("Name the step in a short phrase. Oriel will not run it.");
    }
    return applySpokenStep(swept, original, spokenStep, deps);
  }
  if (isSpokenUnnamed(original)) return applySpokenUnnamed(swept, original, deps);
  if (isSpokenNamed(original)) return applySpokenNamed(swept, original, deps);
  if (isSpokenShared(original)) return applySpokenShared(swept, original, deps);
  if (isSpokenUnsharedWords(original)) return applySpokenUnsharedWords(swept, original, deps);
  if (isSpokenSharedWords(original)) return applySpokenSharedWords(swept, original, deps);
  if (
    loosensSpokenRead(original) ||
    loosensSpokenAsk(original) ||
    loosensSpokenWords(original) ||
    loosensSpokenStep(original) ||
    loosensSpokenUnnamed(original) ||
    loosensSpokenNamed(original) ||
    loosensSpokenShared(original) ||
    loosensSpokenUnsharedWords(original) ||
    loosensSpokenSharedWords(original)
  ) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const stored = redactSecrets(original);
  const memoryTurn = isMemoryQuery(stored) || isMemoryOnly(stored);
  const skill = skillId ? (swept.skills ?? []).find((item) => item.id === skillId) ?? null : null;
  if (skillId && !skill && !memoryTurn) throw new OrielError("That skill is not in the record.", 404);
  const applied = memoryTurn ? null : skill;

  const draft = structuredClone(swept);
  draft.handoffs = draft.handoffs ?? [];
  draft.handoffRules = draft.handoffRules ?? [];
  draft.memory = remember(draft.memory, stored);
  let policy = readPolicy(original, draft.memory);
  if (applied) policy = withSkillProhibitions(policy, applied.method, draft.memory);
  const ruled = applyHandoffRules(policy, draft.handoffRules, original);
  policy = ruled.policy;
  const fired = ruled.fired;
  const rulePhrases = ruled.phrases;

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
    for (const handoff of draft.handoffs) {
      if (handoff.goalId !== goal.id || handoff.status !== "open") continue;
      handoff.status = "left";
      handoff.resolution = "Superseded by a newer request on this goal.";
      handoff.settledAt = at(deps);
      const old = goal.plan.find((item) => item.id === handoff.stepId);
      if (old && old.status === "waiting") old.status = "skipped";
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
      skillId: applied?.id ?? null,
      plan: [],
      brief: composeBrief({
        title: titleFrom(stored),
        choice,
        policy,
        notes: [],
        held,
        skipped,
        skillName: applied?.name ?? null,
        handed: policy.handoff,
        rules: fired,
        rulePhrases,
        away: presence === "away",
      }),
      openLoops: extractLoops(stored),
      prose: null,
    };
    draft.goals.push(goal);
  } else {
    goal.text = stored;
    goal.title = titleFrom(stored);
    goal.updatedAt = now;
    goal.lead = choice.lead;
    if (applied) goal.skillId = applied.id;
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
  const taskForSeats = `${applied ? skillInstruction(applied.name, applied.method, stored) : stored}${taskSuffix(
    policy,
    applied ? skillGuardsSeat(applied.method) : false,
  )}`;
  const consulted = await Promise.all(
    choice.picked.map(async (seat) => {
      const connector = draft.connectors.find((item) => item.id === seat);
      if (!connector) return null;
      return consultSeat({ connector, subject, task: taskForSeats, intents: choice.intents, policy, deps });
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
      expiresAt: expiresAtFor(presence, now, deps),
      settledAt: null,
    };
    draft.approvals.push(approval);
    approvalIds.push(approval.id);
  }
  if (policy.handoff) {
    const detail = handoffCardDetail(policy, rulePhrases);
    const planned = step(draft, "Hand off to you", detail, "oriel", "waiting");
    plan.push(planned);
    draft.handoffs.push({
      id: nid(draft, "handoff"),
      goalId: goal.id,
      stepId: planned.id,
      title: handoffTitle(policy),
      detail,
      status: "open",
      resolution: null,
      createdAt: now,
      settledAt: null,
    });
    pushEvent(
      draft,
      goal.id,
      "handed",
      "Handed a step to you. Oriel will not type a password, sign in, send mail, or move money.",
      deps,
    );
  }

  goal.plan = plan;
  goal.brief = composeBrief({
    title: goal.title,
    choice,
    policy,
    notes,
    held,
    skipped,
    handed: policy.handoff,
    skillName: applied?.name ?? null,
    rules: fired,
    rulePhrases,
    away: presence === "away",
  });
  goal.status = goalStatus(goal, draft.approvals, draft.handoffs);

  let spoken = goal.brief.voice;
  if (!goal.brief.tight && deps.refine) {
    const prose = await deps.refine(goal.brief.synthesis);
    if (prose) {
      goal.prose = prose;
      spoken = prose;
    }
  }
  if (presence === "away" && held.length && !spoken.includes("while you were away")) {
    spoken = `${spoken} ${AWAY_HOLD_COPY}`;
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
  if (applied) {
    pushEvent(
      draft,
      goal.id,
      "skill_applied",
      `Applied skill “${applied.name}”. A skill does not wake, and it does not approve a hold.`,
      deps,
    );
  }
  return draft;
}

export async function settle(
  state: AppState,
  approvalId: string,
  decision: "approve" | "deny",
  deps: Deps,
): Promise<AppState> {
  const swept = expireHolds(state, deps);
  const current = swept.approvals.find((item) => item.id === approvalId);
  if (!current) throw new OrielError("That hold is not in the record.", 404);
  if (current.status !== "open") {
    if (swept !== state) return swept;
    throw new OrielError("That hold is already settled.", 409);
  }
  const draft = structuredClone(swept);
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
            task: releaseTask(goal, draft.handoffs ?? []),
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
  goal.status = goalStatus(goal, draft.approvals, draft.handoffs ?? []);
  pushMessage(draft, { role: "oriel", text: approval.resolution ?? DENIAL_COPY, goalId: goal.id }, deps);
  return draft;
}

function releaseTask(goal: Goal, handoffs: Handoff[]): string {
  return handoffs.some((item) => item.goalId === goal.id)
    ? `${goal.text}\n\n${HANDOFF_TASK} Do not perform the step that was handed to the person.`
    : goal.text;
}

export async function settleHandoff(
  state: AppState,
  handoffId: string,
  decision: "done" | "leave",
  deps: Deps,
): Promise<AppState> {
  const swept = expireHolds(state, deps);
  const current = (swept.handoffs ?? []).find((item) => item.id === handoffId);
  if (!current) throw new OrielError("That handoff is not in the record.", 404);
  if (current.status !== "open") {
    if (swept !== state) return swept;
    throw new OrielError("That handoff is already settled.", 409);
  }
  const draft = structuredClone(swept);
  draft.handoffs = draft.handoffs ?? [];
  const handoff = draft.handoffs.find((item) => item.id === handoffId);
  if (!handoff) throw new OrielError("That handoff is not in the record.", 404);
  if (handoff.status !== "open") throw new OrielError("That handoff is already settled.", 409);
  const goal = draft.goals.find((item) => item.id === handoff.goalId);
  if (!goal) throw new OrielError("That goal is not in the record.", 404);
  const planned = goal.plan.find((item) => item.id === handoff.stepId);
  handoff.settledAt = at(deps);
  handoff.status = decision === "done" ? "done" : "left";
  handoff.resolution = decision === "done" ? HANDOFF_DONE : HANDOFF_LEFT;
  if (planned && planned.status === "waiting") planned.status = decision === "done" ? "done" : "skipped";
  goal.updatedAt = at(deps);
  goal.status = goalStatus(goal, draft.approvals, draft.handoffs);
  pushEvent(draft, goal.id, decision === "done" ? "handoff_done" : "handoff_left", handoff.resolution, deps);
  pushMessage(draft, { role: "oriel", text: handoff.resolution, goalId: goal.id }, deps);
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

function applySpokenClear(state: AppState, raw: string, spoken: SpokenClear, deps: Deps): AppState {
  if (spoken.kind === "reject") {
    const draft = structuredClone(state);
    pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
    const reply =
      "That sentence does not name a send, a payment, a deletion, or a public post. Oriel did not clear a rule and did not open a card. Nothing was sent or spent.";
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "rule_ignored", reply, deps);
    return draft;
  }
  const existing = (state.handoffRules ?? []).find((rule) => rule.action === spoken.action);
  if (spoken.phrase === null) {
    const clears = Boolean(existing && !existing.phrase);
    const draft = clears ? setHandoffRule(state, spoken.action, false, deps) : structuredClone(state);
    pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
    const reply = clears
      ? spokenBareClearCopy(spoken.action)
      : spokenBareClearMissCopy(spoken.action, existing?.phrase);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    if (!clears) pushEvent(draft, null, "rule_ignored", reply, deps);
    return draft;
  }
  const savedPhrase = existing?.phrase ?? null;
  if (!savedPhrase || !spokenPhraseMatches(savedPhrase, spoken.phrase)) {
    const draft = structuredClone(state);
    pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
    const reply = spokenClearMissCopy(spoken.action, spoken.phrase, existing ? existing.phrase : undefined);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "rule_ignored", reply, deps);
    return draft;
  }
  const draft = setHandoffRule(state, spoken.action, false, deps);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: spokenClearCopy(spoken.action, savedPhrase) }, deps);
  return draft;
}

function applySpokenRead(state: AppState, raw: string, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply = spokenReadCopy(draft.handoffRules ?? []);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "rule_read", reply, deps);
  return draft;
}

function applySpokenAskPhrase(state: AppState, raw: string, spoken: SpokenAskPhrase, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply =
    spoken.kind === "reject"
      ? "That sentence does not name a send, a payment, a deletion, or a public post. Oriel did not open a card. Nothing was sent or spent."
      : spokenAskPhraseCopy(
          spoken.action,
          spoken.phrase,
          (draft.handoffRules ?? []).find((rule) => rule.action === spoken.action),
        );
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, spoken.kind === "reject" ? "rule_ignored" : "rule_read", reply, deps);
  return draft;
}

function applySpokenStep(state: AppState, raw: string, spoken: Extract<SpokenStep, { kind: "ask" }>, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply = spokenStepCopy(spoken.phrase, draft.handoffRules ?? []);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "rule_read", reply, deps);
  return draft;
}

function applySpokenUnnamed(state: AppState, raw: string, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply = spokenUnnamedCopy(draft.handoffRules ?? []);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "rule_read", reply, deps);
  return draft;
}

function applySpokenNamed(state: AppState, raw: string, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply = spokenNamedCopy(draft.handoffRules ?? []);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "rule_read", reply, deps);
  return draft;
}

function applySpokenShared(state: AppState, raw: string, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply = spokenSharedCopy(draft.handoffRules ?? []);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "rule_read", reply, deps);
  return draft;
}

function applySpokenSharedWords(state: AppState, raw: string, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply = spokenSharedWordsCopy(draft.handoffRules ?? []);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "rule_read", reply, deps);
  return draft;
}

function applySpokenUnsharedWords(state: AppState, raw: string, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply = spokenUnsharedWordsCopy(draft.handoffRules ?? []);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "rule_read", reply, deps);
  return draft;
}

function applySpokenWords(state: AppState, raw: string, spoken: SpokenWords, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply =
    spoken.kind === "reject"
      ? "That sentence does not name a send, a payment, a deletion, or a public post. Oriel did not open a card. Nothing was sent or spent."
      : spokenWordsCopy(
          spoken.action,
          (draft.handoffRules ?? []).find((rule) => rule.action === spoken.action),
        );
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, spoken.kind === "reject" ? "rule_ignored" : "rule_read", reply, deps);
  return draft;
}

function applySpokenAsk(state: AppState, raw: string, spoken: SpokenAsk, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply =
    spoken.kind === "reject"
      ? "That sentence does not name a send, a payment, a deletion, or a public post. Oriel did not open a card. Nothing was sent or spent."
      : spokenAskCopy(
          spoken.action,
          (draft.handoffRules ?? []).find((rule) => rule.action === spoken.action),
        );
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, spoken.kind === "reject" ? "rule_ignored" : "rule_read", reply, deps);
  return draft;
}

function applySpokenRule(state: AppState, raw: string, spoken: SpokenRule, deps: Deps): AppState {
  if (spoken.kind === "reject") {
    const draft = structuredClone(state);
    pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
    const reply =
      "That sentence does not name a send, a payment, a deletion, or a public post. Oriel did not save a rule and did not open a card. Nothing was sent or spent.";
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "rule_ignored", reply, deps);
    return draft;
  }
  const existing = (state.handoffRules ?? []).find((rule) => rule.action === spoken.action);
  const mode = !existing ? "saved" : existing.phrase === spoken.phrase ? "same" : "updated";
  const draft = mode === "same" ? structuredClone(state) : setHandoffRule(state, spoken.action, true, deps, spoken.phrase);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: spokenRuleCopy(spoken.action, spoken.phrase, mode) }, deps);
  return draft;
}

export function setHandoffRule(
  state: AppState,
  action: string,
  enabled: boolean,
  deps: Deps,
  phrase?: string,
): AppState {
  if (!isHandoffAction(action)) throw new OrielError("A handoff rule names send, pay, delete, or post.");
  const rules = state.handoffRules ?? [];
  const existing = rules.find((rule) => rule.action === action);
  let storedPhrase: string | null = null;
  if (phrase !== undefined) {
    storedPhrase = cleanPhrase(phrase);
    if (!storedPhrase) throw new OrielError("Name the step in a short phrase. Oriel will not run it.");
  }
  if (enabled && existing && phrase === undefined) return state;
  if (enabled && existing && existing.phrase === storedPhrase) return state;
  if (!enabled && !existing) return state;
  const draft = structuredClone(state);
  draft.handoffRules = [...(draft.handoffRules ?? [])];
  if (!enabled) {
    draft.handoffRules = draft.handoffRules.filter((rule) => rule.action !== action);
    pushEvent(
      draft,
      null,
      "rule_cleared",
      `Cleared the handoff rule for ${action}. Nothing was sent or spent, and no hold was approved.`,
      deps,
    );
    return draft;
  }
  const current = draft.handoffRules.find((rule) => rule.action === action);
  if (current) {
    current.phrase = storedPhrase;
    pushEvent(
      draft,
      null,
      "rule_saved",
      `Narrowed the handoff rule for ${action} to “${storedPhrase}”. The rule does not run it, wake, or approve a hold.`,
      deps,
    );
    return draft;
  }
  draft.handoffRules.push({
    id: nid(draft, "rule"),
    action,
    phrase: storedPhrase,
    createdAt: at(deps),
  });
  const scope = storedPhrase ? `mentions “${storedPhrase}”` : "would do that";
  pushEvent(
    draft,
    null,
    "rule_saved",
    `Saved a handoff rule for ${action}. When a request ${scope}, the step is yours. The rule does not run it, wake, or approve a hold.`,
    deps,
  );
  return draft;
}

export function saveSkill(state: AppState, goalId: string, name: string | undefined, deps: Deps): AppState {
  const goal = state.goals.find((item) => item.id === goalId);
  if (!goal) throw new OrielError("That goal is not in the record.", 404);
  const existing = (state.skills ?? []).find((skill) => skill.method === goal.text);
  if (existing) return state;
  const draft = structuredClone(state);
  draft.skills = draft.skills ?? [];
  const skill = {
    id: nid(draft, "skill"),
    name: (name?.trim() || titleFrom(goal.text)).slice(0, 80),
    method: goal.text,
    createdAt: at(deps),
  };
  draft.skills.push(skill);
  pushEvent(
    draft,
    goal.id,
    "skill_saved",
    `Saved skill “${skill.name}”. A skill is the method. It does not wake, and it does not approve a hold.`,
    deps,
  );
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
  const skill = goal.skillId ? (state.skills ?? []).find((item) => item.id === goal.skillId) : undefined;
  const instruction = skill ? skillInstruction(skill.name, skill.method, goal.text) : goal.text;
  const existing = state.routines.find((routine) => routine.instruction === instruction);
  if (existing) return state;
  const draft = structuredClone(state);
  const routine = {
    id: nid(draft, "routine"),
    name: (name?.trim() || (skill ? skill.name : titleFrom(goal.text))).slice(0, 80),
    instruction,
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
  const next = await convene(state, routine.instruction, undefined, deps, undefined, via === "wake" ? "away" : "present");
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
        ? "Wakes are paused. Routines stay saved. Pausing does not release a hold. Nothing was sent or spent."
        : "Wakes are on again. A wake does not approve a hold, send mail, or move money.",
      deps,
    );
  }
  return draft;
}

export async function wakeDue(state: AppState, deps: Deps): Promise<AppState> {
  const swept = expireHolds(state, deps);
  if (swept.paused === true) return swept;
  const now = at(deps);
  const due = swept.routines
    .filter((routine) => routine.cadence !== "manual" && routine.nextRunAt !== null && routine.nextRunAt <= now)
    .sort((a, b) => (a.nextRunAt ?? "").localeCompare(b.nextRunAt ?? ""));
  const routine = due[0];
  if (!routine) return swept;
  try {
    const next = await runRoutine(swept, routine.id, deps, "wake");
    pushEvent(
      next,
      next.goals.at(-1)?.id ?? null,
      "woke",
      `Oriel woke “${routine.name}” on its ${routine.cadence} cadence. Holds still apply. Nothing was sent or spent.`,
      deps,
    );
    return next;
  } catch (error) {
    const draft = structuredClone(swept);
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
