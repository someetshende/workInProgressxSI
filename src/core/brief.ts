import { HANDOFF_VOICE, ruleSentence } from "./handoff.js";
import { AWAY_HOLD_COPY } from "./hold.js";
import { DISPLAY, phrase } from "./doctrine.js";
import { TRUST } from "./doctrine.js";
import { rememberedRuns } from "./cadence.js";
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

const SHORT_GLOSS = "Asking does not follow that see-also line to the hooks note.";
const SHORT_TRIAL = "Asking does not mark those review checks as a trial open to every large team.";
const SHORT_SHADE = "Asking does not leave a new setup in a quiet watch that notes refusals without stopping people.";
const SHORT_HOOK = "Asking does not open that hooks pane from the compliance shelf.";
const SHORT_YIELD = "Asking does not let that host permit or refuse the request before the model runs.";

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

export function pausedRoutinesCopy(routines: Routine[]): string {
  const paused = routines.filter((routine) => routine.paused === true);
  if (!paused.length) return `No routine is paused. A wake does not run a paused routine. ${SCHEDULE_TAIL}`;
  const lines = paused.map((routine) => `${quotedRoutine(routine.name)} is paused. A wake does not run it.`).join(" ");
  return `Paused routines. ${lines} ${SCHEDULE_TAIL}`;
}

export function enabledRoutinesCopy(routines: Routine[]): string {
  const enabled = routines.filter((routine) => routine.paused !== true);
  if (!enabled.length) return `No routine is enabled. A wake does not run a routine that is not enabled. ${SCHEDULE_TAIL}`;
  const lines = enabled.map((routine) => `${quotedRoutine(routine.name)} is enabled.`).join(" ");
  return `Enabled routines. ${lines} ${SCHEDULE_TAIL}`;
}

export function activeRoutinesCopy(routines: Routine[]): string {
  const active = routines.filter((routine) => routine.paused !== true);
  if (!active.length) return `No routine is active. A wake does not run a routine that is not active. ${SCHEDULE_TAIL}`;
  const lines = active.map((routine) => `${quotedRoutine(routine.name)} is active.`).join(" ");
  return `Active routines. ${lines} ${SCHEDULE_TAIL}`;
}

export function disabledRoutinesCopy(routines: Routine[]): string {
  const disabled = routines.filter((routine) => routine.paused === true);
  if (!disabled.length) return `No routine is disabled. A wake does not run a routine that is disabled. ${SCHEDULE_TAIL}`;
  const lines = disabled.map((routine) => `${quotedRoutine(routine.name)} is disabled.`).join(" ");
  return `Disabled routines. ${lines} ${SCHEDULE_TAIL}`;
}

export function routinePausedAskCopy(name: string, paused: boolean, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  if (paused) return `${quoted} is paused. A wake does not run it.${other} ${SCHEDULE_TAIL}`;
  return `${quoted} is not paused.${other} ${SCHEDULE_TAIL}`;
}

export function routinePausedAskMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routinePausedAskAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineActiveAskCopy(name: string, paused: boolean, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  if (paused) return `${quoted} is not active. A wake does not run it.${other} ${SCHEDULE_TAIL}`;
  return `${quoted} is active.${other} ${SCHEDULE_TAIL}`;
}

export function routineActiveAskMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineActiveAskAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineEnabledAskCopy(name: string, paused: boolean, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  if (paused) return `${quoted} is not enabled. A wake does not run it.${other} ${SCHEDULE_TAIL}`;
  return `${quoted} is enabled.${other} ${SCHEDULE_TAIL}`;
}

export function routineEnabledAskMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineEnabledAskAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineDisabledAskCopy(name: string, paused: boolean, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  if (paused) return `${quoted} is disabled. A wake does not run it.${other} ${SCHEDULE_TAIL}`;
  return `${quoted} is not disabled.${other} ${SCHEDULE_TAIL}`;
}

export function routineDisabledAskMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineDisabledAskAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineZoneCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no time zone in the record. The next time stays the instant already stored.${other} ${SCHEDULE_TAIL}`;
}

export function routineZoneMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineZoneAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineOwnerCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no owning bot in the record. Asking does not assign one.${other} ${SCHEDULE_TAIL}`;
}

export function routineOwnerMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineOwnerAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routinePluginCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no required plugin in the record. Asking does not connect one.${other} ${SCHEDULE_TAIL}`;
}

export function routinePluginMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routinePluginAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineSourceCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no source system in the record. Asking does not connect a computer.${other} ${SCHEDULE_TAIL}`;
}

