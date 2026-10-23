import type { Memory } from "./types.js";

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
