import type { Connector, Intent, SeatChoice, SeatId } from "./types.js";

export const AS_OF = "2026-10-23";

export const TRUST =
  "Oriel records every hold. Releasing a hold does not send mail, move money, post in public, or sign in anywhere. A password change, a sign-in, or a code is handed to you, and marking it done does not type a secret or approve a hold. A handoff rule for a named action makes that step yours when a request would do it. You can name the words in a sentence. Saying that sentence saves the same rule and does not open a card. Saying stop handing those same words to you clears that one rule and does not open a card. Words that are not the saved phrase do not clear it. Asking what is handed to you names each saved rule and does not open a card. Asking whether one action is handed to you names only that rule and does not open a card. Asking whether that action mentions certain words names only that match. A rule with no such words is not treated as those words, and different saved words stay the saved words. Asking which words one step uses names that phrase alone. A step with no phrase is described as naming none. Asking which step mentions certain words names only the actions whose phrase is those words. More than one such action is named, and a rule with no phrase is not those words. If none use them, Oriel says so and does not name the others. Asking which steps do not mention certain words names only the actions whose phrase is not those words, in send, pay, delete, and post order, and quotes each saved phrase. More than one such action is named. A phrase that is those words is left out and is not quoted. A rule with no phrase is left out and is not described as the whole action. If no step has other words, Oriel says so, quotes the asked words once, and does not name a step. Asking whether one step does not mention certain words names only that step. When the saved phrase is those words, Oriel says that step does mention those words and quotes the phrase saved on that step. When the saved phrase is different, Oriel says that step does not mention those words and quotes only the saved phrase. A rule with no phrase says it names no words and is the whole action, and is not treated as a mention. If that step has no rule, Oriel says so and does not quote a phrase or name the others. Asking whether one step mentions certain words names only that step. When the saved phrase is those words, Oriel says that step mentions those words and quotes the phrase saved on that step. When the saved phrase is different, Oriel says that step mentions other words and quotes only the saved phrase. It does not say that step does mention those words or that step does not mention those words. A rule with no phrase says it names no words and is the whole action, and is not treated as a mention. If that step has no rule, Oriel says so and does not quote a phrase or name the others. Asking whether one step mentions the same words as one other step compares those two saved phrases. When they match, Oriel says that step mentions the same words as the other step and quotes the phrase saved on the subject once. When the other step has no rule, no phrase, or different words, Oriel says that step does not mention the same words as the other step and quotes only the subject. A rule with no phrase says it names no words and is the whole action, and is not treated as a comparison with the other step. If that step has no rule, Oriel says so and does not name the other step or quote a phrase. The two steps have to be different. Asking whether one step does not mention the same words as one other step compares those two saved phrases. When they match, Oriel says that step does mention the same words as the other step and quotes the phrase saved on the subject once. It does not say that step mentions the same words as the other step. When the other step has no rule, no phrase, or different words, Oriel says that step does not mention the same words as the other step and quotes only the subject. A rule with no phrase says it names no words and is the whole action, and is not treated as a comparison with the other step. If that step has no rule, Oriel says so and does not name the other step or quote a phrase. The two steps have to be different. Asking which steps mention the same words as one step names only the other actions that use the phrase saved on that step, in send, pay, delete, and post order, and quotes that phrase once. When more than one other step uses it, Oriel says these steps mention the same words as that step. When one other step uses it, Oriel names that step. When no other step uses it, Oriel says no other step mentions the same words as that step. A rule with no phrase says it names no words and is the whole action, and is not treated as a comparison with the other steps. If that step has no rule, Oriel says so and does not name the other steps or quote a phrase. Asking which steps do not mention the same words as one step uses that same comparison. When more than one other step uses the phrase, Oriel says these steps do mention the same words as that step and names only those other steps. When one other step uses it, Oriel says that step does mention the same words as that step. When no other step uses it, Oriel says no other step mentions the same words as that step and does not say that no other step does mention them. A rule with no phrase says it names no words and is the whole action, and is not treated as a comparison with the other steps. If that step has no rule, Oriel says so and does not name the other steps or quote a phrase. Asking which words one step mentions quotes the phrase saved on that step and says that step mentions these words. It names no other step. It does not say that step shares these words, that those words are used once, or that the step is handed to you and then quote the words. A rule with no phrase says it names no words and is the whole action, and is not treated as a mention. It does not say that step mentions these words. If that step has no rule, Oriel says so and does not quote a phrase. Asking which steps name no words names only the actions whose rules have no phrase. More than one such action is named, a rule that names words is left out, and its phrase is not quoted. If none are saved that way, Oriel says so and does not name the others. Asking which steps name words names only the actions whose rules have a phrase, and quotes each phrase. More than one such action is named. A rule with no phrase is left out and is not described as the whole action. If none name words, Oriel says so and does not name the others. Asking which steps share words names only the actions whose phrase is exactly the same as another saved rule, and quotes that phrase on each. A share needs at least two actions. A phrase used once is left out and is not quoted. A rule with no phrase is left out and is not described as the whole action. If no two rules share a phrase, Oriel says so and does not name the others. Asking which words are shared names only the phrases used by at least two rules, once each, and with each phrase names the actions that use it, in send, pay, delete, and post order. The quoted words are the ones saved on the earliest of those actions. A phrase used once is left out and is not quoted. A rule with no phrase is left out and is not described as the whole action. If no phrase is shared, Oriel says so and does not name the others. Asking which words are not shared names only the phrases used by exactly one rule, once each, and with each phrase names the one action that uses it, in send, pay, delete, and post order. The quoted words are the ones saved on that action. A phrase used by two or more rules is left out and is not quoted. A rule with no phrase is left out and is not described as the whole action. If no phrase is used only once, Oriel says so and does not name the others. Asking which steps do not share words names only the actions whose phrase is used by exactly one rule, and quotes that phrase on each, in send, pay, delete, and post order. A phrase used by two or more rules is left out and is not quoted. A rule with no phrase is left out and is not described as the whole action. If no step uses words only once, Oriel says so and does not name the others. Asking whether one step shares words quotes the phrase saved on that step and names only the other actions that use it. If those words are used once, it says so and does not name the other rules. A rule with no phrase says it names no words and is the whole action, and is not treated as a share. If that step has no rule, Oriel says so and does not name the others. Asking which words one step shares quotes the phrase saved on that step. When another step uses those words, it says that step shares these words and names only the other actions. When those words are used once, it says so and names no other step. A rule with no phrase is not treated as that share and is not quoted. It does not say with that step. Asking which words one step does not share quotes the phrase saved on that step. When another step uses those words, it says that step does share these words and names only the other actions. When no other step uses them, it says that step does not share these words and names no other step. A rule with no phrase is not treated as that comparison and is not quoted. It does not say with that step. The rule does not run the step, wake, or approve a hold. A skill is a method you apply on a turn. It does not wake, and it does not approve a hold. A saved routine can wake on a cadence you choose. Pausing wakes stops those cadences until you resume, and neither a pause nor a wake approves the hold. A hold raised by a wake expires if you are away, and the action does not run. There is no always-allow. A live bridge is an endpoint you control.";