export function routineSourceMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineSourceAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineUsageCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no usage pause in the record. Asking does not pause account access.${other} ${SCHEDULE_TAIL}`;
}

export function routineUsageMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineUsageAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineFailureCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no failure in the record. Asking does not start a test run.${other} ${SCHEDULE_TAIL}`;
}

export function routineFailureMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineFailureAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineChannelCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no source channel in the record. Asking does not connect a channel.${other} ${SCHEDULE_TAIL}`;
}

export function routineChannelMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineChannelAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineRepositoryCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no source repository in the record. Asking does not confirm a repository.${other} ${SCHEDULE_TAIL}`;
}

export function routineRepositoryMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineRepositoryAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineMatchingCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no matching rule in the record. Asking does not confirm a matching rule.${other} ${SCHEDULE_TAIL}`;
}

export function routineMatchingMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineMatchingAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineAskFirstCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no ask-first rule in the record. Asking does not save an ask-first rule.${other} ${SCHEDULE_TAIL}`;
}

export function routineAskFirstMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineAskFirstAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineAllowAutoCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no allow-automatically rule in the record. Asking does not turn one on.${other} ${SCHEDULE_TAIL}`;
}

export function routineAllowAutoMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineAllowAutoAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineTeamRuleCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no team rule in the record. Asking does not lock a team rule.${other} ${SCHEDULE_TAIL}`;
}

export function routineTeamRuleMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineTeamRuleAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineLockedTeamRuleCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no locked team rule in the record. Asking does not lock a team rule.${other} ${SCHEDULE_TAIL}`;
}

export function routineLockedTeamRuleMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineLockedTeamRuleAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineLocalComputerCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no local-computer refusal in the record. Asking does not turn local access on.${other} ${SCHEDULE_TAIL}`;
}

export function routineLocalComputerMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineLocalComputerAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineCloudComputerCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no cloud-computer refusal in the record. Asking does not turn cloud access on.${other} ${SCHEDULE_TAIL}`;
}

export function routineCloudComputerMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineCloudComputerAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineReachableComputerCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no reachable computer in the record. Asking does not recover a computer.${other} ${SCHEDULE_TAIL}`;
}

export function routineReachableComputerMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineReachableComputerAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineStuckStateCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no stuck state in the record. Asking does not open the computer.${other} ${SCHEDULE_TAIL}`;
}

export function routineStuckStateMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineStuckStateAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineLoginWaitCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no login wait in the record. Asking does not take over the computer.${other} ${SCHEDULE_TAIL}`;
}

export function routineLoginWaitMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineLoginWaitAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routinePluginAuthCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no plugin authentication in the record. Asking does not authenticate a plugin.${other} ${SCHEDULE_TAIL}`;
}

export function routinePluginAuthMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routinePluginAuthAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineReadableAttachmentCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no readable attachment in the record. Asking does not read an attachment.${other} ${SCHEDULE_TAIL}`;
}

export function routineReadableAttachmentMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineReadableAttachmentAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineBlockedApprovalCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no blocked approval in the record. Asking does not reject an approval.${other} ${SCHEDULE_TAIL}`;
}

export function routineBlockedApprovalMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineBlockedApprovalAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineComputerSetupCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no computer setup in the record. Asking does not restart the app.${other} ${SCHEDULE_TAIL}`;
}

export function routineComputerSetupMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineComputerSetupAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineAppUpdateCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no app update in the record. Asking does not check for an app update.${other} ${SCHEDULE_TAIL}`;
}

export function routineAppUpdateMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineAppUpdateAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineOpenSignInCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no open sign-in in the record. Asking does not finish the sign-in.${other} ${SCHEDULE_TAIL}`;
}

export function routineOpenSignInMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineOpenSignInAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineBotQuietCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no quiet bot in the record. Asking does not post on X.${other} ${SCHEDULE_TAIL}`;
}

export function routineBotQuietMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineBotQuietAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineSupportNoteCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no support note in the record. Asking does not contact support.${other} ${SCHEDULE_TAIL}`;
}

export function routineSupportNoteMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineSupportNoteAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineRetryResultCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no retry result in the record. Asking does not retry.${other} ${SCHEDULE_TAIL}`;
}

export function routineRetryResultMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineRetryResultAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineDisconnectedAppCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no disconnected app in the record. Asking does not disconnect the app.${other} ${SCHEDULE_TAIL}`;
}

export function routineDisconnectedAppMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineDisconnectedAppAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineLeastDestructiveCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no least-destructive step in the record. Asking does not take a destructive step.${other} ${SCHEDULE_TAIL}`;
}

export function routineLeastDestructiveMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineLeastDestructiveAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineScreenTaskCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no active screen task in the record. Asking does not redirect the screen.${other} ${SCHEDULE_TAIL}`;
}

