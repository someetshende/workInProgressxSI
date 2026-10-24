import { HANDOFF_VOICE, ruleSentence } from "./handoff.js";
import { AWAY_HOLD_COPY } from "./hold.js";
import { DISPLAY, phrase } from "./doctrine.js";
import { TRUST } from "./doctrine.js";
import { peopleIn } from "./memory.js";
import { isForwardRequest, type SlackAskKind } from "./policy.js";
import type { ApprovalKind, Brief, Cadence, Goal, HandoffAction, LedgerEvent, Policy, Routine, SeatChoice, SeatNote } from "./types.js";

const KIND_HELD: Record<ApprovalKind, string> = {
  send: "I held the send for your approval.",
  pay: "I held the payment for your approval. Oriel never moves money.",
  delete: "I held the deletion for your approval.",
  post: "I held the public post for your approval.",
  credential: "I held the use of credentials for your approval.",
};

const KIND_SKIPPED: Record<ApprovalKind, string> = {
  send: "I left the send unsent, because you ruled it out.",
  pay: "I did not spend anything, because you ruled it out.",
  delete: "I did not delete anything, because you ruled it out.",
  post: "I did not post anything, because you ruled it out.",
  credential: "I did not use credentials.",
};

export const APPROVAL_TITLE: Record<ApprovalKind, string> = {
  send: "Release a send",
  pay: "Release a payment",
  delete: "Release a deletion",
  post: "Release a public post",
  credential: "Release a credential use",
};

const KIND_STAY: Record<ApprovalKind, string> = {
  send: "the send",
  pay: "the payment",
  delete: "the deletion",
  post: "the public post",
  credential: "the credential use",
};

export function holdSentence(held: ApprovalKind[], skipped: ApprovalKind[]): string {
  return [...skipped.map((kind) => KIND_SKIPPED[kind]), ...held.map((kind) => KIND_HELD[kind])].join(" ");
}

export const DRAFT_ONLY_COPY = "This stays a draft. Nothing was sent.";

export const FORWARD_COPY =
  "This is a forward. Oriel did not pull the original message or its attachments. Nothing was sent.";

export const FORWARD_DRAFT_NOTE = "Oriel did not pull the original message or its attachments.";

export const FORWARD_TASK =
  "This is a forward of an existing message. Do not pull an inbox, attachments, or images. Do not send mail.";

export function whoAskedSlackCopy(kind: SlackAskKind | null): string {
  if (kind === "forward") return "You asked Oriel to forward that Slack note. Nothing was sent from here.";
  if (kind === "send") return "You asked Oriel to send that Slack note. Nothing was sent from here.";
  if (kind === "draft") return "You asked Oriel to draft that Slack note. Nothing was sent.";
  if (kind === "ruled") return "You ruled out that Slack note. Nothing was sent.";
  return "No Slack note in this record was asked for. Nothing was sent.";
}

const TASK_COVER: Record<ApprovalKind, string> = {
  send: "The send stays allowed for the rest of this goal. Nothing was sent. A later goal still asks.",
  pay: "The payment stays allowed for the rest of this goal. Oriel did not move money. No charge was made. A later goal still asks.",
  delete: "The deletion stays allowed for the rest of this goal. Nothing was deleted. A later goal still asks.",
  post: "The public post stays allowed for the rest of this goal. Nothing was published. A later goal still asks.",
  credential: "The credential use stays allowed for the rest of this goal. Oriel did not reveal or reuse a secret. A later goal still asks.",
};

export function taskCoverLine(kind: ApprovalKind): string {
  return TASK_COVER[kind];
}

export function taskCoverSentence(kinds: ApprovalKind[]): string {
  return kinds.map((kind) => TASK_COVER[kind]).join(" ");
}

const STOP_NAME: Record<ApprovalKind, string> = {
  send: "the send",
  pay: "the payment",
  delete: "the deletion",
  post: "the public post",
  credential: "the credential use",
};

const STOP_NEXT: Record<ApprovalKind, string> = {
  send: "the next send",
  pay: "the next payment",
  delete: "the next deletion",
  post: "the next public post",
  credential: "the next credential use",
};

function nameList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
}