export const DISPLAY: Record<SeatId, string> = {
  grok: "Grok Bot",
  dots: "Dots",
  muse: "Muse",
};

const ORDER: SeatId[] = ["grok", "dots", "muse"];

const PATTERNS: Record<Exclude<Intent, "direct">, RegExp> = {
  research:
    /\b(research|compare|comparison|versus|vs\.?|competitor|competitors|market|landscape|news|summarize|summary|sources?)\b/i,
  operate:
    /\b(inbox|schedule|calendar|booking|ops|routine|workflow|onboard|crm|ticket|weekly close)\b/i,
  code: /\b(bug|fix|implement|refactor|tests?|pull request|repo|repository|code|typescript|failing)\b/i,
  write: /\b(draft|write|memo|document|narrative|outline|script|copy|note)\b/i,
  personal:
    /\b(grocery|dinner|family|kids|household|errand|birthday|gift|health|flight|hotel|travel|trip)\b/i,
  money: /\b(pay|paid|purchase|buy|checkout|transfer|wire)\b|\$\d/i,
  communicate: /\b(email|e-mail|send|slack|message|whatsapp|text|publish|tweet|post)\b/i,
  analyze:
    /\b(analyze|analyse|metric|metrics|funnel|spreadsheet|retention|revenue|risk|risks)\b/i,
};

const AFFINITY: Record<SeatId, Record<Intent, number>> = {
  grok: {
    research: 3,
    operate: 5,
    code: 5,
    write: 2,
    personal: 1,
    money: 2,
    communicate: 3,
    analyze: 3,
    direct: 2,
  },
  dots: {
    research: 4,
    operate: 3,
    code: 4,
    write: 5,
    personal: 2,
    money: 2,
    communicate: 3,
    analyze: 4,
    direct: 3,
  },
  muse: {
    research: 1,
    operate: 2,
    code: 0,
    write: 2,
    personal: 5,
    money: 3,
    communicate: 4,
    analyze: 1,
    direct: 2,
  },
};

const INTENT_LABEL: Record<Intent, string> = {
  research: "research",
  operate: "operations",
  code: "a code change",
  write: "writing",
  personal: "personal logistics",
  money: "money",
  communicate: "an outbound message",
  analyze: "analysis",
  direct: "a general request",
};