export function routineScreenTaskMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineScreenTaskAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineFinishBeforeRebuildCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no finish-before-rebuild in the record. Asking does not rebuild the computer.${other} ${SCHEDULE_TAIL}`;
}

export function routineFinishBeforeRebuildMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineFinishBeforeRebuildAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineKeptConversationCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no kept conversation in the record. Asking leaves the saved chat in place.${other} ${SCHEDULE_TAIL}`;
}

export function routineKeptConversationMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineKeptConversationAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineKeptFileCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no kept-file in the record. Asking leaves the saved files in place.${other} ${SCHEDULE_TAIL}`;
}

export function routineKeptFileMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineKeptFileAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineSoftwareRefreshCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no software refresh in the record. Asking does not refresh the software.${other} ${SCHEDULE_TAIL}`;
}

export function routineSoftwareRefreshMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineSoftwareRefreshAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineScratchFolderCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no scratch folder in the record. Asking does not delete a temporary directory.${other} ${SCHEDULE_TAIL}`;
}

export function routineScratchFolderMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineScratchFolderAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineWorkSurfaceCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no work surface in the record. Asking does not merge the screens.${other} ${SCHEDULE_TAIL}`;
}

export function routineWorkSurfaceMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineWorkSurfaceAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routinePrivateHostCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no private host in the record. Asking does not share one computer across users.${other} ${SCHEDULE_TAIL}`;
}

export function routinePrivateHostMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routinePrivateHostAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineGuestSliceCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no guest slice in the record. Asking does not boot a microVM.${other} ${SCHEDULE_TAIL}`;
}

export function routineGuestSliceMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineGuestSliceAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routinePersonaLedgerCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no persona ledger in the record. Asking does not merge personalities.${other} ${SCHEDULE_TAIL}`;
}

export function routinePersonaLedgerMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routinePersonaLedgerAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineCommonTrayCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no common tray in the record. Asking does not sign the browser out.${other} ${SCHEDULE_TAIL}`;
}

export function routineCommonTrayMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineCommonTrayAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineSoloRosterCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no solo roster in the record. Asking does not give a workload its own user.${other} ${SCHEDULE_TAIL}`;
}

export function routineSoloRosterMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineSoloRosterAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineTeamBenchCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no team bench in the record. Asking does not share a team bot.${other} ${SCHEDULE_TAIL}`;
}

export function routineTeamBenchMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineTeamBenchAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineGroupComputerCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no group computer in the record. Asking does not give the group its own computer.${other} ${SCHEDULE_TAIL}`;
}

export function routineGroupComputerMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineGroupComputerAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineDirectDeskCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no direct desk in the record. Asking does not put the work on that member's computer.${other} ${SCHEDULE_TAIL}`;
}

export function routineDirectDeskMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineDirectDeskAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}


export function routineAskedMeterCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no asked meter in the record. Asking does not use that member's connected accounts.${other} ${SCHEDULE_TAIL}`;
}

export function routineAskedMeterMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineAskedMeterAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineSharedKitCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no shared kit in the record. Asking does not spread that kit across teammate chats.${other} ${SCHEDULE_TAIL}`;
}

export function routineSharedKitMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineSharedKitAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineSealedChatCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no sealed chat in the record. Asking does not reveal that member's chat to the owner or a Manager.${other} ${SCHEDULE_TAIL}`;
}

export function routineSealedChatMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineSealedChatAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineDelegatedLaneCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no delegated lane in the record. Asking does not hand the coding work off.${other} ${SCHEDULE_TAIL}`;
}

export function routineDelegatedLaneMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineDelegatedLaneAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineDefaultSwitchCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no default switch in the record. Asking does not flip that switch.${other} ${SCHEDULE_TAIL}`;
}

export function routineDefaultSwitchMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineDefaultSwitchAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineRestLatchCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no rest latch in the record. Asking does not turn delegation off.${other} ${SCHEDULE_TAIL}`;
}

export function routineRestLatchMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineRestLatchAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineSpawnHatchCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no spawn hatch in the record. Asking does not disable spawning.${other} ${SCHEDULE_TAIL}`;
}

export function routineSpawnHatchMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineSpawnHatchAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineQuietGateCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no quiet gate in the record. Asking does not quiet Cloud Agent spawning.${other} ${SCHEDULE_TAIL}`;
}

export function routineQuietGateMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineQuietGateAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routinePublicVeilCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no public veil in the record. Asking does not keep public template sharing off.${other} ${SCHEDULE_TAIL}`;
}

