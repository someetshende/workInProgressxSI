import { redactSecrets } from "./redact.js";
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

export function cleanPhrase(value: string): string | null {
  const phrase = value.replace(/\s+/g, " ").trim();
  if (phrase.length < 3 || phrase.length > 80) return null;
  if (/[\u0000-\u001f]/.test(phrase)) return null;
  if (/always[-\s]?allow|without asking|allow automatically|take action without/i.test(phrase)) return null;
  if (redactSecrets(phrase) !== phrase) return null;
  return phrase;
}

const SPOKEN_NOUNS: Record<string, HandoffAction> = {
  send: "send",
  sends: "send",
  sending: "send",
  email: "send",
  emails: "send",
  "e-mail": "send",
  "e-mails": "send",
  message: "send",
  messages: "send",
  mail: "send",
  pay: "pay",
  pays: "pay",
  paying: "pay",
  payment: "pay",
  payments: "pay",
  purchase: "pay",
  purchases: "pay",
  delete: "delete",
  deletes: "delete",
  deleting: "delete",
  deletion: "delete",
  deletions: "delete",
  erase: "delete",
  erases: "delete",
  erasing: "delete",
  post: "post",
  posts: "post",
  posting: "post",
  publish: "post",
  publishes: "post",
  publishing: "post",
  tweet: "post",
  tweets: "post",
  tweeting: "post",
};

const SPOKEN_RULE =
  /^(?:please\s+)?hand(?:\s+over|\s+off|-off)?(?:\s+(?:me|you))?\s+(?:the\s+|an\s+|a\s+|any\s+)?([a-z][a-z-]*)\s+(?:that\s+)?mention(?:s|ing)?\s+(.+?)\s+to\s+(?:me|you)$/i;

const SPOKEN_WOULD: Record<HandoffAction, string> = {
  send: "send",
  pay: "pay",
  delete: "delete",
  post: "post",
};

export type SpokenRule =
  | { kind: "save"; action: HandoffAction; phrase: string }
  | { kind: "reject"; reason: "phrase" | "action" };

function unwrapPhrase(value: string): string {
  const trimmed = value.trim();
  const pairs = [
    ['"', '"'],
    ["'", "'"],
    ["“", "”"],
    ["‘", "’"],
  ] as const;
  for (const [open, close] of pairs) {
    if (trimmed.startsWith(open) && trimmed.endsWith(close) && trimmed.length > open.length + close.length) {
      return trimmed.slice(open.length, trimmed.length - close.length).trim();
    }
  }
  return trimmed;
}

export function readSpokenRule(text: string): SpokenRule | null {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  const match = normalized.match(SPOKEN_RULE);
  if (!match) return null;
  const action = SPOKEN_NOUNS[(match[1] ?? "").toLowerCase()];
  if (!action) return { kind: "reject", reason: "action" };
  const phrase = cleanPhrase(unwrapPhrase(match[2] ?? ""));
  if (!phrase) return { kind: "reject", reason: "phrase" };
  return { kind: "save", action, phrase };
}

export function spokenRuleCopy(action: HandoffAction, phrase: string, mode: "saved" | "same" | "updated"): string {
  const step = SPOKEN_WOULD[action];
  const scope = `When a request would ${step} and mentions “${phrase}”, that step is yours.`;
  const tail = "This did not run the step, send mail, or move money, and it did not approve a hold.";
  if (mode === "same") return `That handoff rule is already saved. ${scope} ${tail}`;
  if (mode === "updated") return `Updated the one handoff rule for a ${step}. ${scope} ${tail}`;
  return `Saved one handoff rule for a ${step}. ${scope} ${tail}`;
}

export function loosensHandoff(text: string): boolean {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  if (!/^(?:please\s+)?hand(?:\s+over|\s+off|-off)?\b/i.test(normalized)) return false;
  return /without asking|always[-\s]?allow|allow automatically|take action without/i.test(normalized);
}

export function phraseMatches(text: string, phrase: string | null): boolean {
  if (!phrase) return true;
  const hay = text.toLowerCase().replace(/\s+/g, " ");
  const needle = phrase.toLowerCase().replace(/\s+/g, " ");
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i").test(hay);
}

export function ruleSentence(
  actions: HandoffAction[],
  phrases?: Partial<Record<HandoffAction, string | null | undefined>>,
): string {
  if (!actions.length) return "";
  const named = actions.some((action) => phrases?.[action]);
  if (!named) {
    const names = actions.map((action) => RULE_NOUN[action]);
    const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
    return `Your rule hands ${list} to you. It does not run the step, and it does not approve a hold.`;
  }
  const parts = actions.map((action) => {
    const phrase = phrases?.[action];
    const base = `${RULE_NOUN[action]} to you`;
    return phrase ? `${base} when the request mentions “${phrase}”` : base;
  });
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(" and ")} and ${parts.at(-1)}`;
  return `Your rule hands ${list}. It does not run the step, and it does not approve a hold.`;
}

export function handoffCardDetail(
  facts: Pick<HandoffFacts, "personPassword" | "personSignin" | "personCode" | "replaces">,
  phrases: Partial<Record<HandoffAction, string>> = {},
): string {
  const base = handoffDetail(facts);
  if (facts.personPassword || facts.personSignin || facts.personCode) return base;
  const kind = (["delete", "pay", "send", "post"] as const).find((item) => facts.replaces.includes(item));
  const phrase = kind ? phrases[kind] : undefined;
  if (!phrase) return base;
  return `${base} This rule applies when the request mentions “${phrase}”.`;
}

export function normalizeHandoffRule(value: unknown): HandoffRule | null {
  if (!value || typeof value !== "object") return null;
  const rule = value as Partial<HandoffRule>;
  if (typeof rule.id !== "string" || !rule.id.trim()) return null;
  if (typeof rule.action !== "string" || !isHandoffAction(rule.action)) return null;
  if (typeof rule.createdAt !== "string" || !rule.createdAt) return null;
  let phrase: string | null = null;
  if ("phrase" in rule && rule.phrase != null && rule.phrase !== "") {
    if (typeof rule.phrase !== "string") return null;
    const cleaned = cleanPhrase(rule.phrase);
    if (!cleaned) return null;
    phrase = cleaned;
  }
  return { id: rule.id, action: rule.action, phrase, createdAt: rule.createdAt };
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
