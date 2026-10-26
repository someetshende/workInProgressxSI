import type { Skill } from "./types.js";

export function normalizeSkill(value: unknown): Skill | null {
  if (!value || typeof value !== "object") return null;
  const skill = value as Partial<Skill>;
  if (typeof skill.id !== "string" || !skill.id.trim()) return null;
  if (typeof skill.method !== "string" || !skill.method.trim()) return null;
  if (typeof skill.createdAt !== "string" || !skill.createdAt) return null;
  const name = typeof skill.name === "string" && skill.name.trim() ? skill.name.trim() : skill.method;
  return {
    id: skill.id,
    name: name.slice(0, 80),
    method: skill.method,
    createdAt: skill.createdAt,
  };
}

export function skillInstruction(name: string, method: string, request: string): string {
  return `Method from the skill “${name}”:\n${method}\n\nRequest:\n${request}`;
}