export function routinePublicVeilMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routinePublicVeilAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}


export function routineServerRingCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no server ring in the record. Asking does not keep sharing team-only.${other} ${SCHEDULE_TAIL}`;
}

export function routineServerRingMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineServerRingAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routinePlanNotchCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no plan notch in the record. Asking does not start enterprise teams closed.${other} ${SCHEDULE_TAIL}`;
}

export function routinePlanNotchMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routinePlanNotchAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineMemberCeilingCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no member ceiling in the record. Asking does not set that ceiling to never allow.${other} ${SCHEDULE_TAIL}`;
}

export function routineMemberCeilingMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineMemberCeilingAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineChoiceLatchCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no choice latch in the record. Asking does not leave that choice with each member.${other} ${SCHEDULE_TAIL}`;
}

export function routineChoiceLatchMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineChoiceLatchAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineLocalShutterCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no local shutter in the record. Asking does not turn local execution off for the whole team.${other} ${SCHEDULE_TAIL}`;
}

export function routineLocalShutterMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineLocalShutterAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineStricterKeepCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no stricter keep in the record. Asking does not keep a stricter member setting in force.${other} ${SCHEDULE_TAIL}`;
}

export function routineStricterKeepMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineStricterKeepAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineReasonBarCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no reason bar in the record. Asking does not pick Never allow unless a specific reason is named.${other} ${SCHEDULE_TAIL}`;
}

export function routineReasonBarMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineReasonBarAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineHabitAskCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no habit ask in the record. Asking does not set the member's own setting to ask before every task.${other} ${SCHEDULE_TAIL}`;
}

export function routineHabitAskMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineHabitAskAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}


export function routineEgressPathCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no egress path in the record. Asking does not route that web traffic through the member's own computer.${other} ${SCHEDULE_TAIL}`;
}

export function routineEgressPathMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineEgressPathAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineOptionBlankCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no option blank in the record. Asking does not disable that option.${other} ${SCHEDULE_TAIL}`;
}

export function routineOptionBlankMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineOptionBlankAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routinePageHomeCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no page home in the record. Asking does not park that control on the page.${other} ${SCHEDULE_TAIL}`;
}

export function routinePageHomeMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routinePageHomeAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineRouteSpanCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no route span in the record. Asking does not stop those routes within five minutes.${other} ${SCHEDULE_TAIL}`;
}

export function routineRouteSpanMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineRouteSpanAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineRestoreLatchCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no restore latch in the record. Asking does not restore each member's previous choice.${other} ${SCHEDULE_TAIL}`;
}

export function routineRestoreLatchMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineRestoreLatchAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineSudoPermitCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no sudo permit in the record. Asking does not run those commands as root.${other} ${SCHEDULE_TAIL}`;
}

export function routineSudoPermitMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineSudoPermitAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineNestPairCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no nest pair in the record. Asking does not leave that switch on beside the egress control.${other} ${SCHEDULE_TAIL}`;
}

export function routineNestPairMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineNestPairAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineColdStartCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no cold start in the record. Asking does not restart those computers before the change.${other} ${SCHEDULE_TAIL}`;
}

export function routineColdStartMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineColdStartAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineBannerCrestCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no banner crest in the record. Asking does not show that notice at the top.${other} ${SCHEDULE_TAIL}`;
}

export function routineBannerCrestMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineBannerCrestAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineFleetImageCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no fleet image in the record. Asking does not rebuild every member computer from the current team settings.${other} ${SCHEDULE_TAIL}`;
}

export function routineFleetImageMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineFleetImageAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineProgressCardCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no progress card in the record. Asking does not clear that notice once the restart starts.${other} ${SCHEDULE_TAIL}`;
}

export function routineProgressCardMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineProgressCardAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}






export function routineGlossLineCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no gloss line in the record. ${SHORT_GLOSS}${other} ${SCHEDULE_TAIL}`;
}

export function routineGlossLineMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineGlossLineAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineTrialSpanCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no trial span in the record. ${SHORT_TRIAL}${other} ${SCHEDULE_TAIL}`;
}

export function routineTrialSpanMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineTrialSpanAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineShadeTallyCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no shade tally in the record. ${SHORT_SHADE}${other} ${SCHEDULE_TAIL}`;
}

export function routineShadeTallyMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineShadeTallyAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineHookShelfCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no hook shelf in the record. ${SHORT_HOOK}${other} ${SCHEDULE_TAIL}`;
}

