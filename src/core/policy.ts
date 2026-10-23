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

export function readPolicy(text: string, memory: Memory): Policy {
  const forbadeSend = forbade(text, "send|sending|email|e-mail|emailing|message|messaging|slack");
  const forbadePay = forbade(text, "pay|paying|purchase|purchasing|buy|buying|spend|spending|transfer|transferring");
  const forbadeDelete = forbade(text, "delete|deleting|erase|erasing|wipe|wiping");
  const forbadePost = forbade(text, "publish|publishing|tweet|tweeting|post publicly");
  return {
    outbound: /\b(email|e-mail|send|slack|message|whatsapp)\b/i.test(text),
    payment: /\b(pay|purchase|buy|checkout|transfer|wire)\b/i.test(text) || /\$\d/.test(text),
    deletion: /\b(delete|erase|wipe)\b/i.test(text),
    publicPost: /\b(tweet|publish|post publicly)\b/i.test(text),
    credentials:
      /\b(password|api key|secret key|credentials?)\b/i.test(text) || /\bsk-[a-z0-9_-]{8,}\b/i.test(text),
    businessSensitive: /\b(client|clients|patient|patients|hipaa|law firm|customer data|confidential)\b/i.test(text),
    forbadeSend,
    forbadePay,
    forbadeDelete,
    forbadePost,
    preferShort: wantsShort(text, memory),
  };
}

export function kindsFor(policy: Policy): { held: ApprovalKind[]; skipped: ApprovalKind[] } {
  const held: ApprovalKind[] = [];
  const skipped: ApprovalKind[] = [];
  const consider = (on: boolean, stopped: boolean, kind: ApprovalKind) => {
    if (!on && !stopped) return;
    if (stopped) skipped.push(kind);
    else held.push(kind);
  };
  consider(policy.outbound, policy.forbadeSend, "send");
  consider(policy.payment, policy.forbadePay, "pay");
  consider(policy.deletion, policy.forbadeDelete, "delete");
  consider(policy.publicPost, policy.forbadePost, "post");
  if (policy.credentials) held.push("credential");
  return { held, skipped };
}
