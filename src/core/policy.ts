import { handoffFacts } from "./handoff.js";
import type { ApprovalKind, Memory, Policy } from "./types.js";

function forbade(text: string, verbs: string): boolean {
  return new RegExp(
    `\\b(?:do not|don't|dont|never|without)\\b(?:\\s+\\w+){0,5}\\s+(?:${verbs})\\b`,
    "i",
  ).test(text);
}

export function wantsShort(text: string, memory: Memory): boolean {
  if (/\b(keep it short|be brief|be concise|short briefs?|prefer short)\b/i.test(text)) return true;
  return memory.preferences.some((preference) =>
    /prefer short|short brief|be concise|keep it short/i.test(preference),
  );
}

function kindActive(policy: Policy, kind: ApprovalKind): boolean {
  if (kind === "send") return policy.outbound && !policy.forbadeSend;
  if (kind === "pay") return policy.payment && !policy.forbadePay;
  if (kind === "delete") return policy.deletion && !policy.forbadeDelete;
  if (kind === "post") return policy.publicPost && !policy.forbadePost;
  return policy.credentials;
}

export function readPolicy(text: string, memory: Memory): Policy {
  const forbadeSend = forbade(text, "send|sending|email|e-mail|emailing|message|messaging|slack");
  const forbadePay = forbade(text, "pay|paying|purchase|purchasing|buy|buying|spend|spending|transfer|transferring");
  const forbadeDelete = forbade(text, "delete|deleting|erase|erasing|wipe|wiping");
  const forbadePost = forbade(text, "publish|publishing|tweet|tweeting|post publicly");
  const facts = handoffFacts(text);
  const replaces = facts.replaces.filter((kind) => {
    if (kind === "send") return !forbadeSend;
    if (kind === "pay") return !forbadePay;
    if (kind === "delete") return !forbadeDelete;
    if (kind === "post") return !forbadePost;
    return true;
  });
  const separateSecret =
    /\b(api key|secret key|credentials?)\b/i.test(text) || /\bsk-[a-z0-9_-]{8,}\b/i.test(text);
  const mentionsSecret = separateSecret || /\bpasswords?\b/i.test(text);
  const credentials =
    mentionsSecret && !replaces.includes("credential") && !(facts.personPassword && !separateSecret);
  return {
    outbound: /\b(email|e-mail|send|slack|message|whatsapp)\b/i.test(text),
    payment: /\b(pay|purchase|buy|checkout|transfer|wire)\b/i.test(text) || /\$\d/.test(text),
    deletion: /\b(delete|erase|wipe)\b/i.test(text),
    publicPost: /\b(tweet|publish|post publicly)\b/i.test(text),
    credentials,
    businessSensitive: /\b(client|clients|patient|patients|hipaa|law firm|customer data|confidential)\b/i.test(text),
    forbadeSend,
    forbadePay,
    forbadeDelete,
    forbadePost,
    preferShort: wantsShort(text, memory),
    handoff: facts.personPassword || facts.personSignin || facts.personCode || facts.hands || replaces.length > 0,
    replaces,
    personPassword: facts.personPassword,
    personSignin: facts.personSignin,
    personCode: facts.personCode,
  };
}

export function withSkillProhibitions(user: Policy, method: string, memory: Memory): Policy {
  const skill = readPolicy(method, memory);
  const replaces = [...user.replaces];
  for (const kind of skill.replaces) {
    if (kindActive(user, kind) && !replaces.includes(kind)) replaces.push(kind);
  }
  return {
    ...user,
    businessSensitive: user.businessSensitive || skill.businessSensitive,
    preferShort: user.preferShort || skill.preferShort,
    forbadeSend: user.forbadeSend || (skill.forbadeSend && user.outbound),
    forbadePay: user.forbadePay || (skill.forbadePay && user.payment),
    forbadeDelete: user.forbadeDelete || (skill.forbadeDelete && user.deletion),
    forbadePost: user.forbadePost || (skill.forbadePost && user.publicPost),
    replaces,
    handoff: user.handoff || replaces.length > user.replaces.length,
    credentials: replaces.includes("credential") ? false : user.credentials,
  };
}

export function kindsFor(policy: Policy): { held: ApprovalKind[]; skipped: ApprovalKind[] } {
  const held: ApprovalKind[] = [];
  const skipped: ApprovalKind[] = [];
  const consider = (on: boolean, stopped: boolean, kind: ApprovalKind) => {
    if (!on && !stopped) return;
    if (stopped) skipped.push(kind);
    else if (!policy.replaces.includes(kind)) held.push(kind);
  };
  consider(policy.outbound, policy.forbadeSend, "send");
  consider(policy.payment, policy.forbadePay, "pay");
  consider(policy.deletion, policy.forbadeDelete, "delete");
  consider(policy.publicPost, policy.forbadePost, "post");
  if (policy.credentials && !policy.replaces.includes("credential")) held.push("credential");
  return { held, skipped };
}