export function isSeatId(value: string): value is SeatId {
  return value === "grok" || value === "dots" || value === "muse";
}

export function scoreIntents(text: string): Intent[] {
  const active = (Object.keys(PATTERNS) as Exclude<Intent, "direct">[]).filter((intent) =>
    PATTERNS[intent].test(text),
  );
  return active.length ? active : ["direct"];
}

export function phrase(intents: Intent[]): string {
  const labels = intents.filter((intent) => intent !== "direct").map((intent) => INTENT_LABEL[intent]);
  if (labels.length === 0) return "a request that does not name a lane";
  if (labels.length === 1) return labels[0] ?? "a request";
  const last = labels.at(-1);
  return `${labels.slice(0, -1).join(", ")} and ${last}`;
}

export function seatScore(seat: SeatId, intents: Intent[]): number {
  const keys = intents.length === 1 && intents[0] === "direct" ? (["direct"] as Intent[]) : intents.filter((intent) => intent !== "direct");
  return keys.reduce((sum, intent) => sum + AFFINITY[seat][intent], 0);
}

export function explainDissent(intents: Intent[], picked: SeatId[]): string | null {
  if (
    picked.includes("muse") &&
    picked.includes("grok") &&
    intents.includes("personal") &&
    intents.includes("operate")
  ) {
    return "Muse would keep this as a conversation and ask each time. Grok would turn a second clean pass into a routine. Oriel will not schedule anything unless you save a routine.";
  }
  if (
    picked.includes("dots") &&
    picked.includes("grok") &&
    intents.includes("code") &&
    intents.includes("write")
  ) {
    return "Dots would own the draft between conversations. Grok would treat the repo as the source of truth and run the test. Oriel wants the test named before the draft is trusted.";
  }
  if (intents.includes("money") && picked.includes("muse")) {
    return "Muse can prepare the errand. Oriel will not spend, and releasing a hold still does not move money.";
  }
  return null;
}

export function chooseSeats(text: string, businessSensitive: boolean, connectors: Connector[]): SeatChoice {
  const intents = scoreIntents(text);
  const enabled = connectors.filter((connector) => connector.enabled);
  const disabled = connectors.filter((connector) => !connector.enabled);
  const ranked = enabled
    .map((connector) => ({ id: connector.id, score: seatScore(connector.id, intents) }))
    .sort((a, b) => b.score - a.score || ORDER.indexOf(a.id) - ORDER.indexOf(b.id));

  const dropped: { id: SeatId; reason: string }[] = [];
  let pool = ranked;
  if (businessSensitive && enabled.some((connector) => connector.id === "muse")) {
    pool = ranked.filter((row) => row.id !== "muse");
    dropped.push({
      id: "muse",
      reason:
        "Muse is off this request because Oriel does not place client, patient, or confidential work on a consumer seat.",
    });
  }
  for (const connector of disabled) {
    dropped.push({ id: connector.id, reason: `${DISPLAY[connector.id]} is switched off.` });
  }

  const viable = pool.filter((row) => row.score > 0);
  if (viable.length === 0) {
    return {
      picked: [],
      lead: null,
      reasons: ["No enabled work seat can take this.", ...dropped.map((item) => item.reason)],
      dropped,
      intents,
      dissent: null,
    };
  }

  const best = viable[0]?.score ?? 0;
  const picked = viable.filter((row) => row.score >= best * 0.6).slice(0, 3).map((row) => row.id);
  let lead: SeatId | null = picked[0] ?? null;
  const reasons: string[] = [];

  // Firm and client work prefers the seat with published team controls when it is actually on.
  if (businessSensitive && picked.includes("grok")) {
    lead = "grok";
    reasons.push(
      "Grok Bot leads because this request touches a client, a patient, or other non-personal work, and that seat is the one with published team controls.",
    );
  } else if (businessSensitive && lead === "dots") {
    reasons.push("Dots leads because Grok Bot is not available and the work stays off Muse.");
  } else if (lead === "muse") {
    reasons.push("Muse leads because this is personal logistics.");
  } else if (lead) {
    reasons.push(`${DISPLAY[lead]} leads on the connected seats for ${phrase(intents)}.`);
  }

  const others = picked.filter((id) => id !== lead);
  if (others.length) {
    reasons.push(`Also convened: ${others.map((id) => DISPLAY[id]).join(", ")}.`);
  }
  reasons.push(...dropped.map((item) => item.reason));

  return {
    picked,
    lead,
    reasons,
    dropped,
    intents,
    dissent: explainDissent(intents, picked),
  };
}
