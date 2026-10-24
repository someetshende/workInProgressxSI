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
