import type { ApprovalKind, Cadence, Routine } from "./types.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
export const SCHEDULE_GAP_MS = 5 * 60 * 1000;
export const ROUTINE_CAP = 50;
export const ROUTINE_HOUR_CAP = 200;
export const DESK_HOUR_CAP = 300;

export function rememberedRuns(stamps: string[] | undefined): string[] {
  const kept: { t: number; iso: string }[] = [];
  for (const stamp of stamps ?? []) {
    if (typeof stamp !== "string") continue;
    const t = Date.parse(stamp);
    if (!Number.isFinite(t)) continue;
    kept.push({ t, iso: new Date(t).toISOString() });
  }
  kept.sort((left, right) => left.t - right.t || left.iso.localeCompare(right.iso));
  return kept.slice(-ROUTINE_HOUR_CAP).map((item) => item.iso);
}

export function runsThisHour(stamps: string[] | undefined, now: Date): string[] {
  const cutoff = now.getTime() - HOUR;
  const nowMs = now.getTime();
  return rememberedRuns(stamps).filter((iso) => {
    const t = Date.parse(iso);
    return t > cutoff && t <= nowMs;
  });
}

export function routineRateBlock(routines: Routine[], routineId: string, now: Date): "routine" | "desk" | null {
  const routine = routines.find((item) => item.id === routineId);
  if (!routine) return null;
  if (runsThisHour(routine.recentRuns, now).length >= ROUTINE_HOUR_CAP) return "routine";
  let total = 0;
  for (const item of routines) total += runsThisHour(item.recentRuns, now).length;
  if (total >= DESK_HOUR_CAP) return "desk";
  return null;
}

export function closerThanFiveMinutes(left: string, right: string): boolean {
  const a = Date.parse(left);
  const b = Date.parse(right);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) < SCHEDULE_GAP_MS;
}

export function isCadence(value: unknown): value is Cadence {
  return value === "manual" || value === "daily" || value === "hourly";
}

export function nextInstant(cadence: Cadence, from: Date): string | null {
  if (cadence === "manual") return null;
  const ms = cadence === "hourly" ? HOUR : DAY;
  return new Date(from.getTime() + ms).toISOString();
}

export function cycleCadence(current: Cadence): Cadence {
  if (current === "manual") return "daily";
  if (current === "daily") return "hourly";
  return "manual";
}

export function normalizeRoutine(value: unknown): Routine | null {
  if (!value || typeof value !== "object") return null;
  const routine = value as Partial<Routine>;
  if (typeof routine.id !== "string" || typeof routine.instruction !== "string" || typeof routine.createdAt !== "string") {
    return null;
  }
  const cadence = isCadence(routine.cadence) ? routine.cadence : "manual";
  const from = new Date(routine.createdAt);
  const fallback = Number.isNaN(from.getTime()) ? null : nextInstant(cadence, from);
  return {
    id: routine.id,
    name: typeof routine.name === "string" && routine.name.trim() ? routine.name : routine.instruction.slice(0, 80),
    instruction: routine.instruction,
    cadence,
    createdAt: routine.createdAt,
    lastRunAt: typeof routine.lastRunAt === "string" ? routine.lastRunAt : null,
    recentRuns: rememberedRuns(Array.isArray(routine.recentRuns) ? routine.recentRuns : []),
    nextRunAt: cadence === "manual" ? null : typeof routine.nextRunAt === "string" ? routine.nextRunAt : fallback,
    paused: routine.paused === true,
    heldBack: heldBackFrom(routine.heldBack),
  };
}

function heldBackFrom(value: unknown): ApprovalKind[] {
  if (!Array.isArray(value)) return [];
  const kinds: ApprovalKind[] = [];
  for (const item of value) {
    if (item === "send" || item === "pay" || item === "delete" || item === "post" || item === "credential") {
      if (!kinds.includes(item)) kinds.push(item);
    }
  }
  return kinds;
}