function titled(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

export function stopTaskCopy(kinds: ApprovalKind[], another: boolean): string {
  const lead = titled(nameList(kinds.map((kind) => STOP_NAME[kind])));
  const verb = kinds.length === 1 ? "is" : "are";
  const next = titled(nameList(kinds.map((kind) => STOP_NEXT[kind])));
  const ask = kinds.length === 1 ? "asks" : "ask";
  const other = another ? " Another goal is unchanged." : "";
  return `Stopped. ${lead} ${verb} no longer allowed for the rest of this goal. ${next} on this goal ${ask} again.${other} A sent email cannot be reversed from here. Nothing was sent or spent.`;
}

export function stopTaskMissCopy(another: boolean): string {
  const other = another ? " Another goal is unchanged." : "";
  return `This goal has no allowance to stop. Nothing was cleared.${other} A sent email cannot be reversed from here. Nothing was sent or spent.`;
}

export function stopTaskNoneCopy(): string {
  return "There is no task to stop. Nothing was cleared. A sent email cannot be reversed from here. Nothing was sent or spent.";
}

function quotedRoutine(name: string): string {
  return `“${name}”`;
}

export function stopRoutineCopy(name: string, another: boolean): string {
  const other = another ? " Another routine is unchanged." : "";
  return `Stopped. ${quotedRoutine(name)} wakes only when you run it. The instruction stays in the record.${other} A completed action was not undone. Nothing was sent or spent.`;
}

export function stopRoutineAlreadyCopy(name: string, another: boolean): string {
  const other = another ? " Another routine is unchanged." : "";
  return `${quotedRoutine(name)} already wakes only when you run it. The instruction stays in the record.${other} Nothing was changed. A completed action was not undone. Nothing was sent or spent.`;
}

export function stopRoutineMissCopy(name: string): string {
  return `There is no ${quotedRoutine(name)} routine. Nothing was changed. A completed action stays completed. Nothing was sent or spent.`;
}

export function stopRoutineAmbiguousCopy(name: string): string {
  return `More than one routine is named ${quotedRoutine(name)}. Nothing was changed. A completed action stays completed. Nothing was sent or spent.`;
}

const SCHEDULE_TAIL =
  "Nothing was run and nothing was changed. A completed action stays completed. Nothing was sent or spent.";

function scheduleClause(name: string, cadence: Cadence): string {
  const quoted = quotedRoutine(name);
  if (cadence === "hourly") return `${quoted} is hourly.`;
  if (cadence === "daily") return `${quoted} is daily.`;
  return `${quoted} is manual and wakes only when you run it.`;
}

export function scheduleReadCopy(routines: Routine[]): string {
  if (!routines.length) return `Nothing is scheduled. ${SCHEDULE_TAIL}`;
  const lines = routines.map((routine) => scheduleClause(routine.name, routine.cadence)).join(" ");
  return `Scheduled. ${lines} ${SCHEDULE_TAIL}`;
}

export function routineWakeCopy(name: string, cadence: Cadence, nextRunAt: string | null, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  if (cadence === "manual") {
    return `${quoted} is manual and wakes only when you run it.${other} ${SCHEDULE_TAIL}`;
  }
  const when = nextRunAt ? ` It next wakes at ${nextRunAt}.` : " It has no next time in the record.";
  const pace = cadence === "hourly" ? "hourly" : "daily";
  return `${quoted} is ${pace}.${when}${other} ${SCHEDULE_TAIL}`;
}

export function routineWakeMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineWakeAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineDoCopy(name: string, instruction: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  const body = instruction.trim()
    ? `${quoted} does this: “${instruction}”.`
    : `${quoted} has no instruction in the record.`;
  return `${body}${other} ${SCHEDULE_TAIL}`;
}

export function routineDoMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineDoAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineRanCopy(name: string, lastRunAt: string | null, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  const when = lastRunAt?.trim() ? lastRunAt.trim() : "";
  const body = when ? `${quoted} last ran at ${when}.` : `${quoted} has no last run in the record.`;
  return `${body}${other} ${SCHEDULE_TAIL}`;
}

export function routineRanMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineRanAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineDeliveredCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no delivery in the record. A last run does not confirm the result.${other} ${SCHEDULE_TAIL}`;
}

export function routineDeliveredMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineDeliveredAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineRunCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine keeps its instruction, its cadence, and its next time." : "";
  return `Ran ${quoted}. The instruction stays in the record. The cadence and the next time stay.${other} This run lets the next wake ask again. A last run is not a delivery. Nothing was sent or spent.`;
}

export function routineRunMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineRunAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function stayedSentence(kinds: ApprovalKind[]): string {
  if (!kinds.length) return "";
  const names = kinds.map((kind) => KIND_STAY[kind]);
  const list =
    names.length === 1 ? (names[0] ?? "the step") : `${names.slice(0, -1).join(", ")} and ${names.at(-1) ?? "the step"}`;
  const verb = names.length === 1 ? "stays" : "stay";
  const them = names.length === 1 ? "it" : "them";
  const lead = `${list.charAt(0).toUpperCase()}${list.slice(1)}`;
  return `${lead} ${verb} held back until you send a message. This wake will not raise ${them}. Nothing was sent or spent.`;
}

export function recommend(choice: SeatChoice, policy: Policy): string {
  if (!choice.lead) {
    if (policy.businessSensitive && choice.dropped.some((item) => item.id === "muse")) {
      return "No work seat can take this. Muse is on, but Oriel will not place client, patient, or confidential work on a consumer seat.";
    }
    return "No connected seat can take this. Turn one on, or bridge an endpoint you control. I kept the request.";
  }
  const name = DISPLAY[choice.lead];
  if (policy.businessSensitive) {
    return `${name} should lead. This request touches a client, a patient, or other non-personal work, and Muse will not hold that material.`;
  }
  if (choice.intents.includes("code") && (choice.lead === "grok" || choice.lead === "dots")) {
    return `${name} should lead. I want the proving test named before the work is trusted.`;
  }
  if (choice.lead === "muse" && choice.intents.includes("personal")) {
    return "Muse should lead. This is personal logistics, and it should read like a message rather than a project plan.";
  }
  if (choice.lead === "muse") {
    if (policy.forbadeSend) return "Muse should lead. Keep it as a message.";
    return "Muse should lead. Keep it as a message, and leave anything outbound on a hold.";
  }
  return `${name} should lead. I convened ${choice.picked.map((id) => DISPLAY[id]).join(", ")} for ${phrase(choice.intents)}.`;
}

export function approvalDetail(kind: ApprovalKind, text: string): string {
  const people = peopleIn(text);
  const amount = text.match(/\$[\d,]+(?:\.\d{2})?/);
  if (kind === "pay") {
    return `Amount ${amount?.[0] ?? "not stated"}. Oriel will record your decision and will not charge anything.`;
  }
  if (kind === "send") {
    const who = people.length ? `People named: ${people.join(", ")}.` : "No recipient was extracted.";
    if (isForwardRequest(text)) {
      return `This is a forward. Oriel did not pull the original message or its attachments. ${who} Releasing this hold does not deliver it.`;
    }
    return `Draft stays here. ${who} Releasing a reference seat does not deliver the message.`;
  }
  if (kind === "delete") return "Nothing is deleted from here. The hold only records whether you would allow it.";
  if (kind === "post") return "Nothing is published from here. The hold records whether a live seat may post.";
  return "The secret was redacted before it was stored. Oriel will not pass a raw credential to a seat.";
}

export function composeBrief(input: {
  title: string;
  choice: SeatChoice;
  policy: Policy;
  notes: SeatNote[];
  held: ApprovalKind[];
  skipped: ApprovalKind[];
  stayed?: ApprovalKind[];
  covered?: ApprovalKind[];
  handed?: boolean;
  skillName?: string | null;
  rules?: HandoffAction[];
  rulePhrases?: Partial<Record<HandoffAction, string>>;
  away?: boolean;
}): Brief {
  const recommendation = recommend(input.choice, input.policy);
  const sentence = holdSentence(input.held, input.skipped);
  const stayedLine = stayedSentence(input.stayed ?? []);
  const coveredLine = taskCoverSentence(input.covered ?? []);
  const using = input.skillName ? `Using the skill “${input.skillName}”.` : "";
  const rules = input.rules ?? [];
  const rulePhrases = input.rulePhrases ?? {};
  const ruleLine = ruleSentence(rules, rulePhrases);
  const handedLine = input.handed ? HANDOFF_VOICE : "";
  const awayLine = input.away && input.held.length ? AWAY_HOLD_COPY : "";
  const draftLine = input.policy.draftOnly ? DRAFT_ONLY_COPY : "";
  const forwardLine = input.policy.forward ? FORWARD_COPY : "";
  const forwardDraftLine =
    !input.policy.forward && input.policy.draftOnly && input.policy.forwardAsked ? FORWARD_DRAFT_NOTE : "";
  const voice = [using, recommendation, draftLine, forwardDraftLine, forwardLine, sentence, coveredLine, stayedLine, ruleLine, handedLine, awayLine]
    .filter(Boolean)
    .join(" ");
  const why = input.skillName
    ? [
        `The skill “${input.skillName}” supplied the method. It does not wake, and it does not approve a hold.`,
        ...input.choice.reasons,
      ]
    : input.choice.reasons;
  const modeLine = input.notes.some((note) => note.mode === "live")
    ? "A live bridge answered for at least one seat. Reference reads cover the rest."
    : "Reference seats stood in for any agent you have not bridged.";
  const synthesis = [
    using || null,
    recommendation,
    ...input.notes.map((note) => note.summary),
    input.choice.dissent,
    draftLine || null,
    forwardDraftLine || null,
    forwardLine || null,
    sentence || null,
    coveredLine || null,
    stayedLine || null,
    ruleLine || null,
    handedLine || null,
    awayLine || null,
    modeLine,
    why.join(" "),
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n\n");
  return {
    title: input.title,
    voice,
    synthesis,
    recommendation,
    why,
    tight: input.policy.preferShort,
    dissent: input.choice.dissent,
    seatReads: input.notes,
    held: input.held,
    skipped: input.skipped,
    stayed: input.stayed ?? [],
    covered: input.covered ?? [],
    handed: Boolean(input.handed),
    referenceOnly: input.notes.every((note) => note.mode === "reference"),
    skill: input.skillName ?? null,
    rules,
    rulePhrases,
  };
}

export function renderMarkdown(goal: Goal, events: LedgerEvent[]): string {
  const lines = [
    `# ${goal.brief.title}`,
    "",
    goal.prose ?? goal.brief.voice,
    "",
    "## Recommendation",
    goal.brief.recommendation,
    "",
    ...(goal.brief.skill
      ? [
          "## Skill",
          `Method applied: ${goal.brief.skill}. A skill does not wake, and it does not approve a hold.`,
          "",
        ]
      : []),
    "## Why these seats",
    ...goal.brief.why.map((item) => `- ${item}`),
    "",
    "## Seat reads",
  ];
  if (!goal.brief.seatReads.length) lines.push("- No work seat was convened.");
  for (const note of goal.brief.seatReads) {
    lines.push(`- ${DISPLAY[note.seat]} (${note.mode}): ${note.summary}`);
  }
  if (goal.brief.dissent) {
    lines.push("", "## Disagreement", goal.brief.dissent);
  }
  if (goal.brief.rules?.length) {
    lines.push("", "## Handoff rule", ruleSentence(goal.brief.rules, goal.brief.rulePhrases));
  }
  if (goal.brief.handed) {
    lines.push(
      "",
      "## Hand off",
      "This step is yours. Oriel will not type a password, sign in, send mail, or move money.",
    );
  }
  lines.push("", "## Record");
  const record = events.filter((event) => event.goalId === goal.id);
  if (!record.length) lines.push("- No events yet.");
  for (const event of record) lines.push(`- ${event.at} ${event.type}: ${event.detail}`);
  lines.push("", TRUST, "");
  return lines.join("\n");
}

export function taskReleaseCopy(kind: ApprovalKind, liveSummary: string | null): string {
  return `${releaseCopy(kind, liveSummary)} ${taskCoverLine(kind)}`;
}

export function releaseCopy(kind: ApprovalKind, liveSummary: string | null): string {
  if (liveSummary) {
    return `You released the ${kind}. The live bridge replied: ${liveSummary} Oriel itself still did not send mail, move money, or sign in.`;
  }
  if (kind === "pay") return "You released the payment hold. Oriel did not move money. No charge was made.";
  if (kind === "send") return "You released the send. Nothing left this computer, because the seat is in reference mode.";
  if (kind === "delete") return "You released the deletion. Oriel did not delete anything.";
  if (kind === "post") return "You released the public post. Oriel did not publish anything.";
  return "You released the credential hold. Oriel did not reveal or reuse a secret.";
}

export const DENIAL_COPY = "You held it back. Nothing was released.";
