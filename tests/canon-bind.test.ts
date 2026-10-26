import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  routineAccessLiftAmbiguousCopy,
  routineAccessLiftCopy,
  routineWakeGuardAmbiguousCopy,
  routineWakeGuardCopy,
  routineDozeTallyAmbiguousCopy,
  routineDozeTallyCopy,
  routineCanonBindAmbiguousCopy,
  routineCanonBindCopy,
  routineCanonBindMissCopy,
  routineFolioReturnAmbiguousCopy,
  routineFolioReturnCopy,
  routineLaborCloseAmbiguousCopy,
  routineLaborCloseCopy,
} from "../src/core/brief.js";
import {
  convene,
  saveRoutine,
  setConnector,
  setHandoffRule,
  setPaused,
  setRoutineCadence,
  settle,
  wakeDue,
} from "../src/core/convene.js";
import { initialState, toPublic } from "../src/core/state.js";
import { startServer } from "../src/server/index.js";
import type { Deps } from "../src/core/types.js";

const CANON_BIND_QUESTION =
  "that rules that every member's Bots follow";
const WAKE_STILL =
  "that a computer that is awake, because a Bot is working or the member is using Grok Bot, is never terminated by this setting";
const DOZE_STILL = "that the 30 days count from when the computer went to sleep after its last use";
const WAKE_SHORT = "Asking does not spare a machine that stays awake while work is still going.";
const ACCESS_LIFT_STILL =
  "that to remove access, remove the member from the team or turn off their access with Manage Group Access, and revoke their sessions in your identity provider";
const FOLIO_RETURN_STILL =
  "that their next message starts a fresh computer on the same durable disk, with their Bots, files, and logins";
const LABOR_CLOSE_STILL =
  "that terminating a computer, by hand or automatically, ends the member's current work";
const SHORT = "Asking does not make every member's bots follow those rules.";
const ALT_OPEN = "Asking does not set every member's bots to follow those rules.";
const ALT_SET = "Asking does not put every member's bots under those rules.";
const ACCESS_SHORT = "Asking does not lift that person off the team or end their sessions.";
const FOLIO_SHORT = "Asking does not seat the next note on that same lasting disk with the bots and sign-ins kept.";
const LABOR_SHORT = "Asking does not close the work that is underway by ending the machine.";
const HAS_NO = "has no canon bind";

const OTHER_HAS_NO = [
  "has no wake guard",
  "has no doze tally",
  "has no access lift",
  "has no folio return",
  "has no labor close",
  "has no serve wide",
  "has no circle door",
  "has no sync forfeit",
  "has no reconnect lag",
  "has no fresh boot",
  "has no session drop",
  "has no safe berth",
  "has no glyph linger",
  "has no cross reach",
  "has no valve shut",
  "has no script reprise",
  "has no disk stay",
  "has no hand twin",
  "has no void levy",
  "has no drift landing",
  "has no mercy window",
  "has no late cohort",
  "has no dual primer",
  "has no turn confirm",
  "has no stock dim",
  "has no count restart",
  "has no thirty lapse",
  "has no tidy sweep",
  "has no slumber mark",
  "has no recreate fence",
  "has no admin chair",
  "has no progress card",
  "has no fleet image",
  "has no banner crest",
  "has no cold start",
  "has no nest pair",
  "has no sudo permit",
  "has no restore latch",
  "has no route span",
  "has no page home",
  "has no option blank",
  "has no egress path",
  "has no habit ask",
  "has no reason bar",
  "has no stricter keep",
  "has no local shutter",
  "has no choice latch",
  "has no member ceiling",
  "has no plan notch",
  "has no server ring",
  "has no public veil",
  "has no quiet gate",
  "has no spawn hatch",
  "has no rest latch",
  "has no default switch",
  "has no delegated lane",
  "has no sealed chat",
  "has no shared kit",
  "has no asked meter",
  "has no direct desk",
  "has no group computer",
  "has no team bench",
  "has no solo roster",
  "has no common tray",
  "has no persona ledger",
  "has no guest slice",
  "has no private host",
  "has no work surface",
  "has no scratch folder",
  "has no software refresh",
  "has no kept-file",
  "has no kept conversation",
  "has no idle span",
  "has no grace period",
  "has no rolling check",
];