export function routineHookShelfMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineHookShelfAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineYieldCordCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no yield cord in the record. ${SHORT_YIELD}${other} ${SCHEDULE_TAIL}`;
}

export function routineYieldCordMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineYieldCordAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineQuillBondCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no quill bond in the record. Asking does not forward each signed model request to a review server the organization runs or reaches through a vendor.${other} ${SCHEDULE_TAIL}`;
}

export function routineQuillBondMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineQuillBondAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineCiteSlipCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no cite slip in the record. Asking does not open that review page from the note.${other} ${SCHEDULE_TAIL}`;
}

export function routineCiteSlipMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineCiteSlipAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineDouseMarkCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no douse mark in the record. Asking does not halt those shared notes once the lock is switched off.${other} ${SCHEDULE_TAIL}`;
}

export function routineDouseMarkMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineDouseMarkAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineSightGlassCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no sight glass in the record. Asking does not show those shared notes as a look-only pane where ask-first wins a clash.${other} ${SCHEDULE_TAIL}`;
}

export function routineSightGlassMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineSightGlassAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineInkLatchCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no ink latch in the record. Asking does not write those notes on that page the moment they change.${other} ${SCHEDULE_TAIL}`;
}

export function routineInkLatchMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineInkLatchAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineCapLayerCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no cap layer in the record. Asking does not lay that shared cap over each person's own notes.${other} ${SCHEDULE_TAIL}`;
}

export function routineCapLayerMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineCapLayerAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineWaiverLockCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no waiver lock in the record. Asking does not let one set of people drop that lock for themselves.${other} ${SCHEDULE_TAIL}`;
}

export function routineWaiverLockMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineWaiverLockAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routinePriorArmCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no prior arm in the record. Asking does not turn that lock on before you count on the shared review rules.${other} ${SCHEDULE_TAIL}`;
}

export function routinePriorArmMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routinePriorArmAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineVacantQuorumCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no vacant quorum in the record. Asking does not cover a chat where nobody can answer before the work runs.${other} ${SCHEDULE_TAIL}`;
}

export function routineVacantQuorumMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineVacantQuorumAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineRiskGateCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no risk gate in the record. Asking does not make those workers check risky steps before they run and ask before they proceed.${other} ${SCHEDULE_TAIL}`;
}

export function routineRiskGateMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineRiskGateAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineStartDimCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no start dim in the record. Asking does not leave that control on that page and off at the start.${other} ${SCHEDULE_TAIL}`;
}

export function routineStartDimMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineStartDimAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineVetoKeelCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no veto keel in the record. Asking does not stop people from switching that check off.${other} ${SCHEDULE_TAIL}`;
}

export function routineVetoKeelMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineVetoKeelAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineClanCharterCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no clan charter in the record. Asking does not place those notes for one set of people under that set's settings.${other} ${SCHEDULE_TAIL}`;
}

export function routineClanCharterMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineClanCharterAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineGuideLaneCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no guide lane in the record. Asking does not steer those guides toward approval behavior.${other} ${SCHEDULE_TAIL}`;
}

export function routineGuideLaneMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineGuideLaneAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineTerseFewCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no terse few in the record. Asking does not keep those guides short and few.${other} ${SCHEDULE_TAIL}`;
}

export function routineTerseFewMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineTerseFewAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineFirmYokeCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no firm yoke in the record. Asking does not lock those rules on so people cannot switch them off.${other} ${SCHEDULE_TAIL}`;
}

export function routineFirmYokeMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineFirmYokeAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineScopeSplitCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no scope split in the record. Asking does not add those rules from that page or limit each one to one seat, the other, or both.${other} ${SCHEDULE_TAIL}`;
}

export function routineScopeSplitMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineScopeSplitAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineCanonBindCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no canon bind in the record. Asking does not make every member's bots follow those rules.${other} ${SCHEDULE_TAIL}`;
}

export function routineCanonBindMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineCanonBindAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineWakeGuardCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no wake guard in the record. Asking does not spare a machine that stays awake while work is still going.${other} ${SCHEDULE_TAIL}`;
}

export function routineWakeGuardMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineWakeGuardAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineDozeTallyCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no doze tally in the record. Asking does not begin that thirty-day wait when the machine fell asleep after its last use.${other} ${SCHEDULE_TAIL}`;
}

export function routineDozeTallyMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineDozeTallyAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineAccessLiftCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no access lift in the record. Asking does not lift that person off the team or end their sessions.${other} ${SCHEDULE_TAIL}`;
}

export function routineAccessLiftMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineAccessLiftAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineFolioReturnCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no folio return in the record. Asking does not seat the next note on that same lasting disk with the bots and sign-ins kept.${other} ${SCHEDULE_TAIL}`;
}

