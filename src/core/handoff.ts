import { HANDOFF_ACTIONS, type ApprovalKind, type Handoff, type HandoffAction, type HandoffRule, type Policy } from "./types.js";

export const HANDOFF_TASK =
  "This step belongs to the person. Do not change a password, sign in, type a code, or solve a captcha. Do not ask them to paste a secret.";

export const HANDOFF_VOICE =
  "I handed that step to you. Do not paste a password or a code. Oriel will not type it, and this does not send mail or move money.";

export const HANDOFF_DONE =
  "You did this step. Oriel did not type a password, sign in, send mail, or move money.";

export const HANDOFF_LEFT = "You left that step. Oriel did not do it. Nothing was sent or spent.";

const KIND_VERBS: Record<ApprovalKind, RegExp> = {
  send: /\b(?:sends?|sending|emails?|e-mails?|messages?)\b/i,
  pay: /\b(?:pays?|paying|payments?|purchases?|buys?|buying)\b/i,
  delete: /\b(?:deletes?|deleting|deletions?|erases?|erasing)\b/i,
  post: /\b(?:posts?|posting|publishes?|publishing|tweets?)\b/i,
  credential: /\b(?:credentials?|api keys?|passwords?|secrets?)\b/i,
};

const ORDER: ApprovalKind[] = ["send", "pay", "delete", "post", "credential"];

const GENERAL_HAND =
  /\bhand(?:\s+off)?\s+(?:this|that|it)\s+to\s+(?:me|you)\b|\bhand off to (?:me|you)\b/i;

export type HandoffFacts = {
  hands: boolean;
  replaces: ApprovalKind[];
  personPassword: boolean;
  personSignin: boolean;
  personCode: boolean;
};

