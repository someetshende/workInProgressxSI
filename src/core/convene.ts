import { assertBridgeUrl, bridgeFailure, callBridge, describeBridge } from "./bridge.js";
import { APPROVAL_TITLE, approvalDetail, composeBrief, DENIAL_COPY, DRAFT_ONLY_COPY, FORWARD_COPY, FORWARD_TASK, releaseCopy, routineChangeAmbiguousCopy, routineChangeCopy, routineChangeMissCopy, routineDeliveredAmbiguousCopy, routineDeliveredCopy, routineDeliveredMissCopy, routineDoAmbiguousCopy, routineDoCopy, routineDoMissCopy, routineDeleteCopy, routineHoldAlreadyCopy, routineHoldCopy, routineRanAmbiguousCopy, routineRanCopy, routineRanMissCopy, routineRunsAmbiguousCopy, routineRunsCopy, routineRunsMissCopy, routinePlaceAmbiguousCopy, routinePlaceCopy, routinePlaceMissCopy, routineQuietAmbiguousCopy, routineQuietCopy, routineQuietMissCopy, routineRunAmbiguousCopy, routineRunCopy, routineRunMissCopy, routineCapCopy, deskHourCopy, routineHourCopy, routinePaceAlreadyCopy, routinePaceApartCopy, routinePaceCopy, routineSaveAlreadyCopy, routineSaveAmbiguousCopy, routineSaveCopy, routineSaveMissCopy, routineWakeAmbiguousCopy, routineWakeCopy, routineWakeMissCopy, activeRoutinesCopy, disabledRoutinesCopy, enabledRoutinesCopy, pausedRoutinesCopy, routineActiveAskAmbiguousCopy, routineActiveAskCopy, routineActiveAskMissCopy, routineEnabledAskAmbiguousCopy, routineEnabledAskCopy, routineEnabledAskMissCopy, routineDisabledAskAmbiguousCopy, routineDisabledAskCopy, routineDisabledAskMissCopy, routineZoneAmbiguousCopy, routineZoneCopy, routineZoneMissCopy, routineOwnerAmbiguousCopy, routineOwnerCopy, routineOwnerMissCopy, routinePluginAmbiguousCopy, routinePluginCopy, routinePluginMissCopy, routineSourceAmbiguousCopy, routineSourceCopy, routineSourceMissCopy, routineUsageAmbiguousCopy, routineUsageCopy, routineUsageMissCopy, routineFailureAmbiguousCopy, routineFailureCopy, routineFailureMissCopy, routineChannelAmbiguousCopy, routineChannelCopy, routineChannelMissCopy, routineRepositoryAmbiguousCopy, routineRepositoryCopy, routineRepositoryMissCopy, routineMatchingAmbiguousCopy, routineMatchingCopy, routineMatchingMissCopy, routineAskFirstAmbiguousCopy, routineAskFirstCopy, routineAskFirstMissCopy, routineAllowAutoAmbiguousCopy, routineAllowAutoCopy, routineAllowAutoMissCopy, routineTeamRuleAmbiguousCopy, routineTeamRuleCopy, routineTeamRuleMissCopy, routineLockedTeamRuleAmbiguousCopy, routineLockedTeamRuleCopy, routineLockedTeamRuleMissCopy, routineLocalComputerAmbiguousCopy, routineLocalComputerCopy, routineLocalComputerMissCopy, routineCloudComputerAmbiguousCopy, routineCloudComputerCopy, routineCloudComputerMissCopy, routineReachableComputerAmbiguousCopy, routineReachableComputerCopy, routineReachableComputerMissCopy, routineStuckStateAmbiguousCopy, routineStuckStateCopy, routineStuckStateMissCopy, routineLoginWaitAmbiguousCopy, routineLoginWaitCopy, routineLoginWaitMissCopy, routinePluginAuthAmbiguousCopy, routinePluginAuthCopy, routinePluginAuthMissCopy, routineReadableAttachmentAmbiguousCopy, routineReadableAttachmentCopy, routineReadableAttachmentMissCopy, routineBlockedApprovalAmbiguousCopy, routineBlockedApprovalCopy, routineBlockedApprovalMissCopy, routineComputerSetupAmbiguousCopy, routineComputerSetupCopy, routineComputerSetupMissCopy, routineAppUpdateAmbiguousCopy, routineAppUpdateCopy, routineAppUpdateMissCopy, routineOpenSignInAmbiguousCopy, routineOpenSignInCopy, routineOpenSignInMissCopy, routineBotQuietAmbiguousCopy, routineBotQuietCopy, routineBotQuietMissCopy, routineSupportNoteAmbiguousCopy, routineSupportNoteCopy, routineSupportNoteMissCopy, routineRetryResultAmbiguousCopy, routineRetryResultCopy, routineRetryResultMissCopy, routineDisconnectedAppAmbiguousCopy, routineDisconnectedAppCopy, routineDisconnectedAppMissCopy, routineLeastDestructiveAmbiguousCopy, routineLeastDestructiveCopy, routineLeastDestructiveMissCopy, routineScreenTaskAmbiguousCopy, routineScreenTaskCopy, routineScreenTaskMissCopy, routineFinishBeforeRebuildAmbiguousCopy, routineFinishBeforeRebuildCopy, routineFinishBeforeRebuildMissCopy, routineKeptConversationAmbiguousCopy, routineKeptConversationCopy, routineKeptConversationMissCopy, routinePausedAskAmbiguousCopy, routinePausedAskCopy, routinePausedAskMissCopy, scheduleReadCopy, stayedSentence, stopRoutineAlreadyCopy, stopRoutineAmbiguousCopy, stopRoutineCopy, stopRoutineMissCopy, stopTaskCopy, stopTaskMissCopy, stopTaskNoneCopy, taskCoverLine, taskReleaseCopy, whoAskedSlackCopy } from "./brief.js";
import { closerThanFiveMinutes, nextInstant, rememberedRuns, ROUTINE_CAP, ROUTINE_HOUR_CAP, routineRateBlock } from "./cadence.js";
import { DISPLAY, chooseSeats, isSeatId } from "./doctrine.js";
import { OrielError } from "./errors.js";
import { HANDOFF_DONE, HANDOFF_LEFT, HANDOFF_TASK, cleanPhrase, handoffCardDetail, handoffTitle, isHandoffAction, isHandoffDecision, isSpokenMentionSame, isSpokenNotMentionSame, isSpokenNamed, isSpokenRead, isSpokenShared, isSpokenSharedWords, isSpokenUnnamed, isSpokenMentionedMore, isSpokenMentionedOnce, isSpokenMentionedOnly, isSpokenMentionedWords, isSpokenUnmentionedWords, isSpokenUnsharedSteps, isSpokenUnsharedWords, loosensHandoff, loosensSpokenAsk, loosensSpokenClear, loosensSpokenNamed, loosensSpokenNotShare, loosensSpokenNotShareWith, loosensSpokenRead, loosensSpokenShare, loosensSpokenShareWith, loosensSpokenShared, loosensSpokenSharedWith, loosensSpokenSharedWords, loosensSpokenNotMention, loosensSpokenStepMention, loosensSpokenSameMention, loosensSpokenSameMentionSteps, loosensSpokenSameNotMentionSteps, loosensSpokenSameNotMention, loosensSpokenNotSameWords, loosensSpokenSameWords, loosensSpokenStepNotMention, loosensSpokenStep, loosensSpokenUnnamed, loosensSpokenUnsharedSteps, loosensSpokenMentionedMore, loosensSpokenMentionedOnce, loosensSpokenMentionedOnly, loosensSpokenMentionedWords, loosensSpokenUnmentionedWords, loosensSpokenUnsharedWith, loosensSpokenUnsharedWords, loosensSpokenWords, readSpokenAsk, readSpokenAskPhrase, readSpokenClear, readSpokenNotShare, readSpokenNotShareWith, readSpokenNotShareWords, readSpokenRule, loosensSpokenNotShareWords, loosensSpokenNotShareWordsWith, loosensSpokenShareWords, loosensSpokenNotMentionWords, loosensSpokenNotMentionWordsWith, loosensSpokenMentionWords, loosensSpokenMentionSame, loosensSpokenNotMentionSame, loosensSpokenMentionWordsWith, loosensSpokenShareWordsWith, readSpokenNotMention, readSpokenStepMention, readSpokenSameMention, readSpokenSameMentionSteps, readSpokenSameNotMentionSteps, readSpokenSameNotMention, readSpokenNotSameWords, readSpokenSameWords, readSpokenStepNotMention, readSpokenNotShareWordsWith, readSpokenShare, readSpokenShareWith, readSpokenShareWords, readSpokenNotMentionWords, readSpokenNotMentionWordsWith, readSpokenMentionWords, readSpokenMentionWordsWith, readSpokenShareWordsWith, readSpokenSharedWith, readSpokenStep, readSpokenUnsharedWith, readSpokenWords, skillGuardsSeat, spokenAskCopy, spokenAskPhraseCopy, spokenBareClearCopy, spokenBareClearMissCopy, spokenClearCopy, spokenClearMissCopy, spokenNamedCopy, spokenNotMentionCopy, spokenStepMentionCopy, spokenSameMentionCopy, spokenSameMentionStepsCopy, spokenSameNotMentionStepsCopy, spokenSameNotMentionCopy, spokenNotSameWordsCopy, spokenSameWordsCopy, spokenStepNotMentionCopy, spokenNotShareCopy, spokenNotShareWithCopy, spokenNotShareWordsCopy, spokenNotShareWordsWithCopy, spokenPhraseMatches, spokenReadCopy, spokenRuleCopy, spokenShareCopy, spokenShareWithCopy, spokenShareWordsCopy, spokenNotMentionWordsCopy, spokenNotMentionWordsWithCopy, spokenMentionSameCopy, spokenNotMentionSameCopy, spokenMentionWordsCopy, spokenMentionWordsWithCopy, spokenShareWordsWithCopy, spokenSharedCopy, spokenSharedWithCopy, spokenSharedWordsCopy, spokenStepCopy, spokenUnnamedCopy, spokenUnsharedStepsCopy, spokenMentionedMoreCopy, spokenMentionedOnceCopy, spokenMentionedOnlyCopy, spokenMentionedWordsCopy, spokenUnmentionedWordsCopy, spokenUnsharedWithCopy, spokenUnsharedWordsCopy, spokenWordsCopy, taskSuffix } from "./handoff.js";
import type { SpokenAsk, SpokenAskPhrase, SpokenClear, SpokenNotMention, SpokenStepMention, SpokenSameMention, SpokenSameMentionSteps, SpokenSameNotMention, SpokenSameNotMentionSteps, SpokenNotSameWords, SpokenSameWords, SpokenStepNotMention, SpokenNotShare, SpokenNotShareWith, SpokenNotShareWords, SpokenNotShareWordsWith, SpokenRule, SpokenShare, SpokenShareWith, SpokenShareWords, SpokenNotMentionWords, SpokenNotMentionWordsWith, SpokenMentionWords, SpokenMentionWordsWith, SpokenShareWordsWith, SpokenSharedWith, SpokenStep, SpokenUnsharedWith, SpokenWords } from "./handoff.js";
import { AWAY_HOLD_COPY, EXPIRED_COPY, expiresAtFor } from "./hold.js";
import { extractLoops, isBareDecision, isMemoryOnly, isMemoryQuery, isActiveRead, isDisabledRead, isEnabledRead, isPausedRead, isScheduleRead, isStopTask, loosensActiveRead, loosensDisabledRead, loosensEnabledRead, loosensRoutineChange, loosensRoutineDelete, loosensRoutineDeliver, loosensRoutineDo, loosensRoutineHold, loosensRoutineRan, loosensRoutinePlace, loosensRoutineQuiet, loosensRoutineRuns, loosensRoutinePace, loosensRoutineRun, loosensRoutineSave, loosensRoutineWake, loosensPausedRead, loosensRoutineActiveAsk, loosensRoutineEnabledAsk, loosensRoutineDisabledAsk, loosensRoutineZone, loosensRoutineOwner, loosensRoutinePlugin, loosensRoutineSource, loosensRoutineUsage, loosensRoutineFailure, loosensRoutineChannel, loosensRoutineRepository, loosensRoutineMatching, loosensRoutineAskFirst, loosensRoutineAllowAuto, loosensRoutineTeamRule, loosensRoutineLockedTeamRule, loosensRoutineLocalComputer, loosensRoutineCloudComputer, loosensRoutineReachableComputer, loosensRoutineStuckState, loosensRoutineLoginWait, loosensRoutinePluginAuth, loosensRoutineReadableAttachment, loosensRoutineBlockedApproval, loosensRoutineComputerSetup, loosensRoutineAppUpdate, loosensRoutineOpenSignIn, loosensRoutineBotQuiet, loosensRoutineSupportNote, loosensRoutineRetryResult, loosensRoutineDisconnectedApp, loosensRoutineLeastDestructive, loosensRoutineScreenTask, loosensRoutineFinishBeforeRebuild, loosensRoutineKeptConversation, loosensRoutinePausedAsk, loosensScheduleRead, loosensStopRoutine, loosensStopTask, recall, remember, routineActiveAskName, routineEnabledAskName, routineDisabledAskName, routineZoneName, routineOwnerName, routinePluginName, routineSourceName, routineUsageName, routineFailureName, routineChannelName, routineRepositoryName, routineMatchingName, routineAskFirstName, routineAllowAutoName, routineTeamRuleName, routineLockedTeamRuleName, routineLocalComputerName, routineCloudComputerName, routineReachableComputerName, routineStuckStateName, routineLoginWaitName, routinePluginAuthName, routineReadableAttachmentName, routineBlockedApprovalName, routineComputerSetupName, routineAppUpdateName, routineOpenSignInName, routineBotQuietName, routineSupportNoteName, routineRetryResultName, routineDisconnectedAppName, routineLeastDestructiveName, routineScreenTaskName, routineFinishBeforeRebuildName, routineKeptConversationName, routineChange, routineDelete, routineDeliverName, routineDoName, routineHold, routinePace, routinePausedAskName, routineRanName, routinePlaceName, routineQuietName, routineRunName, routineRunsName, routineSave, routineStopName, routineWakeName } from "./memory.js";
import { pauseCopy, readDeskCommand } from "./pause.js";
import { applyHandoffRules, isWhoAskedSlack, kindsFor, readPolicy, slackAskKind, withSkillProhibitions } from "./policy.js";
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