export function routineFolioReturnMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineFolioReturnAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineLaborCloseCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no labor close in the record. Asking does not close the work that is underway by ending the machine.${other} ${SCHEDULE_TAIL}`;
}

export function routineLaborCloseMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineLaborCloseAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineServeWideCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no serve wide in the record. Asking does not ripple that same machine out from one group.${other} ${SCHEDULE_TAIL}`;
}

export function routineServeWideMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineServeWideAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineCircleDoorCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no circle door in the record. Asking does not choose that person from every group they sit in.${other} ${SCHEDULE_TAIL}`;
}

export function routineCircleDoorMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineCircleDoorAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineSyncForfeitCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no sync forfeit in the record. Asking does not bring those synced bots and logins back or drop a turn already underway.${other} ${SCHEDULE_TAIL}`;
}

export function routineSyncForfeitMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineSyncForfeitAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineReconnectLagCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no reconnect lag in the record. Asking does not make that return wait several minutes.${other} ${SCHEDULE_TAIL}`;
}

export function routineReconnectLagMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineReconnectLagAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineFreshBootCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no fresh boot in the record. Asking does not open a new machine on that disk after an ending.${other} ${SCHEDULE_TAIL}`;
}

export function routineFreshBootMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineFreshBootAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineSessionDropCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no session drop in the record. Asking does not drop those sign-in sessions when the computer is recreated.${other} ${SCHEDULE_TAIL}`;
}

export function routineSessionDropMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineSessionDropAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineSafeBerthCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no safe berth in the record. Asking does not pause that work at a safe point and carry it onto the new computer.${other} ${SCHEDULE_TAIL}`;
}

export function routineSafeBerthMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineSafeBerthAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineGlyphLingerCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no glyph linger in the record. Asking does not paint that updating label until the switch finishes.${other} ${SCHEDULE_TAIL}`;
}

export function routineGlyphLingerMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineGlyphLingerAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineCrossReachCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no cross reach in the record. Asking does not let one computer cover every team.${other} ${SCHEDULE_TAIL}`;
}

export function routineCrossReachMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineCrossReachAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineValveShutCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no valve shut in the record. Asking does not stop later endings by switching that control off.${other} ${SCHEDULE_TAIL}`;
}

export function routineValveShutMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineValveShutAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineScriptRepriseCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no script reprise in the record. Asking does not clear the packages a person added.${other} ${SCHEDULE_TAIL}`;
}

export function routineScriptRepriseMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineScriptRepriseAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineDiskStayCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no disk stay in the record. Asking does not keep that disk when the next message opens a new computer.${other} ${SCHEDULE_TAIL}`;
}

export function routineDiskStayMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineDiskStayAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineHandTwinCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no hand twin in the record. Asking does not match an automatic ending to a hand one.${other} ${SCHEDULE_TAIL}`;
}

export function routineHandTwinMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineHandTwinAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineVoidLevyCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no void levy in the record. Asking does not cost a member anything or make them act.${other} ${SCHEDULE_TAIL}`;
}

export function routineVoidLevyMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineVoidLevyAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineDriftLandingCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no drift landing in the record. Asking does not slide that ending past the mark.${other} ${SCHEDULE_TAIL}`;
}

export function routineDriftLandingMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineDriftLandingAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineMercyWindowCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no mercy window in the record. Asking does not waive the idle wait.${other} ${SCHEDULE_TAIL}`;
}

export function routineMercyWindowMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineMercyWindowAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineLateCohortCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no late cohort in the record. Asking does not count those already past thirty days.${other} ${SCHEDULE_TAIL}`;
}

export function routineLateCohortMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineLateCohortAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineDualPrimerCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no dual primer in the record. Asking does not preview those two notes.${other} ${SCHEDULE_TAIL}`;
}

export function routineDualPrimerMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineDualPrimerAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineTurnConfirmCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no turn confirm in the record. Asking does not open that confirmation.${other} ${SCHEDULE_TAIL}`;
}

export function routineTurnConfirmMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineTurnConfirmAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineStockDimCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no stock dim in the record. Asking does not leave that setting off.${other} ${SCHEDULE_TAIL}`;
}

export function routineStockDimMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineStockDimAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineCountRestartCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no count restart in the record. Asking does not restart that idle count.${other} ${SCHEDULE_TAIL}`;
}

