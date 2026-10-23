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

const SPOKEN_CLEAR =
  /^(?:please\s+)?(?:stop|don'?t|do not)\s+hand(?:ing)?(?:\s+over|\s+off|-off)?(?:\s+(?:me|you))?\s+(?:the\s+|an\s+|a\s+|any\s+)?([a-z][a-z-]*)\s+(?:that\s+)?mention(?:s|ing)?\s+(.+?)\s+to\s+(?:me|you)$/i;

const SPOKEN_BARE_CLEAR =
  /^(?:please\s+)?(?:stop|don'?t|do not)\s+hand(?:ing)?(?:\s+over|\s+off|-off)?(?:\s+(?:me|you))?\s+(?:the\s+|an\s+|a\s+|any\s+)?([a-z][a-z-]*)\s+to\s+(?:me|you)$/i;

const SPOKEN_READ =
  /^(?:please,?\s+)?(?:what(?:'s| is)|which steps are|which rules are)\s+handed(?:\s+(?:off|over))?\s+to\s+(?:me|you)$/i;

const SPOKEN_ASK =
  /^(?:please,?\s+)?(?:is|are)\s+(?:the\s+|an\s+|a\s+|any\s+)?(?:public\s+)?([a-z][a-z-]*)\s+handed(?:\s+(?:off|over))?\s+to\s+(?:me|you)$/i;

const SPOKEN_ASK_PHRASE =
  /^(?:please,?\s+)?(?:is|are)\s+(?:the\s+|an\s+|a\s+|any\s+)?(?:public\s+)?([a-z][a-z-]*)\s+(?:that\s+)?mention(?:s|ing)?\s+(.+?)\s+handed(?:\s+(?:off|over))?\s+to\s+(?:me|you)$/i;

const SPOKEN_WOULD: Record<HandoffAction, string> = {
  send: "send",
  pay: "pay",
  delete: "delete",
  post: "post",
};

export type SpokenRule =
  | { kind: "save"; action: HandoffAction; phrase: string }
  | { kind: "reject"; reason: "phrase" | "action" };

export type SpokenClear =
  | { kind: "clear"; action: HandoffAction; phrase: string | null }
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

export function readSpokenClear(text: string): SpokenClear | null {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  const match = normalized.match(SPOKEN_CLEAR);
  if (match) {
    const action = SPOKEN_NOUNS[(match[1] ?? "").toLowerCase()];
    if (!action) return { kind: "reject", reason: "action" };
    const phrase = cleanPhrase(unwrapPhrase(match[2] ?? ""));
    if (!phrase) return { kind: "reject", reason: "phrase" };
    return { kind: "clear", action, phrase };
  }
  const bare = normalized.match(SPOKEN_BARE_CLEAR);
  if (!bare) return null;
  const action = SPOKEN_NOUNS[(bare[1] ?? "").toLowerCase()];
  if (!action) return { kind: "reject", reason: "action" };
  return { kind: "clear", action, phrase: null };
}

export function spokenPhraseMatches(saved: string | null, spoken: string): boolean {
  if (!saved) return false;
  return saved.toLowerCase().replace(/\s+/g, " ").trim() === spoken.toLowerCase().replace(/\s+/g, " ").trim();
}

export function spokenClearCopy(action: HandoffAction, phrase: string): string {
  const step = SPOKEN_WOULD[action];
  return `Cleared the one handoff rule for a ${step}. A request that mentions “${phrase}” is no longer handed to you. This did not run the step, send mail, or move money, and it did not approve a hold.`;
}

export function spokenBareClearCopy(action: HandoffAction): string {
  const step = SPOKEN_WOULD[action];
  return `Cleared the one handoff rule for a ${step}. A request that would ${step} is no longer handed to you by that rule. This did not run the step, send mail, or move money, and it did not approve a hold.`;
}

export function spokenBareClearMissCopy(action: HandoffAction, saved: string | null | undefined): string {
  const step = SPOKEN_WOULD[action];
  const head = saved
    ? `That handoff rule for a ${step} names “${saved}”. A sentence with no phrase does not clear it.`
    : `There is no handoff rule for a ${step}.`;
  return `${head} Oriel did not clear a rule and did not open a card. Nothing was sent or spent.`;
}

export function spokenClearMissCopy(action: HandoffAction, phrase: string, saved: string | null | undefined): string {
  const step = SPOKEN_WOULD[action];
  const head =
    saved === undefined
      ? `There is no handoff rule for a ${step} that mentions “${phrase}”.`
      : saved
        ? `Those words are not the saved phrase “${saved}” for a ${step}.`
        : `Those words are not the saved phrase for a ${step}.`;
  return `${head} Oriel did not clear a rule and did not open a card. Nothing was sent or spent.`;
}

export function loosensSpokenClear(text: string): boolean {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  if (!/^(?:please\s+)?(?:stop|don'?t|do not)\s+hand(?:ing)?\b/i.test(normalized)) return false;
  return /without asking|always[-\s]?allow|allow automatically|take action without/i.test(normalized);
}

const READ_ORDER: HandoffAction[] = ["send", "pay", "delete", "post"];

const READ_LABEL: Record<HandoffAction, string> = {
  send: "The send",
  pay: "The payment",
  delete: "The deletion",
  post: "The public post",
};

const READ_WHOLE: Record<HandoffAction, string> = {
  send: "the whole send",
  pay: "the whole payment",
  delete: "the whole deletion",
  post: "the whole public post",
};

export function isSpokenRead(text: string): boolean {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  return SPOKEN_READ.test(normalized);
}

export function handoffRuleLine(rule: Pick<HandoffRule, "action" | "phrase">): string {
  if (!rule.phrase) return `${READ_LABEL[rule.action]} is ${READ_WHOLE[rule.action]}.`;
  return `${READ_LABEL[rule.action]} is only “${rule.phrase}”.`;
}

export function spokenReadCopy(rules: HandoffRule[]): string {
  const saved = READ_ORDER.flatMap((action) => {
    const rule = rules.find((item) => item.action === action);
    return rule ? [rule] : [];
  });
  if (!saved.length) {
    return "Nothing is handed to you. There is no handoff rule. Oriel did not open a card. Nothing was sent or spent.";
  }
  const head = saved.length === 1 ? "This step is handed to you." : "These steps are handed to you.";
  const lines = saved.map((rule) => handoffRuleLine(rule)).join(" ");
  return `${head} ${lines} Saying this did not save or clear a rule and did not open a card. It did not call a bridge, did not approve a hold, send mail, or move money.`;
}

const ASK_ONE: Record<HandoffAction, string> = {
  send: "a send",
  pay: "a payment",
  delete: "a deletion",
  post: "a public post",
};

const ASK_TAIL =
  "Saying this did not save or clear a rule and did not open a card. It did not call a bridge, did not approve a hold, send mail, or move money.";

export type SpokenAsk = { kind: "ask"; action: HandoffAction } | { kind: "reject"; reason: "action" };

export function readSpokenAsk(text: string): SpokenAsk | null {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  const match = normalized.match(SPOKEN_ASK);
  if (!match) return null;
  const action = SPOKEN_NOUNS[(match[1] ?? "").toLowerCase()];
  if (!action) return { kind: "reject", reason: "action" };
  return { kind: "ask", action };
}

export function spokenAskCopy(action: HandoffAction, rule: HandoffRule | undefined): string {
  if (!rule) {
    return `${READ_LABEL[action]} is not handed to you. There is no handoff rule for ${ASK_ONE[action]}. Oriel named no other step. ${ASK_TAIL}`;
  }
  return `${READ_LABEL[action]} is handed to you. ${handoffRuleLine(rule)} Oriel named no other step. ${ASK_TAIL}`;
}

export type SpokenAskPhrase =
  | { kind: "ask"; action: HandoffAction; phrase: string }
  | { kind: "reject"; reason: "phrase" | "action" };

export function readSpokenAskPhrase(text: string): SpokenAskPhrase | null {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  const match = normalized.match(SPOKEN_ASK_PHRASE);
  if (!match) return null;
  const action = SPOKEN_NOUNS[(match[1] ?? "").toLowerCase()];
  if (!action) return { kind: "reject", reason: "action" };
  const phrase = cleanPhrase(unwrapPhrase(match[2] ?? ""));
  if (!phrase) return { kind: "reject", reason: "phrase" };
  return { kind: "ask", action, phrase };
}

export function spokenAskPhraseCopy(action: HandoffAction, phrase: string, rule: HandoffRule | undefined): string {
  if (!rule) {
    return `${READ_LABEL[action]} is not handed to you. There is no handoff rule for ${ASK_ONE[action]} that mentions “${phrase}”. Oriel named no other step. ${ASK_TAIL}`;
  }
  if (!rule.phrase) {
    return `${READ_LABEL[action]} is handed to you. That rule has no such words. Oriel did not treat this question as ${READ_WHOLE[action]}, and it did not treat “${phrase}” as the rule. Oriel named no other step. ${ASK_TAIL}`;
  }
  if (!spokenPhraseMatches(rule.phrase, phrase)) {
    return `${READ_LABEL[action]} is handed to you. The saved words are “${rule.phrase}”. Those are not “${phrase}”. Oriel named no other step. ${ASK_TAIL}`;
  }
  return `${READ_LABEL[action]} is handed to you. ${handoffRuleLine(rule)} Oriel named no other step. ${ASK_TAIL}`;
}

const SPOKEN_WORDS =
  /^(?:please,?\s+)?which words (?:does|do)\s+(?:the\s+|an\s+|a\s+|any\s+)?(?:public\s+)?([a-z][a-z-]*)\s+hand(?:ed)?(?:\s+(?:off|over))?\s+to\s+(?:me|you)$/i;

export type SpokenWords = { kind: "ask"; action: HandoffAction } | { kind: "reject"; reason: "action" };

export function readSpokenWords(text: string): SpokenWords | null {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  const match = normalized.match(SPOKEN_WORDS);
  if (!match) return null;
  const action = SPOKEN_NOUNS[(match[1] ?? "").toLowerCase()];
  if (!action) return { kind: "reject", reason: "action" };
  return { kind: "ask", action };
}

export function spokenWordsCopy(action: HandoffAction, rule: HandoffRule | undefined): string {
  if (!rule) {
    return `${READ_LABEL[action]} is not handed to you. There is no handoff rule for ${ASK_ONE[action]}. Oriel named no other step. ${ASK_TAIL}`;
  }
  if (!rule.phrase) {
    return `${READ_LABEL[action]} is handed to you. That rule names no words and is ${READ_WHOLE[action]}. Oriel named no other step. ${ASK_TAIL}`;
  }
  return `${READ_LABEL[action]} is handed to you. The words are “${rule.phrase}”. Oriel named no other step. ${ASK_TAIL}`;
}

const SPOKEN_STEP = /^(?:please,?\s+)?which steps?\s+mention(?:s|ing)?\s+(.+)$/i;

const STEP_ADDRESS = /(?:\s+hand(?:ed)?(?:\s+(?:off|over))?)?\s+to\s+(?:me|you)$/i;

const LOOSE_TAIL =
  /(?:\s+(?:without asking|always[-\s]?allow|allow automatically|take action without(?: asking)?))+$/i;

export type SpokenStep = { kind: "ask"; phrase: string } | { kind: "reject"; reason: "phrase" };

function stepWouldAct(text: string): boolean {
  const body = text.replace(/^(?:please,?\s+)?which steps?\s+mention(?:s|ing)?\s+/i, "");
  if (/[.!?]/.test(body)) return true;
  return /\b(?:and|then)\s+(?:please\s+)?(?:also\s+)?(?:delete|deleting|send|sending|email|e-mail|pay|paying|post|posting|publish|publishing|buy|buying|purchase)\s+(?:the|a|an|that|this|those|these|them|it)\b/i.test(
    text,
  );
}

export function readSpokenStep(text: string): SpokenStep | null {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  const match = normalized.match(SPOKEN_STEP);
  if (!match || stepWouldAct(normalized)) return null;
  let raw = unwrapPhrase(match[1] ?? "");
  if (LOOSE_TAIL.test(raw)) return null;
  raw = unwrapPhrase(raw.replace(STEP_ADDRESS, "").trim());
  if (!raw || LOOSE_TAIL.test(raw)) return null;
  const phrase = cleanPhrase(raw);
  if (!phrase) return { kind: "reject", reason: "phrase" };
  return { kind: "ask", phrase };
}

export function spokenStepCopy(phrase: string, rules: HandoffRule[]): string {
  const matched = READ_ORDER.flatMap((action) => {
    const rule = rules.find((item) => item.action === action);
    if (!rule || !spokenPhraseMatches(rule.phrase, phrase)) return [];
    return [rule];
  });
  if (!matched.length) {
    return `No step mentions “${phrase}”. Oriel named no other step. ${ASK_TAIL}`;
  }
  const lines = matched.map((rule) => `${READ_LABEL[rule.action]} mentions “${rule.phrase}”.`).join(" ");
  if (matched.length === 1) return `${lines} Oriel named no other step. ${ASK_TAIL}`;
  return `These steps mention “${phrase}”. ${lines} Oriel named no other step. ${ASK_TAIL}`;
}

export function loosensSpokenRead(text: string): boolean {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  if (!/^(?:please,?\s+)?(?:what(?:'s| is)|which)\b/i.test(normalized)) return false;
  if (!/\bhanded(?:\s+(?:off|over))?\s+to\s+(?:me|you)\b/i.test(normalized)) return false;
  return /without asking|always[-\s]?allow|allow automatically|take action without/i.test(normalized);
}

export function loosensSpokenAsk(text: string): boolean {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  if (!/^(?:please,?\s+)?(?:is|are)\b/i.test(normalized)) return false;
  if (!/\bhanded(?:\s+(?:off|over))?\s+to\s+(?:me|you)\b/i.test(normalized)) return false;
  return /without asking|always[-\s]?allow|allow automatically|take action without/i.test(normalized);
}

export function loosensSpokenWords(text: string): boolean {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  if (!/^(?:please,?\s+)?which words\b/i.test(normalized)) return false;
  if (!/\bhand(?:ed|ing)?(?:\s+(?:off|over))?\s+to\s+(?:me|you)\b/i.test(normalized)) return false;
  return /without asking|always[-\s]?allow|allow automatically|take action without/i.test(normalized);
}

export function loosensSpokenStep(text: string): boolean {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  if (!/^(?:please,?\s+)?which steps?\s+mention/i.test(normalized)) return false;
  return /without asking|always[-\s]?allow|allow automatically|take action without/i.test(normalized);
}

const SPOKEN_UNNAMED =
  /^(?:please,?\s+)?which steps?\s+nam(?:e|es|ing)\s+no words(?:\s+hand(?:ed)?(?:\s+(?:off|over))?)?(?:\s+to\s+(?:me|you))?$/i;

export function isSpokenUnnamed(text: string): boolean {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  return SPOKEN_UNNAMED.test(normalized);
}

export function spokenUnnamedCopy(rules: HandoffRule[]): string {
  const matched = READ_ORDER.flatMap((action) => {
    const rule = rules.find((item) => item.action === action);
    if (!rule || rule.phrase) return [];
    return [rule];
  });
  if (!matched.length) {
    return `No step names no words. Oriel named no other step. ${ASK_TAIL}`;
  }
  const lines = matched
    .map((rule) => `${READ_LABEL[rule.action]} is handed to you. That rule names no words and is ${READ_WHOLE[rule.action]}.`)
    .join(" ");
  if (matched.length === 1) return `${lines} Oriel named no other step. ${ASK_TAIL}`;
  return `These steps name no words. ${lines} Oriel named no other step. ${ASK_TAIL}`;
}

export function loosensSpokenUnnamed(text: string): boolean {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  if (!/^(?:please,?\s+)?which steps?\s+nam(?:e|es|ing)\s+no words\b/i.test(normalized)) return false;
  return /without asking|always[-\s]?allow|allow automatically|take action without/i.test(normalized);
}

const SPOKEN_NAMED =
  /^(?:please,?\s+)?which steps?\s+nam(?:e|es|ing)\s+words(?:\s+hand(?:ed)?(?:\s+(?:off|over))?)?(?:\s+to\s+(?:me|you))?$/i;

export function isSpokenNamed(text: string): boolean {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  return SPOKEN_NAMED.test(normalized);
}

export function spokenNamedCopy(rules: HandoffRule[]): string {
  const matched = READ_ORDER.flatMap((action) => {
    const rule = rules.find((item) => item.action === action);
    if (!rule?.phrase) return [];
    return [rule];
  });
  if (!matched.length) {
    return `No step names words. Oriel named no other step. ${ASK_TAIL}`;
  }
  const lines = matched
    .map((rule) => `${READ_LABEL[rule.action]} is handed to you. The words are “${rule.phrase}”.`)
    .join(" ");
  if (matched.length === 1) return `${lines} Oriel named no other step. ${ASK_TAIL}`;
  return `These steps name words. ${lines} Oriel named no other step. ${ASK_TAIL}`;
}

export function loosensSpokenNamed(text: string): boolean {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  if (!/^(?:please,?\s+)?which steps?\s+nam(?:e|es|ing)\s+words\b/i.test(normalized)) return false;
  if (/\bnam(?:e|es|ing)\s+no words\b/i.test(normalized)) return false;
  return /without asking|always[-\s]?allow|allow automatically|take action without/i.test(normalized);
}

const SPOKEN_SHARED =
  /^(?:please,?\s+)?which steps?\s+shar(?:e|es|ing)\s+words(?:\s+hand(?:ed)?(?:\s+(?:off|over))?)?(?:\s+to\s+(?:me|you))?$/i;

function phraseKey(phrase: string): string {
  return phrase.toLowerCase().replace(/\s+/g, " ").trim();
}

export function isSpokenShared(text: string): boolean {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  return SPOKEN_SHARED.test(normalized);
}

export function spokenSharedCopy(rules: HandoffRule[]): string {
  const named = READ_ORDER.flatMap((action) => {
    const rule = rules.find((item) => item.action === action);
    if (!rule?.phrase) return [];
    return [rule];
  });
  const counts = new Map<string, number>();
  for (const rule of named) {
    const key = phraseKey(rule.phrase ?? "");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const matched = named.filter((rule) => (counts.get(phraseKey(rule.phrase ?? "")) ?? 0) >= 2);
  if (!matched.length) {
    return `No steps share words. Oriel named no other step. ${ASK_TAIL}`;
  }
  const lines = matched
    .map((rule) => `${READ_LABEL[rule.action]} is handed to you. The words are “${rule.phrase}”.`)
    .join(" ");
  return `These steps share words. ${lines} Oriel named no other step. ${ASK_TAIL}`;
}

export function loosensSpokenShared(text: string): boolean {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  if (/\bshar(?:e|es|ing)\s+words\s+with\b/i.test(normalized)) return false;
  if (!/^(?:please,?\s+)?which steps?\s+shar(?:e|es|ing)\s+words\b/i.test(normalized)) return false;
  if (/\b(?:do|does)\s+not\s+shar/i.test(normalized)) return false;
  return /without asking|always[-\s]?allow|allow automatically|take action without/i.test(normalized);
}

const SPOKEN_UNSHARED_STEPS =
  /^(?:please,?\s+)?which steps?\s+(?:do|does)\s+not\s+shar(?:e|es|ing)\s+words(?:\s+hand(?:ed)?(?:\s+(?:off|over))?)?(?:\s+to\s+(?:me|you))?$/i;

export function isSpokenUnsharedSteps(text: string): boolean {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  return SPOKEN_UNSHARED_STEPS.test(normalized);
}

export function spokenUnsharedStepsCopy(rules: HandoffRule[]): string {
  const named = READ_ORDER.flatMap((action) => {
    const rule = rules.find((item) => item.action === action);
    if (!rule?.phrase) return [];
    return [rule];
  });
  const counts = new Map<string, number>();
  for (const rule of named) {
    const key = phraseKey(rule.phrase ?? "");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const matched = named.filter((rule) => (counts.get(phraseKey(rule.phrase ?? "")) ?? 0) === 1);
  if (!matched.length) {
    return `No step uses words once. Oriel named no other step. ${ASK_TAIL}`;
  }
  const lines = matched
    .map((rule) => `${READ_LABEL[rule.action]} is handed to you. The words are “${rule.phrase}”.`)
    .join(" ");
  return `These steps use words once. ${lines} Oriel named no other step. ${ASK_TAIL}`;
}

export function loosensSpokenUnsharedSteps(text: string): boolean {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  if (/\bshar(?:e|es|ing)\s+words\s+with\b/i.test(normalized)) return false;
  if (!/^(?:please,?\s+)?which steps?\s+(?:do|does)\s+not\s+shar(?:e|es|ing)\s+words\b/i.test(normalized)) return false;
  return /without asking|always[-\s]?allow|allow automatically|take action without/i.test(normalized);
}

const SPOKEN_SHARED_WORDS =
  /^(?:please,?\s+)?which words?\s+(?:are|is)\s+shared(?:\s+hand(?:ed)?(?:\s+(?:off|over))?)?(?:\s+to\s+(?:me|you))?$/i;

export function isSpokenSharedWords(text: string): boolean {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  return SPOKEN_SHARED_WORDS.test(normalized);
}

function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
}

function groupedNamedPhrases(rules: HandoffRule[]): { phrase: string; actions: HandoffAction[] }[] {
  const named = READ_ORDER.flatMap((action) => {
    const rule = rules.find((item) => item.action === action);
    if (!rule?.phrase) return [];
    return [rule];
  });
  const groups = new Map<string, { phrase: string; actions: HandoffAction[] }>();
  for (const rule of named) {
    const key = phraseKey(rule.phrase ?? "");
    const group = groups.get(key);
    if (group) group.actions.push(rule.action);
    else groups.set(key, { phrase: rule.phrase ?? "", actions: [rule.action] });
  }
  return [...groups.values()];
}

function phraseUseLine(group: { phrase: string; actions: HandoffAction[] }): string {
  return `“${group.phrase}” is used by ${joinLabels(group.actions.map((action) => READ_LABEL[action]))}.`;
}

export function spokenSharedWordsCopy(rules: HandoffRule[]): string {
  const shared = groupedNamedPhrases(rules).filter((group) => group.actions.length >= 2);
  if (!shared.length) {
    return `No words are shared. Oriel named no other step. ${ASK_TAIL}`;
  }
  const lines = shared.map((group) => phraseUseLine(group)).join(" ");
  return `These words are shared. ${lines} Oriel named no other step. ${ASK_TAIL}`;
}

export function loosensSpokenSharedWords(text: string): boolean {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  if (!/^(?:please,?\s+)?which words?\s+(?:are|is)\s+shared\b/i.test(normalized)) return false;
  return /without asking|always[-\s]?allow|allow automatically|take action without/i.test(normalized);
}

const SPOKEN_UNSHARED_WORDS =
  /^(?:please,?\s+)?which words?\s+(?:are|is)\s+not\s+shared(?:\s+hand(?:ed)?(?:\s+(?:off|over))?)?(?:\s+to\s+(?:me|you))?$/i;

export function isSpokenUnsharedWords(text: string): boolean {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  return SPOKEN_UNSHARED_WORDS.test(normalized);
}

export function spokenUnsharedWordsCopy(rules: HandoffRule[]): string {
  const once = groupedNamedPhrases(rules).filter((group) => group.actions.length === 1);
  if (!once.length) {
    return `No words are used once. Oriel named no other step. ${ASK_TAIL}`;
  }
  const lines = once.map((group) => phraseUseLine(group)).join(" ");
  return `These words are used once. ${lines} Oriel named no other step. ${ASK_TAIL}`;
}

export function loosensSpokenUnsharedWords(text: string): boolean {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  if (!/^(?:please,?\s+)?which words?\s+(?:are|is)\s+not\s+shared\b/i.test(normalized)) return false;
  return /without asking|always[-\s]?allow|allow automatically|take action without/i.test(normalized);
}

const SPOKEN_SHARE =
  /^(?:please,?\s+)?(?:does|do)\s+(?:the\s+|an\s+|a\s+|any\s+)?(?:public\s+)?([a-z][a-z-]*)\s+shar(?:e|es|ing)\s+words(?:\s+hand(?:ed)?(?:\s+(?:off|over))?)?(?:\s+to\s+(?:me|you))?$/i;

export type SpokenShare = { kind: "ask"; action: HandoffAction } | { kind: "reject"; reason: "action" };

export function readSpokenShare(text: string): SpokenShare | null {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  if (/\bnot\s+shar/i.test(normalized)) return null;
  if (/\bshar(?:e|es|ing)\s+words\s+with\b/i.test(normalized)) return null;
  const match = normalized.match(SPOKEN_SHARE);
  if (!match) return null;
  const action = SPOKEN_NOUNS[(match[1] ?? "").toLowerCase()];
  if (!action) return { kind: "reject", reason: "action" };
  return { kind: "ask", action };
}

export function spokenShareCopy(action: HandoffAction, rules: HandoffRule[]): string {
  const rule = rules.find((item) => item.action === action);
  if (!rule) {
    return `${READ_LABEL[action]} is not handed to you. There is no handoff rule for ${ASK_ONE[action]}. Oriel named no other step. ${ASK_TAIL}`;
  }
  if (!rule.phrase) {
    return `${READ_LABEL[action]} is handed to you. That rule names no words and is ${READ_WHOLE[action]}. Oriel did not treat this question as a share and did not quote another rule. Oriel named no other step. ${ASK_TAIL}`;
  }
  const key = phraseKey(rule.phrase);
  const others = READ_ORDER.flatMap((item) => {
    if (item === action) return [];
    const other = rules.find((candidate) => candidate.action === item);
    if (!other?.phrase || phraseKey(other.phrase) !== key) return [];
    return [other];
  });
  if (!others.length) {
    return `${READ_LABEL[action]} is handed to you. Those words are used once. The words are “${rule.phrase}”. Oriel named no other step. ${ASK_TAIL}`;
  }
  const names = joinLabels(others.map((other) => READ_LABEL[other.action]));
  const verb = others.length === 1 ? "uses" : "use";
  return `${READ_LABEL[action]} shares those words. The words are “${rule.phrase}”. ${names} ${verb} them. Oriel named no other step. ${ASK_TAIL}`;
}

export function loosensSpokenShare(text: string): boolean {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  if (/\bnot\s+shar/i.test(normalized)) return false;
  if (!/^(?:please,?\s+)?(?:does|do)\s+(?:the\s+|an\s+|a\s+|any\s+)?(?:public\s+)?[a-z][a-z-]*\s+shar(?:e|es|ing)\s+words\b/i.test(normalized)) {
    return false;
  }
  return /without asking|always[-\s]?allow|allow automatically|take action without/i.test(normalized);
}

const SPOKEN_NOT_SHARE =
  /^(?:please,?\s+)?(?:does|do)\s+(?:the\s+|an\s+|a\s+|any\s+)?(?:public\s+)?([a-z][a-z-]*)\s+not\s+shar(?:e|es|ing)\s+words(?:\s+hand(?:ed)?(?:\s+(?:off|over))?)?(?:\s+to\s+(?:me|you))?$/i;

export type SpokenNotShare = { kind: "ask"; action: HandoffAction } | { kind: "reject"; reason: "action" };

export function readSpokenNotShare(text: string): SpokenNotShare | null {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  if (/\bshar(?:e|es|ing)\s+words\s+with\b/i.test(normalized)) return null;
  const match = normalized.match(SPOKEN_NOT_SHARE);
  if (!match) return null;
  const action = SPOKEN_NOUNS[(match[1] ?? "").toLowerCase()];
  if (!action) return { kind: "reject", reason: "action" };
  return { kind: "ask", action };
}

export function spokenNotShareCopy(action: HandoffAction, rules: HandoffRule[]): string {
  const rule = rules.find((item) => item.action === action);
  if (!rule) {
    return `${READ_LABEL[action]} is not handed to you. There is no handoff rule for ${ASK_ONE[action]}. Oriel named no other step. ${ASK_TAIL}`;
  }
  if (!rule.phrase) {
    return `${READ_LABEL[action]} is handed to you. That rule names no words and is ${READ_WHOLE[action]}. Oriel did not treat this question as a share and did not quote another rule. Oriel named no other step. ${ASK_TAIL}`;
  }
  const key = phraseKey(rule.phrase);
  const others = READ_ORDER.flatMap((item) => {
    if (item === action) return [];
    const other = rules.find((candidate) => candidate.action === item);
    if (!other?.phrase || phraseKey(other.phrase) !== key) return [];
    return [other];
  });
  if (!others.length) {
    return `${READ_LABEL[action]} does not share those words. The words are “${rule.phrase}”. Oriel named no other step. ${ASK_TAIL}`;
  }
  const names = joinLabels(others.map((other) => READ_LABEL[other.action]));
  const verb = others.length === 1 ? "uses" : "use";
  return `${READ_LABEL[action]} does share those words. The words are “${rule.phrase}”. ${names} ${verb} them. Oriel named no other step. ${ASK_TAIL}`;
}

export function loosensSpokenNotShare(text: string): boolean {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  if (/\bshar(?:e|es|ing)\s+words\s+with\b/i.test(normalized)) return false;
  if (!/^(?:please,?\s+)?(?:does|do)\s+(?:the\s+|an\s+|a\s+|any\s+)?(?:public\s+)?[a-z][a-z-]*\s+not\s+shar(?:e|es|ing)\s+words\b/i.test(normalized)) {
    return false;
  }
  return /without asking|always[-\s]?allow|allow automatically|take action without/i.test(normalized);
}

const SPOKEN_SHARE_WITH =
  /^(?:please,?\s+)?(?:does|do)\s+(?:the\s+|an\s+|a\s+|any\s+)?(?:public\s+)?([a-z][a-z-]*)\s+shar(?:e|es|ing)\s+words\s+with\s+(?:the\s+|an\s+|a\s+|any\s+)?(?:public\s+)?([a-z][a-z-]*)(?:\s+hand(?:ed)?(?:\s+(?:off|over))?)?(?:\s+to\s+(?:me|you))?$/i;

const WITH_LABEL: Record<HandoffAction, string> = {
  send: "the send",
  pay: "the payment",
  delete: "the deletion",
  post: "the public post",
};

export type SpokenShareWith =
  | { kind: "ask"; action: HandoffAction; other: HandoffAction }
  | { kind: "reject"; reason: "action" };

export function readSpokenShareWith(text: string): SpokenShareWith | null {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  if (/\bnot\s+shar/i.test(normalized)) return null;
  const match = normalized.match(SPOKEN_SHARE_WITH);
  if (!match) return null;
  const action = SPOKEN_NOUNS[(match[1] ?? "").toLowerCase()];
  const other = SPOKEN_NOUNS[(match[2] ?? "").toLowerCase()];
  if (!action || !other || action === other) return { kind: "reject", reason: "action" };
  return { kind: "ask", action, other };
}

export function spokenShareWithCopy(action: HandoffAction, other: HandoffAction, rules: HandoffRule[]): string {
  const rule = rules.find((item) => item.action === action);
  if (!rule) {
    return `${READ_LABEL[action]} is not handed to you. There is no handoff rule for ${ASK_ONE[action]}. Oriel named no other step. ${ASK_TAIL}`;
  }
  if (!rule.phrase) {
    return `${READ_LABEL[action]} is handed to you. That rule names no words and is ${READ_WHOLE[action]}. Oriel did not treat this question as a share with the other step and did not quote that step. Oriel named no other step. ${ASK_TAIL}`;
  }
  const otherRule = rules.find((item) => item.action === other);
  const shares = Boolean(otherRule?.phrase && phraseKey(otherRule.phrase) === phraseKey(rule.phrase));
  const lead = shares
    ? `${READ_LABEL[action]} shares those words with ${WITH_LABEL[other]}.`
    : `${READ_LABEL[action]} does not share those words with ${WITH_LABEL[other]}.`;
  return `${lead} The words are “${rule.phrase}”. Oriel named no other step. ${ASK_TAIL}`;
}

export function loosensSpokenShareWith(text: string): boolean {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  if (/\bnot\s+shar/i.test(normalized)) return false;
  if (
    !/^(?:please,?\s+)?(?:does|do)\s+(?:the\s+|an\s+|a\s+|any\s+)?(?:public\s+)?[a-z][a-z-]*\s+shar(?:e|es|ing)\s+words\s+with\s+/i.test(
      normalized,
    )
  ) {
    return false;
  }
  return /without asking|always[-\s]?allow|allow automatically|take action without/i.test(normalized);
}

const SPOKEN_NOT_SHARE_WITH =
  /^(?:please,?\s+)?(?:does|do)\s+(?:the\s+|an\s+|a\s+|any\s+)?(?:public\s+)?([a-z][a-z-]*)\s+not\s+shar(?:e|es|ing)\s+words\s+with\s+(?:the\s+|an\s+|a\s+|any\s+)?(?:public\s+)?([a-z][a-z-]*)(?:\s+hand(?:ed)?(?:\s+(?:off|over))?)?(?:\s+to\s+(?:me|you))?$/i;

export type SpokenNotShareWith =
  | { kind: "ask"; action: HandoffAction; other: HandoffAction }
  | { kind: "reject"; reason: "action" };

export function readSpokenNotShareWith(text: string): SpokenNotShareWith | null {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  const match = normalized.match(SPOKEN_NOT_SHARE_WITH);
  if (!match) return null;
  const action = SPOKEN_NOUNS[(match[1] ?? "").toLowerCase()];
  const other = SPOKEN_NOUNS[(match[2] ?? "").toLowerCase()];
  if (!action || !other || action === other) return { kind: "reject", reason: "action" };
  return { kind: "ask", action, other };
}

export function spokenNotShareWithCopy(action: HandoffAction, other: HandoffAction, rules: HandoffRule[]): string {
  const rule = rules.find((item) => item.action === action);
  if (!rule) {
    return `${READ_LABEL[action]} is not handed to you. There is no handoff rule for ${ASK_ONE[action]}. Oriel named no other step. ${ASK_TAIL}`;
  }
  if (!rule.phrase) {
    return `${READ_LABEL[action]} is handed to you. That rule names no words and is ${READ_WHOLE[action]}. Oriel did not treat this question as a comparison with the other step and did not quote that step. Oriel named no other step. ${ASK_TAIL}`;
  }
  const otherRule = rules.find((item) => item.action === other);
  const shares = Boolean(otherRule?.phrase && phraseKey(otherRule.phrase) === phraseKey(rule.phrase));
  const lead = shares
    ? `${READ_LABEL[action]} does share those words with ${WITH_LABEL[other]}.`
    : `${READ_LABEL[action]} does not share those words with ${WITH_LABEL[other]}.`;
  return `${lead} The words are “${rule.phrase}”. Oriel named no other step. ${ASK_TAIL}`;
}

export function loosensSpokenNotShareWith(text: string): boolean {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  if (
    !/^(?:please,?\s+)?(?:does|do)\s+(?:the\s+|an\s+|a\s+|any\s+)?(?:public\s+)?[a-z][a-z-]*\s+not\s+shar(?:e|es|ing)\s+words\s+with\s+/i.test(
      normalized,
    )
  ) {
    return false;
  }
  return /without asking|always[-\s]?allow|allow automatically|take action without/i.test(normalized);
}

const SPOKEN_SHARED_WITH =
  /^(?:please,?\s+)?which steps?\s+shar(?:e|es|ing)\s+words\s+with\s+(?:the\s+|an\s+|a\s+|any\s+)?(?:public\s+)?([a-z][a-z-]*)(?:\s+hand(?:ed)?(?:\s+(?:off|over))?)?(?:\s+to\s+(?:me|you))?$/i;

export type SpokenSharedWith = { kind: "ask"; action: HandoffAction } | { kind: "reject"; reason: "action" };

export function readSpokenSharedWith(text: string): SpokenSharedWith | null {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  if (/\b(?:do|does)\s+not\s+shar/i.test(normalized)) return null;
  const match = normalized.match(SPOKEN_SHARED_WITH);
  if (!match) return null;
  const action = SPOKEN_NOUNS[(match[1] ?? "").toLowerCase()];
  if (!action) return { kind: "reject", reason: "action" };
  return { kind: "ask", action };
}

export function spokenSharedWithCopy(action: HandoffAction, rules: HandoffRule[]): string {
  const rule = rules.find((item) => item.action === action);
  if (!rule) {
    return `${READ_LABEL[action]} is not handed to you. There is no handoff rule for ${ASK_ONE[action]}. Oriel named no other step. ${ASK_TAIL}`;
  }
  if (!rule.phrase) {
    return `${READ_LABEL[action]} is handed to you. That rule names no words and is ${READ_WHOLE[action]}. Oriel did not treat this question as a share with the other steps and did not quote another step. Oriel named no other step. ${ASK_TAIL}`;
  }
  const key = phraseKey(rule.phrase);
  const others = READ_ORDER.flatMap((item) => {
    if (item === action) return [];
    const other = rules.find((candidate) => candidate.action === item);
    if (!other?.phrase || phraseKey(other.phrase) !== key) return [];
    return [other];
  });
  const quoted = `The words are “${rule.phrase}”.`;
  if (others.length === 0) {
    return `No other step shares those words with ${WITH_LABEL[action]}. ${quoted} Oriel named no other step. ${ASK_TAIL}`;
  }
  const only = others[0];
  if (others.length === 1 && only) {
    return `${READ_LABEL[only.action]} shares those words with ${WITH_LABEL[action]}. ${quoted} Oriel named no other step. ${ASK_TAIL}`;
  }
  const names = joinLabels(others.map((other) => READ_LABEL[other.action]));
  return `These steps share those words with ${WITH_LABEL[action]}. ${quoted} ${names} use them. Oriel named no other step. ${ASK_TAIL}`;
}

export function loosensSpokenSharedWith(text: string): boolean {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  if (/\b(?:do|does)\s+not\s+shar/i.test(normalized)) return false;
  if (!/^(?:please,?\s+)?which steps?\s+shar(?:e|es|ing)\s+words\s+with\s+/i.test(normalized)) return false;
  return /without asking|always[-\s]?allow|allow automatically|take action without/i.test(normalized);
}

const SPOKEN_UNSHARED_WITH =
  /^(?:please,?\s+)?which steps?\s+(?:do|does)\s+not\s+shar(?:e|es|ing)\s+words\s+with\s+(?:the\s+|an\s+|a\s+|any\s+)?(?:public\s+)?([a-z][a-z-]*)(?:\s+hand(?:ed)?(?:\s+(?:off|over))?)?(?:\s+to\s+(?:me|you))?$/i;

export type SpokenUnsharedWith = { kind: "ask"; action: HandoffAction } | { kind: "reject"; reason: "action" };

export function readSpokenUnsharedWith(text: string): SpokenUnsharedWith | null {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  const match = normalized.match(SPOKEN_UNSHARED_WITH);
  if (!match) return null;
  const action = SPOKEN_NOUNS[(match[1] ?? "").toLowerCase()];
  if (!action) return { kind: "reject", reason: "action" };
  return { kind: "ask", action };
}

export function spokenUnsharedWithCopy(action: HandoffAction, rules: HandoffRule[]): string {
  const rule = rules.find((item) => item.action === action);
  if (!rule) {
    return `${READ_LABEL[action]} is not handed to you. There is no handoff rule for ${ASK_ONE[action]}. Oriel named no other step. ${ASK_TAIL}`;
  }
  if (!rule.phrase) {
    return `${READ_LABEL[action]} is handed to you. That rule names no words and is ${READ_WHOLE[action]}. Oriel did not treat this question as a comparison with the other steps and did not quote another step. Oriel named no other step. ${ASK_TAIL}`;
  }
  const key = phraseKey(rule.phrase);
  const others = READ_ORDER.flatMap((item) => {
    if (item === action) return [];
    const other = rules.find((candidate) => candidate.action === item);
    if (!other?.phrase || phraseKey(other.phrase) !== key) return [];
    return [other];
  });
  const quoted = `The words are “${rule.phrase}”.`;
  if (others.length === 0) {
    return `No other step shares those words with ${WITH_LABEL[action]}. ${quoted} Oriel named no other step. ${ASK_TAIL}`;
  }
  const only = others[0];
  if (others.length === 1 && only) {
    return `${READ_LABEL[only.action]} does share those words with ${WITH_LABEL[action]}. ${quoted} Oriel named no other step. ${ASK_TAIL}`;
  }
  const names = joinLabels(others.map((other) => READ_LABEL[other.action]));
  return `These steps do share those words with ${WITH_LABEL[action]}. ${quoted} ${names} use them. Oriel named no other step. ${ASK_TAIL}`;
}

export function loosensSpokenUnsharedWith(text: string): boolean {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  if (!/^(?:please,?\s+)?which steps?\s+(?:do|does)\s+not\s+shar(?:e|es|ing)\s+words\s+with\s+/i.test(normalized)) return false;
  return /without asking|always[-\s]?allow|allow automatically|take action without/i.test(normalized);
}

const SPOKEN_NOT_SHARE_WORDS =
  /^(?:please,?\s+)?which words?\s+(?:does|do)\s+(?:the\s+|an\s+|a\s+|any\s+)?(?:public\s+)?([a-z][a-z-]*)\s+not\s+shar(?:e|es|ing)(?:\s+hand(?:ed)?(?:\s+(?:off|over))?)?(?:\s+to\s+(?:me|you))?$/i;

export type SpokenNotShareWords = { kind: "ask"; action: HandoffAction } | { kind: "reject"; reason: "action" };

export function readSpokenNotShareWords(text: string): SpokenNotShareWords | null {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  if (/\bshar(?:e|es|ing)\s+words\s+with\b/i.test(normalized)) return null;
  if (/\bnot\s+shar(?:e|es|ing)\s+with\b/i.test(normalized)) return null;
  const match = normalized.match(SPOKEN_NOT_SHARE_WORDS);
  if (!match) return null;
  const action = SPOKEN_NOUNS[(match[1] ?? "").toLowerCase()];
  if (!action) return { kind: "reject", reason: "action" };
  return { kind: "ask", action };
}

export function spokenNotShareWordsCopy(action: HandoffAction, rules: HandoffRule[]): string {
  const rule = rules.find((item) => item.action === action);
  if (!rule) {
    return `${READ_LABEL[action]} is not handed to you. There is no handoff rule for ${ASK_ONE[action]}. Oriel named no other step. ${ASK_TAIL}`;
  }
  if (!rule.phrase) {
    return `${READ_LABEL[action]} is handed to you. That rule names no words and is ${READ_WHOLE[action]}. Oriel did not treat this question as a comparison and did not quote a phrase. Oriel named no other step. ${ASK_TAIL}`;
  }
  const key = phraseKey(rule.phrase);
  const others = READ_ORDER.flatMap((item) => {
    if (item === action) return [];
    const other = rules.find((candidate) => candidate.action === item);
    if (!other?.phrase || phraseKey(other.phrase) !== key) return [];
    return [other];
  });
  const quoted = `The words are “${rule.phrase}”.`;
  if (!others.length) {
    return `${READ_LABEL[action]} does not share these words. ${quoted} Oriel named no other step. ${ASK_TAIL}`;
  }
  const names = joinLabels(others.map((other) => READ_LABEL[other.action]));
  const verb = others.length === 1 ? "uses" : "use";
  return `${READ_LABEL[action]} does share these words. ${quoted} ${names} ${verb} them. Oriel named no other step. ${ASK_TAIL}`;
}

export function loosensSpokenNotShareWords(text: string): boolean {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  if (/\bshar(?:e|es|ing)\s+words\s+with\b/i.test(normalized)) return false;
  if (/\bnot\s+shar(?:e|es|ing)\s+with\b/i.test(normalized)) return false;
  if (
    !/^(?:please,?\s+)?which words?\s+(?:does|do)\s+(?:the\s+|an\s+|a\s+|any\s+)?(?:public\s+)?[a-z][a-z-]*\s+not\s+shar(?:e|es|ing)\b/i.test(
      normalized,
    )
  ) {
    return false;
  }
  return /without asking|always[-\s]?allow|allow automatically|take action without/i.test(normalized);
}

const SPOKEN_SHARE_WORDS =
  /^(?:please,?\s+)?which words?\s+(?:does|do)\s+(?:the\s+|an\s+|a\s+|any\s+)?(?:public\s+)?([a-z][a-z-]*)\s+shar(?:e|es|ing)(?:\s+hand(?:ed)?(?:\s+(?:off|over))?)?(?:\s+to\s+(?:me|you))?$/i;

export type SpokenShareWords = { kind: "ask"; action: HandoffAction } | { kind: "reject"; reason: "action" };

export function readSpokenShareWords(text: string): SpokenShareWords | null {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  if (/\bnot\s+shar/i.test(normalized)) return null;
  if (/\bshar(?:e|es|ing)\s+words\s+with\b/i.test(normalized)) return null;
  const match = normalized.match(SPOKEN_SHARE_WORDS);
  if (!match) return null;
  const action = SPOKEN_NOUNS[(match[1] ?? "").toLowerCase()];
  if (!action) return { kind: "reject", reason: "action" };
  return { kind: "ask", action };
}

export function spokenShareWordsCopy(action: HandoffAction, rules: HandoffRule[]): string {
  const rule = rules.find((item) => item.action === action);
  if (!rule) {
    return `${READ_LABEL[action]} is not handed to you. There is no handoff rule for ${ASK_ONE[action]}. Oriel named no other step. ${ASK_TAIL}`;
  }
  if (!rule.phrase) {
    return `${READ_LABEL[action]} is handed to you. That rule names no words and is ${READ_WHOLE[action]}. Oriel did not treat this question as a share and did not quote a phrase. Oriel named no other step. ${ASK_TAIL}`;
  }
  const key = phraseKey(rule.phrase);
  const others = READ_ORDER.flatMap((item) => {
    if (item === action) return [];
    const other = rules.find((candidate) => candidate.action === item);
    if (!other?.phrase || phraseKey(other.phrase) !== key) return [];
    return [other];
  });
  const quoted = `The words are “${rule.phrase}”.`;
  if (!others.length) {
    return `Those words are used once. ${quoted} Oriel named no other step. ${ASK_TAIL}`;
  }
  const names = joinLabels(others.map((other) => READ_LABEL[other.action]));
  const verb = others.length === 1 ? "uses" : "use";
  return `${READ_LABEL[action]} shares these words. ${quoted} ${names} ${verb} them. Oriel named no other step. ${ASK_TAIL}`;
}

export function loosensSpokenShareWords(text: string): boolean {
  const normalized = text.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  if (/\bnot\s+shar/i.test(normalized)) return false;
  if (/\bshar(?:e|es|ing)\s+words\s+with\b/i.test(normalized)) return false;
  if (
    !/^(?:please,?\s+)?which words?\s+(?:does|do)\s+(?:the\s+|an\s+|a\s+|any\s+)?(?:public\s+)?[a-z][a-z-]*\s+shar(?:e|es|ing)\b/i.test(
      normalized,
    )
  ) {
    return false;
  }
  return /without asking|always[-\s]?allow|allow automatically|take action without/i.test(normalized);
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
