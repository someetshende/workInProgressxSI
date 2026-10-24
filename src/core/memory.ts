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
