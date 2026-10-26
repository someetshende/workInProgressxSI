import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  routineCircleDoorAmbiguousCopy,
  routineCircleDoorCopy,
  routineReconnectLagAmbiguousCopy,
  routineReconnectLagCopy,
  routineServeWideAmbiguousCopy,
  routineServeWideCopy,
  routineServeWideMissCopy,
  routineSyncForfeitCopy,
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

const SERVE_WIDE_QUESTION =
  "that one computer serves every team the member is in, so recreating or terminating it from one team affects the same computer everywhere";
const CIRCLE_DOOR_STILL = "that select the member from any team they belong to";
const SYNC_FORFEIT_STILL =
  "that bots, files, and logins that had synced come back; a turn that was running is lost";
const RECONNECT_LAG_STILL = "that the reconnect can take a few minutes";
const SHORT = "Asking does not ripple that same machine out from one group.";
const ALT_CARRY = "Asking does not carry that same machine across every group.";
const ALT_ECHO = "Asking does not echo that same machine from a single group.";
const CIRCLE_SHORT = "Asking does not choose that person from every group they sit in.";
const HAS_NO = "has no serve wide";

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

describe("ORIEL-F199", () => {
  it("ORIEL-F199 says one routine has no serve wide and does not ripple that same machine out from one group", async () => {
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
      const asked = `Please, does the Launch note routine say ${SERVE_WIDE_QUESTION}?`;

      state = await convene(state, asked, goalId, early, "missing-skill");
      expect(hits.length).toBe(beforeHits);
      expect(state.goals).toEqual(goalsBefore);
      expect(state.routines).toEqual(routinesBefore);
      expect(state.approvals).toEqual(approvalsBefore);
      expect(state.handoffRules).toEqual(rulesBefore);
      expect(state.paused).toBe(true);
      expect(state.messages.at(-1)?.goalId).toBeUndefined();
      expect(state.messages.at(-1)?.text).toBe(routineServeWideCopy("Launch note", true));
      expect(state.messages.at(-1)?.text).toContain("“Launch note” has no serve wide in the record.");
      expect(state.messages.at(-1)?.text).toContain(SHORT);
      expect(state.messages.at(-1)?.text).not.toContain(ALT_CARRY);
      expect(state.messages.at(-1)?.text).not.toContain(ALT_ECHO);
      expect(state.messages.at(-1)?.text).not.toContain(CIRCLE_SHORT);
      expect(state.messages.at(-1)?.text).not.toContain("has no circle door");
      expect(state.messages.at(-1)?.text).not.toContain("has no sync forfeit");
      expect(state.messages.at(-1)?.text).not.toContain("has no reconnect lag");
      expect(state.messages.at(-1)?.text).not.toMatch(/cursor/i);
      expect(state.messages.at(-1)?.text).not.toMatch(/credential/i);
      expect(state.messages.at(-1)?.text).not.toMatch(/password/i);
      expect(state.messages.at(-1)?.text).not.toMatch(/secret/i);
      expect(state.messages.at(-1)?.text).not.toMatch(/file/i);
      for (const other of ["has no circle door", "has no sync forfeit", "has no reconnect lag", "has no fresh boot", "has no server ring"]) {
        expect(HAS_NO.includes(other)).toBe(false);
        expect(other.includes(HAS_NO)).toBe(false);
      }
      for (const other of [
        ALT_CARRY,
        ALT_ECHO,
        CIRCLE_SHORT,
        "Asking does not select that person from every circle they join.",
        "Asking does not name that person from every circle they join.",
      ]) {
        expect(SHORT.includes(other)).toBe(false);
        expect(other.includes(SHORT)).toBe(false);
      }
      const rowId = "serve-wide-";
      for (const prefix of [
        "circle-door-",
        "circle-",
        "door-",
        "sync-forfeit-",
        "sync-",
        "forfeit-",
        "wide-",
        "team-",
        "member-",
        "computer-",
      ]) {
        expect(rowId.startsWith(prefix)).toBe(false);
      }
      expect(rowId.startsWith("serve-")).toBe(true);
      expect(rowId.startsWith("wide-")).toBe(false);
      expect("circle-door-".startsWith("serve-wide-")).toBe(false);
      expect(routineServeWideCopy("Launch note", true)).toContain(SHORT);
      expect(routineServeWideCopy("Launch note", true)).not.toContain(ALT_CARRY);
      expect(routineServeWideCopy("Launch note", true)).not.toContain("has no circle door");
      expect(routineServeWideCopy("Launch note", true)).not.toMatch(/cursor/i);
      expect(routineServeWideCopy("Launch note", true)).not.toMatch(/credential/i);
      expect(routineServeWideCopy("Launch note", true)).not.toMatch(/password/i);
      expect(routineServeWideCopy("Launch note", true)).not.toMatch(/secret/i);
      expect(routineServeWideCopy("Launch note", true)).not.toMatch(/file/i);
      expect(routineServeWideCopy("Launch note", true)).not.toContain("Grok Bot");
      expect(routineCircleDoorCopy("Launch note", true)).not.toContain(HAS_NO);
      expect(routineCircleDoorCopy("Launch note", true)).not.toContain(SHORT);
      expect(routineSyncForfeitCopy("Launch note", true)).not.toContain(HAS_NO);
      expect(routineReconnectLagCopy("Launch note", true)).not.toContain(HAS_NO);
      expect(state.messages.at(-1)?.text).toContain("Another routine is unchanged.");
      expect(state.messages.at(-1)?.text).not.toContain("Grok Bot");
      expect(state.messages.at(-1)?.text).not.toContain("Dots");
      expect(state.messages.at(-1)?.text).not.toContain("Muse");
      expect(state.messages.at(-1)?.text).not.toContain("2026-10-24T02:00:00.000Z");
      expect(state.messages.at(-1)?.text).not.toContain("Market check");
      expect(state.events.some((event) => event.type === "routine_serve_wide")).toBe(true);
      expect(state.events.some((event) => event.type === "routine_circle_door")).toBe(false);
      expect(state.events.some((event) => event.type === "routine_sync_forfeit")).toBe(false);
      expect(state.events.some((event) => event.type === "routine_ran")).toBe(false);
      const published = JSON.stringify(toPublic(state, 0));
      expect(published).not.toContain("bridge-secret-xyz");
      expect(published).not.toContain("Always allow");
      expect(published).toContain("has no serve wide in the record");
      expect(published).toContain("The row says No serve wide");
      expect(published).toContain("The row test id is serve-wide-");
      expect(published).toContain(`The short reply says ${SHORT.slice(0, -1)}`);
      expect(published).toContain("The circle-door reply still says Asking does not choose that person from every group they sit in");
      expect(published).toContain("The short reply says Asking does not choose that person from every group they sit in");
      expect(published).toContain("has no circle door in the record");
      expect(published).toContain("The row says No circle door");
      expect(published).toContain("The row test id is circle-door-");
      expect(published).toContain("A circle door is not a serve wide");
      expect(published).toContain("does not say there is no serve wide");
      expect(published).toContain("does not name a serve wide");
      expect(published).toContain("A stored run is not a serve wide");
      expect(published).toContain("A desk-wide pause does not invent a serve wide");
      expect(published).toContain("There is no relay lamp");
      expect(published).toContain("There is no keyhole");
      expect(published).not.toContain("A recorded failure is not a serve wide");

      const openDesk = structuredClone(state);
      openDesk.paused = false;
      const still = await wakeDue(openDesk, early);
      expect(still.routines[0]?.paused).toBe(true);
      expect(still.routines[0]?.nextRunAt).toBe("2026-10-24T02:00:00.000Z");
      expect(still.events.some((event) => event.type === "routine_ran")).toBe(false);

      const market = await convene(state, `Does the Market check routine say ${SERVE_WIDE_QUESTION}?`, undefined, early);
      expect(market.messages.at(-1)?.text).toBe(routineServeWideCopy("Market check", true));
      expect(market.routines[0]?.paused).toBe(true);
      expect(market.routines[0]?.nextRunAt).toBe("2026-10-24T02:00:00.000Z");
      expect(market.routines[1]?.nextRunAt).toBe("2026-10-24T05:00:00.000Z");
      expect(market.routines[0]?.heldBack).toEqual(["send"]);

      const circleLeft = await convene(state, `Does the Launch note routine say ${CIRCLE_DOOR_STILL}?`, undefined, early);
      expect(circleLeft.messages.at(-1)?.text).toContain("“Launch note” has no circle door in the record.");
      expect(circleLeft.messages.at(-1)?.text).toContain(CIRCLE_SHORT);
      expect(circleLeft.messages.at(-1)?.text).not.toContain(HAS_NO);
      expect(circleLeft.messages.at(-1)?.text).not.toContain(SHORT);
      const syncLeft = await convene(state, `Does the Launch note routine say ${SYNC_FORFEIT_STILL}?`, undefined, early);
      expect(syncLeft.messages.at(-1)?.text).toContain("“Launch note” has no sync forfeit in the record.");
      expect(syncLeft.messages.at(-1)?.text).not.toContain(HAS_NO);
      const reconnectLeft = await convene(state, `Does the Launch note routine say ${RECONNECT_LAG_STILL}?`, undefined, early);
      expect(reconnectLeft.messages.at(-1)?.text).toContain("“Launch note” has no reconnect lag in the record.");
      expect(reconnectLeft.messages.at(-1)?.text).not.toContain(HAS_NO);
      const why = await convene(state, "Why hasn't the Launch note routine run?", undefined, early);
      expect(why.messages.at(-1)?.text).toContain("It is paused.");
      expect(why.messages.at(-1)?.text).not.toContain("serve wide");
      expect(why.messages.at(-1)?.text).not.toContain("circle door");
      expect(why.routines[0]?.nextRunAt).toBe("2026-10-24T02:00:00.000Z");
    });
  });

  it("ORIEL-F199 leaves two names, a desk pause, and a widened sentence alone", async () => {
    const now = new Date("2026-10-24T07:00:00.000Z");
    const early: Deps = { now: () => now, fetchImpl: fetch, refine: null };
    const none = await convene(initialState(), `Does the Launch note routine say ${SERVE_WIDE_QUESTION}?`, undefined, early);
    expect(none.goals).toHaveLength(0);
    expect(none.routines).toHaveLength(0);
    expect(none.messages.at(-1)?.text).toBe(routineServeWideMissCopy("Launch note"));
    expect(none.events.some((event) => event.type === "routine_serve_wide")).toBe(true);
    expect(none.events.some((event) => event.type === "routine_circle_door")).toBe(false);

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

    const asked = await convene(state, `PLEASE, does the Launch note routine say ${SERVE_WIDE_QUESTION}?`, firstId, early, "missing-skill");
    expect(asked.goals).toHaveLength(goals);
    expect(asked.messages.at(-1)?.text).toBe(routineServeWideAmbiguousCopy("Launch note"));
    expect(asked.messages.at(-1)?.text).toContain("More than one routine has that name");
    expect(asked.messages.at(-1)?.text).not.toContain(HAS_NO);
    expect(asked.routines[0]?.heldBack).toEqual(["send"]);
    expect(asked.routines[0]?.paused).toBe(true);
    expect(asked.routines[0]?.instruction).toBe(launchInstruction);
    expect(asked.routines[0]?.nextRunAt).toBe(launchNext);
    expect(asked.routines[1]?.nextRunAt).toBe(secondNext);
    expect(asked.routines[2]?.nextRunAt).toBe(marketNext);

    for (const text of [
      `Please, does the Launch note routine say ${SERVE_WIDE_QUESTION}.`,
      `Does the Launch note routine say ${SERVE_WIDE_QUESTION}??`,
    ]) {
      const again = await convene(state, text, undefined, early);
      expect(again.messages.at(-1)?.text).toBe(routineServeWideAmbiguousCopy("Launch note"));
      expect(again.routines[0]?.paused).toBe(true);
      expect(again.goals).toHaveLength(goals);
    }
    const lower = await convene(state, `does the launch note routine say ${SERVE_WIDE_QUESTION}`.toLowerCase(), undefined, early);
    expect(lower.messages.at(-1)?.text).toBe(routineServeWideAmbiguousCopy("launch note"));
    expect(lower.messages.at(-1)?.text).not.toContain(HAS_NO);
    expect(lower.messages.at(-1)?.text).not.toContain("has no circle door");
    const circleLower = await convene(state, `does the launch note routine say ${CIRCLE_DOOR_STILL}`.toLowerCase(), undefined, early);
    expect(circleLower.messages.at(-1)?.text).toBe(routineCircleDoorAmbiguousCopy("launch note"));
    expect(circleLower.messages.at(-1)?.text).not.toContain(HAS_NO);
    expect(circleLower.messages.at(-1)?.text).not.toContain(SHORT);
    const reconnectLower = await convene(state, `does the launch note routine say ${RECONNECT_LAG_STILL}`.toLowerCase(), undefined, early);
    expect(reconnectLower.messages.at(-1)?.text).toBe(routineReconnectLagAmbiguousCopy("launch note"));
    expect(reconnectLower.messages.at(-1)?.text).not.toContain(HAS_NO);

    const one = structuredClone(state);
    one.routines.splice(1, 1);
    const named = await convene(one, `Does the "Launch note" routine say ${SERVE_WIDE_QUESTION}?`, undefined, early);
    expect(named.messages.at(-1)?.text).toBe(routineServeWideCopy("Launch note", true));
    expect(named.routines[0]?.paused).toBe(true);
    expect(named.routines[0]?.nextRunAt).toBe(launchNext);
    expect(named.routines[1]?.nextRunAt).toBe(marketNext);

    const quoted = await convene(one, `Does the “Launch note” routine say ${SERVE_WIDE_QUESTION}?`, undefined, early);
    expect(quoted.messages.at(-1)?.text).toBe(routineServeWideCopy("Launch note", true));
    expect(quoted.routines[0]?.recentRuns).toEqual(["2026-10-24T03:00:00.000Z"]);

    const marketAsk = await convene(setPaused(one, true, early), `Does the Market check routine say ${SERVE_WIDE_QUESTION}?`, undefined, early);
    expect(marketAsk.paused).toBe(true);
    expect(marketAsk.messages.at(-1)?.text).toBe(routineServeWideCopy("Market check", true));
    expect(marketAsk.messages.at(-1)?.text).not.toContain("Wakes are paused");
    expect(marketAsk.routines[0]?.paused).toBe(true);

    const solo = structuredClone(one);
    solo.routines.splice(1, 1);
    const alone = await convene(solo, `Does the Launch note routine say ${SERVE_WIDE_QUESTION}?`, undefined, early);
    expect(alone.messages.at(-1)?.text).toBe(routineServeWideCopy("Launch note", false));
    expect(alone.messages.at(-1)?.text).not.toContain("Another routine is unchanged.");
    expect(alone.routines).toHaveLength(1);

    const aside = await convene(one, `Does the Launch note routine say ${SERVE_WIDE_QUESTION} and email Maya`, undefined, early);
    expect(aside.goals.length).toBeGreaterThan(one.goals.length);
    expect(aside.messages.at(-1)?.text).not.toContain(HAS_NO);
    expect(aside.routines[0]?.paused).toBe(true);
    expect(aside.routines[0]?.nextRunAt).toBe(launchNext);

    const near = await convene(one, `Does the Launch notes routine say ${SERVE_WIDE_QUESTION}?`, undefined, early);
    expect(near.goals).toHaveLength(one.goals.length);
    expect(near.messages.at(-1)?.text).toBe(routineServeWideMissCopy("Launch notes"));
    expect(near.routines[0]?.paused).toBe(true);
    expect(near.routines[0]?.nextRunAt).toBe(launchNext);

    for (const text of [
      `Does it say ${SERVE_WIDE_QUESTION}?`,
      `Does the Launch note routines say ${SERVE_WIDE_QUESTION}?`,
      `Does the Launch note routine say ${SERVE_WIDE_QUESTION} yet?`,
      `Does the routine say ${SERVE_WIDE_QUESTION}?`,
    ]) {
      const ordinary = await convene(one, text, undefined, early);
      expect(ordinary.goals.length).toBeGreaterThan(one.goals.length);
      expect(ordinary.routines[0]?.paused).toBe(true);
      expect(ordinary.routines[0]?.nextRunAt).toBe(launchNext);
      expect(ordinary.messages.at(-1)?.text).not.toContain(HAS_NO);
      expect(ordinary.messages.at(-1)?.text).not.toContain("There is no such routine");
    }

    const kept = structuredClone(one);
    await expect(convene(kept, `Does the Launch note routine say ${SERVE_WIDE_QUESTION} without asking`, undefined, early)).rejects.toThrow(/without asking/);
    await expect(convene(kept, `Please does the Launch note routine say ${SERVE_WIDE_QUESTION} always allow`, undefined, early)).rejects.toThrow(/without asking/);
    await expect(convene(kept, `Does the Launch note routine say ${SERVE_WIDE_QUESTION} and allow for this site`, undefined, early)).rejects.toThrow(/without asking/);
    expect(kept.routines[0]?.paused).toBe(true);
    expect(kept.routines[0]?.heldBack).toEqual(["send"]);
    expect(kept.goals).toHaveLength(one.goals.length);
    await expect(convene(kept, `Does the Launch note routine say ${SERVE_WIDE_QUESTION}?`, "goal_missing", early)).rejects.toThrow(/not in the record/);

    const circleLeft = await convene(one, `Does the Launch note routine say ${CIRCLE_DOOR_STILL}?`, undefined, early);
    expect(circleLeft.messages.at(-1)?.text).toContain("“Launch note” has no circle door in the record.");
    expect(circleLeft.messages.at(-1)?.text).toContain(CIRCLE_SHORT);
    expect(circleLeft.messages.at(-1)?.text).not.toContain(HAS_NO);
    const why = await convene(one, "Why hasn't the Launch note routine run?", undefined, early);
    expect(why.messages.at(-1)?.text).toContain("It is paused.");
    expect(why.messages.at(-1)?.text).not.toContain("serve wide");
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

describe("ORIEL-F199 server", () => {
  it("ORIEL-F199 says one routine has no serve wide and does not ripple that same machine out from one group", async () => {
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
    const missing = await turn(`Does the Launch note routine say ${SERVE_WIDE_QUESTION}?`);
    expect(missing.status).toBe(200);
    expect(missing.body.goals).toHaveLength(0);
    expect(missing.body.routines).toHaveLength(0);
    expect(missing.body.messages.at(-1).text).toBe(routineServeWideMissCopy("Launch note"));
    expect(missing.body.trust).toContain("has no serve wide in the record");
    expect(missing.body.trust).toContain("The row says No serve wide");
    expect(missing.body.trust).toContain("The row test id is serve-wide-");
    expect(missing.body.trust).toContain(`The short reply says ${SHORT.slice(0, -1)}`);
    expect(missing.body.trust).toContain("The circle-door reply still says Asking does not choose that person from every group they sit in");
    expect(missing.body.trust).toContain("The short reply says Asking does not choose that person from every group they sit in");
    expect(missing.body.trust).toContain("has no circle door in the record");
    expect(missing.body.trust).toContain("The row says No circle door");
    expect(missing.body.trust).toContain("The row test id is circle-door-");
    expect(missing.body.trust).toContain("A circle door is not a serve wide");
    expect(missing.body.trust).toContain("does not say there is no serve wide");
    expect(missing.body.trust).toContain("does not name a serve wide");
    expect(missing.body.trust).toContain("A stored run is not a serve wide");
    expect(missing.body.trust).toContain("A desk-wide pause does not invent a serve wide");
    expect(missing.body.trust).toContain("There is no relay lamp");
    expect(missing.body.trust).toContain("There is no keyhole");
    expect(missing.body.trust).not.toContain("A recorded failure is not a serve wide");
    expect(missing.body.trust).not.toContain("Always allow");
    expect(HAS_NO.includes("has no circle door")).toBe(false);
    expect("has no circle door".includes(HAS_NO)).toBe(false);
    expect(SHORT.includes(CIRCLE_SHORT)).toBe(false);
    expect(CIRCLE_SHORT.includes(SHORT)).toBe(false);
    expect(SHORT.includes(ALT_CARRY)).toBe(false);
    expect("serve-wide-".startsWith("circle-door-")).toBe(false);
    expect("serve-wide-".startsWith("circle-")).toBe(false);
    expect("serve-wide-".startsWith("wide-")).toBe(false);
    expect("serve-wide-".startsWith("serve-")).toBe(true);
    expect("circle-door-".startsWith("serve-wide-")).toBe(false);
    expect(JSON.stringify(missing.body)).not.toContain("Always allow");
    expect(routineServeWideCopy("Launch note", true)).toContain(SHORT);
    expect(routineServeWideCopy("Launch note", true)).not.toContain(ALT_CARRY);
    expect(routineServeWideCopy("Launch note", true)).not.toMatch(/cursor/i);
    expect(routineServeWideCopy("Launch note", true)).not.toMatch(/credential/i);
    expect(routineServeWideCopy("Launch note", true)).not.toMatch(/password/i);
    expect(routineServeWideCopy("Launch note", true)).not.toMatch(/secret/i);
    expect(routineServeWideCopy("Launch note", true)).not.toMatch(/file/i);
    expect(routineServeWideCopy("Launch note", true)).not.toContain("has no circle door");
    expect(routineCircleDoorCopy("Launch note", true)).not.toContain(HAS_NO);
    expect(routineCircleDoorCopy("Launch note", true)).not.toContain(SHORT);

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

    const clear = await turn(`Please, does the Launch note routine say ${SERVE_WIDE_QUESTION}?`, { goalId, skillId: "missing-skill" });
    expect(clear.status).toBe(200);
    expect(clear.body.messages.at(-1).text).toBe(routineServeWideCopy("Launch note", true));
    expect(clear.body.messages.at(-1).text).toContain("“Launch note” has no serve wide in the record.");
    expect(clear.body.messages.at(-1).text).toContain(SHORT);
    expect(clear.body.messages.at(-1).text).not.toContain(ALT_CARRY);
    expect(clear.body.messages.at(-1).text).not.toContain("has no circle door");
    expect(clear.body.messages.at(-1).text).not.toContain(CIRCLE_SHORT);
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
    const duringDesk = await turn(`Does the Launch note routine say ${SERVE_WIDE_QUESTION}?`);
    expect(duringDesk.body.paused).toBe(true);
    expect(duringDesk.body.messages.at(-1).text).toContain("“Launch note” has no serve wide in the record.");
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
    const asked = await turn(`Does the Launch note routine say ${SERVE_WIDE_QUESTION}?`);
    expect(asked.body.messages.at(-1).text).toBe(routineServeWideCopy("Launch note", true));
    expect(asked.body.routines.find((routine: { name: string }) => routine.name === "Launch note").cadence).toBe("hourly");
    expect(asked.body.routines.find((routine: { name: string }) => routine.name === "Launch note").nextRunAt).toBe(nextRun);
    expect(asked.body.routines.find((routine: { name: string }) => routine.name === "Launch note").paused).toBe(true);

    const circleLeft = await turn(`Does the Launch note routine say ${CIRCLE_DOOR_STILL}?`);
    expect(circleLeft.body.messages.at(-1).text).toContain("has no circle door");
    expect(circleLeft.body.messages.at(-1).text).toContain(CIRCLE_SHORT);
    expect(circleLeft.body.messages.at(-1).text).not.toContain(HAS_NO);
    expect(circleLeft.body.messages.at(-1).text).not.toContain(SHORT);
    const reconnectLeft = await turn(`Does the Launch note routine say ${RECONNECT_LAG_STILL}?`);
    expect(reconnectLeft.body.messages.at(-1).text).toContain("has no reconnect lag");
    expect(reconnectLeft.body.messages.at(-1).text).not.toContain(HAS_NO);
    const why = await turn("Why hasn't the Launch note routine run?");
    expect(why.body.messages.at(-1).text).toContain("A wake does not run it.");
    expect(why.body.messages.at(-1).text).not.toContain("serve wide");
    expect(why.body.messages.at(-1).text).not.toContain("circle door");

    const gone = await turn(`Does the Launch note routine say ${SERVE_WIDE_QUESTION}?`, { goalId: "goal_missing" });
    expect(gone.status).toBe(404);
    const refused = await turn(`Does the Launch note routine say ${SERVE_WIDE_QUESTION} without asking`);
    expect(refused.status).toBe(400);
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.routines.find((routine: { name: string }) => routine.name === "Launch note").paused).toBe(true);
    expect(still.routines.find((routine: { name: string }) => routine.name === "Launch note").nextRunAt).toBe(nextRun);
    expect(still.messages.at(-1).text).toContain("A wake does not run it.");
    expect(JSON.stringify(still)).not.toContain("Always allow");
  });
});