function clearHeldBack(state: AppState): AppState {
  if (!state.routines.some((routine) => (routine.heldBack ?? []).length > 0)) return state;
  const draft = structuredClone(state);
  for (const routine of draft.routines) routine.heldBack = [];
  return draft;
}

function wakeStop(kinds: ApprovalKind[]): string {
  if (!kinds.length) return "";
  const lines = kinds.map((kind) => {
    if (kind === "send") return "Do not send mail.";
    if (kind === "pay") return "Do not move money.";
    if (kind === "delete") return "Do not delete anything.";
    if (kind === "post") return "Do not publish anything.";
    return "Do not use a credential.";
  });
  return `\n\nThe person said not now. ${lines.join(" ")} This wake must not try that step.`;
}

const TASK_KIND_ORDER: ApprovalKind[] = ["send", "pay", "delete", "post", "credential"];

function taskKinds(state: AppState, goalId: string): ApprovalKind[] {
  const found = new Set(
    state.approvals
      .filter((approval) => approval.goalId === goalId && approval.status === "approved" && approval.scope === "task")
      .map((approval) => approval.kind),
  );
  return TASK_KIND_ORDER.filter((kind) => found.has(kind));
}

function anotherTaskGoal(state: AppState, goalId: string): boolean {
  return state.approvals.some(
    (approval) => approval.goalId !== goalId && approval.status === "approved" && approval.scope === "task",
  );
}

function sameRoutineName(saved: string, asked: string): boolean {
  return saved.trim().replace(/\s+/g, " ").toLowerCase() === asked.trim().replace(/\s+/g, " ").toLowerCase();
}

function sameStoredInstruction(stored: string, proposal: string): boolean {
  const left = stored.trim().replace(/\s+/g, " ").toLowerCase();
  const right = proposal.trim().replace(/\s+/g, " ").toLowerCase();
  return left.length > 0 && left === right;
}

function applyStopRoutine(
  state: AppState,
  raw: string,
  asked: string,
  goalId: string | undefined,
  deps: Deps,
): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  const goal = goalId ? (draft.goals.find((item) => item.id === goalId) ?? null) : null;
  pushMessage(draft, { role: "you", text: redactSecrets(raw), ...(goal ? { goalId: goal.id } : {}) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = stopRoutineMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply, ...(goal ? { goalId: goal.id } : {}) }, deps);
    pushEvent(draft, goal?.id ?? null, "routine_stop", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = stopRoutineAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply, ...(goal ? { goalId: goal.id } : {}) }, deps);
    pushEvent(draft, goal?.id ?? null, "routine_stop", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  if (routine.cadence === "manual") {
    const reply = stopRoutineAlreadyCopy(routine.name, another);
    pushMessage(draft, { role: "oriel", text: reply, ...(goal ? { goalId: goal.id } : {}) }, deps);
    pushEvent(draft, goal?.id ?? null, "routine_stop", reply, deps);
    return draft;
  }
  routine.cadence = "manual";
  routine.nextRunAt = null;
  const reply = stopRoutineCopy(routine.name, another);
  pushMessage(draft, { role: "oriel", text: reply, ...(goal ? { goalId: goal.id } : {}) }, deps);
  pushEvent(draft, goal?.id ?? null, "routine_stopped", reply, deps);
  return draft;
}

function applyScheduleRead(state: AppState, raw: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  const reply = scheduleReadCopy(draft.routines);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "schedule_read", reply, deps);
  return draft;
}

function applyPausedRead(state: AppState, raw: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  const reply = pausedRoutinesCopy(draft.routines);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "paused_read", reply, deps);
  return draft;
}

function applyEnabledRead(state: AppState, raw: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  const reply = enabledRoutinesCopy(draft.routines);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "enabled_read", reply, deps);
  return draft;
}

function applyActiveRead(state: AppState, raw: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  const reply = activeRoutinesCopy(draft.routines);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "active_read", reply, deps);
  return draft;
}

function applyDisabledRead(state: AppState, raw: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  const reply = disabledRoutinesCopy(draft.routines);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "disabled_read", reply, deps);
  return draft;
}