async function withBridge(
  status: number,
  body: unknown,
  fn: (url: string, hits: { authorization: string | undefined; raw: string }[]) => Promise<void>,
) {
  const hits: { authorization: string | undefined; raw: string }[] = [];
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    hits.push({ authorization: req.headers.authorization, raw: Buffer.concat(chunks).toString("utf8") });
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${address.port}/tasks`, hits);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

describe("ORIEL-F205", () => {
  it("ORIEL-F205 says one routine has no canon bind and does not spare a machine that stays awake while work is still going", async () => {
    await withBridge(200, { summary: "Ready.", points: [], stance: "" }, async (url, hits) => {
      const now = new Date("2026-10-24T04:30:00.000Z");
      const early: Deps = { now: () => now, fetchImpl: fetch, refine: null };
      let state = initialState();
      for (const id of ["grok", "dots", "muse"] as const) {
        state = setConnector(state, id, { bridgeUrl: url, token: "bridge-secret-xyz" }, early);
      }
      state = await convene(state, "Email the client the launch note", undefined, early);
      const goalId = state.goals[0]?.id ?? "";
      const open = state.approvals.find((approval) => approval.status === "open" && approval.kind === "send");
      state = await settle(state, open?.id ?? "", "approve", early);
      state = saveRoutine(state, goalId, "Launch note", early);
      state = setRoutineCadence(state, state.routines[0]?.id ?? "", "hourly", early);
      state = await convene(state, "Compare the market landscape", undefined, early);
      const marketGoal = state.goals.at(-1)?.id ?? "";
      state = saveRoutine(state, marketGoal, "Market check", early);
      state = setRoutineCadence(state, state.routines[1]?.id ?? "", "daily", early);
      state.routines[0]!.paused = true;
      state.routines[0]!.heldBack = ["send"];
      state.routines[0]!.lastRunAt = "2026-10-23T11:00:00.000Z";
      state.routines[0]!.nextRunAt = "2026-10-24T02:00:00.000Z";
      state.routines[0]!.recentRuns = ["2026-10-23T11:00:00.000Z"];
      state.routines[1]!.heldBack = ["pay"];
      state.routines[1]!.lastRunAt = null;
      state.routines[1]!.recentRuns = [];
      state.routines[1]!.nextRunAt = "2026-10-24T05:00:00.000Z";
      state.paused = true;
      state = setHandoffRule(state, "delete", true, early, "shared project files");
      const beforeHits = hits.length;
      const routinesBefore = structuredClone(state.routines);
      const approvalsBefore = structuredClone(state.approvals);
      const goalsBefore = structuredClone(state.goals);
      const rulesBefore = structuredClone(state.handoffRules);
      const asked = `Please, does the Launch note routine say ${CANON_BIND_QUESTION}?`;

      state = await convene(state, asked, goalId, early, "missing-skill");
      expect(hits.length).toBe(beforeHits);
      expect(state.goals).toEqual(goalsBefore);
      expect(state.routines).toEqual(routinesBefore);
      expect(state.approvals).toEqual(approvalsBefore);
      expect(state.handoffRules).toEqual(rulesBefore);
      expect(state.paused).toBe(true);
      expect(state.messages.at(-1)?.goalId).toBeUndefined();
      expect(state.messages.at(-1)?.text).toBe(routineCanonBindCopy("Launch note", true));
      expect(state.messages.at(-1)?.text).toContain("“Launch note” has no canon bind in the record.");
      expect(state.messages.at(-1)?.text).toContain(SHORT);
      expect(state.messages.at(-1)?.text).not.toContain(ALT_OPEN);
      expect(state.messages.at(-1)?.text).not.toContain(ALT_SET);
      expect(state.messages.at(-1)?.text).not.toContain(ACCESS_SHORT);
      expect(state.messages.at(-1)?.text).not.toContain("has no access lift");
      expect(state.messages.at(-1)?.text).not.toContain("has no folio return");
      expect(state.messages.at(-1)?.text).not.toContain("has no labor close");
      expect(state.messages.at(-1)?.text).not.toMatch(/cursor/i);
      expect(state.messages.at(-1)?.text).not.toMatch(/credential/i);
      expect(state.messages.at(-1)?.text).not.toMatch(/password/i);
      expect(state.messages.at(-1)?.text).not.toMatch(/secret/i);
      expect(state.messages.at(-1)?.text).not.toMatch(/file/i);
      expect(state.messages.at(-1)?.text).not.toContain("Grok Bot");
      for (const other of OTHER_HAS_NO) {
        expect(HAS_NO.includes(other)).toBe(false);
        expect(other.includes(HAS_NO)).toBe(false);
      }
      for (const other of [
        ALT_OPEN,
        ALT_SET,
        ACCESS_SHORT,
        FOLIO_SHORT,
        LABOR_SHORT,
        "Asking does not spare a machine that stays awake while work is still going.",
        "Asking does not keep a machine that stays awake while work is still going.",
        "Asking does not shield a machine that stays awake while work is still going.",
        "Asking does not begin that thirty-day wait when the machine fell asleep after its last use.",
        "Asking does not open that thirty-day wait when the machine fell asleep after its last use.",
        "Asking does not set that thirty-day wait when the machine fell asleep after its last use.",
      ]) {
        expect(SHORT.includes(other)).toBe(false);
        expect(other.includes(SHORT)).toBe(false);
      }
      const rowId = "canon-bind-";
      for (const prefix of [
        "access-lift-",
        "access-",
        "lift-",
        "folio-return-",
        "folio-",
        "return-",
        "labor-close-",
        "doze-tally-",
        "doze-",
        "tally-",
        "guard-",
        "file-",
        "note-",
        "bot-",
      ]) {
        expect(rowId.startsWith(prefix)).toBe(false);
      }
      expect(rowId.startsWith("canon-")).toBe(true);
      expect(rowId.startsWith("bind-")).toBe(false);
      expect(rowId.startsWith("wake-")).toBe(false);
      expect(rowId.startsWith("guard-")).toBe(false);
      expect("access-lift-".startsWith("canon-bind-")).toBe(false);
      expect("canon-bind-".startsWith("access-lift-")).toBe(false);
      expect(routineCanonBindCopy("Launch note", true)).toContain(SHORT);
      expect(routineCanonBindCopy("Launch note", true)).not.toContain(ALT_OPEN);
      expect(routineCanonBindCopy("Launch note", true)).not.toContain("has no access lift");
      expect(routineCanonBindCopy("Launch note", true)).not.toMatch(/cursor/i);
      expect(routineCanonBindCopy("Launch note", true)).not.toMatch(/credential/i);
      expect(routineCanonBindCopy("Launch note", true)).not.toMatch(/password/i);
      expect(routineCanonBindCopy("Launch note", true)).not.toMatch(/secret/i);
      expect(routineCanonBindCopy("Launch note", true)).not.toMatch(/file/i);
      expect(routineCanonBindCopy("Launch note", true)).not.toContain("Grok Bot");
      expect(routineAccessLiftCopy("Launch note", true)).not.toContain(HAS_NO);
      expect(routineAccessLiftCopy("Launch note", true)).not.toContain(SHORT);
      expect(routineFolioReturnCopy("Launch note", true)).not.toContain(HAS_NO);
      expect(state.messages.at(-1)?.text).toContain("Another routine is unchanged.");
      expect(state.messages.at(-1)?.text).not.toContain("Dots");
      expect(state.messages.at(-1)?.text).not.toContain("Muse");
      expect(state.messages.at(-1)?.text).not.toContain("2026-10-24T02:00:00.000Z");
      expect(state.messages.at(-1)?.text).not.toContain("Market check");
      expect(state.events.some((event) => event.type === "routine_canon_bind")).toBe(true);
      expect(state.events.some((event) => event.type === "routine_access_lift")).toBe(false);
      expect(state.events.some((event) => event.type === "routine_folio_return")).toBe(false);
      expect(state.events.some((event) => event.type === "routine_ran")).toBe(false);
      const published = JSON.stringify(toPublic(state, 0));
      expect(published).not.toContain("bridge-secret-xyz");
      expect(published).not.toContain("Always allow");
      expect(published).toContain("has no canon bind in the record");
      expect(published).toContain("The row says No canon bind");
      expect(published).toContain("The row test id is canon-bind-");
      expect(published).toContain("The doze-tally reply still says Asking does not begin that thirty-day wait when the machine fell asleep after its last use");
      expect(published).toContain("has no doze tally in the record");
      expect(published).toContain("The row says No doze tally");
      expect(published).toContain("The row test id is doze-tally-");
      expect(published).toContain("The access-lift reply still says Asking does not lift that person off the team or end their sessions");
      expect(published).toContain(`The short reply says ${SHORT.slice(0, -1)}`);
      expect(published).toContain("has no access lift in the record");
      expect(published).toContain("The row says No access lift");
      expect(published).toContain("The row test id is access-lift-");
      expect(published).toContain("The short reply says Asking does not lift that person off the team or end their sessions");
      expect(published).toContain("The folio-return reply still says Asking does not seat the next note on that same lasting disk with the bots and sign-ins kept");
      expect(published).toContain("has no folio return in the record");
      expect(published).toContain("The row says No folio return");
      expect(published).toContain("The row test id is folio-return-");
      expect(published).toContain("The labor-close reply still says Asking does not close the work that is underway by ending the machine");
      expect(published).toContain("has no labor close in the record");
      expect(published).toContain("The row says No labor close");
      expect(published).toContain("The row test id is labor-close-");
      expect(published).toContain("An access lift is not a canon bind");
      expect(published).toContain("does not say there is no canon bind");
      expect(published).toContain("does not name a canon bind");
      expect(published).toContain("A stored run is not a canon bind");
      expect(published).toContain("A desk-wide pause does not invent a canon bind");
      expect(published).toContain("There is no relay lamp");
      expect(published).toContain("There is no keyhole");
      expect(published).not.toContain("A recorded failure is not a canon bind");
      expect(published).not.toContain("A recorded failure is not an access lift");

      const openDesk = structuredClone(state);
      openDesk.paused = false;
      const still = await wakeDue(openDesk, early);
      expect(still.routines[0]?.paused).toBe(true);
      expect(still.routines[0]?.nextRunAt).toBe("2026-10-24T02:00:00.000Z");
      expect(still.events.some((event) => event.type === "routine_ran")).toBe(false);

      const market = await convene(state, `Does the Market check routine say ${CANON_BIND_QUESTION}?`, undefined, early);
      expect(market.messages.at(-1)?.text).toBe(routineCanonBindCopy("Market check", true));
      expect(market.routines[0]?.paused).toBe(true);
      expect(market.routines[0]?.nextRunAt).toBe("2026-10-24T02:00:00.000Z");
      expect(market.routines[1]?.nextRunAt).toBe("2026-10-24T05:00:00.000Z");
      expect(market.routines[0]?.heldBack).toEqual(["send"]);

      const wakeLeft = await convene(state, `Does the Launch note routine say ${WAKE_STILL}?`, undefined, early);
      expect(wakeLeft.messages.at(-1)?.text).toBe(routineWakeGuardCopy("Launch note", true));
      expect(wakeLeft.messages.at(-1)?.text).toContain("“Launch note” has no wake guard in the record.");
      expect(wakeLeft.messages.at(-1)?.text).toContain(WAKE_SHORT);
      expect(wakeLeft.messages.at(-1)?.text).not.toContain(HAS_NO);
      expect(wakeLeft.messages.at(-1)?.text).not.toContain(SHORT);
      expect(wakeLeft.events.some((event) => event.type === "routine_wake_guard")).toBe(true);
      const dozeLeft = await convene(state, `Does the Launch note routine say ${DOZE_STILL}?`, undefined, early);
      expect(dozeLeft.messages.at(-1)?.text).toBe(routineDozeTallyCopy("Launch note", true));
      expect(dozeLeft.messages.at(-1)?.text).toContain("“Launch note” has no doze tally in the record.");
      expect(dozeLeft.messages.at(-1)?.text).not.toContain(HAS_NO);
      expect(dozeLeft.messages.at(-1)?.text).not.toContain(SHORT);
      expect(dozeLeft.events.some((event) => event.type === "routine_doze_tally")).toBe(true);
      const accessLeft = await convene(state, `Does the Launch note routine say ${ACCESS_LIFT_STILL}?`, undefined, early);
      expect(accessLeft.messages.at(-1)?.text).toContain("“Launch note” has no access lift in the record.");
      expect(accessLeft.messages.at(-1)?.text).toContain(ACCESS_SHORT);
      expect(accessLeft.messages.at(-1)?.text).not.toContain(HAS_NO);
      expect(accessLeft.messages.at(-1)?.text).not.toContain(SHORT);
      expect(accessLeft.events.some((event) => event.type === "routine_access_lift")).toBe(true);
      const folioLeft = await convene(state, `Does the Launch note routine say ${FOLIO_RETURN_STILL}?`, undefined, early);
      expect(folioLeft.messages.at(-1)?.text).toContain("“Launch note” has no folio return in the record.");
      expect(folioLeft.messages.at(-1)?.text).toContain(FOLIO_SHORT);
      expect(folioLeft.messages.at(-1)?.text).not.toContain(HAS_NO);
      const laborLeft = await convene(state, `Does the Launch note routine say ${LABOR_CLOSE_STILL}?`, undefined, early);
      expect(laborLeft.messages.at(-1)?.text).toContain("“Launch note” has no labor close in the record.");
      expect(laborLeft.messages.at(-1)?.text).toContain(LABOR_SHORT);
      expect(laborLeft.messages.at(-1)?.text).not.toContain(HAS_NO);
      const why = await convene(state, "Why hasn't the Launch note routine run?", undefined, early);
      expect(why.messages.at(-1)?.text).toContain("It is paused.");
      expect(why.messages.at(-1)?.text).not.toContain("canon bind");
      expect(why.messages.at(-1)?.text).not.toContain("wake guard");
      expect(why.messages.at(-1)?.text).not.toContain("access lift");
      expect(why.routines[0]?.nextRunAt).toBe("2026-10-24T02:00:00.000Z");
    });
  });

  it("ORIEL-F205 leaves two names, a desk pause, and a widened sentence alone", async () => {
    const now = new Date("2026-10-24T07:00:00.000Z");
    const early: Deps = { now: () => now, fetchImpl: fetch, refine: null };
    const none = await convene(initialState(), `Does the Launch note routine say ${CANON_BIND_QUESTION}?`, undefined, early);
    expect(none.goals).toHaveLength(0);
    expect(none.routines).toHaveLength(0);
    expect(none.messages.at(-1)?.text).toBe(routineCanonBindMissCopy("Launch note"));
    expect(none.events.some((event) => event.type === "routine_canon_bind")).toBe(true);
    expect(none.events.some((event) => event.type === "routine_access_lift")).toBe(false);

    let state = await convene(initialState(), "Email Maya the launch update", undefined, early);
    const firstId = state.goals[0]?.id ?? "";
    state = await settle(state, state.approvals[0]?.id ?? "", "task", early);
    state = saveRoutine(state, firstId, "Launch note", early);
    state = setRoutineCadence(state, state.routines[0]?.id ?? "", "hourly", early);
    const launchNext = state.routines[0]?.nextRunAt;
    const launchInstruction = state.routines[0]?.instruction;
    state.routines[0]!.recentRuns = ["2026-10-24T03:00:00.000Z"];
    state.routines[0]!.lastRunAt = "2026-10-24T03:00:00.000Z";
    state = await convene(state, "Email Noah the other note", undefined, early);
    state = saveRoutine(state, state.goals.at(-1)?.id ?? "", "Launch note", early);
    state = setRoutineCadence(state, state.routines[1]?.id ?? "", "daily", early);
    const secondNext = state.routines[1]?.nextRunAt;
    state = await convene(state, "Summarize the launch risks", undefined, early);
    state = saveRoutine(state, state.goals.at(-1)?.id ?? "", "Market check", early);
    state = setRoutineCadence(state, state.routines[2]?.id ?? "", "hourly", early);
    const marketNext = state.routines[2]?.nextRunAt;
    const goals = state.goals.length;
    state.routines[0]!.heldBack = ["send"];
    state.routines[0]!.paused = true;
    state.routines[1]!.paused = true;

    const asked = await convene(state, `PLEASE, does the Launch note routine say ${CANON_BIND_QUESTION}?`, firstId, early, "missing-skill");
    expect(asked.goals).toHaveLength(goals);
    expect(asked.messages.at(-1)?.text).toBe(routineCanonBindAmbiguousCopy("Launch note"));
    expect(asked.messages.at(-1)?.text).toContain("More than one routine has that name");
    expect(asked.messages.at(-1)?.text).not.toContain(HAS_NO);
    expect(asked.routines[0]?.heldBack).toEqual(["send"]);
    expect(asked.routines[0]?.paused).toBe(true);
    expect(asked.routines[0]?.instruction).toBe(launchInstruction);
    expect(asked.routines[0]?.nextRunAt).toBe(launchNext);
    expect(asked.routines[1]?.nextRunAt).toBe(secondNext);
    expect(asked.routines[2]?.nextRunAt).toBe(marketNext);

    for (const text of [
      `Please, does the Launch note routine say ${CANON_BIND_QUESTION}.`,
      `Does the Launch note routine say ${CANON_BIND_QUESTION}??`,
    ]) {
      const again = await convene(state, text, undefined, early);
      expect(again.messages.at(-1)?.text).toBe(routineCanonBindAmbiguousCopy("Launch note"));
      expect(again.routines[0]?.paused).toBe(true);
      expect(again.goals).toHaveLength(goals);
    }
    const lower = await convene(
      state,
      "does the launch note routine say that rules that every member's bots follow",
      undefined,
      early,
    );
    expect(lower.messages.at(-1)?.text).toBe(routineCanonBindAmbiguousCopy("launch note"));
    expect(lower.messages.at(-1)?.text).not.toContain(HAS_NO);
    expect(lower.messages.at(-1)?.text).not.toContain("has no access lift");
    expect(lower.messages.at(-1)?.text).not.toContain("has no folio return");
    expect(lower.events.some((event) => event.type === "routine_canon_bind")).toBe(true);
    expect(lower.events.some((event) => event.type === "routine_access_lift")).toBe(false);
    expect(lower.events.some((event) => event.type === "routine_doze_tally")).toBe(false);
    expect(lower.events.some((event) => event.type === "routine_wake_guard")).toBe(false);
    const wakeLower = await convene(
      state,
      "does the launch note routine say that a computer that is awake, because a bot is working or the member is using grok bot, is never terminated by this setting",
      undefined,
      early,
    );
    expect(wakeLower.messages.at(-1)?.text).toBe(routineWakeGuardAmbiguousCopy("launch note"));
    expect(wakeLower.messages.at(-1)?.text).not.toContain("has no wake guard");
    expect(wakeLower.messages.at(-1)?.text).not.toContain(HAS_NO);
    expect(wakeLower.messages.at(-1)?.text).not.toContain(SHORT);
    expect(wakeLower.events.some((event) => event.type === "routine_wake_guard")).toBe(true);
    expect(wakeLower.events.some((event) => event.type === "routine_canon_bind")).toBe(false);
    const dozeLower = await convene(
      state,
      "does the launch note routine say that the 30 days count from when the computer went to sleep after its last use",
      undefined,
      early,
    );
    expect(dozeLower.messages.at(-1)?.text).toBe(routineDozeTallyAmbiguousCopy("launch note"));
    expect(dozeLower.messages.at(-1)?.text).not.toContain(HAS_NO);
    expect(dozeLower.messages.at(-1)?.text).not.toContain(SHORT);
    expect(dozeLower.events.some((event) => event.type === "routine_doze_tally")).toBe(true);
    expect(dozeLower.events.some((event) => event.type === "routine_canon_bind")).toBe(false);
    const accessLower = await convene(
      state,
      "does the launch note routine say that to remove access, remove the member from the team or turn off their access with manage group access, and revoke their sessions in your identity provider",
      undefined,
      early,
    );
    expect(accessLower.messages.at(-1)?.text).toBe(routineAccessLiftAmbiguousCopy("launch note"));
    expect(accessLower.messages.at(-1)?.text).not.toContain(HAS_NO);
    expect(accessLower.messages.at(-1)?.text).not.toContain(SHORT);
    const folioLower = await convene(
      state,
      "does the launch note routine say that their next message starts a fresh computer on the same durable disk, with their bots, files, and logins",
      undefined,
      early,
    );
    expect(folioLower.messages.at(-1)?.text).toBe(routineFolioReturnAmbiguousCopy("launch note"));
    expect(folioLower.messages.at(-1)?.text).not.toContain(HAS_NO);
    expect(folioLower.messages.at(-1)?.text).not.toContain(SHORT);
    const laborLower = await convene(state, `does the launch note routine say ${LABOR_CLOSE_STILL}`.toLowerCase(), undefined, early);
    expect(laborLower.messages.at(-1)?.text).toBe(routineLaborCloseAmbiguousCopy("launch note"));
    expect(laborLower.messages.at(-1)?.text).not.toContain(HAS_NO);
    expect(laborLower.messages.at(-1)?.text).not.toContain(SHORT);

    const one = structuredClone(state);
    one.routines.splice(1, 1);
    const named = await convene(one, `Does the "Launch note" routine say ${CANON_BIND_QUESTION}?`, undefined, early);
    expect(named.messages.at(-1)?.text).toBe(routineCanonBindCopy("Launch note", true));
    expect(named.routines[0]?.paused).toBe(true);
    expect(named.routines[0]?.nextRunAt).toBe(launchNext);
    expect(named.routines[1]?.nextRunAt).toBe(marketNext);

    const quoted = await convene(one, `Does the “Launch note” routine say ${CANON_BIND_QUESTION}?`, undefined, early);
    expect(quoted.messages.at(-1)?.text).toBe(routineCanonBindCopy("Launch note", true));
    expect(quoted.routines[0]?.recentRuns).toEqual(["2026-10-24T03:00:00.000Z"]);

    const marketAsk = await convene(setPaused(one, true, early), `Does the Market check routine say ${CANON_BIND_QUESTION}?`, undefined, early);
    expect(marketAsk.paused).toBe(true);
    expect(marketAsk.messages.at(-1)?.text).toBe(routineCanonBindCopy("Market check", true));
    expect(marketAsk.messages.at(-1)?.text).not.toContain("Wakes are paused");
    expect(marketAsk.routines[0]?.paused).toBe(true);

    const solo = structuredClone(one);
    solo.routines.splice(1, 1);
    const alone = await convene(solo, `Does the Launch note routine say ${CANON_BIND_QUESTION}?`, undefined, early);
    expect(alone.messages.at(-1)?.text).toBe(routineCanonBindCopy("Launch note", false));
    expect(alone.messages.at(-1)?.text).not.toContain("Another routine is unchanged.");
    expect(alone.routines).toHaveLength(1);

    const aside = await convene(one, `Does the Launch note routine say ${CANON_BIND_QUESTION} and email Maya`, undefined, early);
    expect(aside.goals.length).toBeGreaterThan(one.goals.length);
    expect(aside.messages.at(-1)?.text).not.toContain(HAS_NO);
    expect(aside.routines[0]?.paused).toBe(true);
    expect(aside.routines[0]?.nextRunAt).toBe(launchNext);

    const near = await convene(one, `Does the Launch notes routine say ${CANON_BIND_QUESTION}?`, undefined, early);
    expect(near.goals).toHaveLength(one.goals.length);
    expect(near.messages.at(-1)?.text).toBe(routineCanonBindMissCopy("Launch notes"));
    expect(near.routines[0]?.paused).toBe(true);
    expect(near.routines[0]?.nextRunAt).toBe(launchNext);

    for (const text of [
      `Does it say ${CANON_BIND_QUESTION}?`,
      `Does the Launch note routines say ${CANON_BIND_QUESTION}?`,
      `Does the Launch note routine say ${CANON_BIND_QUESTION} yet?`,
      `Does the routine say ${CANON_BIND_QUESTION}?`,
    ]) {
      const ordinary = await convene(one, text, undefined, early);
      expect(ordinary.goals.length).toBeGreaterThan(one.goals.length);
      expect(ordinary.routines[0]?.paused).toBe(true);
      expect(ordinary.routines[0]?.nextRunAt).toBe(launchNext);
      expect(ordinary.messages.at(-1)?.text).not.toContain(HAS_NO);
      expect(ordinary.messages.at(-1)?.text).not.toContain("There is no such routine");
    }

    const kept = structuredClone(one);
    await expect(convene(kept, `Does the Launch note routine say ${CANON_BIND_QUESTION} without asking`, undefined, early)).rejects.toThrow(/without asking/);
    await expect(convene(kept, `Please does the Launch note routine say ${CANON_BIND_QUESTION} always allow`, undefined, early)).rejects.toThrow(/without asking/);
    await expect(convene(kept, `Does the Launch note routine say ${CANON_BIND_QUESTION} and allow for this site`, undefined, early)).rejects.toThrow(/without asking/);
    expect(kept.routines[0]?.paused).toBe(true);
    expect(kept.routines[0]?.heldBack).toEqual(["send"]);
    expect(kept.goals).toHaveLength(one.goals.length);
    await expect(convene(kept, `Does the Launch note routine say ${CANON_BIND_QUESTION}?`, "goal_missing", early)).rejects.toThrow(/not in the record/);

    const accessLeft = await convene(one, `Does the Launch note routine say ${ACCESS_LIFT_STILL}?`, undefined, early);
    expect(accessLeft.messages.at(-1)?.text).toContain("“Launch note” has no access lift in the record.");
    expect(accessLeft.messages.at(-1)?.text).toContain(ACCESS_SHORT);
    expect(accessLeft.messages.at(-1)?.text).not.toContain(HAS_NO);
    const why = await convene(one, "Why hasn't the Launch note routine run?", undefined, early);
    expect(why.messages.at(-1)?.text).toContain("It is paused.");
    expect(why.messages.at(-1)?.text).not.toContain("canon bind");
    expect(why.routines[0]?.nextRunAt).toBe(launchNext);
  });
});

const running: { close: () => Promise<void>; dir: string }[] = [];

afterEach(async () => {
  while (running.length) {
    const server = running.pop();
    if (!server) continue;
    await server.close();
    await rm(server.dir, { recursive: true, force: true });
  }
});

describe("ORIEL-F205 server", () => {
  it("ORIEL-F205 says one routine has no canon bind and does not spare a machine that stays awake while work is still going", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "oriel-"));
    const server = await startServer({ port: 0, host: "127.0.0.1", dataDir: dir, testMode: true });
    running.push({ close: server.close, dir });
    const turn = async (text: string, extra: { goalId?: string; skillId?: string } = {}) => {
      const response = await fetch(`${server.url}/api/turn`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, ...extra }),
      });
      return { status: response.status, body: await response.json() };
    };
    const missing = await turn(`Does the Launch note routine say ${CANON_BIND_QUESTION}?`);
    expect(missing.status).toBe(200);
    expect(missing.body.goals).toHaveLength(0);
    expect(missing.body.routines).toHaveLength(0);
    expect(missing.body.messages.at(-1).text).toBe(routineCanonBindMissCopy("Launch note"));
    expect(missing.body.trust).toContain("has no canon bind in the record");
    expect(missing.body.trust).toContain("The row says No canon bind");
    expect(missing.body.trust).toContain("The row test id is canon-bind-");
    expect(missing.body.trust).toContain("The doze-tally reply still says Asking does not begin that thirty-day wait when the machine fell asleep after its last use");
    expect(missing.body.trust).toContain("has no doze tally in the record");
    expect(missing.body.trust).toContain("The row says No doze tally");
    expect(missing.body.trust).toContain("The row test id is doze-tally-");
    expect(missing.body.trust).toContain("The access-lift reply still says Asking does not lift that person off the team or end their sessions");
    expect(missing.body.trust).toContain(`The short reply says ${SHORT.slice(0, -1)}`);
    expect(missing.body.trust).toContain("has no access lift in the record");
    expect(missing.body.trust).toContain("The row says No access lift");
    expect(missing.body.trust).toContain("The row test id is access-lift-");
    expect(missing.body.trust).toContain("The short reply says Asking does not lift that person off the team or end their sessions");
    expect(missing.body.trust).toContain("The folio-return reply still says Asking does not seat the next note on that same lasting disk with the bots and sign-ins kept");
    expect(missing.body.trust).toContain("has no folio return in the record");
    expect(missing.body.trust).toContain("The row says No folio return");
    expect(missing.body.trust).toContain("The row test id is folio-return-");
    expect(missing.body.trust).toContain("The labor-close reply still says Asking does not close the work that is underway by ending the machine");
    expect(missing.body.trust).toContain("has no labor close in the record");
    expect(missing.body.trust).toContain("The row says No labor close");
    expect(missing.body.trust).toContain("The row test id is labor-close-");
    expect(missing.body.trust).toContain("An access lift is not a canon bind");
    expect(missing.body.trust).toContain("does not say there is no canon bind");
    expect(missing.body.trust).toContain("does not name a canon bind");
    expect(missing.body.trust).toContain("A stored run is not a canon bind");
    expect(missing.body.trust).toContain("A desk-wide pause does not invent a canon bind");
    expect(missing.body.trust).toContain("There is no relay lamp");
    expect(missing.body.trust).toContain("There is no keyhole");
    expect(missing.body.trust).not.toContain("A recorded failure is not a canon bind");
    expect(missing.body.trust).not.toContain("Always allow");
    expect(HAS_NO.includes("has no access lift")).toBe(false);
    expect("has no access lift".includes(HAS_NO)).toBe(false);
    expect(SHORT.includes(ACCESS_SHORT)).toBe(false);
    expect(ACCESS_SHORT.includes(SHORT)).toBe(false);
    expect(SHORT.includes(ALT_OPEN)).toBe(false);
    expect(SHORT.includes("Asking does not spare a machine that stays awake while work is still going.")).toBe(false);
    expect("Asking does not spare a machine that stays awake while work is still going.".includes(SHORT)).toBe(false);
    expect(HAS_NO.includes("has no wake guard")).toBe(false);
    expect("has no wake guard".includes(HAS_NO)).toBe(false);
    expect(SHORT.includes("Asking does not begin that thirty-day wait when the machine fell asleep after its last use.")).toBe(false);
    expect("Asking does not begin that thirty-day wait when the machine fell asleep after its last use.".includes(SHORT)).toBe(false);
    expect(HAS_NO.includes("has no doze tally")).toBe(false);
    expect("has no doze tally".includes(HAS_NO)).toBe(false);
    expect("canon-bind-".startsWith("access-lift-")).toBe(false);
    expect("canon-bind-".startsWith("access-")).toBe(false);
    expect("canon-bind-".startsWith("lift-")).toBe(false);
    expect("canon-bind-".startsWith("guard-")).toBe(false);
    expect("canon-bind-".startsWith("canon-")).toBe(true);
    expect("canon-bind-".startsWith("bind-")).toBe(false);
    expect("canon-bind-".startsWith("wake-")).toBe(false);
    expect("canon-bind-".startsWith("wake-guard-")).toBe(false);
    expect("canon-bind-".startsWith("doze-")).toBe(false);
    expect("access-lift-".startsWith("canon-bind-")).toBe(false);
    expect(JSON.stringify(missing.body)).not.toContain("Always allow");
    expect(routineCanonBindCopy("Launch note", true)).toContain(SHORT);
    expect(routineCanonBindCopy("Launch note", true)).not.toContain(ALT_OPEN);
    expect(routineCanonBindCopy("Launch note", true)).not.toMatch(/cursor/i);
    expect(routineCanonBindCopy("Launch note", true)).not.toMatch(/credential/i);
    expect(routineCanonBindCopy("Launch note", true)).not.toMatch(/password/i);
    expect(routineCanonBindCopy("Launch note", true)).not.toMatch(/secret/i);
    expect(routineCanonBindCopy("Launch note", true)).not.toMatch(/file/i);
    expect(routineCanonBindCopy("Launch note", true)).not.toContain("has no access lift");
    expect(routineAccessLiftCopy("Launch note", true)).not.toContain(HAS_NO);
    expect(routineAccessLiftCopy("Launch note", true)).not.toContain(SHORT);
    expect(routineLaborCloseCopy("Launch note", true)).not.toContain(HAS_NO);

    const opened = await turn("Summarize the launch risks");
    const goalId = opened.body.goals[0].id as string;
    const saved = await fetch(`${server.url}/api/routines`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goalId, name: "Launch note", cadence: "hourly" }),
    });
    const savedBody = await saved.json();
    const nextRun = savedBody.routines.find((routine: { name: string }) => routine.name === "Launch note").nextRunAt;
    const other = await turn("Compare the market landscape");
    const otherId = other.body.goals.at(-1).id as string;
    const savedOther = await fetch(`${server.url}/api/routines`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goalId: otherId, name: "Market check", cadence: "daily" }),
    });
    const savedOtherBody = await savedOther.json();
    const marketNext = savedOtherBody.routines.find((routine: { name: string }) => routine.name === "Market check").nextRunAt;

    const clear = await turn(`Please, does the Launch note routine say ${CANON_BIND_QUESTION}?`, { goalId, skillId: "missing-skill" });
    expect(clear.status).toBe(200);
    expect(clear.body.messages.at(-1).text).toBe(routineCanonBindCopy("Launch note", true));
    expect(clear.body.messages.at(-1).text).toContain("“Launch note” has no canon bind in the record.");
    expect(clear.body.messages.at(-1).text).toContain(SHORT);
    expect(clear.body.messages.at(-1).text).not.toContain(ALT_OPEN);
    expect(clear.body.messages.at(-1).text).not.toContain("has no access lift");
    expect(clear.body.messages.at(-1).text).not.toContain(ACCESS_SHORT);
    expect(clear.body.messages.at(-1).text).not.toMatch(/cursor/i);
    expect(clear.body.messages.at(-1).text).not.toMatch(/credential/i);
    expect(clear.body.messages.at(-1).text).not.toMatch(/password/i);
    expect(clear.body.messages.at(-1).text).not.toMatch(/secret/i);
    expect(clear.body.messages.at(-1).text).not.toMatch(/file/i);
    expect(clear.body.messages.at(-1).text).not.toContain(nextRun);
    expect(clear.body.routines.find((routine: { name: string }) => routine.name === "Launch note").nextRunAt).toBe(nextRun);
    expect(clear.body.goals).toHaveLength(2);

    const desk = await fetch(`${server.url}/api/pause`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paused: true }),
    });
    expect((await desk.json()).paused).toBe(true);
    const duringDesk = await turn(`Does the Launch note routine say ${CANON_BIND_QUESTION}?`);
    expect(duringDesk.body.paused).toBe(true);
    expect(duringDesk.body.messages.at(-1).text).toContain("“Launch note” has no canon bind in the record.");
    expect(duringDesk.body.messages.at(-1).text).not.toContain("Wakes are paused");
    expect(duringDesk.body.routines.find((routine: { name: string }) => routine.name === "Market check").nextRunAt).toBe(marketNext);

    const resumed = await fetch(`${server.url}/api/pause`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paused: false }),
    });
    expect((await resumed.json()).paused).toBe(false);
    const pausedOne = await turn("Pause the Launch note routine");
    expect(pausedOne.body.routines.find((routine: { name: string }) => routine.name === "Launch note").paused).toBe(true);
    const asked = await turn(`Does the Launch note routine say ${CANON_BIND_QUESTION}?`);
    expect(asked.body.messages.at(-1).text).toBe(routineCanonBindCopy("Launch note", true));
    expect(asked.body.routines.find((routine: { name: string }) => routine.name === "Launch note").cadence).toBe("hourly");
    expect(asked.body.routines.find((routine: { name: string }) => routine.name === "Launch note").nextRunAt).toBe(nextRun);
    expect(asked.body.routines.find((routine: { name: string }) => routine.name === "Launch note").paused).toBe(true);

    const accessLeft = await turn(`Does the Launch note routine say ${ACCESS_LIFT_STILL}?`);
    expect(accessLeft.body.messages.at(-1).text).toContain("has no access lift");
    expect(accessLeft.body.messages.at(-1).text).toContain(ACCESS_SHORT);
    expect(accessLeft.body.messages.at(-1).text).not.toContain(HAS_NO);
    expect(accessLeft.body.messages.at(-1).text).not.toContain(SHORT);
    const why = await turn("Why hasn't the Launch note routine run?");
    expect(why.body.messages.at(-1).text).toContain("A wake does not run it.");
    expect(why.body.messages.at(-1).text).not.toContain("canon bind");
    expect(why.body.messages.at(-1).text).not.toContain("wake guard");
    expect(why.body.messages.at(-1).text).not.toContain("access lift");

    const gone = await turn(`Does the Launch note routine say ${CANON_BIND_QUESTION}?`, { goalId: "goal_missing" });
    expect(gone.status).toBe(404);
    const refused = await turn(`Does the Launch note routine say ${CANON_BIND_QUESTION} without asking`);
    expect(refused.status).toBe(400);
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.routines.find((routine: { name: string }) => routine.name === "Launch note").paused).toBe(true);
    expect(still.routines.find((routine: { name: string }) => routine.name === "Launch note").nextRunAt).toBe(nextRun);
    expect(still.messages.at(-1).text).toContain("A wake does not run it.");
    expect(JSON.stringify(still)).not.toContain("Always allow");
  });
});