function scrub(text: string): string {
  return text
    .replace(
      /\b(?:do not|don't|dont|never|without)\b(?:\s+\w+){0,8}\s+(?:sign(?:ing)?[\s-]?in|log(?:ging)?[\s-]?in|logins?|passwords?|passcodes?|captchas?|one-time codes?|verification codes?|otps?)\b/gi,
      " ",
    )
    .replace(/\b(?:when|if)\b(?:\s+\w+){0,8}\s+passwords?\b/gi, " ");
}

function personPassword(text: string): boolean {
  return /\b(?:change|reset|update|set|rotate|replace|choose)\b(?:\s+\w+){0,6}\s+passwords?\b/i.test(scrub(text));
}

function personSignin(text: string): boolean {
  return /\b(?:sign[\s-]?in|log[\s-]?in|login|log on)\b/i.test(scrub(text));
}

function personCode(text: string): boolean {
  return /\b(?:2fa|mfa|two-factor|two factor|one-time code|one time code|otp|verification code|authenticator|captcha)\b/i.test(
    scrub(text),
  );
}

function handsToYou(text: string): boolean {
  return /\bhand\b[\s\S]{0,80}\bto\s+(?:me|you)\b/i.test(text);
}

function replacesKind(text: string, kind: ApprovalKind): boolean {
  const verb = KIND_VERBS[kind];
  const named = text.match(/\bhand\b[\s\S]{0,80}?\bto\s+(?:me|you)\b[\s\S]{0,48}/gi) ?? [];
  if (named.some((part) => verb.test(part))) return true;
  if (!GENERAL_HAND.test(text)) return false;
  return verb.test(text);
}

export function handoffFacts(text: string): HandoffFacts {
  return {
    hands: handsToYou(text),
    replaces: ORDER.filter((kind) => replacesKind(text, kind)),
    personPassword: personPassword(text),
    personSignin: personSignin(text),
    personCode: personCode(text),
  };
}

export function taskSuffix(policy: Pick<Policy, "handoff" | "replaces">, methodGuards: boolean): string {
  if (!policy.handoff && !methodGuards) return "";
  const lines = [HANDOFF_TASK];
  if (policy.replaces.includes("send")) lines.push("Do not send mail. That step belongs to the person.");
  if (policy.replaces.includes("pay")) lines.push("Do not move money. That step belongs to the person.");
  if (policy.replaces.includes("delete")) lines.push("Do not delete anything. That step belongs to the person.");
  if (policy.replaces.includes("post")) lines.push("Do not publish anything. That step belongs to the person.");
  return `\n\n${lines.join(" ")}`;
}

export function skillGuardsSeat(method: string): boolean {
  const facts = handoffFacts(method);
  return facts.personPassword || facts.personSignin || facts.personCode;
}

export function handoffTitle(facts: Pick<HandoffFacts, "personPassword" | "personSignin" | "personCode" | "replaces">): string {
  if (facts.personPassword) return "Change the password yourself";
  if (facts.personSignin) return "Sign in yourself";
  if (facts.personCode) return "Enter the code yourself";
  if (facts.replaces.includes("delete")) return "Delete that yourself";
  if (facts.replaces.includes("pay")) return "Pay that yourself";
  if (facts.replaces.includes("send")) return "Send that yourself";
  if (facts.replaces.includes("post")) return "Post that yourself";
  return "Do this step yourself";
}

export function handoffDetail(facts: Pick<HandoffFacts, "personPassword" | "personSignin" | "personCode" | "replaces">): string {
  if (facts.personPassword || facts.personSignin || facts.personCode) {
    return "This step is yours. Do not paste a password or a code here. Oriel will not type it or sign in. Marking this done does not send mail or move money.";
  }
  if (facts.replaces.includes("delete")) {
    return "Delete that yourself. Marking this done records that you did it. Oriel does not delete anything, send mail, or move money.";
  }
  if (facts.replaces.includes("pay")) {
    return "Pay that yourself. Marking this done records that you did it. Oriel does not move money or send mail.";
  }
  if (facts.replaces.includes("send")) {
    return "Send that yourself. Marking this done records that you did it. Oriel does not send mail or move money.";
  }
  if (facts.replaces.includes("post")) {
    return "Post that yourself. Marking this done records that you did it. Oriel does not publish anything or send mail.";
  }
  return "This step is yours. Marking this done records that you did it. Oriel does not send mail or move money.";
}

export function isHandoffDecision(text: string): "done" | "leave" | null {
  const value = text.trim().replace(/[.!]+$/, "");
  if (/^(i did this|i did it|i changed it)$/i.test(value)) return "done";
  if (/^(leave it|leave that step)$/i.test(value)) return "leave";
  return null;
}

const RULE_NOUN: Record<HandoffAction, string> = {
  send: "the send",
  pay: "the payment",
  delete: "the deletion",
  post: "the public post",
};

export function isHandoffAction(value: string): value is HandoffAction {
  return (HANDOFF_ACTIONS as readonly string[]).includes(value);
}

export function ruleSentence(actions: HandoffAction[]): string {
  if (!actions.length) return "";
  const names = actions.map((action) => RULE_NOUN[action]);
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return `Your rule hands ${list} to you. It does not run the step, and it does not approve a hold.`;
}

export function normalizeHandoffRule(value: unknown): HandoffRule | null {
  if (!value || typeof value !== "object") return null;
  const rule = value as Partial<HandoffRule>;
  if (typeof rule.id !== "string" || !rule.id.trim()) return null;
  if (typeof rule.action !== "string" || !isHandoffAction(rule.action)) return null;
  if (typeof rule.createdAt !== "string" || !rule.createdAt) return null;
  return { id: rule.id, action: rule.action, createdAt: rule.createdAt };
}

export function normalizeHandoff(value: unknown): Handoff | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<Handoff>;
  if (typeof item.id !== "string" || !item.id.trim()) return null;
  if (typeof item.goalId !== "string" || !item.goalId.trim()) return null;
  if (typeof item.stepId !== "string" || !item.stepId.trim()) return null;
  if (item.status !== "open" && item.status !== "done" && item.status !== "left") return null;
  return {
    id: item.id,
    goalId: item.goalId,
    stepId: item.stepId,
    title: typeof item.title === "string" && item.title.trim() ? item.title : "Do this step yourself",
    detail: typeof item.detail === "string" ? item.detail : "",
    status: item.status,
    resolution: typeof item.resolution === "string" ? item.resolution : null,
    createdAt: typeof item.createdAt === "string" && item.createdAt ? item.createdAt : new Date(0).toISOString(),
    settledAt: typeof item.settledAt === "string" ? item.settledAt : null,
  };
}