function applyRoutinePausedAsk(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routinePausedAskMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_paused_ask", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routinePausedAskAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_paused_ask", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routinePausedAskCopy(routine.name, routine.paused === true, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_paused_ask", reply, deps);
  return draft;
}

function applyRoutineEnabledAsk(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineEnabledAskMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_enabled_ask", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineEnabledAskAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_enabled_ask", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineEnabledAskCopy(routine.name, routine.paused === true, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_enabled_ask", reply, deps);
  return draft;
}

function applyRoutineDisabledAsk(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineDisabledAskMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_disabled_ask", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineDisabledAskAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_disabled_ask", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineDisabledAskCopy(routine.name, routine.paused === true, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_disabled_ask", reply, deps);
  return draft;
}

function applyRoutineZone(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineZoneMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_zone", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineZoneAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_zone", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineZoneCopy(routine.name, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_zone", reply, deps);
  return draft;
}

function applyRoutineOwner(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineOwnerMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_owner", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineOwnerAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_owner", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineOwnerCopy(routine.name, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_owner", reply, deps);
  return draft;
}

function applyRoutinePlugin(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routinePluginMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_plugin", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routinePluginAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_plugin", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routinePluginCopy(routine.name, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_plugin", reply, deps);
  return draft;
}

function applyRoutineSource(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineSourceMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_source", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineSourceAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_source", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineSourceCopy(routine.name, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_source", reply, deps);
  return draft;
}

function applyRoutineFailure(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineFailureMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_failure", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineFailureAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_failure", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineFailureCopy(routine.name, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_failure", reply, deps);
  return draft;
}

function applyRoutineChannel(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineChannelMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_channel", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineChannelAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_channel", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineChannelCopy(routine.name, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_channel", reply, deps);
  return draft;
}

function applyRoutineRepository(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineRepositoryMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_repository", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineRepositoryAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_repository", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineRepositoryCopy(routine.name, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_repository", reply, deps);
  return draft;
}

function applyRoutineMatching(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineMatchingMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_matching", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineMatchingAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_matching", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineMatchingCopy(routine.name, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_matching", reply, deps);
  return draft;
}

function applyRoutineAskFirst(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineAskFirstMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_ask_first", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineAskFirstAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_ask_first", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineAskFirstCopy(routine.name, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_ask_first", reply, deps);
  return draft;
}

function applyRoutineUsage(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineUsageMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_usage", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineUsageAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_usage", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineUsageCopy(routine.name, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_usage", reply, deps);
  return draft;
}

function applyRoutineAllowAuto(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineAllowAutoMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_allow_auto", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineAllowAutoAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_allow_auto", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineAllowAutoCopy(routine.name, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_allow_auto", reply, deps);
  return draft;
}

function applyRoutineTeamRule(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineTeamRuleMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_team_rule", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineTeamRuleAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_team_rule", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineTeamRuleCopy(routine.name, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_team_rule", reply, deps);
  return draft;
}

function applyRoutineLockedTeamRule(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineLockedTeamRuleMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_locked_team_rule", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineLockedTeamRuleAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_locked_team_rule", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineLockedTeamRuleCopy(routine.name, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_locked_team_rule", reply, deps);
  return draft;
}

function applyRoutineLocalComputer(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineLocalComputerMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_local_computer", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineLocalComputerAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_local_computer", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineLocalComputerCopy(routine.name, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_local_computer", reply, deps);
  return draft;
}

function applyRoutineCloudComputer(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineCloudComputerMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_cloud_computer", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineCloudComputerAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_cloud_computer", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineCloudComputerCopy(routine.name, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_cloud_computer", reply, deps);
  return draft;
}

function applyRoutineReachableComputer(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineReachableComputerMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_reachable_computer", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineReachableComputerAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_reachable_computer", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineReachableComputerCopy(routine.name, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_reachable_computer", reply, deps);
  return draft;
}

function applyRoutineStuckState(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineStuckStateMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_stuck_state", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineStuckStateAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_stuck_state", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineStuckStateCopy(routine.name, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_stuck_state", reply, deps);
  return draft;
}

function applyRoutineLoginWait(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineLoginWaitMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_login_wait", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineLoginWaitAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_login_wait", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineLoginWaitCopy(routine.name, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_login_wait", reply, deps);
  return draft;
}

function applyRoutinePluginAuth(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routinePluginAuthMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_plugin_auth", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routinePluginAuthAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_plugin_auth", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routinePluginAuthCopy(routine.name, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_plugin_auth", reply, deps);
  return draft;
}

function applyRoutineReadableAttachment(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineReadableAttachmentMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_readable_attachment", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineReadableAttachmentAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_readable_attachment", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineReadableAttachmentCopy(routine.name, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_readable_attachment", reply, deps);
  return draft;
}

function applyRoutineBlockedApproval(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineBlockedApprovalMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_blocked_approval", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineBlockedApprovalAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_blocked_approval", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineBlockedApprovalCopy(routine.name, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_blocked_approval", reply, deps);
  return draft;
}

function applyRoutineComputerSetup(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineComputerSetupMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_computer_setup", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineComputerSetupAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_computer_setup", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineComputerSetupCopy(routine.name, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_computer_setup", reply, deps);
  return draft;
}

function applyRoutineAppUpdate(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineAppUpdateMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_app_update", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineAppUpdateAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_app_update", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineAppUpdateCopy(routine.name, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_app_update", reply, deps);
  return draft;
}

function applyRoutineOpenSignIn(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineOpenSignInMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_open_sign_in", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineOpenSignInAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_open_sign_in", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineOpenSignInCopy(routine.name, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_open_sign_in", reply, deps);
  return draft;
}

function applyRoutineBotQuiet(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineBotQuietMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_bot_quiet", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineBotQuietAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_bot_quiet", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineBotQuietCopy(routine.name, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_bot_quiet", reply, deps);
  return draft;
}

function applyRoutineSupportNote(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineSupportNoteMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_support_note", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineSupportNoteAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_support_note", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineSupportNoteCopy(routine.name, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_support_note", reply, deps);
  return draft;
}


function applyRoutineRetryResult(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineRetryResultMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_retry_result", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineRetryResultAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_retry_result", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineRetryResultCopy(routine.name, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_retry_result", reply, deps);
  return draft;
}

function applyRoutineDisconnectedApp(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineDisconnectedAppMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_disconnected_app", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineDisconnectedAppAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_disconnected_app", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineDisconnectedAppCopy(routine.name, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_disconnected_app", reply, deps);
  return draft;
}

function applyRoutineLeastDestructive(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineLeastDestructiveMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_least_destructive", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineLeastDestructiveAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_least_destructive", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineLeastDestructiveCopy(routine.name, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_least_destructive", reply, deps);
  return draft;
}

function applyRoutineScreenTask(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineScreenTaskMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_screen_task", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineScreenTaskAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_screen_task", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineScreenTaskCopy(routine.name, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_screen_task", reply, deps);
  return draft;
}

function applyRoutineFinishBeforeRebuild(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineFinishBeforeRebuildMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_finish_before_rebuild", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineFinishBeforeRebuildAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_finish_before_rebuild", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineFinishBeforeRebuildCopy(routine.name, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_finish_before_rebuild", reply, deps);
  return draft;
}


function applyRoutineKeptConversation(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineKeptConversationMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_kept_conversation", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineKeptConversationAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_kept_conversation", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineKeptConversationCopy(routine.name, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_kept_conversation", reply, deps);
  return draft;
}

function applyRoutineActiveAsk(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineActiveAskMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_active_ask", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineActiveAskAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_active_ask", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineActiveAskCopy(routine.name, routine.paused === true, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_active_ask", reply, deps);
  return draft;
}

function applyRoutineWake(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineWakeMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_when", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineWakeAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_when", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineWakeCopy(routine.name, routine.cadence, routine.nextRunAt, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_when", reply, deps);
  return draft;
}

function applyRoutineDo(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineDoMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_do", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineDoAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_do", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineDoCopy(routine.name, routine.instruction, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_do", reply, deps);
  return draft;
}

function applyRoutineRan(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineRanMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_last", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineRanAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_last", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineRanCopy(routine.name, routine.lastRunAt, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_last", reply, deps);
  return draft;
}

function applyRoutineDelivered(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineDeliveredMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_deliver", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineDeliveredAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_deliver", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineDeliveredCopy(routine.name, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_deliver", reply, deps);
  return draft;
}

function applyRoutinePlace(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routinePlaceMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_place", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routinePlaceAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_place", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routinePlaceCopy(routine.name, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_place", reply, deps);
  return draft;
}

function applyRoutineQuiet(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineQuietMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_quiet", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineQuietAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_quiet", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const blocked = routineRateBlock(draft.routines, routine.id, deps.now()) !== null;
  const reply = routineQuietCopy(routine.name, routine, draft.paused === true, blocked, at(deps), another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_quiet", reply, deps);
  return draft;
}

function applyRoutineRuns(state: AppState, raw: string, asked: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineRunsMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_runs", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineRunsAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_runs", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineRunsCopy(routine.name, routine.recentRuns, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_runs", reply, deps);
  return draft;
}

function applyRoutineChange(
  state: AppState,
  raw: string,
  asked: string,
  proposal: string,
  goalId: string | undefined,
  deps: Deps,
): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineChangeMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_change", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineChangeAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_change", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineChangeCopy(routine.name, routine.instruction, proposal, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_change", reply, deps);
  return draft;
}

function applyRoutineSave(
  state: AppState,
  raw: string,
  asked: string,
  proposal: string,
  goalId: string | undefined,
  deps: Deps,
): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineSaveMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_save", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineSaveAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_save", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const nextInstruction = redactSecrets(proposal);
  if (sameStoredInstruction(routine.instruction, nextInstruction)) {
    const reply = routineSaveAlreadyCopy(routine.name, routine.instruction, another);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_save", reply, deps);
    return draft;
  }
  routine.instruction = nextInstruction;
  const reply = routineSaveCopy(routine.name, nextInstruction, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_save", reply, deps);
  return draft;
}

function applyRoutinePace(
  state: AppState,
  raw: string,
  asked: string,
  cadence: Cadence,
  goalId: string | undefined,
  deps: Deps,
): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineSaveMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_cadence", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineSaveAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_cadence", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  if (routine.cadence === cadence) {
    const reply = routinePaceAlreadyCopy(routine.name, routine.cadence, another);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_cadence", reply, deps);
    return draft;
  }
  if (cadence !== "manual") {
    const proposed = nextInstant(cadence, deps.now());
    const conflict = proposed
      ? draft.routines.find(
          (item) =>
            item.id !== routine.id &&
            typeof item.nextRunAt === "string" &&
            closerThanFiveMinutes(proposed, item.nextRunAt),
        )
      : undefined;
    if (conflict) {
      const more = draft.routines.some((item) => item.id !== routine.id && item.id !== conflict.id);
      const reply = routinePaceApartCopy(routine.name, conflict.name, more);
      pushMessage(draft, { role: "oriel", text: reply }, deps);
      pushEvent(draft, null, "routine_cadence", reply, deps);
      return draft;
    }
  }
  routine.cadence = cadence;
  routine.nextRunAt = nextInstant(cadence, deps.now());
  const reply = routinePaceCopy(routine.name, cadence, routine.nextRunAt, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_cadence", reply, deps);
  return draft;
}

function applyRoutineHold(
  state: AppState,
  raw: string,
  asked: string,
  paused: boolean,
  goalId: string | undefined,
  deps: Deps,
): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineSaveMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_pause", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineSaveAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_pause", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  if ((routine.paused === true) === paused) {
    const reply = routineHoldAlreadyCopy(routine.name, paused, routine.cadence, another);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_pause", reply, deps);
    return draft;
  }
  routine.paused = paused;
  const reply = routineHoldCopy(routine.name, paused, routine.cadence, another);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_pause", reply, deps);
  return draft;
}

function applyRoutineDelete(
  state: AppState,
  raw: string,
  asked: string,
  goalId: string | undefined,
  deps: Deps,
): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const matches = draft.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const reply = routineSaveMissCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_delete", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const reply = routineSaveAmbiguousCopy(asked);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_delete", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return draft;
  const another = draft.routines.some((item) => item.id !== routine.id);
  const reply = routineDeleteCopy(routine.name, another);
  draft.routines = draft.routines.filter((item) => item.id !== routine.id);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_delete", reply, deps);
  return draft;
}

async function applySpokenRun(
  state: AppState,
  raw: string,
  asked: string,
  goalId: string | undefined,
  deps: Deps,
): Promise<AppState> {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const matches = state.routines.filter((routine) => sameRoutineName(routine.name, asked));
  if (matches.length === 0) {
    const draft = structuredClone(state);
    const reply = routineRunMissCopy(asked);
    pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_spoken", reply, deps);
    return draft;
  }
  if (matches.length > 1) {
    const draft = structuredClone(state);
    const reply = routineRunAmbiguousCopy(asked);
    pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "routine_spoken", reply, deps);
    return draft;
  }
  const routine = matches[0];
  if (!routine) return state;
  if (routineRateBlock(state.routines, routine.id, deps.now())) {
    return refuseRoutineRate(state, routine.id, deps, raw);
  }
  const another = state.routines.some((item) => item.id !== routine.id);
  const draft = clearHeldBack(structuredClone(state));
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  const next = await runRoutine(draft, routine.id, deps);
  const reply = routineRunCopy(routine.name, another);
  pushMessage(next, { role: "oriel", text: reply }, deps);
  pushEvent(next, next.goals.at(-1)?.id ?? null, "routine_spoken", reply, deps);
  return next;
}

function applyStopTask(state: AppState, raw: string, goalId: string | undefined, deps: Deps): AppState {
  if (goalId && !state.goals.some((item) => item.id === goalId)) {
    throw new OrielError("That goal is not in the record.", 404);
  }
  const draft = structuredClone(state);
  const goal = goalId ? (draft.goals.find((item) => item.id === goalId) ?? null) : (draft.goals.at(-1) ?? null);
  pushMessage(draft, { role: "you", text: redactSecrets(raw), ...(goal ? { goalId: goal.id } : {}) }, deps);
  if (!goal) {
    const reply = stopTaskNoneCopy();
    pushMessage(draft, { role: "oriel", text: reply }, deps);
    pushEvent(draft, null, "task_stop", reply, deps);
    return draft;
  }
  const kinds = taskKinds(draft, goal.id);
  const another = anotherTaskGoal(draft, goal.id);
  if (!kinds.length) {
    const reply = stopTaskMissCopy(another);
    pushMessage(draft, { role: "oriel", text: reply, goalId: goal.id }, deps);
    pushEvent(draft, goal.id, "task_stop", reply, deps);
    return draft;
  }
  for (const approval of draft.approvals) {
    if (approval.goalId === goal.id && approval.status === "approved" && approval.scope === "task") {
      approval.scope = "once";
    }
  }
  const reply = stopTaskCopy(kinds, another);
  goal.updatedAt = at(deps);
  pushMessage(draft, { role: "oriel", text: reply, goalId: goal.id }, deps);
  pushEvent(draft, goal.id, "task_stopped", reply, deps);
  return draft;
}

function taskCoverStop(kinds: ApprovalKind[]): string {
  if (!kinds.length) return "";
  const lines = kinds.map((kind) => {
    if (kind === "send") return "Do not send mail.";
    if (kind === "pay") return "Do not move money.";
    if (kind === "delete") return "Do not delete anything.";
    if (kind === "post") return "Do not publish anything.";
    return "Do not use a credential.";
  });
  return `\n\nAlready allowed for this goal only. ${lines.join(" ")} Do not do that step. A later goal still asks.`;
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

  let swept = expireHolds(state, deps);
  const desk = readDeskCommand(original);
  if (desk && presence === "present") swept = clearHeldBack(swept);
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
      if (decision === "task" && handed) {
        throw new OrielError("That step is yours. Say you did it, or leave it. Allow for this task does not do it.");
      }
      if (swept !== state) return swept;
      throw new OrielError("Nothing is waiting on you.");
    }
    return settle(swept, open.id, decision, deps);
  }

  if (/^(?:please\s+)?(?:always[-\s]?allow|allow automatically|allow for this site)\b/i.test(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
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

  const routineName = routineStopName(original);
  if (routineName) return applyStopRoutine(swept, original, routineName, goalId, deps);
  if (loosensStopRoutine(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  if (isScheduleRead(original)) return applyScheduleRead(swept, original, goalId, deps);
  if (loosensScheduleRead(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  if (isPausedRead(original)) return applyPausedRead(swept, original, goalId, deps);
  if (loosensPausedRead(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  if (isEnabledRead(original)) return applyEnabledRead(swept, original, goalId, deps);
  if (loosensEnabledRead(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  if (isActiveRead(original)) return applyActiveRead(swept, original, goalId, deps);
  if (loosensActiveRead(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  if (isDisabledRead(original)) return applyDisabledRead(swept, original, goalId, deps);
  if (loosensDisabledRead(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const pausedAskName = routinePausedAskName(original);
  if (pausedAskName) return applyRoutinePausedAsk(swept, original, pausedAskName, goalId, deps);
  if (loosensRoutinePausedAsk(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const activeAskName = routineActiveAskName(original);
  if (activeAskName) return applyRoutineActiveAsk(swept, original, activeAskName, goalId, deps);
  if (loosensRoutineActiveAsk(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const enabledAskName = routineEnabledAskName(original);
  if (enabledAskName) return applyRoutineEnabledAsk(swept, original, enabledAskName, goalId, deps);
  if (loosensRoutineEnabledAsk(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const disabledAskName = routineDisabledAskName(original);
  if (disabledAskName) return applyRoutineDisabledAsk(swept, original, disabledAskName, goalId, deps);
  if (loosensRoutineDisabledAsk(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const zoneName = routineZoneName(original);
  if (zoneName) return applyRoutineZone(swept, original, zoneName, goalId, deps);
  if (loosensRoutineZone(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const ownerName = routineOwnerName(original);
  if (ownerName) return applyRoutineOwner(swept, original, ownerName, goalId, deps);
  if (loosensRoutineOwner(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const pluginName = routinePluginName(original);
  if (pluginName) return applyRoutinePlugin(swept, original, pluginName, goalId, deps);
  if (loosensRoutinePlugin(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const sourceName = routineSourceName(original);
  if (sourceName) return applyRoutineSource(swept, original, sourceName, goalId, deps);
  if (loosensRoutineSource(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const usageName = routineUsageName(original);
  if (usageName) return applyRoutineUsage(swept, original, usageName, goalId, deps);
  if (loosensRoutineUsage(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const failureName = routineFailureName(original);
  if (failureName) return applyRoutineFailure(swept, original, failureName, goalId, deps);
  if (loosensRoutineFailure(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const channelName = routineChannelName(original);
  if (channelName) return applyRoutineChannel(swept, original, channelName, goalId, deps);
  if (loosensRoutineChannel(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const repositoryName = routineRepositoryName(original);
  if (repositoryName) return applyRoutineRepository(swept, original, repositoryName, goalId, deps);
  if (loosensRoutineRepository(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const matchingName = routineMatchingName(original);
  if (matchingName) return applyRoutineMatching(swept, original, matchingName, goalId, deps);
  if (loosensRoutineMatching(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const askFirstName = routineAskFirstName(original);
  if (askFirstName) return applyRoutineAskFirst(swept, original, askFirstName, goalId, deps);
  if (loosensRoutineAskFirst(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const allowAutoName = routineAllowAutoName(original);
  if (allowAutoName) return applyRoutineAllowAuto(swept, original, allowAutoName, goalId, deps);
  if (loosensRoutineAllowAuto(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const teamRuleName = routineTeamRuleName(original);
  if (teamRuleName) return applyRoutineTeamRule(swept, original, teamRuleName, goalId, deps);
  if (loosensRoutineTeamRule(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const lockedTeamRuleName = routineLockedTeamRuleName(original);
  if (lockedTeamRuleName) return applyRoutineLockedTeamRule(swept, original, lockedTeamRuleName, goalId, deps);
  if (loosensRoutineLockedTeamRule(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const localComputerName = routineLocalComputerName(original);
  if (localComputerName) return applyRoutineLocalComputer(swept, original, localComputerName, goalId, deps);
  if (loosensRoutineLocalComputer(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const cloudComputerName = routineCloudComputerName(original);
  if (cloudComputerName) return applyRoutineCloudComputer(swept, original, cloudComputerName, goalId, deps);
  if (loosensRoutineCloudComputer(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const reachableComputerName = routineReachableComputerName(original);
  if (reachableComputerName) return applyRoutineReachableComputer(swept, original, reachableComputerName, goalId, deps);
  if (loosensRoutineReachableComputer(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const stuckStateName = routineStuckStateName(original);
  if (stuckStateName) return applyRoutineStuckState(swept, original, stuckStateName, goalId, deps);
  if (loosensRoutineStuckState(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const loginWaitName = routineLoginWaitName(original);
  if (loginWaitName) return applyRoutineLoginWait(swept, original, loginWaitName, goalId, deps);
  if (loosensRoutineLoginWait(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const pluginAuthName = routinePluginAuthName(original);
  if (pluginAuthName) return applyRoutinePluginAuth(swept, original, pluginAuthName, goalId, deps);
  if (loosensRoutinePluginAuth(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const readableAttachmentName = routineReadableAttachmentName(original);
  if (readableAttachmentName) return applyRoutineReadableAttachment(swept, original, readableAttachmentName, goalId, deps);
  if (loosensRoutineReadableAttachment(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const blockedApprovalName = routineBlockedApprovalName(original);
  if (blockedApprovalName) return applyRoutineBlockedApproval(swept, original, blockedApprovalName, goalId, deps);
  if (loosensRoutineBlockedApproval(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const computerSetupName = routineComputerSetupName(original);
  if (computerSetupName) return applyRoutineComputerSetup(swept, original, computerSetupName, goalId, deps);
  if (loosensRoutineComputerSetup(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const appUpdateName = routineAppUpdateName(original);
  if (appUpdateName) return applyRoutineAppUpdate(swept, original, appUpdateName, goalId, deps);
  if (loosensRoutineAppUpdate(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const openSignInName = routineOpenSignInName(original);
  if (openSignInName) return applyRoutineOpenSignIn(swept, original, openSignInName, goalId, deps);
  if (loosensRoutineOpenSignIn(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const botQuietName = routineBotQuietName(original);
  if (botQuietName) return applyRoutineBotQuiet(swept, original, botQuietName, goalId, deps);
  if (loosensRoutineBotQuiet(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const supportNoteName = routineSupportNoteName(original);
  if (supportNoteName) return applyRoutineSupportNote(swept, original, supportNoteName, goalId, deps);
  if (loosensRoutineSupportNote(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const retryResultName = routineRetryResultName(original);
  if (retryResultName) return applyRoutineRetryResult(swept, original, retryResultName, goalId, deps);
  if (loosensRoutineRetryResult(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const disconnectedAppName = routineDisconnectedAppName(original);
  if (disconnectedAppName) return applyRoutineDisconnectedApp(swept, original, disconnectedAppName, goalId, deps);
  if (loosensRoutineDisconnectedApp(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const leastDestructiveName = routineLeastDestructiveName(original);
  if (leastDestructiveName) return applyRoutineLeastDestructive(swept, original, leastDestructiveName, goalId, deps);
  if (loosensRoutineLeastDestructive(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const screenTaskName = routineScreenTaskName(original);
  if (screenTaskName) return applyRoutineScreenTask(swept, original, screenTaskName, goalId, deps);
  if (loosensRoutineScreenTask(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const finishBeforeRebuildName = routineFinishBeforeRebuildName(original);
  if (finishBeforeRebuildName) return applyRoutineFinishBeforeRebuild(swept, original, finishBeforeRebuildName, goalId, deps);
  if (loosensRoutineFinishBeforeRebuild(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const keptConversationName = routineKeptConversationName(original);
  if (keptConversationName) return applyRoutineKeptConversation(swept, original, keptConversationName, goalId, deps);
  if (loosensRoutineKeptConversation(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const wakeName = routineWakeName(original);
  if (wakeName) return applyRoutineWake(swept, original, wakeName, goalId, deps);
  if (loosensRoutineWake(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const doName = routineDoName(original);
  if (doName) return applyRoutineDo(swept, original, doName, goalId, deps);
  if (loosensRoutineDo(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const ranName = routineRanName(original);
  if (ranName) return applyRoutineRan(swept, original, ranName, goalId, deps);
  if (loosensRoutineRan(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const placeName = routinePlaceName(original);
  if (placeName) return applyRoutinePlace(swept, original, placeName, goalId, deps);
  if (loosensRoutinePlace(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const deliveredName = routineDeliverName(original);
  if (deliveredName) return applyRoutineDelivered(swept, original, deliveredName, goalId, deps);
  if (loosensRoutineDeliver(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const runsName = routineRunsName(original);
  if (runsName) return applyRoutineRuns(swept, original, runsName, goalId, deps);
  if (loosensRoutineRuns(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const quietName = routineQuietName(original);
  if (quietName) return applyRoutineQuiet(swept, original, quietName, goalId, deps);
  if (loosensRoutineQuiet(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const savedInstruction = routineSave(original);
  if (savedInstruction) {
    return applyRoutineSave(swept, original, savedInstruction.name, savedInstruction.proposal, goalId, deps);
  }
  if (loosensRoutineSave(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const change = routineChange(original);
  if (change) return applyRoutineChange(swept, original, change.name, change.proposal, goalId, deps);
  if (loosensRoutineChange(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const paced = routinePace(original);
  if (paced) return applyRoutinePace(swept, original, paced.name, paced.cadence, goalId, deps);
  if (loosensRoutinePace(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const parked = routineHold(original);
  if (parked) return applyRoutineHold(swept, original, parked.name, parked.paused, goalId, deps);
  if (loosensRoutineHold(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  const removed = routineDelete(original);
  if (removed) return applyRoutineDelete(swept, original, removed, goalId, deps);
  if (loosensRoutineDelete(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  if (!deps.running) {
    const runName = routineRunName(original);
    if (runName) return applySpokenRun(swept, original, runName, goalId, deps);
    if (loosensRoutineRun(original)) {
      throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
    }
  }

  if (presence === "present") swept = clearHeldBack(swept);

  if (isStopTask(original)) return applyStopTask(swept, original, goalId, deps);
  if (loosensStopTask(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }

  if (isWhoAskedSlack(original)) return answerWhoAskedSlack(swept, original, deps);

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
  const spokenNotShareWordsWith = readSpokenNotShareWordsWith(original);
  if (spokenNotShareWordsWith) return applySpokenNotShareWordsWith(swept, original, spokenNotShareWordsWith, deps);
  const spokenShareWordsWith = readSpokenShareWordsWith(original);
  if (spokenShareWordsWith) return applySpokenShareWordsWith(swept, original, spokenShareWordsWith, deps);
  const spokenNotShareWords = readSpokenNotShareWords(original);
  if (spokenNotShareWords) return applySpokenNotShareWords(swept, original, spokenNotShareWords, deps);
  const spokenShareWords = readSpokenShareWords(original);
  if (spokenShareWords) return applySpokenShareWords(swept, original, spokenShareWords, deps);
  const spokenNotMentionWordsWith = readSpokenNotMentionWordsWith(original);
  if (!spokenNotMentionWordsWith && loosensSpokenNotMentionWordsWith(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }
  if (spokenNotMentionWordsWith) return applySpokenNotMentionWordsWith(swept, original, spokenNotMentionWordsWith, deps);
  const spokenMentionWordsWith = readSpokenMentionWordsWith(original);
  if (!spokenMentionWordsWith && loosensSpokenMentionWordsWith(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }
  if (spokenMentionWordsWith) return applySpokenMentionWordsWith(swept, original, spokenMentionWordsWith, deps);
  const spokenNotMentionWords = readSpokenNotMentionWords(original);
  if (spokenNotMentionWords) return applySpokenNotMentionWords(swept, original, spokenNotMentionWords, deps);
  const spokenMentionWords = readSpokenMentionWords(original);
  if (spokenMentionWords) return applySpokenMentionWords(swept, original, spokenMentionWords, deps);
  const spokenWords = readSpokenWords(original);
  if (spokenWords) return applySpokenWords(swept, original, spokenWords, deps);
  const spokenSameNotMention = readSpokenSameNotMention(original);
  if (!spokenSameNotMention && loosensSpokenSameNotMention(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }
  if (spokenSameNotMention) return applySpokenSameNotMention(swept, original, spokenSameNotMention, deps);
  const spokenSameMention = readSpokenSameMention(original);
  if (!spokenSameMention && loosensSpokenSameMention(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }
  if (spokenSameMention) return applySpokenSameMention(swept, original, spokenSameMention, deps);
  const spokenNotSameWords = readSpokenNotSameWords(original);
  if (!spokenNotSameWords && loosensSpokenNotSameWords(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }
  if (spokenNotSameWords) return applySpokenNotSameWords(swept, original, spokenNotSameWords, deps);
  const spokenSameWords = readSpokenSameWords(original);
  if (!spokenSameWords && loosensSpokenSameWords(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }
  if (spokenSameWords) return applySpokenSameWords(swept, original, spokenSameWords, deps);
  const spokenStepNotMention = readSpokenStepNotMention(original);
  if (spokenStepNotMention?.kind === "reject" && spokenStepNotMention.reason === "phrase") {
    throw new OrielError("Name the step in a short phrase. Oriel will not run it.");
  }
  if (!spokenStepNotMention && loosensSpokenStepNotMention(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }
  if (spokenStepNotMention) return applySpokenStepNotMention(swept, original, spokenStepNotMention, deps);
  const spokenStepMention = readSpokenStepMention(original);
  if (spokenStepMention?.kind === "reject" && spokenStepMention.reason === "phrase") {
    throw new OrielError("Name the step in a short phrase. Oriel will not run it.");
  }
  if (!spokenStepMention && loosensSpokenStepMention(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }
  if (spokenStepMention) return applySpokenStepMention(swept, original, spokenStepMention, deps);
  const spokenSameNotMentionSteps = readSpokenSameNotMentionSteps(original);
  if (!spokenSameNotMentionSteps && loosensSpokenSameNotMentionSteps(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }
  if (spokenSameNotMentionSteps) return applySpokenSameNotMentionSteps(swept, original, spokenSameNotMentionSteps, deps);
  const spokenNotMention = readSpokenNotMention(original);
  if (spokenNotMention?.kind === "reject") {
    throw new OrielError("Name the step in a short phrase. Oriel will not run it.");
  }
  if (!spokenNotMention && loosensSpokenNotMention(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }
  if (spokenNotMention) return applySpokenNotMention(swept, original, spokenNotMention, deps);
  if (isSpokenNotMentionSame(original)) return applySpokenNotMentionSame(swept, original, deps);
  if (loosensSpokenNotMentionSame(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }
  if (isSpokenMentionSame(original)) return applySpokenMentionSame(swept, original, deps);
  if (loosensSpokenMentionSame(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }
  const spokenSameMentionSteps = readSpokenSameMentionSteps(original);
  if (!spokenSameMentionSteps && loosensSpokenSameMentionSteps(original)) {
    throw new OrielError("Oriel will not take that step without asking. Nothing was sent or spent.");
  }
  if (spokenSameMentionSteps) return applySpokenSameMentionSteps(swept, original, spokenSameMentionSteps, deps);
  const spokenStep = readSpokenStep(original);
  if (spokenStep) {
    if (spokenStep.kind === "reject") {
      throw new OrielError("Name the step in a short phrase. Oriel will not run it.");
    }
    return applySpokenStep(swept, original, spokenStep, deps);
  }
  if (isSpokenUnnamed(original)) return applySpokenUnnamed(swept, original, deps);
  if (isSpokenNamed(original)) return applySpokenNamed(swept, original, deps);
  const spokenUnsharedWithOne = readSpokenUnsharedWith(original);
  if (spokenUnsharedWithOne) return applySpokenUnsharedWith(swept, original, spokenUnsharedWithOne, deps);
  const spokenSharedWithOne = readSpokenSharedWith(original);
  if (spokenSharedWithOne) return applySpokenSharedWith(swept, original, spokenSharedWithOne, deps);
  const spokenNotShareWith = readSpokenNotShareWith(original);
  if (spokenNotShareWith) return applySpokenNotShareWith(swept, original, spokenNotShareWith, deps);
  const spokenShareWith = readSpokenShareWith(original);
  if (spokenShareWith) return applySpokenShareWith(swept, original, spokenShareWith, deps);
  const spokenNotShare = readSpokenNotShare(original);
  if (spokenNotShare) return applySpokenNotShare(swept, original, spokenNotShare, deps);
  const spokenShare = readSpokenShare(original);
  if (spokenShare) return applySpokenShare(swept, original, spokenShare, deps);
  if (isSpokenUnsharedSteps(original)) return applySpokenUnsharedSteps(swept, original, deps);
  if (isSpokenShared(original)) return applySpokenShared(swept, original, deps);
  if (isSpokenMentionedOnly(original)) return applySpokenMentionedOnly(swept, original, deps);
  if (isSpokenUnmentionedWords(original)) return applySpokenUnmentionedWords(swept, original, deps);
  if (isSpokenMentionedMore(original)) return applySpokenMentionedMore(swept, original, deps);
  if (isSpokenMentionedOnce(original)) return applySpokenMentionedOnce(swept, original, deps);
  if (isSpokenMentionedWords(original)) return applySpokenMentionedWords(swept, original, deps);
  if (isSpokenUnsharedWords(original)) return applySpokenUnsharedWords(swept, original, deps);
  if (isSpokenSharedWords(original)) return applySpokenSharedWords(swept, original, deps);
  if (
    loosensSpokenRead(original) ||
    loosensSpokenAsk(original) ||
    loosensSpokenNotShareWordsWith(original) ||
    loosensSpokenShareWordsWith(original) ||
    loosensSpokenNotShareWords(original) ||
    loosensSpokenShareWords(original) ||
    loosensSpokenNotMentionWords(original) ||
    loosensSpokenNotMentionWordsWith(original) ||
    loosensSpokenMentionWordsWith(original) ||
    loosensSpokenNotMentionSame(original) ||
    loosensSpokenMentionSame(original) ||
    loosensSpokenMentionWords(original) ||
    loosensSpokenWords(original) ||
    loosensSpokenSameNotMention(original) ||
    loosensSpokenSameMention(original) ||
    loosensSpokenNotSameWords(original) ||
    loosensSpokenSameWords(original) ||
    loosensSpokenSameNotMentionSteps(original) ||
    loosensSpokenSameMentionSteps(original) ||
    loosensSpokenStepNotMention(original) ||
    loosensSpokenStepMention(original) ||
    loosensSpokenNotMention(original) ||
    loosensSpokenStep(original) ||
    loosensSpokenUnnamed(original) ||
    loosensSpokenNamed(original) ||
    loosensSpokenNotShare(original) ||
    loosensSpokenNotShareWith(original) ||
    loosensSpokenShareWith(original) ||
    loosensSpokenUnsharedWith(original) ||
    loosensSpokenSharedWith(original) ||
    loosensSpokenShare(original) ||
    loosensSpokenUnsharedSteps(original) ||
    loosensSpokenShared(original) ||
    loosensSpokenUnmentionedWords(original) ||
    loosensSpokenMentionedMore(original) ||
    loosensSpokenMentionedOnce(original) ||
    loosensSpokenMentionedOnly(original) ||
    loosensSpokenMentionedWords(original) ||
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
  const considered = kindsFor(policy);
  const wakeId = presence === "away" && deps.wakeFrom ? deps.wakeFrom : undefined;
  const blocked = new Set((wakeId ? draft.routines.find((item) => item.id === wakeId)?.heldBack : undefined) ?? []);
  const stayed = considered.held.filter((kind) => blocked.has(kind));
  const pending = considered.held.filter((kind) => !blocked.has(kind));
  const existingGoal = goal;
  const covered: ApprovalKind[] =
    existingGoal === null
      ? []
      : pending.filter((kind) =>
          draft.approvals.some(
            (approval) =>
              approval.goalId === existingGoal.id &&
              approval.status === "approved" &&
              approval.scope === "task" &&
              approval.kind === kind,
          ),
        );
  const held = pending.filter((kind) => !covered.includes(kind));
  const skipped = considered.skipped;
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
        stayed,
        covered,
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
  const draftStop = policy.draftOnly ? "\n\nThis is a draft only. Do not send mail." : "";
  const forwardStop = policy.forwardAsked ? `\n\n${FORWARD_TASK}` : "";
  const taskForSeats = `${applied ? skillInstruction(applied.name, applied.method, stored) : stored}${taskSuffix(
    policy,
    applied ? skillGuardsSeat(applied.method) : false,
  )}${wakeStop(stayed)}${taskCoverStop(covered)}${draftStop}${forwardStop}`;
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
  if (policy.draftOnly) {
    plan.push(step(draft, "Keep the note as a draft", DRAFT_ONLY_COPY, "oriel", "done"));
  }
  if (policy.forward) {
    plan.push(step(draft, "Note the forward", FORWARD_COPY, "oriel", "done"));
  }
  for (const kind of skipped) {
    plan.push(step(draft, `Leave the ${kind} undone`, approvalDetail(kind, stored), "oriel", "skipped", kind));
  }
  for (const kind of stayed) {
    plan.push(
      step(
        draft,
        `Leave the ${kind} held back`,
        "You said not now. This wake will not raise it again until you send a message.",
        "oriel",
        "skipped",
        kind,
      ),
    );
    pushEvent(
      draft,
      goal.id,
      "held_back",
      `${APPROVAL_TITLE[kind]} stays held back. This wake will not raise it. Nothing was sent or spent.`,
      deps,
    );
  }
  for (const kind of covered) {
    plan.push(step(draft, "Covered for this goal", taskCoverLine(kind), "oriel", "done", kind));
    pushEvent(draft, goal.id, "task_cover", taskCoverLine(kind), deps);
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
      routineId: wakeId ?? null,
      scope: "once" as const,
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
    stayed,
    covered,
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
  for (const kind of covered) {
    const line = taskCoverLine(kind);
    if (!spoken.includes(line)) spoken = `${spoken} ${line}`;
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
  decision: "approve" | "deny" | "task",
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
    if (approval.routineId) {
      const routine = draft.routines.find((item) => item.id === approval.routineId);
      if (routine) {
        const kinds = routine.heldBack ?? [];
        if (!kinds.includes(approval.kind)) kinds.push(approval.kind);
        routine.heldBack = kinds;
      }
    }
    pushEvent(draft, goal.id, "denied", `${approval.title} was held back.`, deps);
  } else {
    approval.status = "approved";
    approval.scope = decision === "task" ? "task" : "once";
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
    approval.resolution =
      decision === "task" ? taskReleaseCopy(approval.kind, liveSummary) : releaseCopy(approval.kind, liveSummary);
    pushEvent(draft, goal.id, "approved", approval.resolution, deps);
  }

  goal.updatedAt = at(deps);
  goal.status = goalStatus(goal, draft.approvals, draft.handoffs ?? []);
  pushMessage(draft, { role: "oriel", text: approval.resolution ?? DENIAL_COPY, goalId: goal.id }, deps);
  return draft;
}

function releaseTask(goal: Goal, handoffs: Handoff[]): string {
  const base = handoffs.some((item) => item.goalId === goal.id)
    ? `${goal.text}\n\n${HANDOFF_TASK} Do not perform the step that was handed to the person.`
    : goal.text;
  return readPolicy(goal.text, { preferences: [], people: [] }).forward ? `${base}\n\n${FORWARD_TASK}` : base;
}

function answerWhoAskedSlack(state: AppState, raw: string, deps: Deps): AppState {
  const draft = structuredClone(state);
  let kind: ReturnType<typeof slackAskKind> = null;
  for (let index = draft.goals.length - 1; index >= 0; index -= 1) {
    const goal = draft.goals[index];
    if (!goal) continue;
    const found = slackAskKind(goal.text);
    if (found) {
      kind = found;
      break;
    }
  }
  const reply = whoAskedSlackCopy(kind);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "asked_read", reply, deps);
  return draft;
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

function applySpokenSameNotMentionSteps(
  state: AppState,
  raw: string,
  spoken: SpokenSameNotMentionSteps,
  deps: Deps,
): AppState {
  const draft = structuredClone(state);
  const reply =
    spoken.kind === "reject"
      ? "That sentence does not name a send, a payment, a deletion, or a public post. Oriel did not open a card. Nothing was sent or spent."
      : spokenSameNotMentionStepsCopy(spoken.action, draft.handoffRules ?? []);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, spoken.kind === "reject" ? "rule_ignored" : "rule_read", reply, deps);
  return draft;
}

function applySpokenSameMentionSteps(state: AppState, raw: string, spoken: SpokenSameMentionSteps, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply =
    spoken.kind === "reject"
      ? "That sentence does not name a send, a payment, a deletion, or a public post. Oriel did not open a card. Nothing was sent or spent."
      : spokenSameMentionStepsCopy(spoken.action, draft.handoffRules ?? []);
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

function applySpokenSameNotMention(state: AppState, raw: string, spoken: SpokenSameNotMention, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply =
    spoken.kind === "reject"
      ? "That sentence does not name two different steps. Oriel did not open a card. Nothing was sent or spent."
      : spokenSameNotMentionCopy(spoken.action, spoken.other, draft.handoffRules ?? []);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, spoken.kind === "reject" ? "rule_ignored" : "rule_read", reply, deps);
  return draft;
}

function applySpokenSameMention(state: AppState, raw: string, spoken: SpokenSameMention, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply =
    spoken.kind === "reject"
      ? "That sentence does not name two different steps. Oriel did not open a card. Nothing was sent or spent."
      : spokenSameMentionCopy(spoken.action, spoken.other, draft.handoffRules ?? []);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, spoken.kind === "reject" ? "rule_ignored" : "rule_read", reply, deps);
  return draft;
}

function applySpokenStepNotMention(
  state: AppState,
  raw: string,
  spoken: SpokenStepNotMention,
  deps: Deps,
): AppState {
  const draft = structuredClone(state);
  const reply =
    spoken.kind === "reject"
      ? "That sentence does not name a send, a payment, a deletion, or a public post. Oriel did not open a card. Nothing was sent or spent."
      : spokenStepNotMentionCopy(
          spoken.action,
          spoken.phrase,
          (draft.handoffRules ?? []).find((rule) => rule.action === spoken.action),
        );
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, spoken.kind === "reject" ? "rule_ignored" : "rule_read", reply, deps);
  return draft;
}

function applySpokenStepMention(
  state: AppState,
  raw: string,
  spoken: SpokenStepMention,
  deps: Deps,
): AppState {
  const draft = structuredClone(state);
  const reply =
    spoken.kind === "reject"
      ? "That sentence does not name a send, a payment, a deletion, or a public post. Oriel did not open a card. Nothing was sent or spent."
      : spokenStepMentionCopy(
          spoken.action,
          spoken.phrase,
          (draft.handoffRules ?? []).find((rule) => rule.action === spoken.action),
        );
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, spoken.kind === "reject" ? "rule_ignored" : "rule_read", reply, deps);
  return draft;
}

function applySpokenNotMention(
  state: AppState,
  raw: string,
  spoken: Extract<SpokenNotMention, { kind: "ask" }>,
  deps: Deps,
): AppState {
  const draft = structuredClone(state);
  const reply = spokenNotMentionCopy(spoken.phrase, draft.handoffRules ?? []);
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

function applySpokenUnsharedWith(state: AppState, raw: string, spoken: SpokenUnsharedWith, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply =
    spoken.kind === "reject"
      ? "That sentence does not name a send, a payment, a deletion, or a public post. Oriel did not open a card. Nothing was sent or spent."
      : spokenUnsharedWithCopy(spoken.action, draft.handoffRules ?? []);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, spoken.kind === "reject" ? "rule_ignored" : "rule_read", reply, deps);
  return draft;
}

function applySpokenSharedWith(state: AppState, raw: string, spoken: SpokenSharedWith, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply =
    spoken.kind === "reject"
      ? "That sentence does not name a send, a payment, a deletion, or a public post. Oriel did not open a card. Nothing was sent or spent."
      : spokenSharedWithCopy(spoken.action, draft.handoffRules ?? []);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, spoken.kind === "reject" ? "rule_ignored" : "rule_read", reply, deps);
  return draft;
}

function applySpokenNotShareWith(state: AppState, raw: string, spoken: SpokenNotShareWith, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply =
    spoken.kind === "reject"
      ? "That sentence does not name two different steps. Oriel did not open a card. Nothing was sent or spent."
      : spokenNotShareWithCopy(spoken.action, spoken.other, draft.handoffRules ?? []);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, spoken.kind === "reject" ? "rule_ignored" : "rule_read", reply, deps);
  return draft;
}

function applySpokenShareWith(state: AppState, raw: string, spoken: SpokenShareWith, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply =
    spoken.kind === "reject"
      ? "That sentence does not name two different steps. Oriel did not open a card. Nothing was sent or spent."
      : spokenShareWithCopy(spoken.action, spoken.other, draft.handoffRules ?? []);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, spoken.kind === "reject" ? "rule_ignored" : "rule_read", reply, deps);
  return draft;
}

function applySpokenNotShare(state: AppState, raw: string, spoken: SpokenNotShare, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply =
    spoken.kind === "reject"
      ? "That sentence does not name a send, a payment, a deletion, or a public post. Oriel did not open a card. Nothing was sent or spent."
      : spokenNotShareCopy(spoken.action, draft.handoffRules ?? []);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, spoken.kind === "reject" ? "rule_ignored" : "rule_read", reply, deps);
  return draft;
}

function applySpokenNotSameWords(state: AppState, raw: string, spoken: SpokenNotSameWords, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply =
    spoken.kind === "reject"
      ? "That sentence does not name a send, a payment, a deletion, or a public post. Oriel did not open a card. Nothing was sent or spent."
      : spokenNotSameWordsCopy(spoken.action, draft.handoffRules ?? []);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, spoken.kind === "reject" ? "rule_ignored" : "rule_read", reply, deps);
  return draft;
}

function applySpokenSameWords(state: AppState, raw: string, spoken: SpokenSameWords, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply =
    spoken.kind === "reject"
      ? "That sentence does not name a send, a payment, a deletion, or a public post. Oriel did not open a card. Nothing was sent or spent."
      : spokenSameWordsCopy(spoken.action, draft.handoffRules ?? []);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, spoken.kind === "reject" ? "rule_ignored" : "rule_read", reply, deps);
  return draft;
}

function applySpokenShare(state: AppState, raw: string, spoken: SpokenShare, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply =
    spoken.kind === "reject"
      ? "That sentence does not name a send, a payment, a deletion, or a public post. Oriel did not open a card. Nothing was sent or spent."
      : spokenShareCopy(spoken.action, draft.handoffRules ?? []);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, spoken.kind === "reject" ? "rule_ignored" : "rule_read", reply, deps);
  return draft;
}

function applySpokenUnsharedSteps(state: AppState, raw: string, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply = spokenUnsharedStepsCopy(draft.handoffRules ?? []);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "rule_read", reply, deps);
  return draft;
}

function applySpokenNotMentionSame(state: AppState, raw: string, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply = spokenNotMentionSameCopy(draft.handoffRules ?? []);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "rule_read", reply, deps);
  return draft;
}

function applySpokenMentionSame(state: AppState, raw: string, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply = spokenMentionSameCopy(draft.handoffRules ?? []);
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

function applySpokenUnmentionedWords(state: AppState, raw: string, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply = spokenUnmentionedWordsCopy(draft.handoffRules ?? []);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "rule_read", reply, deps);
  return draft;
}

function applySpokenMentionedMore(state: AppState, raw: string, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply = spokenMentionedMoreCopy(draft.handoffRules ?? []);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "rule_read", reply, deps);
  return draft;
}

function applySpokenMentionedOnce(state: AppState, raw: string, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply = spokenMentionedOnceCopy(draft.handoffRules ?? []);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "rule_read", reply, deps);
  return draft;
}

function applySpokenMentionedOnly(state: AppState, raw: string, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply = spokenMentionedOnlyCopy(draft.handoffRules ?? []);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "rule_read", reply, deps);
  return draft;
}

function applySpokenMentionedWords(state: AppState, raw: string, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply = spokenMentionedWordsCopy(draft.handoffRules ?? []);
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

function applySpokenNotShareWordsWith(state: AppState, raw: string, spoken: SpokenNotShareWordsWith, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply =
    spoken.kind === "reject"
      ? "That sentence does not name two different steps. Oriel did not open a card. Nothing was sent or spent."
      : spokenNotShareWordsWithCopy(spoken.action, spoken.other, draft.handoffRules ?? []);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, spoken.kind === "reject" ? "rule_ignored" : "rule_read", reply, deps);
  return draft;
}

function applySpokenShareWordsWith(state: AppState, raw: string, spoken: SpokenShareWordsWith, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply =
    spoken.kind === "reject"
      ? "That sentence does not name two different steps. Oriel did not open a card. Nothing was sent or spent."
      : spokenShareWordsWithCopy(spoken.action, spoken.other, draft.handoffRules ?? []);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, spoken.kind === "reject" ? "rule_ignored" : "rule_read", reply, deps);
  return draft;
}

function applySpokenNotShareWords(state: AppState, raw: string, spoken: SpokenNotShareWords, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply =
    spoken.kind === "reject"
      ? "That sentence does not name a send, a payment, a deletion, or a public post. Oriel did not open a card. Nothing was sent or spent."
      : spokenNotShareWordsCopy(spoken.action, draft.handoffRules ?? []);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, spoken.kind === "reject" ? "rule_ignored" : "rule_read", reply, deps);
  return draft;
}

function applySpokenShareWords(state: AppState, raw: string, spoken: SpokenShareWords, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply =
    spoken.kind === "reject"
      ? "That sentence does not name a send, a payment, a deletion, or a public post. Oriel did not open a card. Nothing was sent or spent."
      : spokenShareWordsCopy(spoken.action, draft.handoffRules ?? []);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, spoken.kind === "reject" ? "rule_ignored" : "rule_read", reply, deps);
  return draft;
}

function applySpokenNotMentionWordsWith(state: AppState, raw: string, spoken: SpokenNotMentionWordsWith, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply =
    spoken.kind === "reject"
      ? "That sentence does not name two different steps. Oriel did not open a card. Nothing was sent or spent."
      : spokenNotMentionWordsWithCopy(spoken.action, spoken.other, draft.handoffRules ?? []);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, spoken.kind === "reject" ? "rule_ignored" : "rule_read", reply, deps);
  return draft;
}

function applySpokenMentionWordsWith(state: AppState, raw: string, spoken: SpokenMentionWordsWith, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply =
    spoken.kind === "reject"
      ? "That sentence does not name two different steps. Oriel did not open a card. Nothing was sent or spent."
      : spokenMentionWordsWithCopy(spoken.action, spoken.other, draft.handoffRules ?? []);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, spoken.kind === "reject" ? "rule_ignored" : "rule_read", reply, deps);
  return draft;
}

function applySpokenNotMentionWords(state: AppState, raw: string, spoken: SpokenNotMentionWords, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply =
    spoken.kind === "reject"
      ? "That sentence does not name a send, a payment, a deletion, or a public post. Oriel did not open a card. Nothing was sent or spent."
      : spokenNotMentionWordsCopy(spoken.action, draft.handoffRules ?? []);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, spoken.kind === "reject" ? "rule_ignored" : "rule_read", reply, deps);
  return draft;
}

function applySpokenMentionWords(state: AppState, raw: string, spoken: SpokenMentionWords, deps: Deps): AppState {
  const draft = structuredClone(state);
  const reply =
    spoken.kind === "reject"
      ? "That sentence does not name a send, a payment, a deletion, or a public post. Oriel did not open a card. Nothing was sent or spent."
      : spokenMentionWordsCopy(spoken.action, draft.handoffRules ?? []);
  pushMessage(draft, { role: "you", text: redactSecrets(raw) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, spoken.kind === "reject" ? "rule_ignored" : "rule_read", reply, deps);
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
  if (state.routines.length >= ROUTINE_CAP) {
    const draft = structuredClone(state);
    const spoken = routineCapCopy();
    pushMessage(draft, { role: "oriel", text: spoken }, deps);
    pushEvent(draft, goal.id, "routine_capped", spoken, deps);
    return draft;
  }
  const draft = structuredClone(state);
  const routine = {
    id: nid(draft, "routine"),
    name: (name?.trim() || (skill ? skill.name : titleFrom(goal.text))).slice(0, 80),
    instruction,
    cadence,
    createdAt: at(deps),
    lastRunAt: null,
    recentRuns: [],
    nextRunAt: nextInstant(cadence, deps.now()),
    paused: false,
    heldBack: [],
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

function rateReply(name: string, block: "routine" | "desk", another: boolean): string {
  return block === "routine" ? routineHourCopy(name, another) : deskHourCopy(name, another);
}

export function refuseRoutineRate(state: AppState, routineId: string, deps: Deps, heard?: string): AppState {
  const routine = state.routines.find((item) => item.id === routineId);
  if (!routine) throw new OrielError("That routine is not in the record.", 404);
  const block = routineRateBlock(state.routines, routineId, deps.now());
  if (!block) return state;
  const another = state.routines.some((item) => item.id !== routineId);
  const reply = rateReply(routine.name, block, another);
  const draft = structuredClone(state);
  if (heard) pushMessage(draft, { role: "you", text: redactSecrets(heard) }, deps);
  pushMessage(draft, { role: "oriel", text: reply }, deps);
  pushEvent(draft, null, "routine_rate", reply, deps);
  return draft;
}

export function stampRoutineRuns(state: AppState, routineId: string, count: number, deps: Deps): AppState {
  if (!Number.isInteger(count) || count < 1 || count > ROUTINE_HOUR_CAP) {
    throw new OrielError("A test stamp names how many runs to record, from 1 to 200.");
  }
  const draft = structuredClone(state);
  const routine = draft.routines.find((item) => item.id === routineId);
  if (!routine) throw new OrielError("That routine is not in the record.", 404);
  const now = deps.now().getTime();
  const stamps = [...(routine.recentRuns ?? [])];
  for (let i = 0; i < count; i += 1) stamps.push(new Date(now - i).toISOString());
  routine.recentRuns = rememberedRuns(stamps);
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
  if (routineRateBlock(state.routines, routineId, deps.now())) return refuseRoutineRate(state, routineId, deps);
  const next = await convene(
    state,
    routine.instruction,
    undefined,
    { ...deps, ...(via === "wake" ? { wakeFrom: routineId } : {}), running: true },
    undefined,
    via === "wake" ? "away" : "present",
  );
  const saved = next.routines.find((item) => item.id === routineId);
  if (saved) {
    const instant = at(deps);
    saved.lastRunAt = instant;
    saved.recentRuns = rememberedRuns([...(saved.recentRuns ?? []), instant]);
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
    .filter(
      (routine) =>
        routine.cadence !== "manual" &&
        routine.paused !== true &&
        routine.nextRunAt !== null &&
        routine.nextRunAt <= now,
    )
    .sort((a, b) => (a.nextRunAt ?? "").localeCompare(b.nextRunAt ?? ""));
  for (const routine of due) {
    if (routineRateBlock(swept.routines, routine.id, deps.now())) continue;
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
  const blocked = due.find((routine) => routineRateBlock(swept.routines, routine.id, deps.now()));
  if (!blocked) return swept;
  const block = routineRateBlock(swept.routines, blocked.id, deps.now());
  if (!block) return swept;
  const another = swept.routines.some((item) => item.id !== blocked.id);
  const reply = rateReply(blocked.name, block, another);
  if (swept.messages.at(-1)?.role === "oriel" && swept.messages.at(-1)?.text === reply) return swept;
  return refuseRoutineRate(swept, blocked.id, deps);
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
