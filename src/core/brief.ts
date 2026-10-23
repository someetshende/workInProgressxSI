import { HANDOFF_VOICE } from "./handoff.js";
import { AWAY_HOLD_COPY } from "./hold.js";
import { DISPLAY, phrase } from "./doctrine.js";
import { TRUST } from "./doctrine.js";
import { peopleIn } from "./memory.js";
import type { ApprovalKind, Brief, Goal, LedgerEvent, Policy, SeatChoice, SeatNote } from "./types.js";

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

export function holdSentence(held: ApprovalKind[], skipped: ApprovalKind[]): string {
  return [...skipped.map((kind) => KIND_SKIPPED[kind]), ...held.map((kind) => KIND_HELD[kind])].join(" ");
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
  handed?: boolean;
  skillName?: string | null;
  away?: boolean;
}): Brief {
  const recommendation = recommend(input.choice, input.policy);
  const sentence = holdSentence(input.held, input.skipped);
  const using = input.skillName ? `Using the skill “${input.skillName}”.` : "";
  const handedLine = input.handed ? HANDOFF_VOICE : "";
  const awayLine = input.away && input.held.length ? AWAY_HOLD_COPY : "";
  const voice = [using, recommendation, sentence, handedLine, awayLine].filter(Boolean).join(" ");
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
    sentence || null,
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
    handed: Boolean(input.handed),
    referenceOnly: input.notes.every((note) => note.mode === "reference"),
    skill: input.skillName ?? null,
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