export function routineCountRestartMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineCountRestartAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineThirtyLapseCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no thirty lapse in the record. Asking does not end an unused computer after thirty days.${other} ${SCHEDULE_TAIL}`;
}

export function routineThirtyLapseMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineThirtyLapseAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineTidySweepCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no tidy sweep in the record. Asking does not run that idle sweep on your behalf.${other} ${SCHEDULE_TAIL}`;
}

export function routineTidySweepMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineTidySweepAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineSlumberMarkCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no slumber mark in the record. Asking does not leave that sleeping computer in place until someone ends it.${other} ${SCHEDULE_TAIL}`;
}

export function routineSlumberMarkMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineSlumberMarkAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineRecreateFenceCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no recreate fence in the record. Asking does not limit this restart to recreate only.${other} ${SCHEDULE_TAIL}`;
}

export function routineRecreateFenceMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineRecreateFenceAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineAdminChairCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no admin chair in the record. Asking does not let team admins run this restart.${other} ${SCHEDULE_TAIL}`;
}

export function routineAdminChairMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineAdminChairAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
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

export function routinePlaceCopy(name: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `${quoted} has no destination in the record. Where results go is not stored. A last run is not a delivery.${other} ${SCHEDULE_TAIL}`;
}

export function routinePlaceMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routinePlaceAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

const RUNS_NAMED = 20;

export function routineRunsCopy(name: string, stamps: string[] | undefined, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  const kept = rememberedRuns(stamps);
  const newest = kept.slice(-RUNS_NAMED).reverse();
  const delivery = "A last run is not a delivery.";
  if (newest.length === 0) {
    return `${quoted} has no runs in the record. ${delivery}${other} ${SCHEDULE_TAIL}`;
  }
  const older = kept.length > RUNS_NAMED ? " The older runs stay in the record." : "";
  return `${quoted} has these runs, newest first: ${newest.join(", ")}.${older} ${delivery}${other} ${SCHEDULE_TAIL}`;
}

export function routineRunsMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineRunsAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

const QUIET_TAIL =
  "The cadence stays. The next time stays. The instruction stays. The pause stays. The last run stays. The stored runs stay. Nothing was sent or spent.";

export function routineQuietCopy(
  name: string,
  routine: Pick<Routine, "cadence" | "paused" | "nextRunAt" | "lastRunAt" | "recentRuns">,
  deskPaused: boolean,
  blocked: boolean,
  nowIso: string,
  another: boolean,
): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  const paused = routine.paused === true;
  const cadence = routine.cadence === "hourly" || routine.cadence === "daily" ? routine.cadence : "manual";
  const next = typeof routine.nextRunAt === "string" && routine.nextRunAt.trim() ? routine.nextRunAt.trim() : "";
  const last = typeof routine.lastRunAt === "string" && routine.lastRunAt.trim() ? routine.lastRunAt.trim() : "";
  const stored = rememberedRuns(routine.recentRuns);
  const due = cadence !== "manual" && next !== "" && next <= nowIso;
  const pauseLine = paused ? "It is paused." : "It is not paused.";
  const cadenceLine =
    cadence === "hourly" ? " It wakes hourly." : cadence === "daily" ? " It wakes daily." : " It wakes only when you run it.";
  const whenLine =
    next === ""
      ? " It has no next time in the record."
      : due
        ? ` It was due at ${next}.`
        : ` It next wakes at ${next}.`;
  let why: string;
  if (paused) why = " A wake does not run it.";
  else if (cadence === "manual") why = " A schedule has not started it. Use Run to try it now.";
  else if (!due) why = " A new schedule waits for its next time. Use Run to try it now.";
  else if (deskPaused) why = " Wakes are paused, so a schedule does not run it. Run still works.";
  else if (blocked) {
    why = " Automation run rate limit exceeded. This run is not retried automatically. Use Run to try it again yourself.";
  } else why = " A wake can still run it. Asking does not start it.";
  const runsLine =
    !last && stored.length === 0
      ? " No runs yet means nothing has started the routine yet."
      : last
        ? ` It last ran at ${last}. A last run is not a delivery.`
        : " A stored run is not a delivery.";
  return `${quoted} has not started from this question. ${pauseLine}${cadenceLine}${whenLine}${why}${runsLine}${other} ${QUIET_TAIL}`;
}

export function routineQuietMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineQuietAmbiguousCopy(name: string): string {
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

export function routineChangeCopy(name: string, instruction: string, proposal: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  const stored = instruction.trim()
    ? `${quoted} does this: “${instruction}”.`
    : `${quoted} has no instruction in the record.`;
  return `${stored} The proposed instruction is “${proposal}”. The change is not saved.${other} ${SCHEDULE_TAIL}`;
}

export function routineChangeMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineChangeAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

const SAVE_TAIL = "Nothing was run. A last run stays. Nothing was sent or spent.";

export function routineSaveCopy(name: string, instruction: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  return `Saved. ${quoted} now does this: “${instruction}”. The cadence and the next time stay.${other} ${SAVE_TAIL}`;
}

export function routineSaveAlreadyCopy(name: string, instruction: string, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  const shown = instruction.trim().replace(/\s+/g, " ");
  return `${quoted} already does that: “${shown}”. The instruction was not rewritten. The cadence and the next time stay.${other} ${SAVE_TAIL}`;
}

export function routineSaveMissCopy(name: string): string {
  return `There is no such routine as ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

