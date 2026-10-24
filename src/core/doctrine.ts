import type { Connector, Intent, SeatChoice, SeatId } from "./types.js";

export const AS_OF = "2026-10-23";

export const TRUST =
  "Oriel records every hold. Releasing a hold does not send mail, move money, post in public, or sign in anywhere. A password change, a sign-in, or a code is handed to you, and marking it done does not type a secret or approve a hold. A handoff rule for a named action makes that step yours when a request would do it. You can name the words in a sentence. Saying that sentence saves the same rule and does not open a card. Saying stop handing those same words to you clears that one rule and does not open a card. Words that are not the saved phrase do not clear it. Asking what is handed to you names each saved rule and does not open a card. Asking whether one action is handed to you names only that rule and does not open a card. Asking whether that action mentions certain words names only that match. A rule with no such words is not treated as those words, and different saved words stay the saved words. Asking which words one step uses names that phrase alone. A step with no phrase is described as naming none. Asking which step mentions certain words names only the actions whose phrase is those words. More than one such action is named, and a rule with no phrase is not those words. If none use them, Oriel says so and does not name the others. Asking which steps do not mention certain words names only the actions whose phrase is not those words, in send, pay, delete, and post order, and quotes each saved phrase. More than one such action is named. A phrase that is those words is left out and is not quoted. A rule with no phrase is left out and is not described as the whole action. If no step has other words, Oriel says so, quotes the asked words once, and does not name a step. Asking whether one step does not mention certain words names only that step. When the saved phrase is those words, Oriel says that step does mention those words and quotes the phrase saved on that step. When the saved phrase is different, Oriel says that step does not mention those words and quotes only the saved phrase. A rule with no phrase says it names no words and is the whole action, and is not treated as a mention. If that step has no rule, Oriel says so and does not quote a phrase or name the others. Asking whether one step mentions certain words names only that step. When the saved phrase is those words, Oriel says that step mentions those words and quotes the phrase saved on that step. When the saved phrase is different, Oriel says that step mentions other words and quotes only the saved phrase. It does not say that step does mention those words or that step does not mention those words. A rule with no phrase says it names no words and is the whole action, and is not treated as a mention. If that step has no rule, Oriel says so and does not quote a phrase or name the others. Asking whether one step mentions the same words as one other step compares those two saved phrases. When they match, Oriel says that step mentions the same words as the other step and quotes the phrase saved on the subject once. When the other step has no rule, no phrase, or different words, Oriel says that step does not mention the same words as the other step and quotes only the subject. A rule with no phrase says it names no words and is the whole action, and is not treated as a comparison with the other step. If that step has no rule, Oriel says so and does not name the other step or quote a phrase. The two steps have to be different. Asking whether one step does not mention the same words as one other step compares those two saved phrases. When they match, Oriel says that step does mention the same words as the other step and quotes the phrase saved on the subject once. It does not say that step mentions the same words as the other step. When the other step has no rule, no phrase, or different words, Oriel says that step does not mention the same words as the other step and quotes only the subject. A rule with no phrase says it names no words and is the whole action, and is not treated as a comparison with the other step. If that step has no rule, Oriel says so and does not name the other step or quote a phrase. The two steps have to be different. Asking which steps mention the same words as one step names only the other actions that use the phrase saved on that step, in send, pay, delete, and post order, and quotes that phrase once. When more than one other step uses it, Oriel says these steps mention the same words as that step. When one other step uses it, Oriel names that step. When no other step uses it, Oriel says no other step mentions the same words as that step. A rule with no phrase says it names no words and is the whole action, and is not treated as a comparison with the other steps. If that step has no rule, Oriel says so and does not name the other steps or quote a phrase. Asking which steps do not mention the same words as one step uses that same comparison. When more than one other step uses the phrase, Oriel says these steps do mention the same words as that step and names only those other steps. When one other step uses it, Oriel says that step does mention the same words as that step. When no other step uses it, Oriel says no other step mentions the same words as that step and does not say that no other step does mention them. A rule with no phrase says it names no words and is the whole action, and is not treated as a comparison with the other steps. If that step has no rule, Oriel says so and does not name the other steps or quote a phrase. Asking which words one step mentions quotes the phrase saved on that step and says that step mentions these words. It names no other step. It does not say that step shares these words, that those words are used once, or that the step is handed to you and then quote the words. A rule with no phrase says it names no words and is the whole action, and is not treated as a mention. It does not say that step mentions these words. If that step has no rule, Oriel says so and does not quote a phrase. Asking which words one step does not mention quotes the phrase saved on that step and says that step does mention these words. It names no other step. It does not say that step mentions these words. A rule with no phrase says it names no words and is the whole action, and is not treated as a mention. It does not say that step does mention these words. If that step has no rule, Oriel says so and does not quote a phrase. It does not say that step does mention these words or that step mentions these words. Asking which words one step mentions with one other step quotes the phrase saved on the subject when both steps use those words, and says that step mentions these words with the other step. When the other step has no rule, no phrase, or different words, it says that step does not mention these words with the other step and quotes only the subject. It does not say those words are used once, and it does not say that step mentions these words and then stop. A rule with no phrase says it names no words and is the whole action, and is not treated as a mention with the other step. It does not name the other step. If that step has no rule, Oriel says so and does not quote a phrase or name the other step. Asking which words one step does not mention with one other step uses that same comparison. When both steps use those words, Oriel says that step does mention these words with the other step and quotes the phrase saved on the subject once. It does not say that step mentions these words with the other step. When the other step has no rule, no phrase, or different words, it says that step does not mention these words with the other step and quotes only the subject. It does not say those words are used once. A rule with no phrase says it names no words and is the whole action, and is not treated as a mention with the other step. It does not name the other step. If that step has no rule, Oriel says so and does not quote a phrase or name the other step. Asking whether one step mentions the same words compares that step's phrase with every other saved rule. When at least one other step uses those words, Oriel says that step mentions the same words, quotes the phrase saved on the subject once, and names only the other steps that use them, in send, pay, delete, and post order. It does not say that step mentions the same words as another step. When no other step uses them, Oriel says that step does not mention the same words and quotes only the subject. It does not say those words are used once, and it does not name another step. A rule with no phrase says it names no words and is the whole action, and is not treated as the same words. It does not quote a phrase. If that step has no rule, Oriel says so and does not quote a phrase or name another step. Asking which steps name no words names only the actions whose rules have no phrase. More than one such action is named, a rule that names words is left out, and its phrase is not quoted. If none are saved that way, Oriel says so and does not name the others. Asking which steps name words names only the actions whose rules have a phrase, and quotes each phrase. More than one such action is named. A rule with no phrase is left out and is not described as the whole action. If none name words, Oriel says so and does not name the others. Asking which steps share words names only the actions whose phrase is exactly the same as another saved rule, and quotes that phrase on each. A share needs at least two actions. A phrase used once is left out and is not quoted. A rule with no phrase is left out and is not described as the whole action. If no two rules share a phrase, Oriel says so and does not name the others. Asking which steps mention the same words names only the actions whose phrase is exactly the same as another saved rule, in send, pay, delete, and post order, and quotes that phrase on each. A mention of the same words needs at least two actions. If more than one shared phrase exists, Oriel names each matching action and no others. A phrase used by only one rule is left out and is not quoted. A rule with no phrase is left out and is not described as the whole action. If no two rules mention the same words, Oriel says so and does not name the others. Asking which steps do not mention the same words names only the actions whose phrase is used by exactly one rule, in send, pay, delete, and post order, and quotes that phrase on each. A phrase used by two or more rules is left out and is not quoted. A rule with no phrase is left out and is not described as the whole action. If no step mentions words only once, Oriel says so and does not name the others. It does not say that no steps mention the same words, that these steps mention the same words, that these steps use words once, or that no step uses words once. Asking which words are shared names only the phrases used by at least two rules, once each, and with each phrase names the actions that use it, in send, pay, delete, and post order. The quoted words are the ones saved on the earliest of those actions. A phrase used once is left out and is not quoted. A rule with no phrase is left out and is not described as the whole action. If no phrase is shared, Oriel says so and does not name the others. Asking which words are not shared names only the phrases used by exactly one rule, once each, and with each phrase names the one action that uses it, in send, pay, delete, and post order. The quoted words are the ones saved on that action. A phrase used by two or more rules is left out and is not quoted. A rule with no phrase is left out and is not described as the whole action. If no phrase is used only once, Oriel says so and does not name the others. Asking which words are not mentioned names only the phrases used by exactly one rule, once each, and with each phrase names the one action that uses it, in send, pay, delete, and post order. The quoted words are the ones saved on that action. A phrase used by two or more rules is left out and is not quoted. A rule with no phrase is left out and is not described as the whole action. If no phrase is used only once, Oriel says no words are mentioned only once and does not name the others. It does not say that no words are used once, that these words are used once, that no step mentions words only once, that these steps do not mention the same words, or that these words are mentioned only once. Asking which words are mentioned names only the phrases used by at least two rules, once each, and with each phrase names the actions that use it, in send, pay, delete, and post order. The quoted words are the ones saved on the earliest of those actions. A phrase used by only one rule is left out and is not quoted. A rule with no phrase is left out and is not described as the whole action. If no phrase is used by two or more rules, Oriel says no words are mentioned and does not name the others. It does not say that no words are shared, that these words are shared, that no words are mentioned only once, that these words are not mentioned, or that these words are mentioned more than once. Asking which words are mentioned once names only the phrases used by exactly one rule, once each, and with each phrase names the one action that uses it, in send, pay, delete, and post order. The quoted words are the ones saved on that action. A phrase used by two or more rules is left out and is not quoted. A rule with no phrase is left out and is not described as the whole action. If no phrase is used by exactly one rule, Oriel says no words are mentioned once and does not name the others. It does not say that no words are mentioned only once, that these words are not mentioned, that no words are mentioned, that these words are mentioned and then stop, that these words are mentioned more than once, that these words are used once, that no words are used once, that these words are shared, or that no words are shared. Asking which words are mentioned more than once names only the phrases used by at least two rules, once each, and with each phrase names the actions that use it, in send, pay, delete, and post order. The quoted words are the ones saved on the earliest of those actions. A phrase used by only one rule is left out and is not quoted. A rule with no phrase is left out and is not described as the whole action. If no phrase is used by two or more rules, Oriel says no words are mentioned more than once and does not name the others. It does not say that no words are mentioned, that these words are mentioned and then stop, that these words are mentioned once, that no words are mentioned once, that no words are mentioned only once, that these words are not mentioned, that these words are mentioned only once, that no words are shared, that these words are shared, that these words are used once, or that no words are used once. Asking which words are mentioned only once names only the phrases used by exactly one rule, once each, and with each phrase names the one action that uses it, in send, pay, delete, and post order. The quoted words are the ones saved on that action. A phrase used by two or more rules is left out and is not quoted. A rule with no phrase is left out and is not described as the whole action. If no phrase is used by exactly one rule, Oriel says no saved words are mentioned only once and does not name the others. It does not say that no words are mentioned only once, that these words are not mentioned, that these words are mentioned once, that no words are mentioned once, that these words are mentioned more than once, that no words are mentioned more than once, that no words are mentioned, that these words are mentioned and then stop, that these words are shared, that no words are shared, that these words are used once, or that no words are used once. Asking which steps do not share words names only the actions whose phrase is used by exactly one rule, and quotes that phrase on each, in send, pay, delete, and post order. A phrase used by two or more rules is left out and is not quoted. A rule with no phrase is left out and is not described as the whole action. If no step uses words only once, Oriel says so and does not name the others. Asking whether one step shares words quotes the phrase saved on that step and names only the other actions that use it. If those words are used once, it says so and does not name the other rules. A rule with no phrase says it names no words and is the whole action, and is not treated as a share. If that step has no rule, Oriel says so and does not name the others. Asking which words one step shares quotes the phrase saved on that step. When another step uses those words, it says that step shares these words and names only the other actions. When those words are used once, it says so and names no other step. A rule with no phrase is not treated as that share and is not quoted. It does not say with that step. Asking which words one step does not share quotes the phrase saved on that step. When another step uses those words, it says that step does share these words and names only the other actions. When no other step uses them, it says that step does not share these words and names no other step. A rule with no phrase is not treated as that comparison and is not quoted. It does not say with that step. The rule does not run the step, wake, or approve a hold. A skill is a method you apply on a turn. It does not wake, and it does not approve a hold. A saved routine can wake on a cadence you choose. Pausing wakes stops those cadences until you resume, and neither a pause nor a wake approves the hold. A hold raised by a wake expires if you are away, and the action does not run. There is no always-allow. A hold a wake raised, once you say not now, is not raised by the next wake until you send a message. A live bridge is an endpoint you control. A forward is a send. Oriel does not pull the original message or its attachments, and releasing the hold does not send it. Asking who asked for the Slack note reads the record and does not open a card. Allow for this task covers that same kind for the rest of the current goal only. A later goal still asks. Approving once does not cover the next hold. Neither choice sends mail or moves money. Saying stop this task clears that allowance on the current goal only, so the next same-kind step asks again. A sent email cannot be reversed from here. Another goal stays allowed. Stopping does not send mail or move money. Saying stop the named routine sets that one routine to manual so it does not wake. The instruction stays in the record. Another routine is left as it was, including a wake that was held back. A completed action is not undone. Stopping that routine does not send mail or move money. Saying change and one routine's name quotes the instruction already stored and the proposed words, and says the change is not saved. The cadence, the next time, the last run, and the instruction stay. Another routine is left as it was, including a wake that was held back. Asking does not run the routine and does not save the proposal. Saying save and one routine's name writes that instruction and does not run the routine. The cadence, the next time, and the last run stay. If it already does that, the instruction is not rewritten. Another routine is left as it was, including a wake that was held back. Saving does not open a hold, send mail, or move money. A change sentence still does not save. Saying save and one routine's name writes that instruction and does not run the routine. The cadence, the next time, and the last run stay. If it already does that, the instruction is not rewritten. Another routine is left as it was, including a wake that was held back. Saving does not open a hold, send mail, or move money. A change sentence still does not save. Saying wake and one routine's name with daily, hourly, or manual sets that one cadence and does not run the routine. Daily and hourly write the next time from the current clock. Manual clears the next time. If it already wakes that way, the next time is not moved. The instruction and the last run stay. Another routine is left as it was, including a wake that was held back. Saving an instruction still does not change the cadence. A change sentence still does not save and does not change the cadence. Saying wake and one routine's name with daily or hourly does not set that cadence when the next time it would write is less than five minutes from another routine's stored next time. The reply names both routines and says routine schedules must be at least five minutes apart. The cadence, the next time, the instruction, the pause, and the last run stay. It does not run either routine and it does not delete either routine. A routine that already wakes that way does not move its next time. A manual routine has no next time and does not block another schedule. A paused routine still counts. Deleting a routine removes it, so it no longer counts. The cadence control does not apply this check. Saving a routine when 50 routines are already in the record does not add another. The reply says a bot can own up to 50 routines. It does not delete one to make room and it does not run one. Every routine already saved stays. Saving when fewer than 50 still saves, and a send in that instruction still waits on a hold. A name is taken from the goal when the request omits one. The five-minute check does not apply to that save or to the cadence control. There is no undo of the refusal because nothing was added. There is no vault.";

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
