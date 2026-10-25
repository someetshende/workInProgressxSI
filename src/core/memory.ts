import type { Cadence, Memory } from "./types.js";

const STOP = new Set([
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
  "Oriel",
  "Grok",
  "Dots",
  "Muse",
  "Please",
  "Thanks",
  "Thank",
  "Draft",
  "Send",
  "Email",
  "The",
  "This",
  "That",
  "And",
  "But",
]);

function addUnique(list: string[], line: string): void {
  const clean = line.replace(/\s+/g, " ").trim().replace(/[.,;:]+$/, "");
  if (!clean) return;
  if (list.some((item) => item.toLowerCase() === clean.toLowerCase())) return;
  if (list.some((item) => item.toLowerCase().includes(clean.toLowerCase()))) return;
  list.push(clean);
}

const NOT_A_PERSON = new Set(
  [...STOP].map((word) => word.toLowerCase()).concat(["the", "a", "an", "anyone", "them", "this", "that", "my", "our", "your", "it"]),
);

export function peopleIn(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(/\b(?:email|e-mail|tell|message|with)\s+([A-Za-z][a-z]{2,})\b/gi)) {
    const name = match[1];
    if (!name || NOT_A_PERSON.has(name.toLowerCase())) continue;
    if (name[0] !== name[0]?.toUpperCase()) continue;
    addUnique(found, name);
  }
  return found;
}