export function routineSaveAmbiguousCopy(name: string): string {
  return `More than one routine has that name, ${quotedRoutine(name)}. ${SCHEDULE_TAIL}`;
}

const PACE_TAIL = "The instruction stays in the record. The last run stays. Nothing was run. Nothing was sent or spent.";

export function routinePaceCopy(name: string, cadence: Cadence, nextRunAt: string | null, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  if (cadence === "manual") {
    return `Set. ${quoted} now wakes only when you run it. The next time is cleared.${other} ${PACE_TAIL}`;
  }
  const when = nextRunAt ? ` It next wakes at ${nextRunAt}.` : " It has no next time in the record.";
  return `Set. ${quoted} now wakes ${cadence}.${when}${other} ${PACE_TAIL}`;
}

export function routinePaceAlreadyCopy(name: string, cadence: Cadence, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  const how = cadence === "manual" ? "only when you run it" : cadence;
  return `${quoted} already wakes that way. It wakes ${how}. The next time was not moved.${other} ${PACE_TAIL}`;
}

export function routinePaceApartCopy(name: string, otherName: string, more: boolean): string {
  const extra = more ? " Another routine is unchanged." : "";
  return `${quotedRoutine(name)} stays. ${quotedRoutine(otherName)} is within five minutes. Routine schedules must be at least five minutes apart. The cadence stays. The next time stays. The instruction stays. The pause stays. The last run stays.${extra} Nothing was run. Nothing was deleted. Nothing was sent or spent.`;
}

export function routineCapCopy(): string {
  return "A bot can own up to 50 routines. Nothing was added. Nothing was deleted. Nothing was run. Every routine already saved stays. The cadence stays. The next time stays. The instruction stays. The pause stays. The last run stays. Nothing was sent or spent.";
}

const RATE_TAIL =
  "This run did not start. The cadence stays. The next time stays. The instruction stays. The pause stays. The last run stays. Nothing was sent or spent.";

export function routineHourCopy(name: string, another: boolean): string {
  const other = another ? " Another routine is unchanged." : "";
  return `${quotedRoutine(name)} has already run 200 times this hour. Each routine can run up to 200 times an hour.${other} ${RATE_TAIL}`;
}

export function deskHourCopy(name: string, another: boolean): string {
  const other = another ? " Another routine is unchanged." : "";
  return `Routines have already run 300 times this hour. Routines can run up to 300 times an hour in total. ${quotedRoutine(name)} did not run.${other} ${RATE_TAIL}`;
}

const HOLD_TAIL = "The instruction stays. The last run stays. Nothing was run. Nothing was sent or spent.";

function paceWord(cadence: Cadence): string {
  if (cadence === "hourly") return "hourly";
  if (cadence === "daily") return "daily";
  return "manual";
}

export function routineHoldCopy(name: string, paused: boolean, cadence: Cadence, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  const word = paceWord(cadence);
  if (paused) {
    return `Paused. ${quoted} stays ${word}. The next time stays.${other} ${HOLD_TAIL}`;
  }
  return `Resumed. ${quoted} can wake again. The cadence stays ${word}. The next time stays.${other} ${HOLD_TAIL}`;
}

export function routineHoldAlreadyCopy(name: string, paused: boolean, cadence: Cadence, another: boolean): string {
  const quoted = quotedRoutine(name);
  const other = another ? " Another routine is unchanged." : "";
  const word = paceWord(cadence);
  if (paused) {
    return `${quoted} is already paused. The next time was not moved. The cadence stays ${word}.${other} ${HOLD_TAIL}`;
  }
  return `${quoted} is not paused. The cadence stays ${word}. The next time was not moved.${other} ${HOLD_TAIL}`;
}

export function routineDeleteCopy(name: string, another: boolean): string {
  const other = another ? " Another routine is unchanged." : "";
  return `Deleted. ${quotedRoutine(name)} is deleted. The deletion cannot be undone from here.${other} Nothing was run. A completed action was not undone. Nothing was sent or spent.`;
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
