import type { ApprovalKind, Cadence, Routine } from "./types.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

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
    nextRunAt: cadence === "manual" ? null : typeof routine.nextRunAt === "string" ? routine.nextRunAt : fallback,
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