export function remember(memory: Memory, text: string): Memory {
  const preferences = [...memory.preferences];
  const people = [...memory.people];
  for (const match of text.matchAll(/\bi prefer\s+[^.?!\n]+/gi)) {
    if (match[0]) addUnique(preferences, match[0]);
  }
  for (const match of text.matchAll(/\b(?:don't|do not) ever\s+[^.?!\n]+/gi)) {
    if (match[0]) addUnique(preferences, match[0]);
  }
  for (const match of text.matchAll(/\bremember that\s+([^.?!\n]+)/gi)) {
    const clause = match[1]?.trim();
    if (!clause) continue;
    const covered = preferences.some(
      (item) => item.toLowerCase().includes(clause.toLowerCase()) || clause.toLowerCase().includes(item.toLowerCase()),
    );
    if (!covered) addUnique(preferences, `Remember that ${clause}`);
  }
  for (const name of peopleIn(text)) addUnique(people, name);
  return { preferences, people };
}

export function isMemoryOnly(text: string): boolean {
  if (!/^(please\s+)?(remember that|i prefer|don't ever|do not ever)\b/i.test(text)) return false;
  if (/\b(compare|draft|email|plan|fix|schedule|summarize|research|buy|delete|publish|convene)\b/i.test(text)) {
    return false;
  }
  return text.trim().split(/\s+/).length < 16;
}

export function isMemoryQuery(text: string): boolean {
  return /^(what do you remember|what did i ask you to remember|what should you keep|my preferences)\b/i.test(
    text.trim(),
  );
}

export function recall(memory: Memory): string {
  if (!memory.preferences.length && !memory.people.length) {
    return "Nothing yet. Tell me what to keep, or ask for the work directly.";
  }
  const lines = ["You asked me to keep:"];
  for (const preference of memory.preferences) lines.push(`- ${preference}`);
  if (memory.people.length) lines.push(`People named so far: ${memory.people.join(", ")}.`);
  return lines.join("\n");
}

export function extractLoops(text: string): string[] {
  const loops: string[] = [];
  for (const match of text.matchAll(/\b(?:keep an eye on|follow up on|remind me about)\s+([^.\n]+)/gi)) {
    const subject = match[1]?.trim().replace(/[.,;:]+$/, "");
    if (subject) loops.push(`Watch: ${subject}`);
  }
  return loops;
}

export function isBareDecision(text: string): "approve" | "deny" | "task" | null {
  const value = text.trim();
  if (/^(please\s+)?allow(?:\s+this)?\s+for\s+this\s+task\??$/i.test(value)) return "task";
  if (/^(approve|approved|yes release)$/i.test(value)) return "approve";
  if (/^(deny|denied|not now)$/i.test(value)) return "deny";
  return null;
}

export function isStopTask(text: string): boolean {
  const value = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  return /^(?:please\s+)?stop this task$/i.test(value);
}

export function loosensStopTask(text: string): boolean {
  const value = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  if (!/^(?:please\s+)?stop this task\b/i.test(value)) return false;
  return /without asking|always[-\s]?allow|allow automatically|allow for this site|take action without/i.test(value);
}

const ROUTINE_LOOSEN = /without asking|always[-\s]?allow|allow automatically|allow for this site|take action without/i;

function tidySentence(text: string): string {
  return text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
}

export function routineStopName(text: string): string | null {
  const value = tidySentence(text);
  const match = /^(?:please\s+)?stop the (.+) routine$/i.exec(value);
  if (!match) return null;
  const name = (match[1] ?? "").trim().replace(/^["“']+|["”']+$/g, "").replace(/\s+/g, " ").trim();
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensStopRoutine(text: string): boolean {
  const value = tidySentence(text);
  if (routineStopName(text)) return false;
  if (!/^(?:please\s+)?stop the .+ routine\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const SCHEDULE_READ = /^(?:please,?\s+)?what(?:['’]s| is) scheduled$/i;

export function isScheduleRead(text: string): boolean {
  return SCHEDULE_READ.test(tidySentence(text));
}

export function loosensScheduleRead(text: string): boolean {
  const value = tidySentence(text);
  if (isScheduleRead(text)) return false;
  if (!/^(?:please,?\s+)?what(?:['’]s| is) scheduled\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const PAUSED_READ = /^(?:please,?\s+)?which routines are paused$/i;

export function isPausedRead(text: string): boolean {
  return PAUSED_READ.test(tidySentence(text));
}

export function loosensPausedRead(text: string): boolean {
  const value = tidySentence(text);
  if (isPausedRead(text)) return false;
  if (!/^(?:please,?\s+)?which routines are paused\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ENABLED_READ = /^(?:please,?\s+)?which routines are enabled$/i;

export function isEnabledRead(text: string): boolean {
  return ENABLED_READ.test(tidySentence(text));
}

export function loosensEnabledRead(text: string): boolean {
  const value = tidySentence(text);
  if (isEnabledRead(text)) return false;
  if (!/^(?:please,?\s+)?which routines are enabled\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ACTIVE_READ = /^(?:please,?\s+)?which routines are active$/i;

export function isActiveRead(text: string): boolean {
  return ACTIVE_READ.test(tidySentence(text));
}

export function loosensActiveRead(text: string): boolean {
  const value = tidySentence(text);
  if (isActiveRead(text)) return false;
  if (!/^(?:please,?\s+)?which routines are active\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const DISABLED_READ = /^(?:please,?\s+)?which routines are disabled$/i;

export function isDisabledRead(text: string): boolean {
  return DISABLED_READ.test(tidySentence(text));
}

export function loosensDisabledRead(text: string): boolean {
  const value = tidySentence(text);
  if (isDisabledRead(text)) return false;
  if (!/^(?:please,?\s+)?which routines are disabled\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_PAUSED_ASK = /^(?:please,?\s+)?is the (.+) routine paused$/i;

export function routinePausedAskName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_PAUSED_ASK.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutinePausedAsk(text: string): boolean {
  const value = tidySentence(text);
  if (routinePausedAskName(text)) return false;
  if (!/^(?:please,?\s+)?is the .+ routine paused\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_ACTIVE_ASK = /^(?:please,?\s+)?is the (.+) routine active$/i;

export function routineActiveAskName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_ACTIVE_ASK.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineActiveAsk(text: string): boolean {
  const value = tidySentence(text);
  if (routineActiveAskName(text)) return false;
  if (!/^(?:please,?\s+)?is the .+ routine active\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_ENABLED_ASK = /^(?:please,?\s+)?is the (.+) routine enabled$/i;

export function routineEnabledAskName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_ENABLED_ASK.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineEnabledAsk(text: string): boolean {
  const value = tidySentence(text);
  if (routineEnabledAskName(text)) return false;
  if (!/^(?:please,?\s+)?is the .+ routine enabled\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_DISABLED_ASK = /^(?:please,?\s+)?is the (.+) routine disabled$/i;

export function routineDisabledAskName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_DISABLED_ASK.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineDisabledAsk(text: string): boolean {
  const value = tidySentence(text);
  if (routineDisabledAskName(text)) return false;
  if (!/^(?:please,?\s+)?is the .+ routine disabled\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_ZONE = /^(?:please,?\s+)?what time zone is the (.+) routine using$/i;

export function routineZoneName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_ZONE.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineZone(text: string): boolean {
  const value = tidySentence(text);
  if (routineZoneName(text)) return false;
  if (!/^(?:please,?\s+)?what time zone is the .+ routine using\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_OWNER = /^(?:please,?\s+)?which bot owns the (.+) routine$/i;

export function routineOwnerName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_OWNER.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineOwner(text: string): boolean {
  const value = tidySentence(text);
  if (routineOwnerName(text)) return false;
  if (!/^(?:please,?\s+)?which bot owns the .+ routine\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_PLUGIN = /^(?:please,?\s+)?which plugins does the (.+) routine need$/i;

export function routinePluginName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_PLUGIN.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutinePlugin(text: string): boolean {
  const value = tidySentence(text);
  if (routinePluginName(text)) return false;
  if (!/^(?:please,?\s+)?which plugins does the .+ routine need\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_SOURCE = /^(?:please,?\s+)?can the (.+) routine reach its source$/i;

export function routineSourceName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_SOURCE.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineSource(text: string): boolean {
  const value = tidySentence(text);
  if (routineSourceName(text)) return false;
  if (!/^(?:please,?\s+)?can the .+ routine reach its source\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_USAGE = /^(?:please,?\s+)?has usage been paused for the (.+) routine$/i;

export function routineUsageName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_USAGE.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineUsage(text: string): boolean {
  const value = tidySentence(text);
  if (routineUsageName(text)) return false;
  if (!/^(?:please,?\s+)?has usage been paused for the .+ routine\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_FAILURE = /^(?:please,?\s+)?what failure does the (.+) routine show$/i;

export function routineFailureName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_FAILURE.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineFailure(text: string): boolean {
  const value = tidySentence(text);
  if (routineFailureName(text)) return false;
  if (!/^(?:please,?\s+)?what failure does the .+ routine show\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_CHANNEL = /^(?:please,?\s+)?which channel starts the (.+) routine$/i;

export function routineChannelName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_CHANNEL.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineChannel(text: string): boolean {
  const value = tidySentence(text);
  if (routineChannelName(text)) return false;
  if (!/^(?:please,?\s+)?which channel starts the .+ routine\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_REPOSITORY = /^(?:please,?\s+)?which repository starts the (.+) routine$/i;

export function routineRepositoryName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_REPOSITORY.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineRepository(text: string): boolean {
  const value = tidySentence(text);
  if (routineRepositoryName(text)) return false;
  if (!/^(?:please,?\s+)?which repository starts the .+ routine\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_MATCHING = /^(?:please,?\s+)?which matching rule starts the (.+) routine$/i;

export function routineMatchingName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_MATCHING.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineMatching(text: string): boolean {
  const value = tidySentence(text);
  if (routineMatchingName(text)) return false;
  if (!/^(?:please,?\s+)?which matching rule starts the .+ routine\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_ASK_FIRST = /^(?:please,?\s+)?which ask-first rule blocks the (.+) routine$/i;

export function routineAskFirstName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_ASK_FIRST.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineAskFirst(text: string): boolean {
  const value = tidySentence(text);
  if (routineAskFirstName(text)) return false;
  if (!/^(?:please,?\s+)?which ask-first rule blocks the .+ routine\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_ALLOW_AUTO = /^(?:please,?\s+)?which allow-automatically rule covers the (.+) routine$/i;

export function routineAllowAutoName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_ALLOW_AUTO.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineAllowAuto(text: string): boolean {
  const value = tidySentence(text);
  if (routineAllowAutoName(text)) return false;
  if (!/^(?:please,?\s+)?which allow-automatically rule covers the .+ routine\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_TEAM_RULE = /^(?:please,?\s+)?which team rule blocks the (.+) routine$/i;

export function routineTeamRuleName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_TEAM_RULE.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineTeamRule(text: string): boolean {
  const value = tidySentence(text);
  if (routineTeamRuleName(text)) return false;
  if (!/^(?:please,?\s+)?which team rule blocks the .+ routine\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_LOCKED_TEAM_RULE = /^(?:please,?\s+)?is the team rule for the (.+) routine locked$/i;

export function routineLockedTeamRuleName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_LOCKED_TEAM_RULE.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineLockedTeamRule(text: string): boolean {
  const value = tidySentence(text);
  if (routineLockedTeamRuleName(text)) return false;
  if (!/^(?:please,?\s+)?is the team rule for the .+ routine\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_LOCAL_COMPUTER = /^(?:please,?\s+)?is local computer work refused for the (.+) routine$/i;

export function routineLocalComputerName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_LOCAL_COMPUTER.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineLocalComputer(text: string): boolean {
  const value = tidySentence(text);
  if (routineLocalComputerName(text)) return false;
  if (!/^(?:please,?\s+)?is local computer work refused for the .+ routine\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_CLOUD_COMPUTER = /^(?:please,?\s+)?is cloud computer work refused for the (.+) routine$/i;

export function routineCloudComputerName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_CLOUD_COMPUTER.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineCloudComputer(text: string): boolean {
  const value = tidySentence(text);
  if (routineCloudComputerName(text)) return false;
  if (!/^(?:please,?\s+)?is cloud computer work refused for the .+ routine\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_REACHABLE_COMPUTER = /^(?:please,?\s+)?can the (.+) routine reach its computer$/i;

export function routineReachableComputerName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_REACHABLE_COMPUTER.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineReachableComputer(text: string): boolean {
  const value = tidySentence(text);
  if (routineReachableComputerName(text)) return false;
  if (!/^(?:please,?\s+)?can the .+ routine reach its computer\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_STUCK_STATE = /^(?:please,?\s+)?is the (.+) routine stuck$/i;

export function routineStuckStateName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_STUCK_STATE.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineStuckState(text: string): boolean {
  const value = tidySentence(text);
  if (routineStuckStateName(text)) return false;
  if (!/^(?:please,?\s+)?is the .+ routine stuck\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_LOGIN_WAIT = /^(?:please,?\s+)?is the (.+) routine waiting on a login$/i;

export function routineLoginWaitName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_LOGIN_WAIT.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineLoginWait(text: string): boolean {
  const value = tidySentence(text);
  if (routineLoginWaitName(text)) return false;
  if (!/^(?:please,?\s+)?is the .+ routine waiting on a login\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_PLUGIN_AUTH = /^(?:please,?\s+)?is the plugin for the (.+) routine authenticated$/i;

export function routinePluginAuthName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_PLUGIN_AUTH.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutinePluginAuth(text: string): boolean {
  const value = tidySentence(text);
  if (routinePluginAuthName(text)) return false;
  if (!/^(?:please,?\s+)?is the plugin for the .+ routine authenticated\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_READABLE_ATTACHMENT = /^(?:please,?\s+)?can the (.+) routine read its attachment$/i;

export function routineReadableAttachmentName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_READABLE_ATTACHMENT.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineReadableAttachment(text: string): boolean {
  const value = tidySentence(text);
  if (routineReadableAttachmentName(text)) return false;
  if (!/^(?:please,?\s+)?can the .+ routine read its attachment\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_BLOCKED_APPROVAL = /^(?:please,?\s+)?is the approval for the (.+) routine blocked$/i;

export function routineBlockedApprovalName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_BLOCKED_APPROVAL.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineBlockedApproval(text: string): boolean {
  const value = tidySentence(text);
  if (routineBlockedApprovalName(text)) return false;
  if (!/^(?:please,?\s+)?is the approval for the .+ routine blocked\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_COMPUTER_SETUP = /^(?:please,?\s+)?is the computer for the (.+) routine still setting up$/i;

export function routineComputerSetupName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_COMPUTER_SETUP.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineComputerSetup(text: string): boolean {
  const value = tidySentence(text);
  if (routineComputerSetupName(text)) return false;
  if (!/^(?:please,?\s+)?is the computer for the .+ routine still setting up\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_APP_UPDATE = /^(?:please,?\s+)?is an app update waiting for the (.+) routine$/i;

export function routineAppUpdateName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_APP_UPDATE.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineAppUpdate(text: string): boolean {
  const value = tidySentence(text);
  if (routineAppUpdateName(text)) return false;
  if (!/^(?:please,?\s+)?is an app update waiting for the .+ routine\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_OPEN_SIGN_IN = /^(?:please,?\s+)?is sign-in still open for the (.+) routine$/i;

export function routineOpenSignInName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_OPEN_SIGN_IN.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineOpenSignIn(text: string): boolean {
  const value = tidySentence(text);
  if (routineOpenSignInName(text)) return false;
  if (!/^(?:please,?\s+)?is sign-in still open for the .+ routine\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_BOT_QUIET = /^(?:please,?\s+)?is @bot quiet for the (.+) routine$/i;

export function routineBotQuietName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_BOT_QUIET.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineBotQuiet(text: string): boolean {
  const value = tidySentence(text);
  if (routineBotQuietName(text)) return false;
  if (!/^(?:please,?\s+)?is @bot quiet for the .+ routine\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_SUPPORT_NOTE = /^(?:please,?\s+)?is a support note ready for the (.+) routine$/i;

export function routineSupportNoteName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_SUPPORT_NOTE.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineSupportNote(text: string): boolean {
  const value = tidySentence(text);
  if (routineSupportNoteName(text)) return false;
  if (!/^(?:please,?\s+)?is a support note ready for the .+ routine\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_RETRY_RESULT = /^(?:please,?\s+)?did a retry change the result for the (.+) routine$/i;

export function routineRetryResultName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_RETRY_RESULT.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineRetryResult(text: string): boolean {
  const value = tidySentence(text);
  if (routineRetryResultName(text)) return false;
  if (!/^(?:please,?\s+)?did a retry change the result for the .+ routine\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_DISCONNECTED_APP = /^(?:please,?\s+)?is the app disconnected for the (.+) routine$/i;

export function routineDisconnectedAppName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_DISCONNECTED_APP.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineDisconnectedApp(text: string): boolean {
  const value = tidySentence(text);
  if (routineDisconnectedAppName(text)) return false;
  if (!/^(?:please,?\s+)?is the app disconnected for the .+ routine\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_LEAST_DESTRUCTIVE = /^(?:please,?\s+)?did the (.+) routine start with the least destructive step$/i;

export function routineLeastDestructiveName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_LEAST_DESTRUCTIVE.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineLeastDestructive(text: string): boolean {
  const value = tidySentence(text);
  if (routineLeastDestructiveName(text)) return false;
  if (!/^(?:please,?\s+)?did the .+ routine start with the least destructive step\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_SCREEN_TASK = /^(?:please,?\s+)?is a computer-use task already active for the (.+) routine$/i;

export function routineScreenTaskName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_SCREEN_TASK.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineScreenTask(text: string): boolean {
  const value = tidySentence(text);
  if (routineScreenTaskName(text)) return false;
  if (!/^(?:please,?\s+)?is a computer-use task already active for the .+ routine\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_FINISH_BEFORE_REBUILD = /^(?:please,?\s+)?should recovery wait until the (.+) routine finishes computer work$/i;

export function routineFinishBeforeRebuildName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_FINISH_BEFORE_REBUILD.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineFinishBeforeRebuild(text: string): boolean {
  const value = tidySentence(text);
  if (routineFinishBeforeRebuildName(text)) return false;
  if (!/^(?:please,?\s+)?should recovery wait until the .+ routine finishes computer work\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_KEPT_CONVERSATION = /^(?:please,?\s+)?do conversations for the (.+) routine survive a reset$/i;

export function routineKeptConversationName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_KEPT_CONVERSATION.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineKeptConversation(text: string): boolean {
  const value = tidySentence(text);
  if (routineKeptConversationName(text)) return false;
  if (!/^(?:please,?\s+)?do conversations for the .+ routine survive a reset\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_KEPT_FILE = /^(?:please,?\s+)?does the computer image for the (.+) routine keep logins$/i;

export function routineKeptFileName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_KEPT_FILE.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineKeptFile(text: string): boolean {
  const value = tidySentence(text);
  if (routineKeptFileName(text)) return false;
  if (!/^(?:please,?\s+)?does the computer image for the .+ routine keep logins\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_SOFTWARE_REFRESH = /^(?:please,?\s+)?does a software update for the (.+) routine keep installed apps$/i;

export function routineSoftwareRefreshName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_SOFTWARE_REFRESH.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineSoftwareRefresh(text: string): boolean {
  const value = tidySentence(text);
  if (routineSoftwareRefreshName(text)) return false;
  if (!/^(?:please,?\s+)?does a software update for the .+ routine keep installed apps\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_SCRATCH_FOLDER = /^(?:please,?\s+)?does a normal recovery for the (.+) routine replace uncommitted state$/i;

export function routineScratchFolderName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_SCRATCH_FOLDER.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineScratchFolder(text: string): boolean {
  const value = tidySentence(text);
  if (routineScratchFolderName(text)) return false;
  if (!/^(?:please,?\s+)?does a normal recovery for the .+ routine replace uncommitted state\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_WORK_SURFACE = /^(?:please,?\s+)?is a screen for the (.+) routine a separate security boundary$/i;

export function routineWorkSurfaceName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_WORK_SURFACE.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineWorkSurface(text: string): boolean {
  const value = tidySentence(text);
  if (routineWorkSurfaceName(text)) return false;
  if (!/^(?:please,?\s+)?is a screen for the .+ routine a separate security boundary\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_PRIVATE_HOST = /^(?:please,?\s+)?is isolation between users strict for the (.+) routine$/i;

export function routinePrivateHostName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_PRIVATE_HOST.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutinePrivateHost(text: string): boolean {
  const value = tidySentence(text);
  if (routinePrivateHostName(text)) return false;
  if (!/^(?:please,?\s+)?is isolation between users strict for the .+ routine\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_GUEST_SLICE = /^(?:please,?\s+)?does the (.+) routine keep its own kernel$/i;

export function routineGuestSliceName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_GUEST_SLICE.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineGuestSlice(text: string): boolean {
  const value = tidySentence(text);
  if (routineGuestSliceName(text)) return false;
  if (!/^(?:please,?\s+)?does the .+ routine keep its own kernel\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_PERSONA_LEDGER = /^(?:please,?\s+)?does the (.+) routine isolate workspaces, not compute$/i;

export function routinePersonaLedgerName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_PERSONA_LEDGER.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutinePersonaLedger(text: string): boolean {
  const value = tidySentence(text);
  if (routinePersonaLedgerName(text)) return false;
  if (!/^(?:please,?\s+)?does the .+ routine isolate workspaces, not compute\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_COMMON_TRAY = /^(?:please,?\s+)?is a login or file for the (.+) routine available to every bot$/i;

export function routineCommonTrayName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_COMMON_TRAY.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineCommonTray(text: string): boolean {
  const value = tidySentence(text);
  if (routineCommonTrayName(text)) return false;
  if (!/^(?:please,?\s+)?is a login or file for the .+ routine available to every bot\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_SOLO_ROSTER = /^(?:please,?\s+)?does the (.+) routine need its own cursor user for a separate computer and credential set$/i;

export function routineSoloRosterName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_SOLO_ROSTER.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineSoloRoster(text: string): boolean {
  const value = tidySentence(text);
  if (routineSoloRosterName(text)) return false;
  if (!/^(?:please,?\s+)?does the .+ routine need its own cursor user for a separate computer and credential set\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_TEAM_BENCH = /^(?:please,?\s+)?does the (.+) routine share a cloud-hosted bot with everyone on the team$/i;

export function routineTeamBenchName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_TEAM_BENCH.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineTeamBench(text: string): boolean {
  const value = tidySentence(text);
  if (routineTeamBenchName(text)) return false;
  if (!/^(?:please,?\s+)?does the .+ routine share a cloud-hosted bot with everyone on the team\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_GROUP_COMPUTER = /^(?:please,?\s+)?does the (.+) routine use one computer of its own in slack channels, threads, group dms, and group chats$/i;

export function routineGroupComputerName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_GROUP_COMPUTER.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineGroupComputer(text: string): boolean {
  const value = tidySentence(text);
  if (routineGroupComputerName(text)) return false;
  if (!/^(?:please,?\s+)?does the .+ routine use one computer of its own in slack channels, threads, group dms, and group chats\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_DIRECT_DESK = /^(?:please,?\s+)?does the (.+) routine work on that member's computer in that member's own chat or slack dm$/i;

export function routineDirectDeskName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_DIRECT_DESK.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineDirectDesk(text: string): boolean {
  const value = tidySentence(text);
  if (routineDirectDeskName(text)) return false;
  if (!/^(?:please,?\s+)?does the .+ routine work on that member's computer in that member's own chat or slack dm\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}


const ROUTINE_ASKED_METER = /^(?:please,?\s+)?does the (.+) routine use that member's connected accounts after asking and that member's grok bot usage$/i;

export function routineAskedMeterName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_ASKED_METER.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineAskedMeter(text: string): boolean {
  const value = tidySentence(text);
  if (routineAskedMeterName(text)) return false;
  if (!/^(?:please,?\s+)?does the .+ routine use that member's connected accounts after asking and that member's grok bot usage\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_SHARED_KIT = /^(?:please,?\s+)?does the (.+) routine make secrets, apps, and files the owner or a manager adds to a team bot available in every teammate's chat$/i;

export function routineSharedKitName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_SHARED_KIT.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineSharedKit(text: string): boolean {
  const value = tidySentence(text);
  if (routineSharedKitName(text)) return false;
  if (!/^(?:please,?\s+)?does the .+ routine make secrets, apps, and files the owner or a manager adds to a team bot available in every teammate's chat\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_SEALED_CHAT = /^(?:please,?\s+)?does the (.+) routine keep each member's chat private, including from the owner and the bot's managers$/i;

export function routineSealedChatName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_SEALED_CHAT.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineSealedChat(text: string): boolean {
  const value = tidySentence(text);
  if (routineSealedChatName(text)) return false;
  if (!/^(?:please,?\s+)?does the .+ routine keep each member's chat private, including from the owner and the bot's managers\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_DELEGATED_LANE = /^(?:please,?\s+)?does the (.+) routine run delegated work on separate computers under your existing cloud agent controls$/i;

export function routineDelegatedLaneName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_DELEGATED_LANE.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineDelegatedLane(text: string): boolean {
  const value = tidySentence(text);
  if (routineDelegatedLaneName(text)) return false;
  if (!/^(?:please,?\s+)?does the .+ routine run delegated work on separate computers under your existing cloud agent controls\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_DEFAULT_SWITCH = /^(?:please,?\s+)?does the (.+) routine keep the cloud agents switch on the grok bot page for the whole team and on by default$/i;

export function routineDefaultSwitchName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_DEFAULT_SWITCH.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineDefaultSwitch(text: string): boolean {
  const value = tidySentence(text);
  if (routineDefaultSwitchName(text)) return false;
  if (!/^(?:please,?\s+)?does the .+ routine keep the cloud agents switch on the grok bot page for the whole team and on by default\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_REST_LATCH = /^(?:please,?\s+)?does the (.+) routine turn it off when your team does not need delegation$/i;

export function routineRestLatchName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_REST_LATCH.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineRestLatch(text: string): boolean {
  const value = tidySentence(text);
  if (routineRestLatchName(text)) return false;
  if (!/^(?:please,?\s+)?does the .+ routine turn it off when your team does not need delegation\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_SPAWN_HATCH = /^(?:please,?\s+)?does the (.+) routine say admins can disable spawning$/i;

export function routineSpawnHatchName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_SPAWN_HATCH.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineSpawnHatch(text: string): boolean {
  const value = tidySentence(text);
  if (routineSpawnHatchName(text)) return false;
  if (!/^(?:please,?\s+)?does the .+ routine say admins can disable spawning\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_QUIET_GATE = /^(?:please,?\s+)?does the (.+) routine say to disable cloud agent spawning if you do not need delegation$/i;

export function routineQuietGateName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_QUIET_GATE.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineQuietGate(text: string): boolean {
  const value = tidySentence(text);
  if (routineQuietGateName(text)) return false;
  if (!/^(?:please,?\s+)?does the .+ routine say to disable cloud agent spawning if you do not need delegation\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_PUBLIC_VEIL = /^(?:please,?\s+)?does the (.+) routine say to keep public template sharing off unless members should publish bot templates outside the team$/i;

export function routinePublicVeilName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_PUBLIC_VEIL.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutinePublicVeil(text: string): boolean {
  const value = tidySentence(text);
  if (routinePublicVeilName(text)) return false;
  if (!/^(?:please,?\s+)?does the .+ routine say to keep public template sharing off unless members should publish bot templates outside the team\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}


const ROUTINE_SERVER_RING = /^(?:please,?\s+)?does the (.+) routine say that off keeps sharing team-only, including for templates that are already public$/i;

export function routineServerRingName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_SERVER_RING.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineServerRing(text: string): boolean {
  const value = tidySentence(text);
  if (routineServerRingName(text)) return false;
  if (!/^(?:please,?\s+)?does the .+ routine say that off keeps sharing team-only, including for templates that are already public\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_PLAN_NOTCH = /^(?:please,?\s+)?does the (.+) routine say that enterprise teams start with public sharing off and other teams start with it allowed$/i;

export function routinePlanNotchName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_PLAN_NOTCH.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutinePlanNotch(text: string): boolean {
  const value = tidySentence(text);
  if (routinePlanNotchName(text)) return false;
  if (!/^(?:please,?\s+)?does the .+ routine say that enterprise teams start with public sharing off and other teams start with it allowed\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_MEMBER_CEILING = /^(?:please,?\s+)?does the (.+) routine say to set execution on local computer to never allow unless bots need to act on member machines$/i;

export function routineMemberCeilingName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_MEMBER_CEILING.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineMemberCeiling(text: string): boolean {
  const value = tidySentence(text);
  if (routineMemberCeilingName(text)) return false;
  if (!/^(?:please,?\s+)?does the .+ routine say to set execution on local computer to never allow unless bots need to act on member machines\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_CHOICE_LATCH = /^(?:please,?\s+)?does the (.+) routine say that the default leaves the choice to each member$/i;

export function routineChoiceLatchName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_CHOICE_LATCH.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineChoiceLatch(text: string): boolean {
  const value = tidySentence(text);
  if (routineChoiceLatchName(text)) return false;
  if (!/^(?:please,?\s+)?does the .+ routine say that the default leaves the choice to each member\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_LOCAL_SHUTTER = /^(?:please,?\s+)?does the (.+) routine say that ask every time makes every local task ask for approval and never allow turns local execution off for the whole team$/i;

export function routineLocalShutterName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_LOCAL_SHUTTER.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineLocalShutter(text: string): boolean {
  const value = tidySentence(text);
  if (routineLocalShutterName(text)) return false;
  if (!/^(?:please,?\s+)?does the .+ routine say that ask every time makes every local task ask for approval and never allow turns local execution off for the whole team\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_STRICTER_KEEP = /^(?:please,?\s+)?does the (.+) routine say that a member's own setting still applies when it is stricter than the team's$/i;

export function routineStricterKeepName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_STRICTER_KEEP.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineStricterKeep(text: string): boolean {
  const value = tidySentence(text);
  if (routineStricterKeepName(text)) return false;
  if (!/^(?:please,?\s+)?does the .+ routine say that a member's own setting still applies when it is stricter than the team's\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_REASON_BAR = /^(?:please,?\s+)?does the (.+) routine say to pick never allow unless bots have a specific reason to work on member machines$/i;

export function routineReasonBarName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_REASON_BAR.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineReasonBar(text: string): boolean {
  const value = tidySentence(text);
  if (routineReasonBarName(text)) return false;
  if (!/^(?:please,?\s+)?does the .+ routine say to pick never allow unless bots have a specific reason to work on member machines\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_HABIT_ASK = /^(?:please,?\s+)?does the (.+) routine say that the default leaves the choice to each member, whose own setting defaults to asking before every task$/i;

export function routineHabitAskName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_HABIT_ASK.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineHabitAsk(text: string): boolean {
  const value = tidySentence(text);
  if (routineHabitAskName(text)) return false;
  if (!/^(?:please,?\s+)?does the .+ routine say that the default leaves the choice to each member, whose own setting defaults to asking before every task\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}


const ROUTINE_OPTION_BLANK = /^(?:please,?\s+)?does the (.+) routine say that off disables the option in grok bot$/i;

export function routineOptionBlankName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_OPTION_BLANK.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineOptionBlank(text: string): boolean {
  const value = tidySentence(text);
  if (routineOptionBlankName(text)) return false;
  if (!/^(?:please,?\s+)?does the .+ routine say that off disables the option in grok bot\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_PAGE_HOME = /^(?:please,?\s+)?does the (.+) routine say that the switch is under bot computers on the grok bot page and is on by default$/i;

export function routinePageHomeName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_PAGE_HOME.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutinePageHome(text: string): boolean {
  const value = tidySentence(text);
  if (routinePageHomeName(text)) return false;
  if (!/^(?:please,?\s+)?does the .+ routine say that the switch is under bot computers on the grok bot page and is on by default\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_ROUTE_SPAN = /^(?:please,?\s+)?does the (.+) routine say that turning it off stops active routes within five minutes$/i;

export function routineRouteSpanName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_ROUTE_SPAN.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineRouteSpan(text: string): boolean {
  const value = tidySentence(text);
  if (routineRouteSpanName(text)) return false;
  if (!/^(?:please,?\s+)?does the .+ routine say that turning it off stops active routes within five minutes\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_RESTORE_LATCH = /^(?:please,?\s+)?does the (.+) routine say that turning it back on restores each member's previous choice$/i;

export function routineRestoreLatchName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_RESTORE_LATCH.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineRestoreLatch(text: string): boolean {
  const value = tidySentence(text);
  if (routineRestoreLatchName(text)) return false;
  if (!/^(?:please,?\s+)?does the .+ routine say that turning it back on restores each member's previous choice\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_SUDO_PERMIT = /^(?:please,?\s+)?does the (.+) routine say that it lets bots run commands as root on their own computer$/i;

export function routineSudoPermitName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_SUDO_PERMIT.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineSudoPermit(text: string): boolean {
  const value = tidySentence(text);
  if (routineSudoPermitName(text)) return false;
  if (!/^(?:please,?\s+)?does the .+ routine say that it lets bots run commands as root on their own computer\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_NEST_PAIR = /^(?:please,?\s+)?does the (.+) routine say that the switch is on by default and sits next to allow local egress routing in the bot computers section of the grok bot page$/i;

export function routineNestPairName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_NEST_PAIR.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineNestPair(text: string): boolean {
  const value = tidySentence(text);
  if (routineNestPairName(text)) return false;
  if (!/^(?:please,?\s+)?does the .+ routine say that the switch is on by default and sits next to allow local egress routing in the bot computers section of the grok bot page\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_COLD_START = /^(?:please,?\s+)?does the (.+) routine say that existing computers must be restarted before a change takes effect$/i;

export function routineColdStartName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_COLD_START.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineColdStart(text: string): boolean {
  const value = tidySentence(text);
  if (routineColdStartName(text)) return false;
  if (!/^(?:please,?\s+)?does the .+ routine say that existing computers must be restarted before a change takes effect\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_BANNER_CREST = /^(?:please,?\s+)?does the (.+) routine say that after some changes to team settings the grok bot page shows restart vms to apply changed settings at the top$/i;

export function routineBannerCrestName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_BANNER_CREST.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineBannerCrest(text: string): boolean {
  const value = tidySentence(text);
  if (routineBannerCrestName(text)) return false;
  if (!/^(?:please,?\s+)?does the .+ routine say that after some changes to team settings the grok bot page shows restart vms to apply changed settings at the top\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_FLEET_IMAGE = /^(?:please,?\s+)?does the (.+) routine say to select restart all vms, then recreate vms, to recreate the computer of every member of the team with the current team settings$/i;

export function routineFleetImageName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_FLEET_IMAGE.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineFleetImage(text: string): boolean {
  const value = tidySentence(text);
  if (routineFleetImageName(text)) return false;
  if (!/^(?:please,?\s+)?does the .+ routine say to select restart all vms, then recreate vms, to recreate the computer of every member of the team with the current team settings\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_PROGRESS_CARD = /^(?:please,?\s+)?does the (.+) routine say that the restart runs like any other recreate operation, with the same progress card and results, and the notice clears once it starts$/i;

export function routineProgressCardName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_PROGRESS_CARD.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineProgressCard(text: string): boolean {
  const value = tidySentence(text);
  if (routineProgressCardName(text)) return false;
  if (!/^(?:please,?\s+)?does the .+ routine say that the restart runs like any other recreate operation, with the same progress card and results, and the notice clears once it starts\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_EGRESS_PATH = /^(?:please,?\s+)?does the (.+) routine say to let members route grok bot's web traffic through their own computer$/i;

export function routineEgressPathName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_EGRESS_PATH.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineEgressPath(text: string): boolean {
  const value = tidySentence(text);
  if (routineEgressPathName(text)) return false;
  if (!/^(?:please,?\s+)?does the .+ routine say to let members route grok bot's web traffic through their own computer\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_WAKE = /^(?:please,?\s+)?when does the (.+) routine wake$/i;

export function routineWakeName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_WAKE.exec(value);
  if (!match) return null;
  const name = (match[1] ?? "").trim().replace(/^["“']+|["”']+$/g, "").replace(/\s+/g, " ").trim();
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineWake(text: string): boolean {
  const value = tidySentence(text);
  if (routineWakeName(text)) return false;
  if (!/^(?:please,?\s+)?when does the .+ routine wake\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_DO = /^(?:please,?\s+)?what does the (.+) routine do$/i;

export function routineDoName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_DO.exec(value);
  if (!match) return null;
  const name = (match[1] ?? "").trim().replace(/^["“']+|["”']+$/g, "").replace(/\s+/g, " ").trim();
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineDo(text: string): boolean {
  const value = tidySentence(text);
  if (routineDoName(text)) return false;
  if (!/^(?:please,?\s+)?what does the .+ routine do\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_RAN = /^(?:please,?\s+)?when did the (.+) routine last run$/i;

export function routineRanName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_RAN.exec(value);
  if (!match) return null;
  const name = (match[1] ?? "").trim().replace(/^["“']+|["”']+$/g, "").replace(/\s+/g, " ").trim();
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineRan(text: string): boolean {
  const value = tidySentence(text);
  if (routineRanName(text)) return false;
  if (!/^(?:please,?\s+)?when did the .+ routine last run\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_PLACE = /^(?:please,?\s+)?where does the (.+) routine deliver$/i;

export function routinePlaceName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_PLACE.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutinePlace(text: string): boolean {
  const value = tidySentence(text);
  if (routinePlaceName(text)) return false;
  if (!/^(?:please,?\s+)?where does the .+ routine deliver\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_DELIVER = /^(?:please,?\s+)?what did the (.+) routine deliver$/i;

export function routineDeliverName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_DELIVER.exec(value);
  if (!match) return null;
  const name = (match[1] ?? "").trim().replace(/^["“']+|["”']+$/g, "").replace(/\s+/g, " ").trim();
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineDeliver(text: string): boolean {
  const value = tidySentence(text);
  if (routineDeliverName(text)) return false;
  if (!/^(?:please,?\s+)?what did the .+ routine deliver\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_RUNS = /^(?:please,?\s+)?what runs does the (.+) routine have$/i;

export function routineRunsName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_RUNS.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineRuns(text: string): boolean {
  const value = tidySentence(text);
  if (routineRunsName(text)) return false;
  if (!/^(?:please,?\s+)?what runs does the .+ routine have\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_QUIET = /^(?:please,?\s+)?why (?:hasn't|has not) the (.+) routine run$/i;

export function routineQuietName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_QUIET.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineQuiet(text: string): boolean {
  const value = tidySentence(text);
  if (routineQuietName(text)) return false;
  if (!/^(?:please,?\s+)?why (?:hasn't|has not) the .+ routine run\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_RUN = /^(?:please,?\s+)?run the (.+) routine$/i;

export function routineRunName(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_RUN.exec(value);
  if (!match) return null;
  const name = (match[1] ?? "").trim().replace(/^["“']+|["”']+$/g, "").replace(/\s+/g, " ").trim();
  if (!name || ROUTINE_LOOSEN.test(name)) return null;
  return name;
}

export function loosensRoutineRun(text: string): boolean {
  const value = tidySentence(text);
  if (routineRunName(text)) return false;
  if (!/^(?:please,?\s+)?run the .+ routine\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_CHANGE = /^(?:please,?\s+)?change the (.+?) routine to (.+)$/i;

function stripRoutineToken(value: string): string {
  return value.trim().replace(/^["“']+|["”']+$/g, "").replace(/\s+/g, " ").trim();
}

export function routineChange(text: string): { name: string; proposal: string } | null {
  const value = tidySentence(text);
  const match = ROUTINE_CHANGE.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  const proposal = stripRoutineToken(match[2] ?? "");
  if (!name || !proposal || ROUTINE_LOOSEN.test(value) || /\band\b/i.test(proposal)) return null;
  return { name, proposal };
}

export function loosensRoutineChange(text: string): boolean {
  const value = tidySentence(text);
  if (routineChange(text)) return false;
  if (!/^(?:please,?\s+)?change the .+ routine to\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_SAVE = /^(?:please,?\s+)?save the (.+?) routine as (.+)$/i;

export function routineSave(text: string): { name: string; proposal: string } | null {
  const value = tidySentence(text);
  const match = ROUTINE_SAVE.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  const proposal = stripRoutineToken(match[2] ?? "");
  if (!name || !proposal || ROUTINE_LOOSEN.test(value) || /\band\b/i.test(proposal)) return null;
  return { name, proposal };
}

export function loosensRoutineSave(text: string): boolean {
  const value = tidySentence(text);
  if (routineSave(text)) return false;
  if (!/^(?:please,?\s+)?save the .+ routine as\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_PACE = /^(?:please,?\s+)?wake the (.+?) routine (daily|hourly|manually|manual)$/i;

export function routinePace(text: string): { name: string; cadence: Cadence } | null {
  const value = tidySentence(text);
  const match = ROUTINE_PACE.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  const word = (match[2] ?? "").toLowerCase();
  if (!name || ROUTINE_LOOSEN.test(value) || /\band\b/i.test(value)) return null;
  const cadence: Cadence = word === "hourly" ? "hourly" : word === "daily" ? "daily" : "manual";
  return { name, cadence };
}

export function loosensRoutinePace(text: string): boolean {
  const value = tidySentence(text);
  if (routinePace(text)) return false;
  if (!/^(?:please,?\s+)?wake the .+ routine\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_HOLD = /^(?:please,?\s+)?(pause|resume) the (.+?) routine$/i;

export function routineHold(text: string): { name: string; paused: boolean } | null {
  const value = tidySentence(text);
  const match = ROUTINE_HOLD.exec(value);
  if (!match) return null;
  const verb = (match[1] ?? "").toLowerCase();
  const name = stripRoutineToken(match[2] ?? "");
  if (!name || ROUTINE_LOOSEN.test(value) || /\band\b/i.test(value)) return null;
  return { name, paused: verb === "pause" };
}

export function loosensRoutineHold(text: string): boolean {
  const value = tidySentence(text);
  if (routineHold(text)) return false;
  if (!/^(?:please,?\s+)?(?:pause|resume) the .+ routine\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}

const ROUTINE_DELETE = /^(?:please,?\s+)?delete the (.+?) routine$/i;

export function routineDelete(text: string): string | null {
  const value = tidySentence(text);
  const match = ROUTINE_DELETE.exec(value);
  if (!match) return null;
  const name = stripRoutineToken(match[1] ?? "");
  if (!name || ROUTINE_LOOSEN.test(value) || /\band\b/i.test(value)) return null;
  return name;
}

export function loosensRoutineDelete(text: string): boolean {
  const value = tidySentence(text);
  if (routineDelete(text)) return false;
  if (!/^(?:please,?\s+)?delete the .+ routine\b/i.test(value)) return false;
  return ROUTINE_LOOSEN.test(value);
}
