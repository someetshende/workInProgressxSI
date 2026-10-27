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
  routineFirmYokeAmbiguousCopy,
  routineFirmYokeCopy,
  routineHookShelfAmbiguousCopy,
  routineHookShelfCopy,
  routineHookShelfMissCopy,
  routineReachLedgerAmbiguousCopy,
  routineReachLedgerCopy,
  routineReachLedgerMissCopy,
  routineShadeTallyAmbiguousCopy,
  routineShadeTallyCopy,
  routineShadeTallyMissCopy,
  routineVetoKeelAmbiguousCopy,
  routineVetoKeelCopy,
  routineClanCharterAmbiguousCopy,
  routineClanCharterCopy,
  routineClanCharterMissCopy,
  routineGuideLaneAmbiguousCopy,
  routineGuideLaneCopy,
  routineGuideLaneMissCopy,
  routineTerseFewAmbiguousCopy,
  routineTerseFewCopy,
  routineTerseFewMissCopy,
  routineScopeSplitAmbiguousCopy,
  routineScopeSplitCopy,
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

const QUILL_BOND_QUESTION =
  "that how team computers are set up, what they can reach, and how you recreate or terminate them";
const CLAN_CHARTER_STILL =
  "that for guidance that belongs to one cohort, add group rules under group settings";
const GUIDE_LANE_STILL =
  "that rules guide a Bot; for approval behavior, use Auto-review rules";
const TERSE_FEW_STILL =
  'that keep them short and few, like "never move company data to personal accounts."';
const FIRM_YOKE_STILL =
  "that rules applied to Grok Bot are always required, so members cannot turn them off";
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
const SHORT = "Asking does not map how those machines are prepared, where they may go, or how they are rebuilt or ended.";
const ALT_OPEN = "Asking does not sketch how those machines are prepared, where they may go, or how they are rebuilt or ended.";
const ALT_SET = "Asking does not spell how those machines are prepared, where they may go, or how they are rebuilt or ended.";
const CLAN_SHORT = "Asking does not place those notes for one set of people under that set's settings.";
const TERSE_SHORT = "Asking does not keep those guides short and few.";
const ACCESS_SHORT = "Asking does not lift that person off the team or end their sessions.";
const FOLIO_SHORT = "Asking does not seat the next note on that same lasting disk with the bots and sign-ins kept.";
const LABOR_SHORT = "Asking does not close the work that is underway by ending the machine.";
const HAS_NO = "has no reach ledger";

const OTHER_HAS_NO = [
  "has no gloss line",
  "has no trial span",
  "has no shade tally",
  "has no hook shelf",
  "has no yield cord",
  "has no quill bond",
  "has no cite slip",
  "has no douse mark",
  "has no sight glass",
  "has no ink latch",
  "has no cap layer",
  "has no waiver lock",
  "has no prior arm",
  "has no vacant quorum",
  "has no risk gate",
  "has no start dim",
  "has no veto keel",
  "has no clan charter",
  "has no guide lane",
  "has no terse few",
  "has no firm yoke",
  "has no scope split",
  "has no canon bind",
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

describe("ORIEL-F228", () => {
  it("ORIEL-F228 says one routine has no trial span and does not mark those review checks as a trial open to every large team", async () => {
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
      const asked = `Please, does the Launch note routine say ${QUILL_BOND_QUESTION}?`;

      state = await convene(state, asked, goalId, early, "missing-skill");
      expect(hits.length).toBe(beforeHits);
      expect(state.goals).toEqual(goalsBefore);
      expect(state.routines).toEqual(routinesBefore);
      expect(state.approvals).toEqual(approvalsBefore);
      expect(state.handoffRules).toEqual(rulesBefore);
      expect(state.paused).toBe(true);
      expect(state.messages.at(-1)?.goalId).toBeUndefined();
      expect(state.messages.at(-1)?.text).toBe(routineReachLedgerCopy("Launch note", true));
      expect(state.messages.at(-1)?.text).toContain("“Launch note” has no reach ledger in the record.");
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
        "Asking does not let that host permit or refuse the request before the model runs.",
        "Asking does not have that host permit or refuse the request before the model runs.",
        "Asking does not make that host permit or refuse the request before the model runs.",
        "Asking does not halt those shared notes once the lock is switched off.",
        "Asking does not cease those shared notes once the lock is switched off.",
        "Asking does not drop those shared notes once the lock is switched off.",
        "Asking does not show those shared notes as a look-only pane where ask-first wins a clash.",
        "Asking does not leave those shared notes as a look-only pane where ask-first wins a clash.",
        "Asking does not park those shared notes as a look-only pane where ask-first wins a clash.",
        "Asking does not open that hooks pane from the compliance shelf.",
        "Asking does not leave a new setup in a quiet watch that notes refusals without stopping people.",
        "Asking does not keep a new setup in a quiet watch that notes refusals without stopping people.",
        "Asking does not park a new setup in a quiet watch that notes refusals without stopping people.",
        "Asking does not show that hooks pane from the compliance shelf.",
        "Asking does not reach that hooks pane from the compliance shelf.",
        "Asking does not write those notes on that page the moment they change.",
        "Asking does not store those notes on that page the moment they change.",
        "Asking does not keep those notes on that page the moment they change.",
        "Asking does not lay that shared cap over each person's own notes.",
        "Asking does not set that shared cap over each person's own notes.",
        "Asking does not place that shared cap over each person's own notes.",
        "Asking does not let one set of people drop that lock for themselves.",
        "Asking does not free one set of people to drop that lock for themselves.",
        "Asking does not hand one set of people a way to drop that lock for themselves.",
        "Asking does not follow that see-also line to the hooks note.",
        "Asking does not open that see-also line to the hooks note.",
        "Asking does not walk that see-also line to the hooks note.",
        ALT_OPEN,
        ALT_SET,
        "Asking does not cover a chat where nobody can answer before the work runs.",
        "Asking does not hold a chat where nobody can answer before the work runs.",
        "Asking does not keep a chat where nobody can answer before the work runs.",
        "Asking does not make those workers check risky steps before they run and ask before they proceed.",
        "Asking does not force those workers to check risky steps before they run and ask before they proceed.",
        "Asking does not set those workers to check risky steps before they run and ask before they proceed.",
        "Asking does not leave that control on that page and off at the start.",
        "Asking does not park that control on that page and off at the start.",
        "Asking does not seat that control on that page and off at the start.",
        "Asking does not stop people from switching that check off.",
        "Asking does not block people from switching that check off.",
        "Asking does not bar people from switching that check off.",
        CLAN_SHORT,
        "Asking does not add those notes for one set of people under that set's settings.",
        "Asking does not set those notes for one set of people under that set's settings.",
        "Asking does not steer those guides toward approval behavior.",
        "Asking does not aim those guides toward approval behavior.",
        "Asking does not bend those guides toward approval behavior.",
        TERSE_SHORT,
        "Asking does not hold those guides short and few.",
        "Asking does not leave those guides short and few.",
        "Asking does not lock those rules on so people cannot switch them off.",
        "Asking does not fasten those rules on so people cannot switch them off.",
        "Asking does not pin those rules on so people cannot switch them off.",
        "Asking does not make every member's bots follow those rules.",
        "Asking does not set every member's bots to follow those rules.",
        "Asking does not put every member's bots under those rules.",
        ACCESS_SHORT,
        FOLIO_SHORT,
        LABOR_SHORT,
        "Asking does not spare a machine that stays awake while work is still going.",
        "Asking does not keep a machine that stays awake while work is still going.",
        "Asking does not shield a machine that stays awake while work is still going.",
        "Asking does not begin that thirty-day wait when the machine fell asleep after its last use.",
        "Asking does not open that thirty-day wait when the machine fell asleep after its last use.",
        "Asking does not set that thirty-day wait when the machine fell asleep after its last use.",
        "Asking does not mark those review checks as a trial open to every large team.",
        "Asking does not call those review checks a trial open to every large team.",
        "Asking does not treat those review checks as a trial open to every large team.",
      ]) {
        expect(SHORT.includes(other)).toBe(false);
        expect(other.includes(SHORT)).toBe(false);
      }
      const rowId = "yard-chart-";
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
        "terse-few-",
        "terse-",
        "few-",
        "lane-",
        "firm-yoke-",
        "scope-split-",
      ]) {
        expect(rowId.startsWith(prefix)).toBe(false);
      }
      expect(rowId.startsWith("yard-")).toBe(true);
      expect(rowId.startsWith("chart-")).toBe(false);
      expect(rowId.startsWith("line-")).toBe(false);
      expect(rowId.startsWith("trial-")).toBe(false);
      expect(rowId.startsWith("span-")).toBe(false);
      expect(rowId.startsWith("shade-")).toBe(false);
      expect(rowId.startsWith("shade-tally-")).toBe(false);
      expect(rowId.startsWith("tally-")).toBe(false);
      expect(rowId.startsWith("hook-")).toBe(false);
      expect(rowId.startsWith("hook-shelf-")).toBe(false);
      expect(rowId.startsWith("shelf-")).toBe(false);
      expect(rowId.startsWith("yield-")).toBe(false);
      expect(rowId.startsWith("yield-cord-")).toBe(false);
      expect(rowId.startsWith("cord-")).toBe(false);
      expect(rowId.startsWith("bond-")).toBe(false);
      expect(rowId.startsWith("cite-slip-")).toBe(false);
      expect(rowId.startsWith("cite-")).toBe(false);
      expect(rowId.startsWith("slip-")).toBe(false);
      expect(rowId.startsWith("douse-mark-")).toBe(false);
      expect(rowId.startsWith("douse-")).toBe(false);
      expect(rowId.startsWith("mark-")).toBe(false);
      expect(rowId.startsWith("ink-latch-")).toBe(false);
      expect(rowId.startsWith("ink-")).toBe(false);
      expect(rowId.startsWith("latch-")).toBe(false);
      expect(rowId.startsWith("cap-layer-")).toBe(false);
      expect(rowId.startsWith("cap-")).toBe(false);
      expect(rowId.startsWith("vacant-quorum-")).toBe(false);
      expect(rowId.startsWith("vacant-")).toBe(false);
      expect(rowId.startsWith("quorum-")).toBe(false);
      expect(rowId.startsWith("slip-")).toBe(false);
      expect(rowId.startsWith("sight-")).toBe(false);
      expect(rowId.startsWith("sight-glass-")).toBe(false);
      expect(rowId.startsWith("glass-")).toBe(false);
      expect(rowId.startsWith("layer-")).toBe(false);
      expect(rowId.startsWith("waiver-")).toBe(false);
      expect(rowId.startsWith("waiver-lock-")).toBe(false);
      expect(rowId.startsWith("lock-")).toBe(false);
      expect(rowId.startsWith("prior-")).toBe(false);
      expect(rowId.startsWith("arm-")).toBe(false);
      expect(rowId.startsWith("risk-")).toBe(false);
      expect(rowId.startsWith("risk-gate-")).toBe(false);
      expect(rowId.startsWith("gate-")).toBe(false);
      expect(rowId.startsWith("gate-")).toBe(false);
      expect(rowId.startsWith("off-")).toBe(false);
      expect(rowId.startsWith("off-page-")).toBe(false);
      expect(rowId.startsWith("start-")).toBe(false);
      expect(rowId.startsWith("page-")).toBe(false);
      expect(rowId.startsWith("veto-")).toBe(false);
      expect(rowId.startsWith("keel-")).toBe(false);
      expect(rowId.startsWith("page-")).toBe(false);
      expect(rowId.startsWith("clan-charter-")).toBe(false);
      expect(rowId.startsWith("clan-")).toBe(false);
      expect(rowId.startsWith("charter-")).toBe(false);
      expect(rowId.startsWith("guide-")).toBe(false);
      expect(rowId.startsWith("lane-")).toBe(false);
      expect(rowId.startsWith("yard-chart-")).toBe(true);
      expect(rowId.startsWith("gloss-line-")).toBe(false);
      expect(rowId.startsWith("gloss-")).toBe(false);
      expect(rowId.startsWith("trial-span-")).toBe(false);
      expect(rowId.startsWith("trial-")).toBe(false);
      expect(rowId.startsWith("span-")).toBe(false);
      expect(rowId.startsWith("shade-tally-")).toBe(false);
      expect(rowId.startsWith("hook-shelf-")).toBe(false);
      expect(rowId.startsWith("sight-glass-")).toBe(false);
      expect(rowId.startsWith("terse-few-")).toBe(false);
      expect(rowId.startsWith("terse-")).toBe(false);
      expect(rowId.startsWith("few-")).toBe(false);
      expect(rowId.startsWith("firm-yoke-")).toBe(false);
      expect(rowId.startsWith("scope-split-")).toBe(false);
      expect("access-lift-".startsWith("sight-glass-")).toBe(false);
      expect("sight-glass-".startsWith("access-lift-")).toBe(false);
      expect("terse-few-".startsWith("sight-glass-")).toBe(false);
      expect("sight-glass-".startsWith("terse-few-")).toBe(false);
      expect(routineReachLedgerCopy("Launch note", true)).toContain(SHORT);
      expect(routineReachLedgerCopy("Launch note", true)).not.toContain(ALT_OPEN);
      expect(routineReachLedgerCopy("Launch note", true)).not.toContain("has no access lift");
      expect(routineReachLedgerCopy("Launch note", true)).not.toMatch(/cursor/i);
      expect(routineReachLedgerCopy("Launch note", true)).not.toMatch(/credential/i);
      expect(routineReachLedgerCopy("Launch note", true)).not.toMatch(/password/i);
      expect(routineReachLedgerCopy("Launch note", true)).not.toMatch(/secret/i);
      expect(routineReachLedgerCopy("Launch note", true)).not.toMatch(/file/i);
      expect(routineReachLedgerCopy("Launch note", true)).not.toContain("Grok Bot");
      expect(routineAccessLiftCopy("Launch note", true)).not.toContain(HAS_NO);
      expect(routineAccessLiftCopy("Launch note", true)).not.toContain(SHORT);
      expect(routineFolioReturnCopy("Launch note", true)).not.toContain(HAS_NO);
      expect(state.messages.at(-1)?.text).toContain("Another routine is unchanged.");
      expect(state.messages.at(-1)?.text).not.toContain("Dots");
      expect(state.messages.at(-1)?.text).not.toContain("Muse");
      expect(state.messages.at(-1)?.text).not.toContain("2026-10-24T02:00:00.000Z");
      expect(state.messages.at(-1)?.text).not.toContain("Market check");
      expect(state.events.some((event) => event.type === "routine_reach_ledger")).toBe(true);
      expect(state.events.some((event) => event.type === "routine_access_lift")).toBe(false);
      expect(state.events.some((event) => event.type === "routine_folio_return")).toBe(false);
      expect(state.events.some((event) => event.type === "routine_ran")).toBe(false);
      const published = JSON.stringify(toPublic(state, 0));
      expect(published).not.toContain("bridge-secret-xyz");
      expect(published).not.toContain("Always allow");
      expect(published).toContain("has no hook shelf in the record");
      expect(published).toContain("The row says No quill bond");
      expect(published).toContain("The row test id is hook-shelf-");
      expect(published).toContain("has no reach ledger in the record");
      expect(published).toContain("The row says No reach ledger");
      expect(published).toContain("The row test id is yard-chart-");
      expect(published).toContain("The trial-span reply still says Asking does not mark those review checks as a trial open to every large team");
      expect(published).toContain("A gloss line is not a reach ledger");
      expect(published).toContain("does not say there is no reach ledger");
      expect(published).toContain("does not name a reach ledger");
      expect(published).toContain("has no trial span in the record");
      expect(published).toContain("The row says No trial span");
      expect(published).toContain("The row test id is trial-span-");
      expect(published).toContain("The shade-tally reply still says Asking does not leave a new setup in a quiet watch that notes refusals without stopping people");
      expect(published).toContain("A shade tally is not a trial span");
      expect(published).toContain("does not say there is no trial span");
      expect(published).toContain("does not name a trial span");
      expect(published).toContain("has no shade tally in the record");
      expect(published).toContain("The row says No shade tally");
      expect(published).toContain("The row test id is shade-tally-");
      expect(published).toContain("The hook-shelf reply still says Asking does not open that hooks pane from the compliance shelf");
      expect(published).toContain("A hook shelf is not a shade tally");
      expect(published).toContain("does not say there is no shade tally");
      expect(published).toContain("does not name a shade tally");
      expect(published).toContain("The row says No yield cord");
      expect(published).toContain("The row test id is yield-cord-");
      expect(published).toContain("The yield-cord reply still says Asking does not let that host permit or refuse the request before the model runs");

      expect(published).toContain("The short reply says Asking does not open that review page from the note");
      expect(published).toContain("The short reply says Asking does not halt those shared notes once the lock is switched off");
      expect(published).toContain("A sight glass is not a quill bond");
      expect(published).toContain("does not say there is no quill bond");
      expect(published).toContain("does not name a quill bond");
      expect(published).toContain("A stored run is not a quill bond");
      expect(published).toContain("A desk-wide pause does not invent a quill bond");
      expect(published).toContain("The sight-glass reply still says Asking does not show those shared notes as a look-only pane where ask-first wins a clash");
      expect(published).toContain("has no sight glass in the record");
      expect(published).toContain("The row says No sight glass");
      expect(published).toContain("The row test id is sight-glass-");
      expect(published).toContain("has no prior arm in the record");
      expect(published).toContain("The row says No prior arm");
      expect(published).toContain("The row test id is prior-arm-");
      expect(published).toContain("The prior-arm reply still says Asking does not turn that lock on before you count on the shared review rules");
      expect(published).toContain("The terse-few reply still says Asking does not keep those guides short and few");
      expect(published).toContain("has no terse few in the record");
      expect(published).toContain("The row says No terse few");
      expect(published).toContain("The row test id is terse-few-");
      expect(published).toContain("A guide lane is not a sight glass");
      expect(published).toContain("does not say there is no sight glass");
      expect(published).toContain("does not name a sight glass");
      expect(published).toContain("A stored run is not a sight glass");
      expect(published).toContain("A desk-wide pause does not invent a sight glass");
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
      expect(published).toContain("An access lift is not a terse few");
      expect(published).toContain("does not say there is no terse few");
      expect(published).toContain("does not name a terse few");
      expect(published).toContain("A stored run is not a terse few");
      expect(published).toContain("A desk-wide pause does not invent a terse few");
      expect(published).toContain("There is no relay lamp");
      expect(published).toContain("There is no keyhole");
      expect(published).not.toContain("A recorded failure is not a terse few");
      expect(published).not.toContain("A recorded failure is not an access lift");

      const openDesk = structuredClone(state);
      openDesk.paused = false;
      const still = await wakeDue(openDesk, early);
      expect(still.routines[0]?.paused).toBe(true);
      expect(still.routines[0]?.nextRunAt).toBe("2026-10-24T02:00:00.000Z");
      expect(still.events.some((event) => event.type === "routine_ran")).toBe(false);

      const market = await convene(state, `Does the Market check routine say ${QUILL_BOND_QUESTION}?`, undefined, early);
      expect(market.messages.at(-1)?.text).toBe(routineReachLedgerCopy("Market check", true));
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

      const glossLeft = await convene(state, "Does the Launch note routine say that see grok bot inference hooks?", undefined, early);
      expect(glossLeft.messages.at(-1)?.text).toContain("“Launch note” has no gloss line in the record.");
      expect(glossLeft.messages.at(-1)?.text).toContain("Asking does not follow that see-also line to the hooks note.");
      expect(glossLeft.messages.at(-1)?.text).not.toContain(HAS_NO);
      expect(glossLeft.messages.at(-1)?.text).not.toContain(SHORT);
      expect(glossLeft.events.at(-1)?.type).toBe("routine_gloss_line");

      const shadeLeft = await convene(state, "Does the Launch note routine say that new configurations start in shadow mode, which records denials in the audit log without blocking members?", undefined, early);
      expect(shadeLeft.messages.at(-1)?.text).toContain("“Launch note” has no shade tally in the record.");
      expect(shadeLeft.messages.at(-1)?.text).toContain("Asking does not leave a new setup in a quiet watch that notes refusals without stopping people.");
      expect(shadeLeft.messages.at(-1)?.text).not.toContain(HAS_NO);
      expect(shadeLeft.messages.at(-1)?.text).not.toContain(SHORT);
      expect(shadeLeft.events.at(-1)?.type).toBe("routine_shade_tally");

      const hookLeft = await convene(state, "Does the Launch note routine say that open inference hooks from security & compliance on the grok bot page?", undefined, early);
      expect(hookLeft.messages.at(-1)?.text).toContain("“Launch note” has no hook shelf in the record.");
      expect(hookLeft.messages.at(-1)?.text).toContain("Asking does not open that hooks pane from the compliance shelf.");
      expect(hookLeft.messages.at(-1)?.text).not.toContain(HAS_NO);
      expect(hookLeft.messages.at(-1)?.text).not.toContain(SHORT);
      expect(hookLeft.events.at(-1)?.type).toBe("routine_hook_shelf");

      const yieldLeft = await convene(state, "Does the Launch note routine say that your server allows or denies the request before the model runs?", undefined, early);
      expect(yieldLeft.messages.at(-1)?.text).toContain("“Launch note” has no yield cord in the record.");
      expect(yieldLeft.messages.at(-1)?.text).toContain("Asking does not let that host permit or refuse the request before the model runs.");
      expect(yieldLeft.messages.at(-1)?.text).not.toContain(HAS_NO);
      expect(yieldLeft.messages.at(-1)?.text).not.toContain(SHORT);
      expect(yieldLeft.events.at(-1)?.type).toBe("routine_yield_cord");

            const quillLeft = await convene(state, "Does the Launch note routine say that sends each grok bot model request, signed, to an ai security server your organization runs or uses through a security vendor?", undefined, early);
      expect(quillLeft.messages.at(-1)?.text).toContain("“Launch note” has no quill bond in the record.");
      expect(quillLeft.messages.at(-1)?.text).toContain("Asking does not forward each signed model request to a review server the organization runs or reaches through a vendor.");
      expect(quillLeft.messages.at(-1)?.text).not.toContain(HAS_NO);
      expect(quillLeft.messages.at(-1)?.text).not.toContain(SHORT);
      expect(quillLeft.events.at(-1)?.type).toBe("routine_quill_bond");

      const citeLeft = await convene(state, "Does the Launch note routine say that see approvals and auto review?", undefined, early);
      expect(citeLeft.messages.at(-1)?.text).toContain("“Launch note” has no cite slip in the record.");
      expect(citeLeft.messages.at(-1)?.text).toContain("Asking does not open that review page from the note.");
      expect(citeLeft.messages.at(-1)?.text).not.toContain(HAS_NO);
      expect(citeLeft.messages.at(-1)?.text).not.toContain(SHORT);
      expect(citeLeft.events.at(-1)?.type).toBe("routine_cite_slip");

      const douseLeft = await convene(state, "Does the Launch note routine say that turning enforcement off stops applying the team rules?", undefined, early);
      expect(douseLeft.messages.at(-1)?.text).toContain("“Launch note” has no douse mark in the record.");
      expect(douseLeft.messages.at(-1)?.text).toContain("Asking does not halt those shared notes once the lock is switched off.");
      expect(douseLeft.messages.at(-1)?.text).not.toContain(HAS_NO);
      expect(douseLeft.messages.at(-1)?.text).not.toContain(SHORT);
      expect(douseLeft.events.at(-1)?.type).toBe("routine_douse_mark");

      const sightLeft = await convene(state, "Does the Launch note routine say that members see the team rules under settings → general → auto-review but cannot edit or delete them, and ask first wins when rules conflict?", undefined, early);
      expect(sightLeft.messages.at(-1)?.text).toContain("“Launch note” has no sight glass in the record.");
      expect(sightLeft.messages.at(-1)?.text).toContain("Asking does not show those shared notes as a look-only pane where ask-first wins a clash.");
      expect(sightLeft.messages.at(-1)?.text).not.toContain(HAS_NO);
      expect(sightLeft.messages.at(-1)?.text).not.toContain(SHORT);
      expect(sightLeft.events.at(-1)?.type).toBe("routine_sight_glass");

      const capLeft = await convene(state, "Does the Launch note routine say that team-wide Ask first and Allow automatically rules that apply to every member's Bots on top of their own rules?", undefined, early);
      expect(capLeft.messages.at(-1)?.text).toContain("“Launch note” has no cap layer in the record.");
      expect(capLeft.messages.at(-1)?.text).toContain("Asking does not lay that shared cap over each person's own notes.");
      expect(capLeft.messages.at(-1)?.text).not.toContain(HAS_NO);
      expect(capLeft.messages.at(-1)?.text).not.toContain(SHORT);
      expect(capLeft.events.at(-1)?.type).toBe("routine_cap_layer");

      const waiverLeft = await convene(state, "Does the Launch note routine say that a group can lift the lock for its own members with Don't enforce for this group; see Group settings?", undefined, early);
      expect(waiverLeft.messages.at(-1)?.text).toContain("“Launch note” has no waiver lock in the record.");
      expect(waiverLeft.messages.at(-1)?.text).toContain("Asking does not let one set of people drop that lock for themselves.");
      expect(waiverLeft.messages.at(-1)?.text).not.toContain(HAS_NO);
      expect(waiverLeft.messages.at(-1)?.text).not.toContain(SHORT);
      expect(waiverLeft.events.at(-1)?.type).toBe("routine_waiver_lock");

      const priorLeft = await convene(state, "Does the Launch note routine say that turn it on before you rely on team Auto-review rules?", undefined, early);
      expect(priorLeft.messages.at(-1)?.text).toContain("“Launch note” has no prior arm in the record.");
      expect(priorLeft.messages.at(-1)?.text).toContain("Asking does not turn that lock on before you count on the shared review rules.");
      expect(priorLeft.messages.at(-1)?.text).not.toContain(HAS_NO);
      expect(priorLeft.messages.at(-1)?.text).not.toContain(SHORT);
      expect(priorLeft.events.at(-1)?.type).toBe("routine_prior_arm");

      const vacantLeft = await convene(state, "Does the Launch note routine say that this includes Team Bots in chats where nobody can answer an approval, which otherwise run without Auto-review?", undefined, early);
      expect(vacantLeft.messages.at(-1)?.text).toContain("“Launch note” has no vacant quorum in the record.");
      expect(vacantLeft.messages.at(-1)?.text).toContain("Asking does not cover a chat where nobody can answer before the work runs.");
      expect(vacantLeft.messages.at(-1)?.text).not.toContain(HAS_NO);
      expect(vacantLeft.messages.at(-1)?.text).not.toContain(SHORT);
      expect(vacantLeft.events.at(-1)?.type).toBe("routine_vacant_quorum");

      const riskLeft = await convene(state, "Does the Launch note routine say that when it is on, Bots always check risky actions before running them and ask for approval when needed?", undefined, early);
      expect(riskLeft.messages.at(-1)?.text).toContain("“Launch note” has no risk gate in the record.");
      expect(riskLeft.messages.at(-1)?.text).toContain("Asking does not make those workers check risky steps before they run and ask before they proceed.");
      expect(riskLeft.messages.at(-1)?.text).not.toContain(HAS_NO);
      expect(riskLeft.messages.at(-1)?.text).not.toContain(SHORT);
      expect(riskLeft.events.at(-1)?.type).toBe("routine_risk_gate");

      const startLeft = await convene(state, "Does the Launch note routine say that the switch is on the Grok Bot page and is off by default?", undefined, early);
      expect(startLeft.messages.at(-1)?.text).toContain("“Launch note” has no start dim in the record.");
      expect(startLeft.messages.at(-1)?.text).toContain("Asking does not leave that control on that page and off at the start.");
      expect(startLeft.messages.at(-1)?.text).not.toContain(HAS_NO);
      expect(startLeft.messages.at(-1)?.text).not.toContain(SHORT);
      expect(startLeft.events.at(-1)?.type).toBe("routine_start_dim");

      const vetoLeft = await convene(state, "Does the Launch note routine say that prevents members from turning Auto-review off?", undefined, early);
      expect(vetoLeft.messages.at(-1)?.text).toBe(routineVetoKeelCopy("Launch note", true));
      expect(vetoLeft.messages.at(-1)?.text).toContain("“Launch note” has no veto keel in the record.");
      expect(vetoLeft.messages.at(-1)?.text).toContain("Asking does not stop people from switching that check off.");
      expect(vetoLeft.messages.at(-1)?.text).not.toContain(HAS_NO);
      expect(vetoLeft.messages.at(-1)?.text).not.toContain(SHORT);
      expect(vetoLeft.events.at(-1)?.type).toBe("routine_veto_keel");

      const clanLeft = await convene(state, "Does the Launch note routine say that for guidance that belongs to one cohort, add Group Rules under Group settings?", undefined, early);
      expect(clanLeft.messages.at(-1)?.text).toBe(routineClanCharterCopy("Launch note", true));
      expect(clanLeft.messages.at(-1)?.text).toContain("“Launch note” has no clan charter in the record.");
      expect(clanLeft.messages.at(-1)?.text).toContain(CLAN_SHORT);
      expect(clanLeft.messages.at(-1)?.text).not.toContain(HAS_NO);
      expect(clanLeft.messages.at(-1)?.text).not.toContain(SHORT);
      expect(clanLeft.events.at(-1)?.type).toBe("routine_clan_charter");

      const guideLeft = await convene(state, `Does the Launch note routine say ${GUIDE_LANE_STILL}?`, undefined, early);
      expect(guideLeft.messages.at(-1)?.text).toBe(routineGuideLaneCopy("Launch note", true));
      expect(guideLeft.messages.at(-1)?.text).toContain("“Launch note” has no guide lane in the record.");
      expect(guideLeft.messages.at(-1)?.text).toContain("Asking does not steer those guides toward approval behavior.");
      expect(guideLeft.messages.at(-1)?.text).not.toContain(HAS_NO);
      expect(guideLeft.messages.at(-1)?.text).not.toContain(SHORT);
      expect(guideLeft.events.at(-1)?.type).toBe("routine_guide_lane");
      const terseLeft = await convene(state, `Does the Launch note routine say ${TERSE_FEW_STILL}?`, undefined, early);
      expect(terseLeft.messages.at(-1)?.text).toBe(routineTerseFewCopy("Launch note", true));
      expect(terseLeft.messages.at(-1)?.text).toContain("“Launch note” has no terse few in the record.");
      expect(terseLeft.messages.at(-1)?.text).toContain(TERSE_SHORT);
      expect(terseLeft.messages.at(-1)?.text).not.toContain(HAS_NO);
      expect(terseLeft.messages.at(-1)?.text).not.toContain(SHORT);
      expect(terseLeft.events.at(-1)?.type).toBe("routine_terse_few");

      const firmLeft = await convene(state, `Does the Launch note routine say ${FIRM_YOKE_STILL}?`, undefined, early);
      expect(firmLeft.messages.at(-1)?.text).toBe(routineFirmYokeCopy("Launch note", true));
      expect(firmLeft.messages.at(-1)?.text).toContain("“Launch note” has no firm yoke in the record.");
      expect(firmLeft.messages.at(-1)?.text).toContain("Asking does not lock those rules on so people cannot switch them off.");
      expect(firmLeft.messages.at(-1)?.text).not.toContain(HAS_NO);
      expect(firmLeft.messages.at(-1)?.text).not.toContain(SHORT);
      expect(firmLeft.events.at(-1)?.type).toBe("routine_firm_yoke");
      const scopeLeft = await convene(state, "Does the Launch note routine say that add them from the Grok Bot page and scope each rule to Cursor, Grok Bot, or both?", undefined, early);
      expect(scopeLeft.messages.at(-1)?.text).toBe(routineScopeSplitCopy("Launch note", true));
      expect(scopeLeft.messages.at(-1)?.text).toContain("“Launch note” has no scope split in the record.");
      expect(scopeLeft.messages.at(-1)?.text).toContain("Asking does not add those rules from that page or limit each one to one seat, the other, or both.");
      expect(scopeLeft.messages.at(-1)?.text).not.toContain(HAS_NO);
      expect(scopeLeft.messages.at(-1)?.text).not.toContain(SHORT);
      expect(scopeLeft.events.at(-1)?.type).toBe("routine_scope_split");
      const canonLeft = await convene(state, "Does the Launch note routine say that rules that every member's Bots follow?", undefined, early);
      expect(canonLeft.messages.at(-1)?.text).toBe(routineCanonBindCopy("Launch note", true));
      expect(canonLeft.messages.at(-1)?.text).toContain("“Launch note” has no canon bind in the record.");
      expect(canonLeft.messages.at(-1)?.text).toContain("Asking does not make every member's bots follow those rules.");
      expect(canonLeft.messages.at(-1)?.text).not.toContain(HAS_NO);
      expect(canonLeft.messages.at(-1)?.text).not.toContain(SHORT);
      expect(canonLeft.events.at(-1)?.type).toBe("routine_canon_bind");
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
      expect(why.messages.at(-1)?.text).not.toContain("sight glass");
      expect(why.messages.at(-1)?.text).not.toContain("quill bond");
      expect(why.messages.at(-1)?.text).not.toContain("cite slip");
      expect(why.messages.at(-1)?.text).not.toContain("ink latch");
      expect(why.messages.at(-1)?.text).not.toContain("waiver lock");
      expect(why.messages.at(-1)?.text).not.toContain("prior arm");
      expect(why.messages.at(-1)?.text).not.toContain("vacant quorum");
      expect(why.messages.at(-1)?.text).not.toContain("terse few");
      expect(why.messages.at(-1)?.text).not.toContain("firm yoke");
      expect(why.messages.at(-1)?.text).not.toContain("scope split");
      expect(why.messages.at(-1)?.text).not.toContain("wake guard");
      expect(why.messages.at(-1)?.text).not.toContain("access lift");
      expect(why.routines[0]?.nextRunAt).toBe("2026-10-24T02:00:00.000Z");
    });
  });

  it("ORIEL-F228 leaves two names, a desk pause, and a widened sentence alone", async () => {
    const now = new Date("2026-10-24T07:00:00.000Z");
    const early: Deps = { now: () => now, fetchImpl: fetch, refine: null };
    const none = await convene(initialState(), `Does the Launch note routine say ${QUILL_BOND_QUESTION}?`, undefined, early);
    expect(none.goals).toHaveLength(0);
    expect(none.routines).toHaveLength(0);
    expect(none.messages.at(-1)?.text).toBe(routineReachLedgerMissCopy("Launch note"));
    expect(none.events.some((event) => event.type === "routine_reach_ledger")).toBe(true);
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

    const asked = await convene(state, `PLEASE, does the Launch note routine say ${QUILL_BOND_QUESTION}?`, firstId, early, "missing-skill");
    expect(asked.goals).toHaveLength(goals);
    expect(asked.messages.at(-1)?.text).toBe(routineReachLedgerAmbiguousCopy("Launch note"));
    expect(asked.messages.at(-1)?.text).toContain("More than one routine has that name");
    expect(asked.messages.at(-1)?.text).not.toContain(HAS_NO);
    expect(asked.routines[0]?.heldBack).toEqual(["send"]);
    expect(asked.routines[0]?.paused).toBe(true);
    expect(asked.routines[0]?.instruction).toBe(launchInstruction);
    expect(asked.routines[0]?.nextRunAt).toBe(launchNext);
    expect(asked.routines[1]?.nextRunAt).toBe(secondNext);
    expect(asked.routines[2]?.nextRunAt).toBe(marketNext);

    for (const text of [
      `Please, does the Launch note routine say ${QUILL_BOND_QUESTION}.`,
      `Does the Launch note routine say ${QUILL_BOND_QUESTION}??`,
    ]) {
      const again = await convene(state, text, undefined, early);
      expect(again.messages.at(-1)?.text).toBe(routineReachLedgerAmbiguousCopy("Launch note"));
      expect(again.routines[0]?.paused).toBe(true);
      expect(again.goals).toHaveLength(goals);
    }
    const lower = await convene(
      state,
      "does the launch note routine say that how team computers are set up, what they can reach, and how you recreate or terminate them",
      undefined,
      early,
    );
    expect(lower.messages.at(-1)?.text).toBe(routineReachLedgerAmbiguousCopy("launch note"));
    expect(lower.messages.at(-1)?.text).not.toContain(HAS_NO);
    expect(lower.messages.at(-1)?.text).not.toContain("has no access lift");
    expect(lower.messages.at(-1)?.text).not.toContain("has no folio return");
    expect(lower.events.some((event) => event.type === "routine_reach_ledger")).toBe(true);

    const glossLower = await convene(
      state,
      "does the launch note routine say that see grok bot inference hooks",
      undefined,
      early,
    );
    expect(glossLower.messages.at(-1)?.text).toContain("More than one routine has that name");
    expect(glossLower.messages.at(-1)?.text).not.toContain(HAS_NO);
    expect(glossLower.messages.at(-1)?.text).not.toContain(SHORT);
    expect(glossLower.events.some((event) => event.type === "routine_gloss_line")).toBe(true);
    expect(glossLower.events.some((event) => event.type === "routine_reach_ledger")).toBe(false);

    const trialLower = await convene(
      state,
      "does the launch note routine say that inference hooks are in beta and available to all enterprise teams",
      undefined,
      early,
    );
    expect(trialLower.messages.at(-1)?.text).toContain("More than one routine has that name");
    expect(trialLower.messages.at(-1)?.text).not.toContain(HAS_NO);
    expect(trialLower.messages.at(-1)?.text).not.toContain(SHORT);
    expect(trialLower.events.some((event) => event.type === "routine_trial_span")).toBe(true);
    expect(trialLower.events.some((event) => event.type === "routine_reach_ledger")).toBe(false);


    const shadeLower = await convene(
      state,
      "does the launch note routine say that new configurations start in shadow mode, which records denials in the audit log without blocking members",
      undefined,
      early,
    );
    expect(shadeLower.messages.at(-1)?.text).toBe(routineShadeTallyAmbiguousCopy("launch note"));
    expect(shadeLower.messages.at(-1)?.text).toContain("More than one routine has that name");
    expect(shadeLower.messages.at(-1)?.text).not.toContain(HAS_NO);
    expect(shadeLower.messages.at(-1)?.text).not.toContain(SHORT);
    expect(shadeLower.events.some((event) => event.type === "routine_shade_tally")).toBe(true);
    expect(shadeLower.events.some((event) => event.type === "routine_reach_ledger")).toBe(false);

    const hookLower = await convene(
      state,
      "does the launch note routine say that open inference hooks from security & compliance on the grok bot page",
      undefined,
      early,
    );
    expect(hookLower.messages.at(-1)?.text).toBe(routineHookShelfAmbiguousCopy("launch note"));
    expect(hookLower.messages.at(-1)?.text).toContain("More than one routine has that name");
    expect(hookLower.messages.at(-1)?.text).not.toContain(HAS_NO);
    expect(hookLower.messages.at(-1)?.text).not.toContain(SHORT);
    expect(hookLower.events.some((event) => event.type === "routine_hook_shelf")).toBe(true);
    expect(hookLower.events.some((event) => event.type === "routine_reach_ledger")).toBe(false);

    const yieldLower = await convene(
      state,
      "does the launch note routine say that your server allows or denies the request before the model runs",
      undefined,
      early,
    );
    expect(yieldLower.messages.at(-1)?.text).toContain("More than one routine has that name");
    expect(yieldLower.messages.at(-1)?.text).not.toContain(HAS_NO);
    expect(yieldLower.messages.at(-1)?.text).not.toContain(SHORT);
    expect(yieldLower.events.some((event) => event.type === "routine_yield_cord")).toBe(true);
    expect(yieldLower.events.some((event) => event.type === "routine_reach_ledger")).toBe(false);

    const quillLower = await convene(
      state,
      "does the launch note routine say that sends each grok bot model request, signed, to an ai security server your organization runs or uses through a security vendor",
      undefined,
      early,
    );
    expect(quillLower.messages.at(-1)?.text).toContain("More than one routine has that name");
    expect(quillLower.messages.at(-1)?.text).not.toContain(HAS_NO);
    expect(quillLower.messages.at(-1)?.text).not.toContain(SHORT);
    expect(quillLower.events.some((event) => event.type === "routine_quill_bond")).toBe(true);
    expect(quillLower.events.some((event) => event.type === "routine_reach_ledger")).toBe(false);

    const citeLower = await convene(
      state,
      "does the launch note routine say that see approvals and auto review",
      undefined,
      early,
    );
    expect(citeLower.messages.at(-1)?.text).toContain("More than one routine has that name");
    expect(citeLower.messages.at(-1)?.text).not.toContain(HAS_NO);
    expect(citeLower.messages.at(-1)?.text).not.toContain(SHORT);
    expect(citeLower.events.some((event) => event.type === "routine_cite_slip")).toBe(true);
    expect(citeLower.events.some((event) => event.type === "routine_reach_ledger")).toBe(false);

    const douseLower = await convene(
      state,
      "does the launch note routine say that turning enforcement off stops applying the team rules",
      undefined,
      early,
    );
    expect(douseLower.messages.at(-1)?.text).toContain("More than one routine has that name");
    expect(douseLower.messages.at(-1)?.text).not.toContain(HAS_NO);
    expect(douseLower.messages.at(-1)?.text).not.toContain(SHORT);
    expect(douseLower.events.some((event) => event.type === "routine_douse_mark")).toBe(true);
    expect(douseLower.events.some((event) => event.type === "routine_reach_ledger")).toBe(false);

    const capLower = await convene(
      state,
      "does the launch note routine say that team-wide ask first and allow automatically rules that apply to every member's bots on top of their own rules",
      undefined,
      early,
    );
    expect(capLower.messages.at(-1)?.text).toContain("More than one routine has that name");
    expect(capLower.messages.at(-1)?.text).not.toContain(HAS_NO);
    expect(capLower.messages.at(-1)?.text).not.toContain(SHORT);
    expect(capLower.events.some((event) => event.type === "routine_cap_layer")).toBe(true);
    expect(capLower.events.some((event) => event.type === "routine_reach_ledger")).toBe(false);

    const priorLower = await convene(
      state,
      "does the launch note routine say that turn it on before you rely on team auto-review rules",
      undefined,
      early,
    );
    expect(priorLower.messages.at(-1)?.text).toContain("More than one routine has that name");
    expect(priorLower.messages.at(-1)?.text).not.toContain(HAS_NO);
    expect(priorLower.messages.at(-1)?.text).not.toContain(SHORT);
    expect(priorLower.events.some((event) => event.type === "routine_prior_arm")).toBe(true);
    expect(priorLower.events.some((event) => event.type === "routine_reach_ledger")).toBe(false);

    const vacantLower = await convene(
      state,
      "does the launch note routine say that this includes team bots in chats where nobody can answer an approval, which otherwise run without auto-review",
      undefined,
      early,
    );
    expect(vacantLower.messages.at(-1)?.text).toContain("More than one routine has that name");
    expect(vacantLower.messages.at(-1)?.text).not.toContain(HAS_NO);
    expect(vacantLower.messages.at(-1)?.text).not.toContain(SHORT);
    expect(vacantLower.events.some((event) => event.type === "routine_vacant_quorum")).toBe(true);
    expect(vacantLower.events.some((event) => event.type === "routine_reach_ledger")).toBe(false);

    const riskLower = await convene(
      state,
      "does the launch note routine say that when it is on, bots always check risky actions before running them and ask for approval when needed",
      undefined,
      early,
    );
    expect(riskLower.messages.at(-1)?.text).toContain("More than one routine has that name");
    expect(riskLower.messages.at(-1)?.text).not.toContain(HAS_NO);
    expect(riskLower.messages.at(-1)?.text).not.toContain(SHORT);
    expect(riskLower.events.some((event) => event.type === "routine_risk_gate")).toBe(true);
    expect(riskLower.events.some((event) => event.type === "routine_reach_ledger")).toBe(false);

    const startLower = await convene(
      state,
      "does the launch note routine say that the switch is on the grok bot page and is off by default",
      undefined,
      early,
    );
    expect(startLower.messages.at(-1)?.text).toContain("More than one routine has that name");
    expect(startLower.messages.at(-1)?.text).not.toContain(HAS_NO);
    expect(startLower.messages.at(-1)?.text).not.toContain(SHORT);
    expect(startLower.events.some((event) => event.type === "routine_start_dim")).toBe(true);
    expect(startLower.events.some((event) => event.type === "routine_reach_ledger")).toBe(false);

    const vetoLower = await convene(
      state,
      "does the launch note routine say that prevents members from turning auto-review off",
      undefined,
      early,
    );
    expect(vetoLower.messages.at(-1)?.text).toBe(routineVetoKeelAmbiguousCopy("launch note"));
    expect(vetoLower.messages.at(-1)?.text).not.toContain(HAS_NO);
    expect(vetoLower.messages.at(-1)?.text).not.toContain(SHORT);
    expect(vetoLower.events.some((event) => event.type === "routine_veto_keel")).toBe(true);
    expect(vetoLower.events.some((event) => event.type === "routine_reach_ledger")).toBe(false);

    const clanLower = await convene(
      state,
      "does the launch note routine say that for guidance that belongs to one cohort, add group rules under group settings",
      undefined,
      early,
    );
    expect(clanLower.messages.at(-1)?.text).toBe(routineClanCharterAmbiguousCopy("launch note"));
    expect(clanLower.messages.at(-1)?.text).not.toContain(HAS_NO);
    expect(clanLower.messages.at(-1)?.text).not.toContain(SHORT);
    expect(clanLower.events.some((event) => event.type === "routine_clan_charter")).toBe(true);
    expect(clanLower.events.some((event) => event.type === "routine_reach_ledger")).toBe(false);

    const guideLower = await convene(
      state,
      "does the launch note routine say that rules guide a bot; for approval behavior, use auto-review rules",
      undefined,
      early,
    );
    expect(guideLower.messages.at(-1)?.text).toBe(routineGuideLaneAmbiguousCopy("launch note"));
    expect(guideLower.messages.at(-1)?.text).not.toContain(HAS_NO);
    expect(guideLower.messages.at(-1)?.text).not.toContain(SHORT);
    expect(guideLower.events.some((event) => event.type === "routine_guide_lane")).toBe(true);
    expect(guideLower.events.some((event) => event.type === "routine_reach_ledger")).toBe(false);
    const terseLower = await convene(
      state,
      'does the launch note routine say that keep them short and few, like "never move company data to personal accounts."',
      undefined,
      early,
    );
    expect(terseLower.messages.at(-1)?.text).toBe(routineTerseFewAmbiguousCopy("launch note"));
    expect(terseLower.messages.at(-1)?.text).not.toContain(HAS_NO);
    expect(terseLower.messages.at(-1)?.text).not.toContain(SHORT);
    expect(terseLower.events.some((event) => event.type === "routine_terse_few")).toBe(true);
    expect(terseLower.events.some((event) => event.type === "routine_reach_ledger")).toBe(false);

    const firmLower = await convene(
      state,
      "does the launch note routine say that rules applied to grok bot are always required, so members cannot turn them off",
      undefined,
      early,
    );
    expect(firmLower.messages.at(-1)?.text).toBe(routineFirmYokeAmbiguousCopy("launch note"));
    expect(firmLower.messages.at(-1)?.text).not.toContain(HAS_NO);
    expect(firmLower.messages.at(-1)?.text).not.toContain(SHORT);
    expect(firmLower.events.some((event) => event.type === "routine_firm_yoke")).toBe(true);
    expect(firmLower.events.some((event) => event.type === "routine_reach_ledger")).toBe(false);
    expect(lower.events.some((event) => event.type === "routine_access_lift")).toBe(false);
    expect(lower.events.some((event) => event.type === "routine_doze_tally")).toBe(false);
    expect(lower.events.some((event) => event.type === "routine_wake_guard")).toBe(false);
    const scopeLower = await convene(
      state,
      "does the launch note routine say that add them from the grok bot page and scope each rule to cursor, grok bot, or both",
      undefined,
      early,
    );
    expect(scopeLower.messages.at(-1)?.text).toBe(routineScopeSplitAmbiguousCopy("launch note"));
    expect(scopeLower.messages.at(-1)?.text).not.toContain(HAS_NO);
    expect(scopeLower.messages.at(-1)?.text).not.toContain(SHORT);
    expect(scopeLower.events.some((event) => event.type === "routine_scope_split")).toBe(true);
    expect(scopeLower.events.some((event) => event.type === "routine_reach_ledger")).toBe(false);
    const canonLower = await convene(
      state,
      "does the launch note routine say that rules that every member's bots follow",
      undefined,
      early,
    );
    expect(canonLower.messages.at(-1)?.text).toBe(routineCanonBindAmbiguousCopy("launch note"));
    expect(canonLower.messages.at(-1)?.text).not.toContain(HAS_NO);
    expect(canonLower.messages.at(-1)?.text).not.toContain(SHORT);
    expect(canonLower.events.some((event) => event.type === "routine_canon_bind")).toBe(true);
    expect(canonLower.events.some((event) => event.type === "routine_reach_ledger")).toBe(false);
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
    expect(wakeLower.events.some((event) => event.type === "routine_reach_ledger")).toBe(false);
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
    expect(dozeLower.events.some((event) => event.type === "routine_reach_ledger")).toBe(false);
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
    const named = await convene(one, `Does the "Launch note" routine say ${QUILL_BOND_QUESTION}?`, undefined, early);
    expect(named.messages.at(-1)?.text).toBe(routineReachLedgerCopy("Launch note", true));
    expect(named.routines[0]?.paused).toBe(true);
    expect(named.routines[0]?.nextRunAt).toBe(launchNext);
    expect(named.routines[1]?.nextRunAt).toBe(marketNext);

    const quoted = await convene(one, `Does the “Launch note” routine say ${QUILL_BOND_QUESTION}?`, undefined, early);
    expect(quoted.messages.at(-1)?.text).toBe(routineReachLedgerCopy("Launch note", true));
    expect(quoted.routines[0]?.recentRuns).toEqual(["2026-10-24T03:00:00.000Z"]);

    const marketAsk = await convene(setPaused(one, true, early), `Does the Market check routine say ${QUILL_BOND_QUESTION}?`, undefined, early);
    expect(marketAsk.paused).toBe(true);
    expect(marketAsk.messages.at(-1)?.text).toBe(routineReachLedgerCopy("Market check", true));
    expect(marketAsk.messages.at(-1)?.text).not.toContain("Wakes are paused");
    expect(marketAsk.routines[0]?.paused).toBe(true);

    const solo = structuredClone(one);
    solo.routines.splice(1, 1);
    const alone = await convene(solo, `Does the Launch note routine say ${QUILL_BOND_QUESTION}?`, undefined, early);
    expect(alone.messages.at(-1)?.text).toBe(routineReachLedgerCopy("Launch note", false));
    expect(alone.messages.at(-1)?.text).not.toContain("Another routine is unchanged.");
    expect(alone.routines).toHaveLength(1);

    const aside = await convene(one, `Does the Launch note routine say ${QUILL_BOND_QUESTION} and email Maya`, undefined, early);
    expect(aside.goals.length).toBeGreaterThan(one.goals.length);
    expect(aside.messages.at(-1)?.text).not.toContain(HAS_NO);
    expect(aside.routines[0]?.paused).toBe(true);
    expect(aside.routines[0]?.nextRunAt).toBe(launchNext);

    const near = await convene(one, `Does the Launch notes routine say ${QUILL_BOND_QUESTION}?`, undefined, early);
    expect(near.goals).toHaveLength(one.goals.length);
    expect(near.messages.at(-1)?.text).toBe(routineReachLedgerMissCopy("Launch notes"));
    expect(near.routines[0]?.paused).toBe(true);
    expect(near.routines[0]?.nextRunAt).toBe(launchNext);

    for (const text of [
      `Does it say ${QUILL_BOND_QUESTION}?`,
      `Does the Launch note routines say ${QUILL_BOND_QUESTION}?`,
      `Does the Launch note routine say ${QUILL_BOND_QUESTION} yet?`,
      `Does the routine say ${QUILL_BOND_QUESTION}?`,
    ]) {
      const ordinary = await convene(one, text, undefined, early);
      expect(ordinary.goals.length).toBeGreaterThan(one.goals.length);
      expect(ordinary.routines[0]?.paused).toBe(true);
      expect(ordinary.routines[0]?.nextRunAt).toBe(launchNext);
      expect(ordinary.messages.at(-1)?.text).not.toContain(HAS_NO);
      expect(ordinary.messages.at(-1)?.text).not.toContain("There is no such routine");
    }

    const kept = structuredClone(one);
    await expect(convene(kept, `Does the Launch note routine say ${QUILL_BOND_QUESTION} without asking`, undefined, early)).rejects.toThrow(/without asking/);
    await expect(convene(kept, `Please does the Launch note routine say ${QUILL_BOND_QUESTION} always allow`, undefined, early)).rejects.toThrow(/without asking/);
    await expect(convene(kept, `Does the Launch note routine say ${QUILL_BOND_QUESTION} and allow for this site`, undefined, early)).rejects.toThrow(/without asking/);
    expect(kept.routines[0]?.paused).toBe(true);
    expect(kept.routines[0]?.heldBack).toEqual(["send"]);
    expect(kept.goals).toHaveLength(one.goals.length);
    await expect(convene(kept, `Does the Launch note routine say ${QUILL_BOND_QUESTION}?`, "goal_missing", early)).rejects.toThrow(/not in the record/);

    const accessLeft = await convene(one, `Does the Launch note routine say ${ACCESS_LIFT_STILL}?`, undefined, early);
    expect(accessLeft.messages.at(-1)?.text).toContain("“Launch note” has no access lift in the record.");
    expect(accessLeft.messages.at(-1)?.text).toContain(ACCESS_SHORT);
    expect(accessLeft.messages.at(-1)?.text).not.toContain(HAS_NO);
    const why = await convene(one, "Why hasn't the Launch note routine run?", undefined, early);
    expect(why.messages.at(-1)?.text).toContain("It is paused.");
    expect(why.messages.at(-1)?.text).not.toContain("terse few");
      expect(why.messages.at(-1)?.text).not.toContain("firm yoke");
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

describe("ORIEL-F228 server", () => {
  it("ORIEL-F228 says one routine has no trial span and does not mark those review checks as a trial open to every large team", async () => {
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
    const missing = await turn(`Does the Launch note routine say ${QUILL_BOND_QUESTION}?`);
    expect(missing.status).toBe(200);
    expect(missing.body.goals).toHaveLength(0);
    expect(missing.body.routines).toHaveLength(0);
    expect(missing.body.messages.at(-1).text).toBe(routineReachLedgerMissCopy("Launch note"));
    expect(missing.body.trust).toContain("has no hook shelf in the record");
    expect(missing.body.trust).toContain("The row says No quill bond");
    expect(missing.body.trust).toContain("The row test id is hook-shelf-");
    expect(missing.body.trust).toContain("has no reach ledger in the record");
    expect(missing.body.trust).toContain("The row says No reach ledger");
    expect(missing.body.trust).toContain("The row test id is yard-chart-");
    expect(missing.body.trust).toContain("The trial-span reply still says Asking does not mark those review checks as a trial open to every large team");
    expect(missing.body.trust).toContain("A gloss line is not a reach ledger");
    expect(missing.body.trust).toContain("does not say there is no reach ledger");
    expect(missing.body.trust).toContain("does not name a reach ledger");
    expect(missing.body.trust).toContain("has no trial span in the record");
    expect(missing.body.trust).toContain("The row says No trial span");
    expect(missing.body.trust).toContain("The row test id is trial-span-");
    expect(missing.body.trust).toContain("The shade-tally reply still says Asking does not leave a new setup in a quiet watch that notes refusals without stopping people");
    expect(missing.body.trust).toContain("A shade tally is not a trial span");
    expect(missing.body.trust).toContain("does not say there is no trial span");
    expect(missing.body.trust).toContain("does not name a trial span");
    expect(missing.body.trust).toContain("has no shade tally in the record");
    expect(missing.body.trust).toContain("The row says No shade tally");
    expect(missing.body.trust).toContain("The row test id is shade-tally-");
    expect(missing.body.trust).toContain("The hook-shelf reply still says Asking does not open that hooks pane from the compliance shelf");
    expect(missing.body.trust).toContain("A hook shelf is not a shade tally");
    expect(missing.body.trust).toContain("does not say there is no shade tally");
    expect(missing.body.trust).toContain("does not name a shade tally");
    expect(missing.body.trust).toContain("The row says No yield cord");
    expect(missing.body.trust).toContain("The row test id is yield-cord-");
    expect(missing.body.trust).toContain("The yield-cord reply still says Asking does not let that host permit or refuse the request before the model runs");
    expect(missing.body.trust).toContain("does not say there is no yield cord");
    expect(missing.body.trust).toContain("does not name a yield cord");

    expect(missing.body.trust).toContain("A sight glass is not a quill bond");
    expect(missing.body.trust).toContain("does not say there is no quill bond");
    expect(missing.body.trust).toContain("does not name a quill bond");
    expect(missing.body.trust).toContain("has no sight glass in the record");
    expect(missing.body.trust).toContain("The row says No sight glass");
    expect(missing.body.trust).toContain("The row test id is sight-glass-");
    expect(missing.body.trust).toContain("has no prior arm in the record");
    expect(missing.body.trust).toContain("The row says No prior arm");
    expect(missing.body.trust).toContain("The row test id is prior-arm-");
    expect(missing.body.trust).toContain("The prior-arm reply still says Asking does not turn that lock on before you count on the shared review rules");

    expect(missing.body.trust).toContain("The clan-charter reply still says Asking does not place those notes for one set of people under that set's settings");
    expect(missing.body.trust).toContain("has no clan charter in the record");
    expect(missing.body.trust).toContain("The row says No clan charter");
    expect(missing.body.trust).toContain("The row test id is clan-charter-");
    expect(missing.body.trust).toContain("A clan charter is not a sight glass");

    expect(missing.body.trust).toContain("The guide-lane reply still says Asking does not steer those guides toward approval behavior");
    expect(missing.body.trust).toContain("has no guide lane in the record");
    expect(missing.body.trust).toContain("The row says No guide lane");
    expect(missing.body.trust).toContain("The row test id is guide-lane-");
    expect(missing.body.trust).toContain("The terse-few reply still says Asking does not keep those guides short and few");
    expect(missing.body.trust).toContain("has no terse few in the record");
    expect(missing.body.trust).toContain("The row says No terse few");
    expect(missing.body.trust).toContain("The row test id is terse-few-");
    expect(missing.body.trust).toContain("A guide lane is not a sight glass");
    expect(missing.body.trust).toContain("does not say there is no sight glass");
    expect(missing.body.trust).toContain("does not name a sight glass");
    expect(missing.body.trust).toContain("A stored run is not a sight glass");
    expect(missing.body.trust).toContain("A desk-wide pause does not invent a sight glass");
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
    expect(missing.body.trust).toContain("An access lift is not a terse few");
    expect(missing.body.trust).toContain("does not say there is no terse few");
    expect(missing.body.trust).toContain("does not name a terse few");
    expect(missing.body.trust).toContain("A stored run is not a terse few");
    expect(missing.body.trust).toContain("A desk-wide pause does not invent a terse few");
    expect(missing.body.trust).toContain("There is no relay lamp");
    expect(missing.body.trust).toContain("There is no keyhole");
    expect(missing.body.trust).not.toContain("A recorded failure is not a terse few");
    expect(missing.body.trust).not.toContain("Always allow");
    expect(HAS_NO.includes("has no access lift")).toBe(false);
    expect("has no access lift".includes(HAS_NO)).toBe(false);
    expect(SHORT.includes(ACCESS_SHORT)).toBe(false);
    expect(ACCESS_SHORT.includes(SHORT)).toBe(false);
    expect(SHORT.includes(ALT_OPEN)).toBe(false);
    expect(SHORT.includes("Asking does not forward each signed model request to a review server the organization runs or reaches through a vendor.")).toBe(false);
    expect("Asking does not forward each signed model request to a review server the organization runs or reaches through a vendor.".includes(SHORT)).toBe(false);
    expect(SHORT.includes("Asking does not pass each signed model request to a review server the organization runs or reaches through a vendor.")).toBe(false);
    expect(SHORT.includes("Asking does not route each signed model request to a review server the organization runs or reaches through a vendor.")).toBe(false);
    expect(HAS_NO.includes("has no quill bond")).toBe(false);
    expect("has no quill bond".includes(HAS_NO)).toBe(false);
    expect(SHORT.includes("Asking does not make every member's bots follow those rules.")).toBe(false);
    expect("Asking does not make every member's bots follow those rules.".includes(SHORT)).toBe(false);
    expect(HAS_NO.includes("has no canon bind")).toBe(false);
    expect("has no canon bind".includes(HAS_NO)).toBe(false);
    expect(SHORT.includes("Asking does not spare a machine that stays awake while work is still going.")).toBe(false);
    expect("Asking does not spare a machine that stays awake while work is still going.".includes(SHORT)).toBe(false);
    expect(HAS_NO.includes("has no wake guard")).toBe(false);
    expect("has no wake guard".includes(HAS_NO)).toBe(false);
    expect(SHORT.includes("Asking does not begin that thirty-day wait when the machine fell asleep after its last use.")).toBe(false);
    expect("Asking does not begin that thirty-day wait when the machine fell asleep after its last use.".includes(SHORT)).toBe(false);
    expect(HAS_NO.includes("has no doze tally")).toBe(false);
    expect("has no doze tally".includes(HAS_NO)).toBe(false);
    expect("sight-glass-".startsWith("access-lift-")).toBe(false);
    expect("sight-glass-".startsWith("access-")).toBe(false);
    expect("sight-glass-".startsWith("lift-")).toBe(false);
    expect("sight-glass-".startsWith("guard-")).toBe(false);
    expect("sight-glass-".startsWith("sight-")).toBe(true);
    expect("sight-glass-".startsWith("glass-")).toBe(false);
    expect("sight-glass-".startsWith("layer-")).toBe(false);
    expect("sight-glass-".startsWith("waiver-")).toBe(false);
    expect("sight-glass-".startsWith("waiver-lock-")).toBe(false);
    expect("sight-glass-".startsWith("lock-")).toBe(false);
    expect("sight-glass-".startsWith("prior-")).toBe(false);
    expect("sight-glass-".startsWith("prior-arm-")).toBe(false);
    expect("sight-glass-".startsWith("arm-")).toBe(false);
    expect("sight-glass-".startsWith("risk-")).toBe(false);
    expect("sight-glass-".startsWith("risk-gate-")).toBe(false);
    expect("sight-glass-".startsWith("gate-")).toBe(false);
    expect("sight-glass-".startsWith("gate-")).toBe(false);
    expect("sight-glass-".startsWith("off-")).toBe(false);
    expect("sight-glass-".startsWith("off-page-")).toBe(false);
    expect("sight-glass-".startsWith("start-")).toBe(false);
    expect("sight-glass-".startsWith("page-")).toBe(false);
    expect("sight-glass-".startsWith("veto-")).toBe(false);
    expect("sight-glass-".startsWith("keel-")).toBe(false);
    expect("sight-glass-".startsWith("page-")).toBe(false);
    expect("sight-glass-".startsWith("clan-charter-")).toBe(false);
    expect("sight-glass-".startsWith("clan-")).toBe(false);
    expect("sight-glass-".startsWith("charter-")).toBe(false);
    expect("sight-glass-".startsWith("guide-")).toBe(false);
    expect("sight-glass-".startsWith("lane-")).toBe(false);
    expect("sight-glass-".startsWith("terse-")).toBe(false);
    expect("sight-glass-".startsWith("few-")).toBe(false);
    expect("sight-glass-".startsWith("terse-few-")).toBe(false);
    expect("trial-span-".startsWith("trial-span-")).toBe(true);
    expect("trial-span-".startsWith("trial-")).toBe(true);
    expect("trial-span-".startsWith("span-")).toBe(false);
    expect("trial-span-".startsWith("shade-tally-")).toBe(false);
    expect("trial-span-".startsWith("shade-")).toBe(false);
    expect("trial-span-".startsWith("tally-")).toBe(false);
    expect("trial-span-".startsWith("hook-shelf-")).toBe(false);
    expect("trial-span-".startsWith("hook-")).toBe(false);
    expect("trial-span-".startsWith("shelf-")).toBe(false);
    expect("trial-span-".startsWith("yield-")).toBe(false);
    expect("trial-span-".startsWith("yield-cord-")).toBe(false);
    expect("trial-span-".startsWith("cord-")).toBe(false);
    expect("trial-span-".startsWith("cord-")).toBe(false);
    expect("trial-span-".startsWith("quill-bond-")).toBe(false);
    expect("trial-span-".startsWith("quill-")).toBe(false);
    expect("trial-span-".startsWith("bond-")).toBe(false);
    expect("trial-span-".startsWith("bond-")).toBe(false);
    expect("trial-span-".startsWith("cite-")).toBe(false);
    expect("trial-span-".startsWith("slip-")).toBe(false);
    expect("trial-span-".startsWith("slip-")).toBe(false);
    expect("trial-span-".startsWith("sight-glass-")).toBe(false);
    expect("trial-span-".startsWith("sight-")).toBe(false);
    expect("trial-span-".startsWith("glass-")).toBe(false);
    expect("sight-glass-".startsWith("hook-shelf-")).toBe(false);
    expect("sight-glass-".startsWith("sight-glass-")).toBe(true);
    expect("sight-glass-".startsWith("firm-yoke-")).toBe(false);
    expect("sight-glass-".startsWith("firm-")).toBe(false);
    expect("sight-glass-".startsWith("yoke-")).toBe(false);
    expect("sight-glass-".startsWith("scope-split-")).toBe(false);
    expect("sight-glass-".startsWith("canon-bind-")).toBe(false);
    expect("terse-few-".startsWith("sight-glass-")).toBe(false);
    expect("access-lift-".startsWith("sight-glass-")).toBe(false);
    expect(JSON.stringify(missing.body)).not.toContain("Always allow");
    expect(routineReachLedgerCopy("Launch note", true)).toContain(SHORT);
    expect(routineReachLedgerCopy("Launch note", true)).not.toContain(ALT_OPEN);
    expect(routineReachLedgerCopy("Launch note", true)).not.toMatch(/cursor/i);
    expect(routineReachLedgerCopy("Launch note", true)).not.toMatch(/credential/i);
    expect(routineReachLedgerCopy("Launch note", true)).not.toMatch(/password/i);
    expect(routineReachLedgerCopy("Launch note", true)).not.toMatch(/secret/i);
    expect(routineReachLedgerCopy("Launch note", true)).not.toMatch(/file/i);
    expect(routineReachLedgerCopy("Launch note", true)).not.toContain("has no access lift");
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

    const clear = await turn(`Please, does the Launch note routine say ${QUILL_BOND_QUESTION}?`, { goalId, skillId: "missing-skill" });
    expect(clear.status).toBe(200);
    expect(clear.body.messages.at(-1).text).toBe(routineReachLedgerCopy("Launch note", true));
    expect(clear.body.messages.at(-1).text).toContain("“Launch note” has no reach ledger in the record.");
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
    const duringDesk = await turn(`Does the Launch note routine say ${QUILL_BOND_QUESTION}?`);
    expect(duringDesk.body.paused).toBe(true);
    expect(duringDesk.body.messages.at(-1).text).toContain("“Launch note” has no reach ledger in the record.");
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
    const asked = await turn(`Does the Launch note routine say ${QUILL_BOND_QUESTION}?`);
    expect(asked.body.messages.at(-1).text).toBe(routineReachLedgerCopy("Launch note", true));
    expect(asked.body.routines.find((routine: { name: string }) => routine.name === "Launch note").cadence).toBe("hourly");
    expect(asked.body.routines.find((routine: { name: string }) => routine.name === "Launch note").nextRunAt).toBe(nextRun);
    expect(asked.body.routines.find((routine: { name: string }) => routine.name === "Launch note").paused).toBe(true);

    const glossKept = await turn("Does the Launch note routine say that see grok bot inference hooks?");
    expect(glossKept.body.messages.at(-1).text).toContain("has no gloss line in the record");
    expect(glossKept.body.messages.at(-1).text).toContain("Asking does not follow that see-also line to the hooks note.");
    expect(glossKept.body.messages.at(-1).text).not.toContain(HAS_NO);
    expect(glossKept.body.messages.at(-1).text).not.toContain(SHORT);

    const shadeKept = await turn("Does the Launch note routine say that new configurations start in shadow mode, which records denials in the audit log without blocking members?");
    expect(shadeKept.body.messages.at(-1).text).toContain("has no shade tally in the record");
    expect(shadeKept.body.messages.at(-1).text).toContain("Asking does not leave a new setup in a quiet watch that notes refusals without stopping people.");
    expect(shadeKept.body.messages.at(-1).text).not.toContain(HAS_NO);
    expect(shadeKept.body.messages.at(-1).text).not.toContain(SHORT);

    const hookKept = await turn("Does the Launch note routine say that open inference hooks from security & compliance on the grok bot page?");
    expect(hookKept.body.messages.at(-1).text).toContain("has no hook shelf in the record");
    expect(hookKept.body.messages.at(-1).text).toContain("Asking does not open that hooks pane from the compliance shelf.");
    expect(hookKept.body.messages.at(-1).text).not.toContain(HAS_NO);
    expect(hookKept.body.messages.at(-1).text).not.toContain(SHORT);

    const capKept = await turn("Does the Launch note routine say that team-wide Ask first and Allow automatically rules that apply to every member's Bots on top of their own rules?");
    expect(capKept.body.messages.at(-1).text).toContain("has no cap layer in the record");
    expect(capKept.body.messages.at(-1).text).toContain("Asking does not lay that shared cap over each person's own notes.");
    expect(capKept.body.messages.at(-1).text).not.toContain(HAS_NO);
    expect(capKept.body.messages.at(-1).text).not.toContain(SHORT);

    const priorKept = await turn("Does the Launch note routine say that turn it on before you rely on team Auto-review rules?");
    expect(priorKept.body.messages.at(-1).text).toContain("has no prior arm in the record");
    expect(priorKept.body.messages.at(-1).text).toContain("Asking does not turn that lock on before you count on the shared review rules.");
    expect(priorKept.body.messages.at(-1).text).not.toContain(HAS_NO);
    expect(priorKept.body.messages.at(-1).text).not.toContain(SHORT);

    const scopeLeft = await turn("Does the Launch note routine say that add them from the Grok Bot page and scope each rule to Cursor, Grok Bot, or both?");
    expect(scopeLeft.body.messages.at(-1).text).toContain("has no scope split");
    expect(scopeLeft.body.messages.at(-1).text).toContain("Asking does not add those rules from that page or limit each one to one seat, the other, or both.");
    expect(scopeLeft.body.messages.at(-1).text).not.toContain(HAS_NO);
    expect(scopeLeft.body.messages.at(-1).text).not.toContain(SHORT);
    const canonLeft = await turn("Does the Launch note routine say that rules that every member's Bots follow?");
    expect(canonLeft.body.messages.at(-1).text).toContain("has no canon bind");
    expect(canonLeft.body.messages.at(-1).text).toContain("Asking does not make every member's bots follow those rules.");
    expect(canonLeft.body.messages.at(-1).text).not.toContain(HAS_NO);
    expect(canonLeft.body.messages.at(-1).text).not.toContain(SHORT);
    const accessLeft = await turn(`Does the Launch note routine say ${ACCESS_LIFT_STILL}?`);
    expect(accessLeft.body.messages.at(-1).text).toContain("has no access lift");
    expect(accessLeft.body.messages.at(-1).text).toContain(ACCESS_SHORT);
    expect(accessLeft.body.messages.at(-1).text).not.toContain(HAS_NO);
    expect(accessLeft.body.messages.at(-1).text).not.toContain(SHORT);
    const why = await turn("Why hasn't the Launch note routine run?");
    expect(why.body.messages.at(-1).text).toContain("A wake does not run it.");
    expect(why.body.messages.at(-1).text).not.toContain("sight glass");
    expect(why.body.messages.at(-1).text).not.toContain("quill bond");
    expect(why.body.messages.at(-1).text).not.toContain("cite slip");
    expect(why.body.messages.at(-1).text).not.toContain("ink latch");
    expect(why.body.messages.at(-1).text).not.toContain("prior arm");
    expect(why.body.messages.at(-1).text).not.toContain("terse few");
    expect(why.body.messages.at(-1).text).not.toContain("firm yoke");
    expect(why.body.messages.at(-1).text).not.toContain("scope split");
    expect(why.body.messages.at(-1).text).not.toContain("wake guard");
    expect(why.body.messages.at(-1).text).not.toContain("access lift");

    const gone = await turn(`Does the Launch note routine say ${QUILL_BOND_QUESTION}?`, { goalId: "goal_missing" });
    expect(gone.status).toBe(404);
    const refused = await turn(`Does the Launch note routine say ${QUILL_BOND_QUESTION} without asking`);
    expect(refused.status).toBe(400);
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.routines.find((routine: { name: string }) => routine.name === "Launch note").paused).toBe(true);
    expect(still.routines.find((routine: { name: string }) => routine.name === "Launch note").nextRunAt).toBe(nextRun);
    expect(still.messages.at(-1).text).toContain("A wake does not run it.");
    expect(JSON.stringify(still)).not.toContain("Always allow");
  });
});
