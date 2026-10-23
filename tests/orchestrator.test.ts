import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../src/core/brief.js";
import { convene, probeConnector, reviewWatches, runRoutine, saveRoutine, saveSkill, setConnector, setHandoffRule, setPaused, setRoutineCadence, settle, settleHandoff, wakeDue } from "../src/core/convene.js";
import { HOLD_WINDOW_MS } from "../src/core/hold.js";
import { initialState, toPublic } from "../src/core/state.js";
import { startLocalSeat } from "../src/seats/local.js";
import type { AppState, Deps } from "../src/core/types.js";
import { flagshipStories } from "../src/stories/flagship.js";

const deps: Deps = {
  now: () => new Date("2026-10-23T12:00:00.000Z"),
  fetchImpl: fetch,
  refine: null,
};

const COMPARE = "Compare Grok Bot, Dots, and Muse for a client-facing team. Do not email anyone.";

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
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function voice(state: AppState): string {
  return state.goals.at(-1)?.brief.voice ?? "";
}

describe("Oriel convenes", () => {
  it("ORIEL-F01 ORIEL-F03 ORIEL-F14 convenes work seats and leaves a ruled-out send unsent", async () => {
    const state = await convene(initialState(), COMPARE, undefined, deps);
    expect(state.goals).toHaveLength(1);
    expect(voice(state)).toContain("Grok Bot should lead");
    expect(voice(state)).toContain("Muse will not hold that material");
    expect(voice(state)).toContain("I left the send unsent, because you ruled it out.");
    expect(state.goals[0]?.brief.seatReads.map((note) => note.seat)).toEqual(["dots", "grok"]);
    expect(state.goals[0]?.brief.why.join(" ")).toContain("consumer seat");
    expect(state.approvals.filter((approval) => approval.status === "open")).toHaveLength(0);
    expect(state.goals[0]?.plan.some((step) => step.kind === "send" && step.status === "skipped")).toBe(true);
  });

  it("ORIEL-F02 holds an outbound send and does not claim it was delivered", async () => {
    const state = await convene(initialState(), "Email Maya the launch update", undefined, deps);
    const open = state.approvals.filter((approval) => approval.status === "open");
    expect(open).toHaveLength(1);
    expect(open[0]?.title).toBe("Release a send");
    expect(open[0]?.detail).toContain("Maya");
    expect(voice(state)).toContain("I held the send for your approval.");
    expect(JSON.stringify(state)).not.toContain("delivered");
  });

  it("ORIEL-F04 denying a hold releases nothing and cannot be settled twice", async () => {
    let state = await convene(initialState(), "Email Maya the launch update", undefined, deps);
    const id = state.approvals[0]?.id ?? "";
    state = await settle(state, id, "deny", deps);
    expect(state.approvals[0]?.status).toBe("denied");
    expect(state.messages.at(-1)?.text).toBe("You held it back. Nothing was released.");
    await expect(settle(state, id, "approve", deps)).rejects.toThrow(/already settled/);
  });

  it("ORIEL-F05 recalls a stored preference without opening a goal", async () => {
    let state = await convene(initialState(), "Remember that I prefer short briefs.", undefined, deps);
    expect(state.goals).toHaveLength(0);
    expect(state.memory.preferences.join(" ")).toContain("I prefer short briefs");
    expect(state.messages.at(-1)?.text).toContain("I'll keep that.");
    state = await convene(state, "What do you remember?", undefined, deps);
    expect(state.messages.at(-1)?.text).toContain("I prefer short briefs");
    expect(state.goals).toHaveLength(0);
  });

  it("ORIEL-F06 reroutes when Grok Bot is switched off", async () => {
    let state = setConnector(initialState(), "grok", { enabled: false }, deps);
    state = await convene(state, "Fix the failing test in the repo", undefined, deps);
    expect(voice(state)).toContain("Dots should lead");
    expect(voice(state)).toContain("proving test");
    expect(state.goals[0]?.brief.why.join(" ")).toContain("Grok Bot is switched off.");
    expect(state.goals[0]?.brief.seatReads.map((note) => note.seat)).toEqual(["dots"]);
  });

  it("ORIEL-F07 saves a routine once and still skips a forbidden send", async () => {
    let state = await convene(initialState(), "Draft the weekly close but do not send it", undefined, deps);
    const goalId = state.goals[0]?.id ?? "";
    state = saveRoutine(state, goalId, "Weekly close", deps);
    state = saveRoutine(state, goalId, "Weekly close", deps);
    expect(state.routines).toHaveLength(1);
    state = await runRoutine(state, state.routines[0]?.id ?? "", deps);
    expect(state.goals).toHaveLength(2);
    expect(state.approvals.filter((approval) => approval.status === "open")).toHaveLength(0);
    expect(state.goals[1]?.plan.some((step) => step.kind === "send" && step.status === "skipped")).toBe(true);
    expect(state.events.some((event) => event.type === "routine_ran")).toBe(true);
  });

  it("ORIEL-F08 keeps open holds and watches on the away brief", async () => {
    let state = await convene(
      initialState(),
      "Buy a $20 gift for the dinner and keep an eye on the guest list.",
      undefined,
      deps,
    );
    expect(toPublic(state, 0).away?.lines).toEqual([
      "Waiting on you: Release a payment",
      "Watch: the guest list",
    ]);
    state = await settle(state, state.approvals[0]?.id ?? "", "approve", deps);
    expect(toPublic(state, 0).away?.lines).toEqual(["Watch: the guest list"]);
    expect(state.messages.at(-1)?.text).toContain("did not move money");
    expect(state.messages.at(-1)?.text.toLowerCase()).not.toContain("charged");
  });

  it("ORIEL-F10 names a failed bridge and continues with a reference read", async () => {
    await withBridge(500, { summary: "no" }, async (url) => {
      let state = setConnector(initialState(), "grok", { bridgeUrl: url, token: "bridge-secret-xyz" }, deps);
      state = await convene(state, "Summarize the market landscape", undefined, deps);
      const note = state.goals[0]?.brief.seatReads.find((item) => item.seat === "grok");
      expect(note?.mode).toBe("reference");
      expect(note?.summary).toContain("The live bridge for Grok Bot failed");
      expect(note?.summary).toContain("Grok Bot would run this");
      expect(state.connectors.find((connector) => connector.id === "grok")?.lastResult).toBe("fallback");
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("bridge-secret-xyz");
    });
  });

  it("a live bridge is labeled live and its token stays out of the body", async () => {
    await withBridge(200, { summary: "Queued on the user's computer.", points: ["Ready"], stance: "On it." }, async (url, hits) => {
      let state = setConnector(initialState(), "dots", { bridgeUrl: url, token: "bridge-secret-xyz" }, deps);
      state = await convene(state, "Summarize the market landscape", undefined, deps);
      const note = state.goals[0]?.brief.seatReads.find((item) => item.seat === "dots");
      expect(note?.mode).toBe("live");
      expect(note?.summary).toContain("Queued on the user's computer.");
      expect(hits[0]?.authorization).toBe("Bearer bridge-secret-xyz");
      expect(hits[0]?.raw).not.toContain("bridge-secret-xyz");
    });
  });

  it("ORIEL-F11 records a payment release without moving money", async () => {
    let state = await convene(initialState(), "Plan a family dinner under $80 and hold any purchase.", undefined, deps);
    expect(state.approvals[0]?.kind).toBe("pay");
    expect(state.approvals[0]?.detail).toContain("$80");
    expect(voice(state)).toContain("Oriel never moves money.");
    state = await settle(state, state.approvals[0]?.id ?? "", "approve", deps);
    expect(state.messages.at(-1)?.text).toContain("No charge was made.");
    expect(JSON.stringify(state).toLowerCase()).not.toContain("payment sent");
  });

  it("ORIEL-F12 holds a deletion", async () => {
    const state = await convene(initialState(), "Delete the old campaign draft", undefined, deps);
    expect(state.approvals[0]?.title).toBe("Release a deletion");
    expect(state.approvals[0]?.detail).toContain("Nothing is deleted from here.");
  });

  it("ORIEL-F13 shows a real disagreement and still names one lead", async () => {
    const state = await convene(initialState(), "Schedule family dinner and put it on the calendar", undefined, deps);
    const seats = state.goals[0]?.brief.seatReads.map((note) => note.seat);
    expect(seats).toContain("muse");
    expect(seats).toContain("grok");
    expect(state.goals[0]?.brief.dissent).toContain("will not schedule anything unless you save a routine");
    expect(voice(state)).toContain("Muse should lead");
  });

  it("ORIEL-F16 does not offer always-allow, and one release does not release the next", async () => {
    const web = `${await readFile("web/app.js", "utf8")}\n${await readFile("web/index.html", "utf8")}\n${await readFile("web/atlas.js", "utf8")}`;
    expect(web.toLowerCase()).not.toContain("always allow");
    expect(web.toLowerCase()).not.toContain("always-allow");
    let state = await convene(initialState(), "Buy a $20 gift for the dinner", undefined, deps);
    state = await settle(state, state.approvals[0]?.id ?? "", "approve", deps);
    state = await convene(state, "Buy a $15 gift for the trip", undefined, deps);
    expect(state.approvals.filter((approval) => approval.status === "approved")).toHaveLength(1);
    expect(state.approvals.filter((approval) => approval.status === "open")).toHaveLength(1);
    expect(state.events.filter((event) => event.type === "approved")).toHaveLength(1);
  });

  it("ORIEL-F17 writes the convened seats into the record and the desk brief", async () => {
    const state = await convene(initialState(), COMPARE, undefined, deps);
    const goal = state.goals[0];
    expect(goal).toBeTruthy();
    expect(state.events.some((event) => event.type === "convened" && event.detail.includes("Grok Bot"))).toBe(true);
    const markdown = renderMarkdown(goal!, state.events);
    expect(markdown).toContain("Grok Bot");
    expect(markdown).toContain("convened");
    expect(toPublic(state, 1).events.some((event) => event.detail.includes("Dots"))).toBe(true);
  });

  it("ORIEL-F18 collapses the next brief and does not call a rewriter", async () => {
    let calls = 0;
    let state = await convene(initialState(), "Remember that I prefer short briefs.", undefined, deps);
    state = await convene(state, "Compare the market landscape", undefined, {
      ...deps,
      refine: async () => {
        calls += 1;
        return "This should not be used.";
      },
    });
    expect(calls).toBe(0);
    expect(state.goals[0]?.brief.tight).toBe(true);
    expect(state.goals[0]?.prose).toBeNull();
    expect(voice(state)).toContain("should lead");
  });

  it("uses a rewriter only when the brief is not tight", async () => {
    const state = await convene(initialState(), "Compare the market landscape", undefined, {
      ...deps,
      refine: async () => "GLM REWRITE",
    });
    expect(state.goals[0]?.prose).toBe("GLM REWRITE");
    expect(state.goals[0]?.brief.voice).not.toContain("GLM REWRITE");
    expect(state.messages.at(-1)?.text).toBe("GLM REWRITE");
  });

  it("redacts secrets before they are stored and still holds credential use", async () => {
    const secret = "sk-supersecretvalue";
    const state = await convene(initialState(), `Store the api key ${secret} in the doc`, undefined, deps);
    const packed = JSON.stringify(state);
    expect(packed).not.toContain(secret);
    expect(packed).toContain("[redacted secret]");
    expect(state.approvals[0]?.kind).toBe("credential");
  });

  it("rejects bridge addresses that are not ordinary http(s)", () => {
    expect(() => setConnector(initialState(), "grok", { bridgeUrl: "http://169.254.169.254/latest" }, deps)).toThrow(
      /not allowed/,
    );
    expect(() => setConnector(initialState(), "muse", { bridgeUrl: "file:///etc/passwd" }, deps)).toThrow(/http/);
  });

  it("supersedes an open hold when the same goal continues", async () => {
    let state = await convene(initialState(), "Email Maya the launch update", undefined, deps);
    const goalId = state.goals[0]?.id ?? "";
    state = await convene(state, "Do not send it. Just list the risks.", goalId, deps);
    expect(state.goals).toHaveLength(1);
    expect(state.approvals[0]?.status).toBe("denied");
    expect(state.approvals[0]?.resolution).toContain("Superseded");
    expect(state.approvals.filter((approval) => approval.status === "open")).toHaveLength(0);
  });

  it("keeps client work off Muse even when Muse is the only seat left on", async () => {
    let state = setConnector(initialState(), "grok", { enabled: false }, deps);
    state = setConnector(state, "dots", { enabled: false }, deps);
    state = await convene(state, "Summarize the confidential client matter", undefined, deps);
    expect(state.goals[0]?.lead).toBeNull();
    expect(voice(state)).toContain("will not place client, patient, or confidential work on a consumer seat");
    expect(state.goals[0]?.brief.seatReads).toHaveLength(0);
  });

  it("typed approve settles the newest open hold", async () => {
    let state = await convene(initialState(), "Email Maya the launch update", undefined, deps);
    state = await convene(state, "approve", undefined, deps);
    expect(state.approvals[0]?.status).toBe("approved");
    expect(state.messages.at(-1)?.text).toContain("Nothing left this computer");
  });

  it("keeps an existing watch when the same goal continues", async () => {
    let state = await convene(
      initialState(),
      "Buy a $20 gift for the dinner and keep an eye on the guest list.",
      undefined,
      deps,
    );
    const goalId = state.goals[0]?.id ?? "";
    state = await convene(state, "Do not send it. Just list the risks.", goalId, deps);
    expect(state.goals[0]?.openLoops).toEqual(["Watch: the guest list"]);
    state = await convene(state, "Stop watching the guest list.", goalId, deps);
    expect(state.goals[0]?.openLoops).toEqual([]);
  });

  it("rejects bridge secrets in the URL and plain HTTP off this machine", () => {
    expect(() => setConnector(initialState(), "grok", { bridgeUrl: "http://bridge.example/tasks" }, deps)).toThrow(/HTTPS/);
    expect(() => setConnector(initialState(), "grok", { bridgeUrl: "http://user:secret@127.0.0.1/tasks" }, deps)).toThrow(
      /token field/,
    );
    const saved = setConnector(initialState(), "dots", { bridgeUrl: "https://bridge.example/tasks" }, deps);
    expect(saved.connectors.find((connector) => connector.id === "dots")?.bridgeUrl).toBe("https://bridge.example/tasks");
  });

  it("does not follow a bridge redirect", async () => {
    const server = createServer((_req, res) => {
      res.writeHead(302, { location: "http://169.254.169.254/latest/meta-data" });
      res.end();
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address() as AddressInfo;
    try {
      let state = setConnector(initialState(), "grok", { bridgeUrl: `http://127.0.0.1:${address.port}/tasks` }, deps);
      state = await convene(state, "Summarize the market landscape", undefined, deps);
      const note = state.goals[0]?.brief.seatReads.find((item) => item.seat === "grok");
      expect(note?.mode).toBe("reference");
      expect(note?.summary).toContain("Bridge redirected");
      expect(JSON.stringify(state)).not.toContain("169.254.169.254");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("a watch check asks only for status", async () => {
    await withBridge(200, { summary: "Idle. Nothing sent.", points: [], stance: "" }, async (url, hits) => {
      let state = setConnector(initialState(), "grok", { bridgeUrl: url, token: "bridge-secret-xyz" }, deps);
      state = await convene(state, "Buy a $20 gift and keep an eye on the guest list.", undefined, deps);
      const before = hits.length;
      state = await reviewWatches(state, deps);
      const watchHits = hits.slice(before);
      expect(watchHits.length).toBeGreaterThan(0);
      for (const hit of watchHits) {
        expect(hit.raw).toContain('"action":"status"');
        expect(hit.raw).not.toContain('"action":"convene"');
        expect(hit.raw).not.toContain('"action":"released"');
        expect(hit.raw).toContain("Do not send, pay, delete, post, or sign in.");
      }
      expect(state.approvals[0]?.status).toBe("open");
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("bridge-secret-xyz");
    });
  });

  it("reviews open work without settling a hold", async () => {
    let state = await convene(
      initialState(),
      "Buy a $20 gift for the dinner and keep an eye on the guest list.",
      undefined,
      deps,
    );
    state = await reviewWatches(state, deps);
    expect(state.messages.at(-1)?.text).toContain("Nothing moved. Here is what is still open.");
    expect(state.messages.at(-1)?.text).toContain("Release a payment");
    expect(state.messages.at(-1)?.text).toContain("Watch: the guest list");
    expect(state.approvals[0]?.status).toBe("open");
    expect(state.events.some((event) => event.type === "watched")).toBe(true);
  });

  it("asks local stand-ins in parallel and does not give a confidential watch to Muse", async () => {
    const grok = await startLocalSeat({ seat: "grok", token: "tok-grok" });
    const dots = await startLocalSeat({ seat: "dots", token: "tok-dots" });
    const muse = await startLocalSeat({ seat: "muse", token: "tok-muse" });
    try {
      let state = setConnector(initialState(), "grok", { bridgeUrl: grok.url, token: "tok-grok" }, deps);
      state = setConnector(state, "dots", { bridgeUrl: dots.url, token: "tok-dots" }, deps);
      state = setConnector(state, "muse", { bridgeUrl: muse.url, token: "wrong-token" }, deps);
      state = await convene(state, "Keep an eye on the confidential client filing.", undefined, deps);
      expect(grok.hits()).toBe(1);
      expect(dots.hits()).toBe(1);
      expect(muse.hits()).toBe(0);
      expect(state.goals[0]?.brief.seatReads.map((note) => note.seat)).toEqual(["dots", "grok"]);
      expect(state.goals[0]?.brief.seatReads.every((note) => note.mode === "live")).toBe(true);
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("tok-grok");
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("tok-dots");
      state = await reviewWatches(state, deps);
      expect(muse.hits()).toBe(0);
      expect(state.messages.at(-1)?.text).toContain("Muse was not asked");
      expect(state.messages.at(-1)?.text).toContain("Nothing moved");
      expect(grok.hits()).toBe(2);
      expect(dots.hits()).toBe(2);
    } finally {
      await grok.close();
      await dots.close();
      await muse.close();
    }
  });

  it("ORIEL-F19 wakes the earliest due routine and leaves the send held", async () => {
    const early: Deps = { ...deps, now: () => new Date("2026-10-23T12:00:00.000Z") };
    let state = await convene(initialState(), "Email Maya the launch update", undefined, early);
    state = saveRoutine(state, state.goals[0]?.id ?? "", "Launch note", early);
    state = await convene(state, "Draft the weekly close but do not send it", undefined, early);
    state = saveRoutine(state, state.goals[1]?.id ?? "", "Weekly close", early);
    expect(state.routines.every((routine) => routine.cadence === "manual")).toBe(true);
    expect((await wakeDue(state, { ...deps, now: () => new Date("2026-10-24T12:00:00.000Z") })).goals).toHaveLength(2);

    const email = state.routines.find((routine) => routine.name === "Launch note");
    const weekly = state.routines.find((routine) => routine.name === "Weekly close");
    state = setRoutineCadence(state, email?.id ?? "", "hourly", early);
    state = setRoutineCadence(state, weekly?.id ?? "", "daily", early);
    const hourlyDue: Deps = { ...deps, now: () => new Date("2026-10-23T13:00:00.000Z") };
    state = await wakeDue(state, hourlyDue);
    expect(state.goals).toHaveLength(3);
    expect(state.goals[2]?.text).toContain("Email Maya");
    expect(state.messages.some((message) => message.via === "wake")).toBe(true);
    expect(state.approvals.filter((approval) => approval.status === "approved")).toHaveLength(0);
    expect(state.approvals.some((approval) => approval.status === "open" && approval.kind === "send")).toBe(true);
    expect(state.events.some((event) => event.type === "woke" && event.detail.includes("Nothing was sent or spent"))).toBe(true);
    expect((await wakeDue(state, hourlyDue)).goals).toHaveLength(3);

    const bothDue: Deps = { ...deps, now: () => new Date("2026-10-24T12:00:00.000Z") };
    state = await wakeDue(state, bothDue);
    expect(state.goals).toHaveLength(4);
    expect(state.goals[3]?.text).toContain("Email Maya");
    state = await wakeDue(state, bothDue);
    expect(state.goals).toHaveLength(5);
    expect(state.goals[4]?.text).toContain("weekly close");
    expect(state.goals[4]?.plan.some((step) => step.kind === "send" && step.status === "skipped")).toBe(true);
    expect(state.approvals.filter((approval) => approval.status === "approved")).toHaveLength(0);
  });

  it("a woken confidential routine still stays off Muse", async () => {
    const early: Deps = { ...deps, now: () => new Date("2026-10-23T12:00:00.000Z") };
    let state = await convene(initialState(), "Summarize the confidential client matter", undefined, early);
    state = saveRoutine(state, state.goals[0]?.id ?? "", "Matter", early);
    state = setRoutineCadence(state, state.routines[0]?.id ?? "", "daily", early);
    state = await wakeDue(state, { ...deps, now: () => new Date("2026-10-24T12:00:00.000Z") });
    const woken = state.goals.at(-1);
    expect(woken?.lead).toBe("grok");
    expect(woken?.brief.seatReads.map((note) => note.seat)).not.toContain("muse");
    expect(woken?.brief.seatReads.every((note) => note.mode === "reference" || note.mode === "live")).toBe(true);
  });

  it("ORIEL-F20 checks a bridge without convening work or echoing the token", async () => {
    await expect(probeConnector(initialState(), "grok", deps)).rejects.toThrow(/Save a bridge/);
    const token = "bridge-secret-xyz";
    await withBridge(200, { summary: `Ready. token ${token}`, points: [`echo ${token}`], stance: token }, async (url, hits) => {
      let state = setConnector(initialState(), "grok", { bridgeUrl: url, token }, deps);
      state = await probeConnector(state, "grok", deps);
      expect(hits).toHaveLength(1);
      expect(hits[0]?.raw).toContain('"action":"status"');
      expect(hits[0]?.raw).toContain("Do not send, pay, delete, post, or sign in.");
      expect(hits[0]?.raw).not.toContain("client");
      expect(hits[0]?.authorization).toBe(`Bearer ${token}`);
      expect(state.connectors.find((connector) => connector.id === "grok")?.lastResult).toBe("live");
      expect(state.messages.at(-1)?.text).toContain("Nothing was sent or spent.");
      expect(state.goals).toHaveLength(0);
      const packed = JSON.stringify(toPublic(state, 0));
      expect(packed).not.toContain(token);
    });

    const seat = await startLocalSeat({ seat: "grok", token: "tok-grok" });
    try {
      let state = setConnector(initialState(), "grok", { bridgeUrl: seat.url, token: "tok-grok" }, deps);
      state = await probeConnector(state, "grok", deps);
      expect(seat.hits()).toBe(1);
      expect(state.messages.at(-1)?.text).toContain("Bridge is reachable");
      expect(state.messages.at(-1)?.text).toContain("Nothing was sent or spent.");
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("tok-grok");
    } finally {
      await seat.close();
    }
  });

  it("a dead bridge check is named and spends nothing", async () => {
    await withBridge(500, { summary: "no" }, async (url) => {
      let state = setConnector(initialState(), "dots", { bridgeUrl: url, token: "bridge-secret-xyz" }, deps);
      state = await probeConnector(state, "dots", deps);
      expect(state.connectors.find((connector) => connector.id === "dots")?.lastResult).toBe("fallback");
      expect(state.messages.at(-1)?.text).toContain("did not answer");
      expect(state.messages.at(-1)?.text).toContain("Nothing was sent or spent.");
      expect(state.goals).toHaveLength(0);
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("bridge-secret-xyz");
    });
  });

  it("ORIEL-F21 a pause stops a due wake and leaves the hold open", async () => {
    const early: Deps = { ...deps, now: () => new Date("2026-10-23T12:00:00.000Z") };
    let state = await convene(initialState(), "Email Maya the launch update", undefined, early);
    state = saveRoutine(state, state.goals[0]?.id ?? "", "Launch note", early);
    state = setRoutineCadence(state, state.routines[0]?.id ?? "", "hourly", early);
    const nextRunAt = state.routines[0]?.nextRunAt;
    expect(state.approvals[0]?.status).toBe("open");
    state = setPaused(state, true, early);
    expect(state.paused).toBe(true);
    expect(state.messages.at(-1)?.text).toContain("Nothing was sent or spent.");
    const later: Deps = { ...deps, now: () => new Date("2026-10-23T15:00:00.000Z") };
    const slept = await wakeDue(state, later);
    expect(slept).toBe(state);
    expect(slept.goals).toHaveLength(1);
    expect(slept.approvals[0]?.status).toBe("open");
    expect(slept.routines[0]?.nextRunAt).toBe(nextRunAt);
    const ran = await runRoutine(slept, slept.routines[0]?.id ?? "", later);
    expect(ran.paused).toBe(true);
    expect(ran.goals).toHaveLength(2);
    expect(ran.approvals.filter((approval) => approval.status === "open")).toHaveLength(2);
    expect(ran.messages.some((message) => message.via === "wake")).toBe(false);
    const resumed = setPaused(ran, false, later);
    expect(resumed.paused).toBe(false);
    expect(resumed.approvals.filter((approval) => approval.status === "open")).toHaveLength(2);
    const woken = await wakeDue(resumed, later);
    expect(woken.goals).toHaveLength(3);
    expect(woken.messages.some((message) => message.via === "wake")).toBe(true);
    expect(woken.approvals.filter((approval) => approval.status === "open")).toHaveLength(3);
    expect(woken.messages.at(-1)?.text.toLowerCase()).not.toContain("sent the");
    expect(woken.events.some((event) => event.type === "paused")).toBe(true);
    expect(woken.events.some((event) => event.type === "resumed")).toBe(true);
  });

  it("treats only the desk phrase as a pause", async () => {
    const paused = await convene(initialState(), "Pause wakes.", undefined, deps);
    expect(paused.paused).toBe(true);
    expect(paused.goals).toHaveLength(0);
    expect(paused.approvals).toHaveLength(0);
    const again = await convene(paused, "stop waking", undefined, deps);
    expect(again.paused).toBe(true);
    expect(again.events.filter((event) => event.type === "paused")).toHaveLength(1);
    const unrelated = await convene(initialState(), "Pause the newsletter draft", undefined, deps);
    expect(unrelated.paused).toBe(false);
    expect(unrelated.goals).toHaveLength(1);
    const resumed = await convene(paused, "Resume wakes", undefined, deps);
    expect(resumed.paused).toBe(false);
    expect(resumed.goals).toHaveLength(0);
  });

  it("a released payment reaches the lead stand-in and still moves no money", async () => {
    const muse = await startLocalSeat({ seat: "muse", token: "tok-muse" });
    try {
      let state = setConnector(initialState(), "muse", { bridgeUrl: muse.url, token: "tok-muse" }, deps);
      state = await convene(state, "Plan a family dinner under $80 and hold any purchase.", undefined, deps);
      expect(state.goals[0]?.lead).toBe("muse");
      expect(muse.hits()).toBe(1);
      state = await settle(state, state.approvals[0]?.id ?? "", "approve", deps);
      expect(muse.hits()).toBe(2);
      expect(state.messages.at(-1)?.text).toContain("Acknowledged a pay release");
      expect(state.messages.at(-1)?.text).toContain("did not send mail, move money");
      expect(state.messages.at(-1)?.text.toLowerCase()).not.toContain("charged");
    } finally {
      await muse.close();
    }
  });

  it("ORIEL-F22 a skill keeps a prohibition and does not wake or approve", async () => {
    let state = await convene(initialState(), "Draft the weekly close but do not send it", undefined, deps);
    const shown = state.goals[0]?.id ?? "";
    state = saveSkill(state, shown, "Weekly close", deps);
    state = saveSkill(state, shown, "Weekly close", deps);
    expect(state.skills).toHaveLength(1);
    expect(state.routines).toHaveLength(0);
    const skillId = state.skills[0]?.id ?? "";
    const slept = await wakeDue(state, deps);
    expect(slept.goals).toHaveLength(1);
    expect(slept.events.some((event) => event.type === "woke" || event.type === "routine_ran")).toBe(false);

    state = await convene(state, "Email Maya the launch update", undefined, deps, skillId);
    expect(state.goals).toHaveLength(2);
    expect(state.goals[1]?.skillId).toBe(skillId);
    expect(state.goals[1]?.brief.skill).toBe("Weekly close");
    expect(voice(state)).toContain("Using the skill “Weekly close”.");
    expect(voice(state)).toContain("left the send unsent");
    expect(voice(state)).not.toContain("on a hold");
    expect(state.approvals.filter((approval) => approval.status === "open")).toHaveLength(0);
    expect(state.events.some((event) => event.type === "approved")).toBe(false);
    expect(state.events.some((event) => event.type === "skill_applied")).toBe(true);

    state = saveRoutine(state, state.goals[1]?.id ?? "", undefined, deps);
    expect(state.routines[0]?.name).toBe("Weekly close");
    expect(state.routines[0]?.instruction).toContain("do not send");
    expect(state.routines[0]?.instruction).toContain("Email Maya");
    state = await runRoutine(state, state.routines[0]?.id ?? "", deps);
    expect(state.approvals.filter((approval) => approval.status === "open")).toHaveLength(0);
    expect(state.goals.at(-1)?.plan.some((step) => step.kind === "send" && step.status === "skipped")).toBe(true);
  });

  it("a confidential skill stays off Muse, and a neutral skill still holds a send", async () => {
    let state = await convene(
      initialState(),
      "Summarize the confidential client matter but do not send it",
      undefined,
      deps,
    );
    state = saveSkill(state, state.goals[0]?.id ?? "", "Client read", deps);
    const skillId = state.skills[0]?.id ?? "";
    const muse = await startLocalSeat({ seat: "muse", token: "tok-muse" });
    const grok = await startLocalSeat({ seat: "grok", token: "tok-grok" });
    try {
      state = setConnector(state, "muse", { bridgeUrl: muse.url, token: "tok-muse" }, deps);
      state = setConnector(state, "grok", { bridgeUrl: grok.url, token: "tok-grok" }, deps);
      state = await convene(state, "Plan a family dinner under $80", undefined, deps, skillId);
      expect(muse.hits()).toBe(0);
      expect(grok.hits()).toBe(1);
      expect(state.goals.at(-1)?.brief.seatReads.some((note) => note.seat === "muse")).toBe(false);
      expect(state.messages.at(-1)?.text).toContain("Using the skill “Client read”.");
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("tok-grok");
    } finally {
      await muse.close();
      await grok.close();
    }

    let neutral = await convene(initialState(), "Compare the market landscape", undefined, deps);
    neutral = saveSkill(neutral, neutral.goals[0]?.id ?? "", "Landscape", deps);
    neutral = await convene(neutral, "Email Maya the launch update", undefined, deps, neutral.skills[0]?.id);
    expect(neutral.approvals.some((approval) => approval.kind === "send" && approval.status === "open")).toBe(true);
    expect(voice(neutral)).toContain("held the send");
  });

  it("sends the skill method to a bridge without releasing the send", async () => {
    let state = await convene(initialState(), "Draft the weekly close but do not send it", undefined, deps);
    state = saveSkill(state, state.goals[0]?.id ?? "", "Weekly close", deps);
    const skillId = state.skills[0]?.id ?? "";
    await withBridge(200, { summary: "Read the method.", points: [], stance: "" }, async (url, hits) => {
      state = setConnector(state, "grok", { bridgeUrl: url, token: "bridge-secret-xyz" }, deps);
      state = await convene(state, "Email Maya the launch update", undefined, deps, skillId);
      expect(hits).toHaveLength(1);
      expect(hits[0]?.raw).toContain('"action":"convene"');
      expect(hits[0]?.raw).toContain("do not send");
      expect(hits[0]?.raw).toContain("Email Maya");
      expect(hits[0]?.raw).not.toContain('"action":"released"');
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("bridge-secret-xyz");
      expect(state.approvals.filter((approval) => approval.status === "open")).toHaveLength(0);
    });
  });

  it("ORIEL-F23 an unattended hold expires without a bridge release", async () => {
    const early: Deps = { ...deps, now: () => new Date("2026-10-23T12:00:00.000Z") };
    const wakeAt = new Date("2026-10-23T13:00:00.000Z");
    const wakeDeps: Deps = { ...deps, now: () => wakeAt };
    await withBridge(200, { summary: "Ready.", points: [], stance: "" }, async (url, hits) => {
      let state = setConnector(initialState(), "muse", { bridgeUrl: url, token: "bridge-secret-xyz" }, early);
      state = await convene(state, "Email Maya the launch update", undefined, early);
      const present = state.approvals[0];
      expect(present?.expiresAt).toBeNull();
      expect(present?.status).toBe("open");
      state = await settle(state, present?.id ?? "", "deny", early);
      state = saveRoutine(state, state.goals[0]?.id ?? "", "Launch note", early);
      state = setRoutineCadence(state, state.routines[0]?.id ?? "", "hourly", early);
      const manual = await runRoutine(state, state.routines[0]?.id ?? "", early);
      expect(manual.approvals.at(-1)?.expiresAt).toBeNull();
      state = await settle(manual, manual.approvals.at(-1)?.id ?? "", "deny", early);

      state = await wakeDue(state, wakeDeps);
      const away = state.approvals.at(-1);
      expect(away?.expiresAt).toBe(new Date(wakeAt.getTime() + HOLD_WINDOW_MS).toISOString());
      expect(away?.status).toBe("open");
      expect(state.messages.some((message) => message.text.includes("while you were away"))).toBe(true);
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("Always allow");
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("bridge-secret-xyz");
      const afterWake = hits.length;
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);

      const atExpiry: Deps = { ...deps, now: () => new Date(wakeAt.getTime() + HOLD_WINDOW_MS) };
      state = await convene(state, "approve", undefined, atExpiry);
      expect(state.approvals.find((approval) => approval.id === away?.id)?.status).toBe("expired");
      expect(state.approvals.some((approval) => approval.status === "approved")).toBe(false);
      expect(state.messages.at(-1)?.text).toContain("did not run");
      expect(state.messages.at(-1)?.text).toContain("no always-allow");
      expect(hits).toHaveLength(afterWake);
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);

      const goal = state.goals.at(-1);
      state = await convene(state, goal?.text ?? "", goal?.id, atExpiry);
      const fresh = state.approvals.at(-1);
      expect(fresh?.expiresAt).toBeNull();
      expect(fresh?.status).toBe("open");
      expect(state.approvals.find((approval) => approval.id === away?.id)?.status).toBe("expired");
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("Always allow");
    });
  });

  it("ORIEL-F23 a hold answered inside the window still does not spend", async () => {
    const wakeAt = new Date("2026-10-23T13:00:00.000Z");
    const early: Deps = { ...deps, now: () => new Date("2026-10-23T12:00:00.000Z") };
    await withBridge(200, { summary: "Ready.", points: [], stance: "" }, async (url, hits) => {
      let state = setConnector(initialState(), "muse", { bridgeUrl: url, token: "bridge-secret-xyz" }, early);
      state = await convene(state, "Email Maya the launch update", undefined, early);
      state = await settle(state, state.approvals[0]?.id ?? "", "deny", early);
      state = saveRoutine(state, state.goals[0]?.id ?? "", "Launch note", early);
      state = setRoutineCadence(state, state.routines[0]?.id ?? "", "hourly", early);
      state = await wakeDue(state, { ...deps, now: () => wakeAt });
      const away = state.approvals.at(-1);
      const before = hits.length;
      const justBefore: Deps = { ...deps, now: () => new Date(wakeAt.getTime() + HOLD_WINDOW_MS - 1) };
      state = await settle(state, away?.id ?? "", "approve", justBefore);
      expect(state.approvals.find((approval) => approval.id === away?.id)?.status).toBe("approved");
      expect(hits.length).toBe(before + 1);
      expect(hits.at(-1)?.raw).toContain('"action":"released"');
      expect(state.messages.at(-1)?.text).toContain("did not send mail, move money");
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("Always allow");
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("bridge-secret-xyz");
    });
  });

  it("a paused desk still expires an unattended hold and does not wake", async () => {
    const early: Deps = { ...deps, now: () => new Date("2026-10-23T12:00:00.000Z") };
    const wakeAt = new Date("2026-10-23T13:00:00.000Z");
    let state = await convene(initialState(), "Email Maya the launch update", undefined, early);
    state = saveRoutine(state, state.goals[0]?.id ?? "", "Launch note", early);
    state = setRoutineCadence(state, state.routines[0]?.id ?? "", "hourly", early);
    state = await wakeDue(state, { ...deps, now: () => wakeAt });
    const awayId = state.approvals.at(-1)?.id ?? "";
    const nextRunAt = state.routines[0]?.nextRunAt;
    state = setPaused(state, true, { ...deps, now: () => wakeAt });
    const atExpiry: Deps = { ...deps, now: () => new Date("2026-10-23T14:00:00.000Z") };
    const slept = await wakeDue(state, atExpiry);
    expect(slept.paused).toBe(true);
    expect(slept.goals).toHaveLength(2);
    expect(slept.routines[0]?.nextRunAt).toBe(nextRunAt);
    expect(slept.approvals.find((approval) => approval.id === awayId)?.status).toBe("expired");
    expect(slept.approvals.some((approval) => approval.status === "approved")).toBe(false);
    expect(slept.approvals.find((approval) => approval.expiresAt === null)?.status).toBe("open");
    expect(slept.messages.at(-1)?.text).toContain("did not run");
    expect(JSON.stringify(slept)).not.toContain("Always allow");
  });

  it("rejects an unknown skill and ignores one on a memory question", async () => {
    await expect(convene(initialState(), "Compare the market landscape", undefined, deps, "skill_missing")).rejects.toThrow(
      /skill/,
    );
    const state = await convene(initialState(), "What do you remember?", undefined, deps, "skill_missing");
    expect(state.goals).toHaveLength(0);
    expect(state.messages.at(-1)?.text).toContain("Nothing yet");
  });
});

describe("hand off to you", () => {
  it("ORIEL-F24 hands a password change to you and does not release it to a bridge", async () => {
    const secret = "hunter2-window";
    await withBridge(200, { summary: "Ready.", points: [], stance: "" }, async (url, hits) => {
      let state = setConnector(initialState(), "grok", { bridgeUrl: url, token: "bridge-secret-xyz" }, deps);
      state = await convene(state, `Change my password to ${secret}`, undefined, deps);
      const packed = JSON.stringify(toPublic(state, 0));
      expect(packed).not.toContain(secret);
      expect(packed).toContain("[redacted secret]");
      expect(state.approvals).toHaveLength(0);
      expect(state.handoffs).toHaveLength(1);
      expect(state.handoffs[0]?.title).toBe("Change the password yourself");
      expect(state.goals[0]?.status).toBe("waiting");
      expect(voice(state)).toContain("I handed that step to you");
      expect(voice(state)).toContain("Do not paste a password");
      const passwordRead = state.goals[0]?.brief.seatReads.map((note) => note.points.join(" ")).join(" ");
      expect(passwordRead).toContain("The password, sign-in, or code stays with the person");
      expect(packed).toContain("Handed to you: Change the password yourself");
      expect(renderMarkdown(state.goals[0]!, state.events)).toContain("## Hand off");
      expect(hits).toHaveLength(1);
      expect(hits[0]?.raw).toContain('"action":"convene"');
      expect(hits[0]?.raw).toContain("Do not change a password");
      expect(hits[0]?.raw).not.toContain(secret);
      expect(hits[0]?.raw).not.toContain('"action":"released"');
      await expect(convene(state, "approve", undefined, deps)).rejects.toThrow(/That step is yours/);
      expect(state.handoffs[0]?.status).toBe("open");
      const before = hits.length;
      state = await settleHandoff(state, state.handoffs[0]?.id ?? "", "done", deps);
      expect(hits).toHaveLength(before);
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);
      expect(state.handoffs[0]?.status).toBe("done");
      expect(state.goals[0]?.status).toBe("done");
      expect(state.messages.at(-1)?.text).toContain("did not type a password");
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
      expect(JSON.stringify(toPublic(state, 0))).not.toContain(secret);
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("bridge-secret-xyz");
    });
  });

  it("ORIEL-F24 keeps a sign-in with you while the send stays held", async () => {
    await withBridge(200, { summary: "Ready.", points: [], stance: "" }, async (url, hits) => {
      let state = setConnector(initialState(), "muse", { bridgeUrl: url, token: "bridge-secret-xyz" }, deps);
      state = await convene(state, "Sign in to the shop and email Maya the receipt", undefined, deps);
      expect(state.handoffs).toHaveLength(1);
      expect(state.handoffs[0]?.title).toBe("Sign in yourself");
      expect(state.approvals.filter((approval) => approval.kind === "send" && approval.status === "open")).toHaveLength(1);
      const convened = hits.length;
      expect(convened).toBeGreaterThan(0);
      expect(hits.every((hit) => hit.raw.includes('"action":"convene"'))).toBe(true);
      state = await convene(state, "I did this", undefined, deps);
      expect(hits).toHaveLength(convened);
      expect(state.handoffs[0]?.status).toBe("done");
      expect(state.approvals.filter((approval) => approval.status === "open")).toHaveLength(1);
      state = await settle(state, state.approvals.find((approval) => approval.status === "open")?.id ?? "", "approve", deps);
      expect(hits.length).toBe(convened + 1);
      expect(hits.at(-1)?.raw).toContain('"action":"released"');
      expect(hits.at(-1)?.raw).toContain("Do not change a password");
      expect(hits.at(-1)?.raw).toContain("Do not perform the step that was handed to the person.");
      expect(state.messages.at(-1)?.text).toContain("did not send mail, move money");
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("bridge-secret-xyz");
    });
  });

  it("hands a deletion to you, and a skill does not invent one on a draft", async () => {
    await withBridge(200, { summary: "Ready.", points: [], stance: "" }, async (url, hits) => {
      let state = setConnector(initialState(), "dots", { bridgeUrl: url, token: "bridge-secret-xyz" }, deps);
      state = await convene(state, "Delete the shared files and hand that to me", undefined, deps);
      expect(state.approvals).toHaveLength(0);
      expect(state.handoffs[0]?.title).toBe("Delete that yourself");
      expect(hits[0]?.raw).toContain("Do not delete anything");
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);
      state = await convene(state, "Leave it", undefined, deps);
      expect(state.handoffs[0]?.status).toBe("left");
      expect(state.messages.at(-1)?.text).toContain("You left that step");
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);
    });

    let skill = await convene(initialState(), "Hand deletions to me", undefined, deps);
    skill = saveSkill(skill, skill.goals[0]?.id ?? "", "No deletes", deps);
    const skillId = skill.skills[0]?.id ?? "";
    skill = await convene(skill, "Draft the weekly close", undefined, deps, skillId);
    expect(skill.goals.at(-1)?.brief.handed).toBe(false);
    expect(skill.handoffs.filter((item) => item.goalId === skill.goals.at(-1)?.id)).toHaveLength(0);
    skill = await convene(skill, "Delete the shared project files", undefined, deps, skillId);
    const latest = skill.goals.at(-1)?.id;
    expect(skill.goals.at(-1)?.brief.handed).toBe(true);
    expect(skill.approvals.filter((approval) => approval.goalId === latest && approval.status === "open")).toHaveLength(0);
    expect(skill.handoffs.filter((item) => item.goalId === latest && item.status === "open")).toHaveLength(1);
    expect(skill.events.some((event) => event.type === "approved")).toBe(false);
  });

  it("a password method guards the bridge and does not invent a handoff", async () => {
    let state = await convene(initialState(), "Change the store password and hand that step to me", undefined, deps);
    state = saveSkill(state, state.goals[0]?.id ?? "", "Password step", deps);
    const skillId = state.skills[0]?.id ?? "";
    await withBridge(200, { summary: "Ready.", points: [], stance: "" }, async (url, hits) => {
      state = setConnector(state, "dots", { bridgeUrl: url, token: "bridge-secret-xyz" }, deps);
      state = await convene(state, "Draft the weekly close", undefined, deps, skillId);
      expect(state.goals.at(-1)?.brief.handed).toBe(false);
      expect(hits.at(-1)?.raw).toContain("Do not change a password");
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);
      state = await convene(state, "Change the vendor password", undefined, deps, skillId);
      expect(state.goals.at(-1)?.brief.handed).toBe(true);
      expect(state.approvals.filter((approval) => approval.goalId === state.goals.at(-1)?.id)).toHaveLength(0);
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("bridge-secret-xyz");
    });
  });

  it("keeps a client password change off Muse", async () => {
    const muse = await startLocalSeat({ seat: "muse", token: "tok-muse" });
    const grok = await startLocalSeat({ seat: "grok", token: "tok-grok" });
    try {
      let state = setConnector(initialState(), "muse", { bridgeUrl: muse.url, token: "tok-muse" }, deps);
      state = setConnector(state, "grok", { bridgeUrl: grok.url, token: "tok-grok" }, deps);
      state = await convene(state, "Change the client password for the matter", undefined, deps);
      expect(muse.hits()).toBe(0);
      expect(grok.hits()).toBe(1);
      expect(state.handoffs).toHaveLength(1);
      expect(state.goals[0]?.brief.seatReads.some((note) => note.seat === "muse")).toBe(false);
      expect(state.goals[0]?.lead).toBe("grok");
    } finally {
      await muse.close();
      await grok.close();
    }
  });

  it("does not hand off a comparison that rules sign-in out", async () => {
    const state = await convene(initialState(), "Do not sign in, just compare the market landscape", undefined, deps);
    expect(state.handoffs).toHaveLength(0);
    expect(voice(state)).not.toContain("I handed that step");
    expect(state.approvals).toHaveLength(0);
  });

  it("ORIEL-F25 a handoff rule covers only the named action and does not wake", async () => {
    expect(() => setHandoffRule(initialState(), "allow", true, deps)).toThrow(/send, pay, delete, or post/);
    let held = await convene(initialState(), "Email Maya the launch update", undefined, deps);
    const openId = held.approvals[0]?.id ?? "";
    held = setHandoffRule(held, "send", true, deps);
    held = setHandoffRule(held, "send", false, deps);
    expect(held.handoffRules).toHaveLength(0);
    expect(held.approvals.find((approval) => approval.id === openId)?.status).toBe("open");
    expect(held.events.some((event) => event.type === "approved")).toBe(false);

    await withBridge(200, { summary: "Ready.", points: [], stance: "" }, async (url, hits) => {
      let state = setConnector(initialState(), "grok", { bridgeUrl: url, token: "bridge-secret-xyz" }, deps);
      state = setHandoffRule(state, "delete", true, deps);
      state = setHandoffRule(state, "delete", true, deps);
      expect(state.handoffRules).toHaveLength(1);
      expect(state.events.filter((event) => event.type === "rule_saved")).toHaveLength(1);
      state = await convene(state, "Draft the weekly close", undefined, deps);
      expect(state.goals.at(-1)?.brief.handed).toBe(false);
      expect(state.goals.at(-1)?.brief.rules).toEqual([]);
      expect(state.handoffs).toHaveLength(0);
      state = await convene(state, "Delete the shared project files", undefined, deps);
      const latest = state.goals.at(-1)?.id;
      expect(state.goals.at(-1)?.brief.rules).toEqual(["delete"]);
      expect(voice(state)).toContain("Your rule hands the deletion to you");
      expect(state.approvals.filter((approval) => approval.goalId === latest)).toHaveLength(0);
      expect(state.handoffs.filter((item) => item.goalId === latest && item.status === "open")).toHaveLength(1);
      expect(hits.at(-1)?.raw).toContain("Do not delete anything");
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);
      const convened = hits.length;
      state = await settleHandoff(state, state.handoffs.at(-1)?.id ?? "", "done", deps);
      expect(hits).toHaveLength(convened);
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
      expect(state.messages.at(-1)?.text).toContain("did not type a password");
      expect(renderMarkdown(state.goals.at(-1)!, state.events)).toContain("## Handoff rule");
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("bridge-secret-xyz");
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("Always allow");
    });

    let ruled = setHandoffRule(initialState(), "send", true, deps);
    ruled = await convene(ruled, "Email Maya the launch update but do not send it", undefined, deps);
    expect(ruled.handoffs).toHaveLength(0);
    expect(voice(ruled)).toContain("ruled it out");
    ruled = await convene(ruled, "Delete the shared files and email Maya the note", undefined, deps);
    expect(ruled.goals.at(-1)?.brief.rules).toEqual(["send"]);
    expect(ruled.approvals.filter((approval) => approval.status === "open" && approval.kind === "delete")).toHaveLength(1);
    expect(ruled.handoffs.at(-1)?.title).toBe("Send that yourself");

    let quiet = setHandoffRule(initialState(), "delete", true, deps);
    quiet = await convene(quiet, "Change the vendor password", undefined, deps);
    expect(quiet.handoffs).toHaveLength(1);
    expect(quiet.handoffs[0]?.title).toBe("Change the password yourself");
    expect(quiet.goals[0]?.brief.rules).toEqual([]);

    const asleep = await wakeDue(setHandoffRule(initialState(), "pay", true, deps), {
      ...deps,
      now: () => new Date("2026-10-24T12:00:00.000Z"),
    });
    expect(asleep.goals).toHaveLength(0);
    expect(asleep.handoffRules).toHaveLength(1);
    expect(asleep.routines).toHaveLength(0);
  });

  it("ORIEL-F26 a phrase hands over only the matching deletion", async () => {
    expect(() => setHandoffRule(initialState(), "delete", true, deps, "always allow the deletion")).toThrow(/short phrase/);
    expect(() => setHandoffRule(initialState(), "delete", true, deps, "password is hunter2")).toThrow(/short phrase/);
    expect(() => setHandoffRule(initialState(), "delete", true, deps, "ab")).toThrow(/short phrase/);

    let held = await convene(initialState(), "Delete the archive", undefined, deps);
    const openId = held.approvals[0]?.id ?? "";
    held = setHandoffRule(held, "delete", true, deps, "shared project files");
    held = setHandoffRule(held, "delete", false, deps);
    expect(held.handoffRules).toHaveLength(0);
    expect(held.approvals.find((approval) => approval.id === openId)?.status).toBe("open");
    expect(held.events.some((event) => event.type === "approved")).toBe(false);

    await withBridge(200, { summary: "Ready.", points: [], stance: "" }, async (url, hits) => {
      let state = setConnector(initialState(), "grok", { bridgeUrl: url, token: "bridge-secret-xyz" }, deps);
      state = setHandoffRule(state, "delete", true, deps, "shared project files");
      state = setHandoffRule(state, "delete", true, deps, "shared project files");
      expect(state.handoffRules).toHaveLength(1);
      expect(state.handoffRules[0]?.phrase).toBe("shared project files");
      expect(state.events.filter((event) => event.type === "rule_saved")).toHaveLength(1);
      const ruleId = state.handoffRules[0]?.id;
      state = setHandoffRule(state, "delete", true, deps, "the vendor archive");
      expect(state.handoffRules).toHaveLength(1);
      expect(state.handoffRules[0]?.phrase).toBe("the vendor archive");
      expect(state.handoffRules[0]?.id).toBe(ruleId);
      state = setHandoffRule(state, "delete", true, deps, "shared project files");
      expect(state.handoffRules).toHaveLength(1);
      state = await convene(state, "Draft the weekly close", undefined, deps);
      expect(state.goals.at(-1)?.brief.handed).toBe(false);
      expect(state.goals.at(-1)?.brief.rules).toEqual([]);
      expect(state.handoffs).toHaveLength(0);
      state = await convene(state, "Delete the unshared project files", undefined, deps);
      expect(state.goals.at(-1)?.brief.rules).toEqual([]);
      expect(state.approvals.filter((approval) => approval.goalId === state.goals.at(-1)?.id && approval.status === "open")).toHaveLength(1);
      expect(state.handoffs.filter((item) => item.goalId === state.goals.at(-1)?.id)).toHaveLength(0);
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);
      state = await convene(state, "Delete the shared project files.", undefined, deps);
      const latest = state.goals.at(-1)?.id;
      expect(state.goals.at(-1)?.brief.rules).toEqual(["delete"]);
      expect(state.goals.at(-1)?.brief.rulePhrases?.delete).toBe("shared project files");
      expect(voice(state)).toContain("Your rule hands the deletion to you when the request mentions “shared project files”");
      expect(state.approvals.filter((approval) => approval.goalId === latest)).toHaveLength(0);
      expect(state.handoffs.filter((item) => item.goalId === latest && item.status === "open")).toHaveLength(1);
      expect(state.handoffs.at(-1)?.title).toBe("Delete that yourself");
      expect(state.handoffs.at(-1)?.detail).toContain("shared project files");
      const read = state.goals.at(-1)?.brief.seatReads.map((note) => note.points.join(" ")).join(" ");
      expect(read).toContain("The deletion stays with the person");
      expect(read).not.toContain("password");
      expect(hits.at(-1)?.raw).toContain("Do not delete anything");
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);
      const convened = hits.length;
      state = await settleHandoff(state, state.handoffs.at(-1)?.id ?? "", "done", deps);
      expect(hits).toHaveLength(convened);
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
      expect(renderMarkdown(state.goals.at(-1)!, state.events)).toContain("shared project files");
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("bridge-secret-xyz");
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("Always allow");
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("hunter2");
    });

    let skipped = setHandoffRule(initialState(), "delete", true, deps, "shared project files");
    skipped = await convene(skipped, "Delete the shared project files but do not delete them", undefined, deps);
    expect(skipped.handoffs).toHaveLength(0);
    expect(voice(skipped)).toContain("ruled it out");
    skipped = await convene(skipped, "Write about the shared project files", undefined, deps);
    expect(skipped.goals.at(-1)?.brief.handed).toBe(false);
    expect(skipped.approvals.filter((approval) => approval.goalId === skipped.goals.at(-1)?.id)).toHaveLength(0);

    let skill = setHandoffRule(initialState(), "delete", true, deps, "shared project files");
    skill = await convene(skill, "Hand deletions to me", undefined, deps);
    skill = saveSkill(skill, skill.goals[0]?.id ?? "", "No deletes", deps);
    const skillId = skill.skills[0]?.id ?? "";
    skill = await convene(skill, "Delete the archive", undefined, deps, skillId);
    expect(skill.goals.at(-1)?.brief.handed).toBe(true);
    expect(skill.goals.at(-1)?.brief.rules).toEqual([]);
    expect(skill.handoffs.filter((item) => item.goalId === skill.goals.at(-1)?.id && item.status === "open")).toHaveLength(1);
    expect(skill.events.some((event) => event.type === "approved")).toBe(false);

    let send = setHandoffRule(initialState(), "send", true, deps, "launch update");
    send = await convene(send, "Delete the shared project files", undefined, deps);
    expect(send.handoffs).toHaveLength(0);
    expect(send.approvals.filter((approval) => approval.status === "open" && approval.kind === "delete")).toHaveLength(1);
    send = await convene(send, "Email Maya the launch update", undefined, deps);
    expect(send.goals.at(-1)?.brief.rules).toEqual(["send"]);
    expect(send.handoffs.at(-1)?.title).toBe("Send that yourself");
    expect(send.approvals.filter((approval) => approval.goalId === send.goals.at(-1)?.id)).toHaveLength(0);

    const quiet = await wakeDue(setHandoffRule(initialState(), "pay", true, deps, "the vendor invoice"), {
      ...deps,
      now: () => new Date("2026-10-24T12:00:00.000Z"),
    });
    expect(quiet.goals).toHaveLength(0);
    expect(quiet.handoffRules).toHaveLength(1);
    expect(quiet.routines).toHaveLength(0);
  });

  it("ORIEL-F26 a phrase keeps client work off Muse", async () => {
    const muse = await startLocalSeat({ seat: "muse", token: "tok-muse" });
    const grok = await startLocalSeat({ seat: "grok", token: "tok-grok" });
    try {
      let state = setConnector(initialState(), "muse", { bridgeUrl: muse.url, token: "tok-muse" }, deps);
      state = setConnector(state, "grok", { bridgeUrl: grok.url, token: "tok-grok" }, deps);
      state = setHandoffRule(state, "delete", true, deps, "shared project files");
      state = await convene(state, "Delete the client files for the matter", undefined, deps);
      expect(muse.hits()).toBe(0);
      expect(grok.hits()).toBe(1);
      expect(state.handoffs).toHaveLength(0);
      expect(state.approvals.filter((approval) => approval.status === "open" && approval.kind === "delete")).toHaveLength(1);
      expect(state.goals[0]?.brief.seatReads.some((note) => note.seat === "muse")).toBe(false);
      state = await convene(state, "Delete the shared project files for the client matter", undefined, deps);
      expect(muse.hits()).toBe(0);
      expect(grok.hits()).toBe(2);
      expect(state.handoffs.filter((item) => item.goalId === state.goals.at(-1)?.id && item.status === "open")).toHaveLength(1);
      expect(state.goals.at(-1)?.lead).toBe("grok");
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
    } finally {
      await muse.close();
      await grok.close();
    }
  });

  it("ORIEL-F26 a woken deletion follows the phrase and does not approve itself", async () => {
    const early: Deps = { ...deps, now: () => new Date("2026-10-23T12:00:00.000Z") };
    const wakeAt = new Date("2026-10-23T13:00:00.000Z");
    await withBridge(200, { summary: "Ready.", points: [], stance: "" }, async (url, hits) => {
      let state = setConnector(initialState(), "dots", { bridgeUrl: url, token: "bridge-secret-xyz" }, early);
      state = setHandoffRule(state, "delete", true, early, "shared project files");
      state = await convene(state, "Delete the archive", undefined, early);
      expect(state.handoffs).toHaveLength(0);
      expect(state.approvals.filter((approval) => approval.status === "open")).toHaveLength(1);
      state = saveRoutine(state, state.goals[0]?.id ?? "", "Archive", early);
      state = setRoutineCadence(state, state.routines[0]?.id ?? "", "hourly", early);
      state = await convene(state, "Delete the Shared Project Files", undefined, early);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(1);
      state = saveRoutine(state, state.goals.at(-1)?.id ?? "", "Shared files", early);
      state = setRoutineCadence(state, state.routines.at(-1)?.id ?? "", "hourly", early);
      state = await wakeDue(state, { ...deps, now: () => wakeAt });
      expect(state.goals).toHaveLength(3);
      expect(state.approvals.filter((approval) => approval.status === "open")).toHaveLength(2);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(1);
      state = await wakeDue(state, { ...deps, now: () => wakeAt });
      expect(state.goals).toHaveLength(4);
      expect(state.approvals.filter((approval) => approval.status === "open")).toHaveLength(2);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(2);
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);
      expect(state.messages.some((message) => message.text.includes("I deleted"))).toBe(false);
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("Always allow");
    });
  });

  it("ORIEL-F25 a woken send stays with you when the rule says so", async () => {
    const early: Deps = { ...deps, now: () => new Date("2026-10-23T12:00:00.000Z") };
    const wakeAt = new Date("2026-10-23T13:00:00.000Z");
    await withBridge(200, { summary: "Ready.", points: [], stance: "" }, async (url, hits) => {
      let state = setConnector(initialState(), "dots", { bridgeUrl: url, token: "bridge-secret-xyz" }, early);
      state = setHandoffRule(state, "send", true, early);
      state = await convene(state, "Email Maya the launch update", undefined, early);
      expect(state.approvals).toHaveLength(0);
      state = saveRoutine(state, state.goals[0]?.id ?? "", "Launch note", early);
      state = setRoutineCadence(state, state.routines[0]?.id ?? "", "hourly", early);
      state = await wakeDue(state, { ...deps, now: () => wakeAt });
      expect(state.approvals.filter((approval) => approval.status === "open")).toHaveLength(0);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(2);
      expect(state.goals).toHaveLength(2);
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);
      expect(state.messages.some((message) => message.text.includes("I sent"))).toBe(false);
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("Always allow");
    });
  });

  it("a delete rule keeps client work off Muse", async () => {
    const muse = await startLocalSeat({ seat: "muse", token: "tok-muse" });
    const grok = await startLocalSeat({ seat: "grok", token: "tok-grok" });
    try {
      let state = setConnector(initialState(), "muse", { bridgeUrl: muse.url, token: "tok-muse" }, deps);
      state = setConnector(state, "grok", { bridgeUrl: grok.url, token: "tok-grok" }, deps);
      state = setHandoffRule(state, "delete", true, deps);
      state = await convene(state, "Delete the client files for the matter", undefined, deps);
      expect(muse.hits()).toBe(0);
      expect(grok.hits()).toBe(1);
      expect(state.handoffs).toHaveLength(1);
      expect(state.goals[0]?.brief.seatReads.some((note) => note.seat === "muse")).toBe(false);
      expect(state.goals[0]?.lead).toBe("grok");
    } finally {
      await muse.close();
      await grok.close();
    }
  });

  it("ORIEL-F27 a sentence saves the phrase and does not open a card", async () => {
    const said = "Hand deletions that mention shared project files to me";
    await expect(convene(initialState(), "Hand deletions that mention ab to me", undefined, deps)).rejects.toThrow(/short phrase/);
    await expect(convene(initialState(), "Hand deletions that mention always allow the deletion to me", undefined, deps)).rejects.toThrow(
      /short phrase/,
    );
    await expect(convene(initialState(), "Hand deletions that mention password is hunter2 to me", undefined, deps)).rejects.toThrow(
      /short phrase/,
    );
    await expect(
      convene(initialState(), "Hand deletions that mention shared project files to me without asking", undefined, deps),
    ).rejects.toThrow(/without asking/);
    expect(JSON.stringify(initialState())).not.toContain("hunter2");

    const quiet = await convene(initialState(), "Hand notes that mention shared project files to me", undefined, deps);
    expect(quiet.goals).toHaveLength(0);
    expect(quiet.handoffs).toHaveLength(0);
    expect(quiet.approvals).toHaveLength(0);
    expect(quiet.handoffRules).toHaveLength(0);
    expect(quiet.messages.at(-1)?.text).toContain("did not save a rule");
    expect(quiet.messages.at(-1)?.text).toContain("did not open a card");

    let held = await convene(initialState(), "Email Maya the launch update", undefined, deps);
    const openId = held.approvals[0]?.id ?? "";
    const goalId = held.goals[0]?.id ?? "";
    held = await convene(held, said, goalId, deps, "skill_missing");
    expect(held.approvals.find((approval) => approval.id === openId)?.status).toBe("open");
    expect(held.goals).toHaveLength(1);
    expect(held.handoffs).toHaveLength(0);
    expect(held.handoffRules).toHaveLength(1);
    expect(held.events.some((event) => event.type === "approved")).toBe(false);

    await withBridge(200, { summary: "Ready.", points: [], stance: "" }, async (url, hits) => {
      const refine = async () => {
        throw new Error("refine should not run");
      };
      let state = setConnector(initialState(), "grok", { bridgeUrl: url, token: "bridge-secret-xyz" }, deps);
      state = setPaused(state, true, deps);
      state = await convene(state, `${said}.`, undefined, { ...deps, refine });
      expect(state.paused).toBe(true);
      expect(state.goals).toHaveLength(0);
      expect(state.handoffs).toHaveLength(0);
      expect(state.approvals).toHaveLength(0);
      expect(state.routines).toHaveLength(0);
      expect(state.handoffRules).toHaveLength(1);
      expect(state.handoffRules[0]?.phrase).toBe("shared project files");
      expect(state.messages.at(-1)?.text).toContain("Saved one handoff rule for a delete");
      expect(state.messages.at(-1)?.text).toContain("did not approve a hold");
      expect(hits).toHaveLength(0);
      const ruleId = state.handoffRules[0]?.id;
      state = await convene(state, "Please hand off the deletion that mentions shared project files to you", undefined, deps);
      expect(state.handoffRules).toHaveLength(1);
      expect(state.handoffRules[0]?.id).toBe(ruleId);
      expect(state.events.filter((event) => event.type === "rule_saved")).toHaveLength(1);
      expect(state.messages.at(-1)?.text).toContain("already saved");
      state = await convene(state, `Hand deletions that mention ${"\u201c"}the vendor archive${"\u201d"} to me?`, undefined, deps);
      expect(state.handoffRules).toHaveLength(1);
      expect(state.handoffRules[0]?.id).toBe(ruleId);
      expect(state.handoffRules[0]?.phrase).toBe("the vendor archive");
      expect(state.messages.at(-1)?.text).toContain("Updated the one handoff rule");
      state = await convene(state, said, undefined, deps);
      expect(state.handoffRules[0]?.phrase).toBe("shared project files");
      state = await convene(state, "Hand the weekly close to me", undefined, deps);
      expect(state.handoffRules).toHaveLength(1);
      expect(state.goals.at(-1)?.brief.handed).toBe(false);
      expect(state.handoffs).toHaveLength(0);
      expect(state.approvals).toHaveLength(0);
      state = await convene(state, "Draft the weekly close", undefined, deps);
      expect(state.handoffRules).toHaveLength(1);
      expect(state.handoffs).toHaveLength(0);
      expect(state.approvals.filter((approval) => approval.goalId === state.goals.at(-1)?.id)).toHaveLength(0);
      state = await convene(state, "Write about the shared project files", undefined, deps);
      expect(state.handoffRules).toHaveLength(1);
      expect(state.goals.at(-1)?.brief.handed).toBe(false);
      expect(state.handoffs.filter((item) => item.goalId === state.goals.at(-1)?.id)).toHaveLength(0);
      state = await convene(state, "Delete the unshared project files", undefined, deps);
      expect(state.goals.at(-1)?.brief.rules).toEqual([]);
      expect(state.approvals.filter((approval) => approval.goalId === state.goals.at(-1)?.id && approval.status === "open")).toHaveLength(1);
      expect(state.handoffs.filter((item) => item.goalId === state.goals.at(-1)?.id)).toHaveLength(0);
      state = await convene(state, "Delete the shared project files but do not delete them", undefined, deps);
      expect(state.handoffs.filter((item) => item.goalId === state.goals.at(-1)?.id)).toHaveLength(0);
      expect(voice(state)).toContain("ruled it out");
      state = await convene(state, "Delete the shared project files", undefined, deps);
      const latest = state.goals.at(-1)?.id;
      expect(state.goals.at(-1)?.brief.rules).toEqual(["delete"]);
      expect(state.goals.at(-1)?.brief.rulePhrases?.delete).toBe("shared project files");
      expect(voice(state)).toContain("when the request mentions “shared project files”");
      expect(state.approvals.filter((approval) => approval.goalId === latest)).toHaveLength(0);
      expect(state.handoffs.filter((item) => item.goalId === latest && item.status === "open")).toHaveLength(1);
      expect(hits.at(-1)?.raw).toContain("Do not delete anything");
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);
      const convened = hits.length;
      state = await settleHandoff(state, state.handoffs.at(-1)?.id ?? "", "done", deps);
      expect(hits).toHaveLength(convened);
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
      expect(state.messages.at(-1)?.text).toContain("did not type a password");
      state = await convene(state, "Hand sends that mention the launch note to me", undefined, deps);
      state = await convene(state, "Hand payments that mention the vendor invoice to me", undefined, deps);
      state = await convene(state, "Hand posts that mention the launch note to me", undefined, deps);
      expect(state.handoffRules.map((rule) => rule.action).sort()).toEqual(["delete", "pay", "post", "send"]);
      expect(state.goals.some((goal) => /mention/i.test(goal.text))).toBe(false);
      state = await convene(state, "Publish the launch note", undefined, deps);
      expect(state.handoffs.at(-1)?.title).toBe("Post that yourself");
      expect(state.approvals.filter((approval) => approval.goalId === state.goals.at(-1)?.id)).toHaveLength(0);
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("bridge-secret-xyz");
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("Always allow");
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("hunter2");
    });

    const asleep = await wakeDue(
      await convene(initialState(), said, undefined, deps),
      { ...deps, now: () => new Date("2026-10-24T12:00:00.000Z") },
    );
    expect(asleep.goals).toHaveLength(0);
    expect(asleep.routines).toHaveLength(0);
    expect(asleep.handoffRules).toHaveLength(1);
    expect(asleep.events.some((event) => event.type === "approved")).toBe(false);
  });

  it("ORIEL-F27 a spoken phrase keeps client work off Muse", async () => {
    const muse = await startLocalSeat({ seat: "muse", token: "tok-muse" });
    const grok = await startLocalSeat({ seat: "grok", token: "tok-grok" });
    try {
      let state = setConnector(initialState(), "muse", { bridgeUrl: muse.url, token: "tok-muse" }, deps);
      state = setConnector(state, "grok", { bridgeUrl: grok.url, token: "tok-grok" }, deps);
      state = await convene(state, "Hand deletions that mention shared project files to me", undefined, deps);
      expect(muse.hits()).toBe(0);
      expect(grok.hits()).toBe(0);
      state = await convene(state, "Delete the client files for the matter", undefined, deps);
      expect(muse.hits()).toBe(0);
      expect(grok.hits()).toBe(1);
      expect(state.handoffs).toHaveLength(0);
      expect(state.approvals.filter((approval) => approval.status === "open" && approval.kind === "delete")).toHaveLength(1);
      expect(state.goals.at(-1)?.brief.seatReads.some((note) => note.seat === "muse")).toBe(false);
      state = await convene(state, "Delete the shared project files for the client matter", undefined, deps);
      expect(muse.hits()).toBe(0);
      expect(grok.hits()).toBe(2);
      expect(state.handoffs.filter((item) => item.goalId === state.goals.at(-1)?.id && item.status === "open")).toHaveLength(1);
      expect(state.goals.at(-1)?.lead).toBe("grok");
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
    } finally {
      await muse.close();
      await grok.close();
    }
  });

  it("ORIEL-F27 a woken deletion follows the sentence and does not approve itself", async () => {
    const early: Deps = { ...deps, now: () => new Date("2026-10-23T12:00:00.000Z") };
    const wakeAt = new Date("2026-10-23T13:00:00.000Z");
    await withBridge(200, { summary: "Ready.", points: [], stance: "" }, async (url, hits) => {
      let state = setConnector(initialState(), "dots", { bridgeUrl: url, token: "bridge-secret-xyz" }, early);
      state = await convene(state, "Hand deletions that mention shared project files to me", undefined, early);
      expect(state.goals).toHaveLength(0);
      state = await convene(state, "Delete the archive", undefined, early);
      expect(state.handoffs).toHaveLength(0);
      expect(state.approvals.filter((approval) => approval.status === "open")).toHaveLength(1);
      state = saveRoutine(state, state.goals[0]?.id ?? "", "Archive", early);
      state = setRoutineCadence(state, state.routines[0]?.id ?? "", "hourly", early);
      state = await convene(state, "Delete the Shared Project Files", undefined, early);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(1);
      state = saveRoutine(state, state.goals.at(-1)?.id ?? "", "Shared files", early);
      state = setRoutineCadence(state, state.routines.at(-1)?.id ?? "", "hourly", early);
      state = await wakeDue(state, { ...deps, now: () => wakeAt });
      expect(state.approvals.filter((approval) => approval.status === "open")).toHaveLength(2);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(1);
      state = await wakeDue(state, { ...deps, now: () => wakeAt });
      expect(state.approvals.filter((approval) => approval.status === "open")).toHaveLength(2);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(2);
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);
      expect(state.messages.some((message) => message.text.includes("I deleted"))).toBe(false);
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("Always allow");
    });
  });

  it("ORIEL-F28 a sentence clears only the saved phrase and does not delete", async () => {
    const said = "Hand deletions that mention shared project files to me";
    const clear = "Stop handing deletions that mention shared project files to me";
    await expect(convene(initialState(), "Stop handing deletions that mention ab to me", undefined, deps)).rejects.toThrow(/short phrase/);
    await expect(
      convene(initialState(), "Stop handing deletions that mention always allow the deletion to me", undefined, deps),
    ).rejects.toThrow(/short phrase/);
    await expect(convene(initialState(), "Stop handing deletions that mention password is hunter2 to me", undefined, deps)).rejects.toThrow(
      /short phrase/,
    );
    await expect(convene(initialState(), `${clear} without asking`, undefined, deps)).rejects.toThrow(/without asking/);
    expect(JSON.stringify(initialState())).not.toContain("hunter2");

    const bare = setHandoffRule(initialState(), "delete", true, deps);
    const untouched = await convene(bare, clear, undefined, deps);
    expect(untouched.handoffRules).toHaveLength(1);
    expect(untouched.handoffRules[0]?.phrase).toBeNull();
    expect(untouched.goals).toHaveLength(0);
    expect(untouched.messages.at(-1)?.text).toContain("not the saved phrase");
    expect(untouched.events.some((event) => event.type === "rule_cleared")).toBe(false);

    let held = await convene(initialState(), "Email Maya the launch update", undefined, deps);
    const openId = held.approvals[0]?.id ?? "";
    const goalId = held.goals[0]?.id ?? "";
    held = await convene(held, said, undefined, deps);
    held = await convene(held, clear, goalId, deps, "skill_missing");
    expect(held.approvals.find((approval) => approval.id === openId)?.status).toBe("open");
    expect(held.goals).toHaveLength(1);
    expect(held.handoffs).toHaveLength(0);
    expect(held.handoffRules).toHaveLength(0);
    expect(held.events.some((event) => event.type === "approved")).toBe(false);
    expect(held.messages.at(-1)?.text).toContain("Cleared the one handoff rule for a delete");
    expect(held.messages.at(-1)?.text).toContain("did not approve a hold");

    await withBridge(200, { summary: "Ready.", points: [], stance: "" }, async (url, hits) => {
      const refine = async () => {
        throw new Error("refine should not run");
      };
      let state = setConnector(initialState(), "grok", { bridgeUrl: url, token: "bridge-secret-xyz" }, deps);
      state = setPaused(state, true, deps);
      state = await convene(state, said, undefined, { ...deps, refine });
      const ruleId = state.handoffRules[0]?.id;
      state = await convene(state, "Stop handing deletions that mention the vendor archive to me", undefined, deps);
      expect(state.handoffRules).toHaveLength(1);
      expect(state.handoffRules[0]?.id).toBe(ruleId);
      expect(state.handoffRules[0]?.phrase).toBe("shared project files");
      expect(state.goals).toHaveLength(0);
      expect(state.messages.at(-1)?.text).toContain("not the saved phrase");
      state = await convene(state, "Stop handing deletions that mention unshared project files to me", undefined, deps);
      expect(state.handoffRules[0]?.id).toBe(ruleId);
      state = await convene(state, "Stop handing notes that mention shared project files to me", undefined, deps);
      expect(state.handoffRules).toHaveLength(1);
      expect(state.goals).toHaveLength(0);
      expect(state.messages.at(-1)?.text).toContain("did not clear a rule");
      expect(state.messages.at(-1)?.text).toContain("did not open a card");
      expect(hits).toHaveLength(0);
      state = await convene(
        state,
        "Stop handing deletions that mention shared project files to me and delete them",
        undefined,
        deps,
      );
      expect(state.handoffRules).toHaveLength(1);
      expect(state.handoffRules[0]?.id).toBe(ruleId);
      const deleting = state.goals.at(-1)?.id;
      expect(state.handoffs.filter((item) => item.goalId === deleting && item.status === "open")).toHaveLength(1);
      expect(state.approvals.filter((approval) => approval.goalId === deleting)).toHaveLength(0);
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);
      state = await convene(state, "Do not delete the shared project files", undefined, deps);
      expect(state.handoffRules[0]?.id).toBe(ruleId);
      expect(state.handoffs.filter((item) => item.goalId === state.goals.at(-1)?.id)).toHaveLength(0);
      expect(voice(state)).toContain("ruled it out");
      state = await convene(state, "Hand sends that mention the launch note to me", undefined, deps);
      expect(state.handoffRules.map((rule) => rule.action).sort()).toEqual(["delete", "send"]);
      const beforeClear = hits.length;
      state = await convene(state, clear, undefined, deps);
      expect(hits).toHaveLength(beforeClear);
      expect(state.paused).toBe(true);
      expect(state.handoffRules.map((rule) => rule.action)).toEqual(["send"]);
      expect(state.messages.at(-1)?.text).toContain("Cleared the one handoff rule for a delete");
      expect(state.messages.at(-1)?.text).toContain("no longer handed to you");
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(1);
      state = await convene(state, "Don't hand the send that mentions the launch note to you", undefined, deps);
      expect(state.handoffRules).toHaveLength(0);
      expect(hits).toHaveLength(beforeClear);
      const goalsBefore = state.goals.length;
      state = await convene(state, said, undefined, deps);
      expect(state.goals).toHaveLength(goalsBefore);
      expect(state.handoffRules).toHaveLength(1);
      state = await convene(
        state,
        `Please stop handing deletions that mention ${"\u201c"}Shared Project Files${"\u201d"} to me?`,
        undefined,
        deps,
      );
      expect(state.handoffRules).toHaveLength(0);
      expect(state.goals).toHaveLength(goalsBefore);
      expect(state.messages.at(-1)?.text).toContain("Cleared the one handoff rule for a delete");
      state = await convene(state, clear, undefined, deps);
      expect(state.handoffRules).toHaveLength(0);
      expect(state.messages.at(-1)?.text).toContain("no handoff rule");
      expect(state.messages.at(-1)?.text).toContain("did not open a card");
      state = await convene(state, "Delete the shared project files", undefined, deps);
      const latest = state.goals.at(-1)?.id;
      expect(state.approvals.filter((approval) => approval.goalId === latest && approval.status === "open" && approval.kind === "delete")).toHaveLength(1);
      expect(state.handoffs.filter((item) => item.goalId === latest)).toHaveLength(0);
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);
      expect(state.messages.some((message) => message.text.includes("I deleted"))).toBe(false);
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("bridge-secret-xyz");
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("Always allow");
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("hunter2");
    });
  });

  it("ORIEL-F28 a cleared phrase keeps client work off Muse and a wake does not approve", async () => {
    const muse = await startLocalSeat({ seat: "muse", token: "tok-muse" });
    const grok = await startLocalSeat({ seat: "grok", token: "tok-grok" });
    try {
      let state = setConnector(initialState(), "muse", { bridgeUrl: muse.url, token: "tok-muse" }, deps);
      state = setConnector(state, "grok", { bridgeUrl: grok.url, token: "tok-grok" }, deps);
      state = await convene(state, "Hand deletions that mention shared project files to me", undefined, deps);
      state = await convene(state, "Stop handing deletions that mention the client archive to me", undefined, deps);
      expect(muse.hits()).toBe(0);
      expect(grok.hits()).toBe(0);
      expect(state.handoffRules).toHaveLength(1);
      expect(state.goals).toHaveLength(0);
      state = await convene(state, "Stop handing deletions that mention shared project files to me", undefined, deps);
      expect(muse.hits()).toBe(0);
      expect(grok.hits()).toBe(0);
      expect(state.handoffRules).toHaveLength(0);
      state = await convene(state, "Delete the shared project files for the client matter", undefined, deps);
      expect(muse.hits()).toBe(0);
      expect(grok.hits()).toBe(1);
      expect(state.handoffs).toHaveLength(0);
      expect(state.approvals.filter((approval) => approval.status === "open" && approval.kind === "delete")).toHaveLength(1);
      expect(state.goals.at(-1)?.brief.seatReads.some((note) => note.seat === "muse")).toBe(false);
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
    } finally {
      await muse.close();
      await grok.close();
    }
  });

  it("ORIEL-F28 a woken deletion is held after the sentence clears the rule", async () => {
    const early: Deps = { ...deps, now: () => new Date("2026-10-23T12:00:00.000Z") };
    const wakeAt = new Date("2026-10-23T13:00:00.000Z");
    await withBridge(200, { summary: "Ready.", points: [], stance: "" }, async (url, hits) => {
      let state = setConnector(initialState(), "dots", { bridgeUrl: url, token: "bridge-secret-xyz" }, early);
      state = await convene(state, "Hand deletions that mention shared project files to me", undefined, early);
      state = await convene(state, "Delete the shared project files", undefined, early);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(1);
      state = saveRoutine(state, state.goals[0]?.id ?? "", "Shared files", early);
      state = setRoutineCadence(state, state.routines[0]?.id ?? "", "hourly", early);
      state = await convene(state, "Stop handing deletions that mention shared project files to me", undefined, early);
      expect(state.handoffRules).toHaveLength(0);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(1);
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
      state = await wakeDue(state, { ...deps, now: () => wakeAt });
      expect(state.goals).toHaveLength(2);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(1);
      expect(state.approvals.filter((approval) => approval.status === "open" && approval.kind === "delete")).toHaveLength(1);
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);
      expect(state.messages.some((message) => message.text.includes("I deleted"))).toBe(false);
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("Always allow");
      const asleep = await wakeDue(state, { ...deps, now: () => new Date("2026-10-24T12:00:00.000Z") });
      expect(asleep.routines[0]?.cadence).toBe("hourly");
      expect(asleep.events.filter((event) => event.type === "woke").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("ORIEL-F29 a sentence clears only a rule with no phrase and does not delete", async () => {
    const clear = "Stop handing deletions to me";
    await expect(convene(initialState(), `${clear} without asking`, undefined, deps)).rejects.toThrow(/without asking/);
    await expect(convene(initialState(), "Stop handing deletions to me always allow", undefined, deps)).rejects.toThrow(/without asking/);

    const none = await convene(initialState(), clear, undefined, deps);
    expect(none.handoffRules).toHaveLength(0);
    expect(none.goals).toHaveLength(0);
    expect(none.handoffs).toHaveLength(0);
    expect(none.messages.at(-1)?.text).toContain("no handoff rule");
    expect(none.messages.at(-1)?.text).toContain("did not open a card");
    expect(none.events.some((event) => event.type === "rule_cleared")).toBe(false);

    const phrased = await convene(initialState(), "Hand deletions that mention shared project files to me", undefined, deps);
    const kept = await convene(phrased, clear, undefined, deps);
    expect(kept.handoffRules).toHaveLength(1);
    expect(kept.handoffRules[0]?.id).toBe(phrased.handoffRules[0]?.id);
    expect(kept.handoffRules[0]?.phrase).toBe("shared project files");
    expect(kept.goals).toHaveLength(0);
    expect(kept.messages.at(-1)?.text).toContain("shared project files");
    expect(kept.messages.at(-1)?.text).toContain("does not clear it");
    expect(kept.events.some((event) => event.type === "rule_cleared")).toBe(false);
    expect(kept.events.some((event) => event.type === "approved")).toBe(false);

    let held = await convene(initialState(), "Email Maya the launch update", undefined, deps);
    const openId = held.approvals[0]?.id ?? "";
    const goalId = held.goals[0]?.id ?? "";
    held = setHandoffRule(held, "delete", true, deps);
    held = await convene(held, clear, goalId, deps, "skill_missing");
    expect(held.approvals.find((approval) => approval.id === openId)?.status).toBe("open");
    expect(held.goals).toHaveLength(1);
    expect(held.handoffs).toHaveLength(0);
    expect(held.handoffRules).toHaveLength(0);
    expect(held.messages.at(-1)?.text).toContain("Cleared the one handoff rule for a delete");
    expect(held.messages.at(-1)?.text).toContain("did not approve a hold");

    await withBridge(200, { summary: "Ready.", points: [], stance: "" }, async (url, hits) => {
      let state = setConnector(initialState(), "grok", { bridgeUrl: url, token: "bridge-secret-xyz" }, deps);
      state = setPaused(state, true, deps);
      state = setHandoffRule(state, "delete", true, deps);
      state = setHandoffRule(state, "send", true, deps);
      state = setHandoffRule(state, "pay", true, deps);
      state = await convene(state, "Stop handing notes to me", undefined, deps);
      expect(state.handoffRules).toHaveLength(3);
      expect(state.goals).toHaveLength(0);
      expect(state.messages.at(-1)?.text).toContain("did not clear a rule");
      expect(hits).toHaveLength(0);
      state = await convene(state, "Stop handing the weekly close to me", undefined, deps);
      expect(state.handoffRules).toHaveLength(3);
      expect(state.goals).toHaveLength(1);
      expect(state.handoffs).toHaveLength(0);
      expect(state.approvals).toHaveLength(0);
      state = await convene(state, "Stop handing deletions to me and delete them", undefined, deps);
      expect(state.handoffRules.map((rule) => rule.action).sort()).toEqual(["delete", "pay", "send"]);
      const deleting = state.goals.at(-1)?.id;
      expect(state.handoffs.filter((item) => item.goalId === deleting && item.status === "open")).toHaveLength(1);
      expect(state.approvals.filter((approval) => approval.goalId === deleting)).toHaveLength(0);
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);
      expect(state.messages.some((message) => message.text.includes("I deleted"))).toBe(false);
      state = await convene(state, "Do not delete the archive", undefined, deps);
      expect(state.handoffRules.map((rule) => rule.action).sort()).toEqual(["delete", "pay", "send"]);
      expect(state.handoffs.filter((item) => item.goalId === state.goals.at(-1)?.id)).toHaveLength(0);
      expect(voice(state)).toContain("ruled it out");
      const beforeClear = hits.length;
      state = await convene(state, "Please stop handing the deletions to me?", deleting, deps);
      expect(hits).toHaveLength(beforeClear);
      expect(state.paused).toBe(true);
      expect(state.handoffRules.map((rule) => rule.action).sort()).toEqual(["pay", "send"]);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(1);
      expect(state.goals.find((goal) => goal.id === deleting)?.status).toBe("waiting");
      expect(state.messages.at(-1)?.text).toContain("no longer handed to you by that rule");
      state = await convene(state, "Don't hand the payment to you", undefined, deps);
      expect(state.handoffRules.map((rule) => rule.action)).toEqual(["send"]);
      state = await convene(state, "Do not hand sends to me", undefined, deps);
      expect(state.handoffRules).toHaveLength(0);
      expect(hits).toHaveLength(beforeClear);
      state = await convene(state, clear, undefined, deps);
      expect(state.handoffRules).toHaveLength(0);
      expect(state.messages.at(-1)?.text).toContain("no handoff rule");
      state = await convene(state, "Hand deletions that mention shared project files to me", undefined, deps);
      state = await convene(state, "Stop handing deletions to me and delete the shared project files", undefined, deps);
      expect(state.handoffRules[0]?.phrase).toBe("shared project files");
      const named = state.goals.at(-1)?.id;
      expect(state.handoffs.filter((item) => item.goalId === named && item.status === "open")).toHaveLength(1);
      expect(state.approvals.filter((approval) => approval.goalId === named)).toHaveLength(0);
      state = await convene(state, "Delete the archive", undefined, deps);
      const latest = state.goals.at(-1)?.id;
      expect(state.approvals.filter((approval) => approval.goalId === latest && approval.status === "open" && approval.kind === "delete")).toHaveLength(1);
      expect(state.handoffs.filter((item) => item.goalId === latest)).toHaveLength(0);
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("bridge-secret-xyz");
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("Always allow");
    });
  });

  it("ORIEL-F29 a cleared whole rule keeps client work off Muse", async () => {
    const muse = await startLocalSeat({ seat: "muse", token: "tok-muse" });
    const grok = await startLocalSeat({ seat: "grok", token: "tok-grok" });
    try {
      let state = setConnector(initialState(), "muse", { bridgeUrl: muse.url, token: "tok-muse" }, deps);
      state = setConnector(state, "grok", { bridgeUrl: grok.url, token: "tok-grok" }, deps);
      state = setHandoffRule(state, "delete", true, deps);
      state = await convene(state, "Stop handing deletions to me", undefined, deps);
      expect(muse.hits()).toBe(0);
      expect(grok.hits()).toBe(0);
      expect(state.handoffRules).toHaveLength(0);
      expect(state.goals).toHaveLength(0);
      state = await convene(state, "Delete the client files for the matter", undefined, deps);
      expect(muse.hits()).toBe(0);
      expect(grok.hits()).toBe(1);
      expect(state.handoffs).toHaveLength(0);
      expect(state.approvals.filter((approval) => approval.status === "open" && approval.kind === "delete")).toHaveLength(1);
      expect(state.goals.at(-1)?.brief.seatReads.some((note) => note.seat === "muse")).toBe(false);
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
    } finally {
      await muse.close();
      await grok.close();
    }
  });

  it("ORIEL-F29 a woken deletion is held after the sentence clears the whole rule", async () => {
    const early: Deps = { ...deps, now: () => new Date("2026-10-23T12:00:00.000Z") };
    const wakeAt = new Date("2026-10-23T13:00:00.000Z");
    await withBridge(200, { summary: "Ready.", points: [], stance: "" }, async (url, hits) => {
      let state = setConnector(initialState(), "dots", { bridgeUrl: url, token: "bridge-secret-xyz" }, early);
      state = setHandoffRule(state, "delete", true, early);
      state = await convene(state, "Delete the archive", undefined, early);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(1);
      state = saveRoutine(state, state.goals[0]?.id ?? "", "Archive", early);
      state = setRoutineCadence(state, state.routines[0]?.id ?? "", "hourly", early);
      state = await convene(state, "Stop handing deletions to me", undefined, early);
      expect(state.handoffRules).toHaveLength(0);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(1);
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
      state = await wakeDue(state, { ...deps, now: () => wakeAt });
      expect(state.goals).toHaveLength(2);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(1);
      expect(state.approvals.filter((approval) => approval.status === "open" && approval.kind === "delete")).toHaveLength(1);
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);
      expect(state.messages.some((message) => message.text.includes("I deleted"))).toBe(false);
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("Always allow");
    });
  });

  it("ORIEL-F30 a sentence reads each handoff rule and does not act", async () => {
    await expect(convene(initialState(), "What is handed to me without asking", undefined, deps)).rejects.toThrow(/without asking/);
    await expect(convene(initialState(), "What is handed to me always allow", undefined, deps)).rejects.toThrow(/without asking/);

    const none = await convene(initialState(), "What is handed to me?", undefined, deps);
    expect(none.handoffRules).toHaveLength(0);
    expect(none.goals).toHaveLength(0);
    expect(none.handoffs).toHaveLength(0);
    expect(none.approvals).toHaveLength(0);
    expect(none.messages.at(-1)?.text).toContain("Nothing is handed to you");
    expect(none.messages.at(-1)?.text).toContain("no handoff rule");
    expect(none.messages.at(-1)?.text).toContain("did not open a card");
    expect(none.events.some((event) => event.type === "rule_read")).toBe(true);
    expect(none.events.some((event) => event.type === "rule_saved" || event.type === "rule_cleared" || event.type === "approved")).toBe(false);

    const repeated = await convene(none, "What's handed over to me", undefined, deps);
    expect(repeated.goals).toHaveLength(0);
    expect(repeated.handoffRules).toHaveLength(0);
    expect(repeated.messages.at(-1)?.text).toContain("Nothing is handed to you");

    let held = await convene(initialState(), "Email Maya the launch update", undefined, deps);
    const openId = held.approvals[0]?.id ?? "";
    const goalId = held.goals[0]?.id ?? "";
    held = setHandoffRule(held, "delete", true, deps);
    const deleteId = held.handoffRules[0]?.id ?? "";
    held = await convene(held, "Please, what is handed to me?", goalId, deps, "skill_missing");
    expect(held.approvals.find((approval) => approval.id === openId)?.status).toBe("open");
    expect(held.goals).toHaveLength(1);
    expect(held.goals[0]?.status).toBe("waiting");
    expect(held.handoffs).toHaveLength(0);
    expect(held.handoffRules).toHaveLength(1);
    expect(held.handoffRules[0]?.id).toBe(deleteId);
    expect(held.handoffRules[0]?.phrase).toBeNull();
    expect(held.messages.at(-1)?.text).toContain("This step is handed to you");
    expect(held.messages.at(-1)?.text).toContain("the whole deletion");
    expect(held.messages.at(-1)?.text).toContain("did not approve a hold");
    expect(held.messages.at(-1)?.text).not.toContain("Nothing is handed to you");

    const early: Deps = { ...deps, now: () => new Date("2026-10-23T12:00:00.000Z") };
    let parked = await convene(initialState(), "Draft the weekly close", undefined, early);
    parked = saveRoutine(parked, parked.goals[0]?.id ?? "", "Close", early);
    parked = setRoutineCadence(parked, parked.routines[0]?.id ?? "", "hourly", early);
    const nextRun = parked.routines[0]?.nextRunAt;
    parked = setPaused(parked, true, early);
    parked = setHandoffRule(parked, "delete", true, early);
    parked = await convene(parked, "What is handed to me?", undefined, { ...deps, now: () => new Date("2026-10-23T13:30:00.000Z") });
    expect(parked.paused).toBe(true);
    expect(parked.routines[0]?.nextRunAt).toBe(nextRun);
    expect(parked.events.some((event) => event.type === "woke" || event.type === "approved")).toBe(false);
    expect(parked.messages.at(-1)?.text).toContain("the whole deletion");

    await withBridge(200, { summary: "Ready.", points: [], stance: "" }, async (url, hits) => {
      let state = setConnector(initialState(), "grok", { bridgeUrl: url, token: "bridge-secret-xyz" }, deps);
      state = setPaused(state, true, deps);
      state = await convene(state, "Hand deletions that mention shared project files to me", undefined, deps);
      state = setHandoffRule(state, "send", true, deps);
      state = setHandoffRule(state, "pay", true, deps, "the vendor invoice");
      const ids = state.handoffRules.map((rule) => rule.id);
      expect(ids).toHaveLength(3);
      state = await convene(state, "Which steps are handed to me?", undefined, deps);
      expect(hits).toHaveLength(0);
      expect(state.paused).toBe(true);
      expect(state.goals).toHaveLength(0);
      expect(state.handoffs).toHaveLength(0);
      expect(state.approvals).toHaveLength(0);
      expect(state.handoffRules.map((rule) => rule.id)).toEqual(ids);
      expect(state.messages.at(-1)?.text).toContain("These steps are handed to you");
      expect(state.messages.at(-1)?.text).toContain("The send is the whole send");
      expect(state.messages.at(-1)?.text).toContain("only “the vendor invoice”");
      expect(state.messages.at(-1)?.text).toContain("only “shared project files”");
      expect(state.messages.at(-1)?.text).not.toContain("the whole deletion");
      expect(state.messages.at(-1)?.text).toContain("did not approve a hold");
      const beforeAct = state.goals.length;
      state = await convene(state, "What is handed to me and delete the archive", undefined, deps);
      expect(state.goals.length).toBe(beforeAct + 1);
      expect(state.handoffRules.map((rule) => rule.id)).toEqual(ids);
      const archive = state.goals.at(-1)?.id;
      expect(state.approvals.filter((approval) => approval.goalId === archive && approval.status === "open" && approval.kind === "delete")).toHaveLength(1);
      expect(state.handoffs.filter((item) => item.goalId === archive)).toHaveLength(0);
      expect(state.messages.at(-1)?.text).not.toContain("These steps are handed to you");
      state = await convene(state, "What is handed to me and delete the shared project files", undefined, deps);
      const named = state.goals.at(-1)?.id;
      expect(state.handoffs.filter((item) => item.goalId === named && item.status === "open")).toHaveLength(1);
      expect(state.approvals.filter((approval) => approval.goalId === named)).toHaveLength(0);
      expect(state.handoffRules.map((rule) => rule.id)).toEqual(ids);
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);
      expect(state.messages.some((message) => message.text.includes("I deleted"))).toBe(false);
      const beforeOrdinary = state.handoffRules.map((rule) => `${rule.id}:${rule.phrase ?? ""}`);
      state = await convene(state, "Hand deletions to me", undefined, deps);
      expect(state.goals.length).toBe(3);
      expect(state.handoffRules.map((rule) => `${rule.id}:${rule.phrase ?? ""}`)).toEqual(beforeOrdinary);
      expect(state.messages.at(-1)?.text).not.toContain("These steps are handed to you");
      expect(state.messages.at(-1)?.text).not.toContain("Nothing is handed to you");
      expect(hits).toHaveLength(3);
      expect(hits.every((hit) => hit.raw.includes('"action":"convene"'))).toBe(true);
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("bridge-secret-xyz");
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("Always allow");
    });
  });

  it("ORIEL-F30 reading the rules keeps client work off Muse", async () => {
    const muse = await startLocalSeat({ seat: "muse", token: "tok-muse" });
    const grok = await startLocalSeat({ seat: "grok", token: "tok-grok" });
    try {
      let state = setConnector(initialState(), "muse", { bridgeUrl: muse.url, token: "tok-muse" }, deps);
      state = setConnector(state, "grok", { bridgeUrl: grok.url, token: "tok-grok" }, deps);
      state = await convene(state, "Delete the client files for the matter", undefined, deps);
      expect(muse.hits()).toBe(0);
      expect(grok.hits()).toBe(1);
      state = setHandoffRule(state, "delete", true, deps);
      state = await convene(state, "What is handed to me?", undefined, deps);
      expect(muse.hits()).toBe(0);
      expect(grok.hits()).toBe(1);
      expect(state.goals).toHaveLength(1);
      expect(state.handoffRules[0]?.phrase).toBeNull();
      expect(state.messages.at(-1)?.text).toContain("the whole deletion");
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
    } finally {
      await muse.close();
      await grok.close();
    }
  });

  it("ORIEL-F31 a sentence asks about one handoff and does not act", async () => {
    await expect(convene(initialState(), "Is a deletion handed to me without asking", undefined, deps)).rejects.toThrow(/without asking/);
    await expect(convene(initialState(), "Is a deletion handed to me always allow", undefined, deps)).rejects.toThrow(/without asking/);

    const none = await convene(initialState(), "Is a deletion handed to me?", undefined, deps);
    expect(none.handoffRules).toHaveLength(0);
    expect(none.goals).toHaveLength(0);
    expect(none.handoffs).toHaveLength(0);
    expect(none.approvals).toHaveLength(0);
    expect(none.messages.at(-1)?.text).toContain("The deletion is not handed to you");
    expect(none.messages.at(-1)?.text).toContain("no handoff rule for a deletion");
    expect(none.messages.at(-1)?.text).toContain("named no other step");
    expect(none.messages.at(-1)?.text).toContain("did not open a card");
    expect(none.messages.at(-1)?.text).not.toContain("Nothing is handed to you");
    expect(none.events.some((event) => event.type === "rule_read")).toBe(true);
    expect(none.events.some((event) => event.type === "rule_saved" || event.type === "rule_cleared" || event.type === "approved")).toBe(false);

    const unknown = await convene(none, "Is a note handed to me?", undefined, deps);
    expect(unknown.goals).toHaveLength(0);
    expect(unknown.handoffRules).toHaveLength(0);
    expect(unknown.messages.at(-1)?.text).toContain("does not name a send");
    expect(unknown.messages.at(-1)?.text).toContain("did not open a card");
    expect(unknown.events.at(-1)?.type).toBe("rule_ignored");

    let held = await convene(initialState(), "Email Maya the launch update", undefined, deps);
    const openId = held.approvals[0]?.id ?? "";
    const goalId = held.goals[0]?.id ?? "";
    held = setHandoffRule(held, "delete", true, deps);
    held = setHandoffRule(held, "send", true, deps);
    held = setHandoffRule(held, "pay", true, deps, "the vendor invoice");
    const ids = held.handoffRules.map((rule) => rule.id);
    held = await convene(held, "Please, is the deletion handed to me?", goalId, deps, "skill_missing");
    expect(held.approvals.find((approval) => approval.id === openId)?.status).toBe("open");
    expect(held.goals).toHaveLength(1);
    expect(held.goals[0]?.status).toBe("waiting");
    expect(held.handoffs).toHaveLength(0);
    expect(held.handoffRules.map((rule) => rule.id)).toEqual(ids);
    expect(held.messages.at(-1)?.text).toContain("The deletion is handed to you");
    expect(held.messages.at(-1)?.text).toContain("the whole deletion");
    expect(held.messages.at(-1)?.text).toContain("named no other step");
    expect(held.messages.at(-1)?.text).not.toContain("the whole send");
    expect(held.messages.at(-1)?.text).not.toContain("the vendor invoice");
    expect(held.messages.at(-1)?.text).not.toContain("These steps are handed to you");
    expect(held.messages.at(-1)?.text).toContain("did not approve a hold");

    const every = await convene(held, "What is handed to me?", undefined, deps);
    expect(every.goals).toHaveLength(1);
    expect(every.handoffRules.map((rule) => rule.id)).toEqual(ids);
    expect(every.messages.at(-1)?.text).toContain("These steps are handed to you");
    expect(every.messages.at(-1)?.text).toContain("the whole deletion");
    expect(every.messages.at(-1)?.text).toContain("the whole send");
    expect(every.messages.at(-1)?.text).toContain("only “the vendor invoice”");
    expect(every.approvals.find((approval) => approval.id === openId)?.status).toBe("open");

    const missed = await convene(every, "Is a payment handed over to you", undefined, deps);
    expect(missed.messages.at(-1)?.text).toContain("The payment is handed to you");
    expect(missed.messages.at(-1)?.text).toContain("only “the vendor invoice”");
    expect(missed.messages.at(-1)?.text).not.toContain("the whole deletion");
    expect(missed.messages.at(-1)?.text).not.toContain("the whole send");
    expect(missed.handoffRules.map((rule) => rule.id)).toEqual(ids);

    const early: Deps = { ...deps, now: () => new Date("2026-10-23T12:00:00.000Z") };
    let parked = await convene(initialState(), "Draft the weekly close", undefined, early);
    parked = saveRoutine(parked, parked.goals[0]?.id ?? "", "Close", early);
    parked = setRoutineCadence(parked, parked.routines[0]?.id ?? "", "hourly", early);
    const nextRun = parked.routines[0]?.nextRunAt;
    parked = setPaused(parked, true, early);
    parked = setHandoffRule(parked, "post", true, early);
    parked = await convene(parked, "Are posts handed to me?", undefined, { ...deps, now: () => new Date("2026-10-23T13:30:00.000Z") });
    expect(parked.paused).toBe(true);
    expect(parked.routines[0]?.nextRunAt).toBe(nextRun);
    expect(parked.events.some((event) => event.type === "woke" || event.type === "approved")).toBe(false);
    expect(parked.messages.at(-1)?.text).toContain("The public post is handed to you");
    expect(parked.messages.at(-1)?.text).toContain("the whole public post");

    await withBridge(200, { summary: "Ready.", points: [], stance: "" }, async (url, hits) => {
      let state = setConnector(initialState(), "grok", { bridgeUrl: url, token: "bridge-secret-xyz" }, deps);
      state = setPaused(state, true, deps);
      state = await convene(state, "Hand deletions that mention shared project files to me", undefined, deps);
      state = setHandoffRule(state, "send", true, deps);
      const before = state.handoffRules.map((rule) => `${rule.id}:${rule.phrase ?? ""}`);
      state = await convene(state, "Is the deletion handed off to me?", undefined, deps);
      expect(hits).toHaveLength(0);
      expect(state.paused).toBe(true);
      expect(state.goals).toHaveLength(0);
      expect(state.handoffs).toHaveLength(0);
      expect(state.approvals).toHaveLength(0);
      expect(state.handoffRules.map((rule) => `${rule.id}:${rule.phrase ?? ""}`)).toEqual(before);
      expect(state.messages.at(-1)?.text).toContain("only “shared project files”");
      expect(state.messages.at(-1)?.text).not.toContain("the whole deletion");
      expect(state.messages.at(-1)?.text).not.toContain("the whole send");
      expect(state.messages.at(-1)?.text).toContain("named no other step");
      state = await convene(state, "Is a send handed to me?", undefined, deps);
      expect(state.messages.at(-1)?.text).toContain("the whole send");
      expect(state.messages.at(-1)?.text).not.toContain("shared project files");
      expect(hits).toHaveLength(0);
      state = await convene(state, "Is a deletion handed to me and delete the archive", undefined, deps);
      expect(state.handoffRules.map((rule) => `${rule.id}:${rule.phrase ?? ""}`)).toEqual(before);
      const archive = state.goals.at(-1)?.id;
      expect(state.approvals.filter((approval) => approval.goalId === archive && approval.status === "open" && approval.kind === "delete")).toHaveLength(1);
      expect(state.handoffs.filter((item) => item.goalId === archive)).toHaveLength(0);
      expect(state.messages.at(-1)?.text).not.toContain("named no other step");
      state = await convene(state, "Is a deletion handed to me and delete the shared project files", undefined, deps);
      const named = state.goals.at(-1)?.id;
      expect(state.handoffs.filter((item) => item.goalId === named && item.status === "open")).toHaveLength(1);
      expect(state.approvals.filter((approval) => approval.goalId === named)).toHaveLength(0);
      expect(state.handoffRules.map((rule) => `${rule.id}:${rule.phrase ?? ""}`)).toEqual(before);
      expect(state.messages.at(-1)?.text).not.toContain("named no other step");
      const beforeOrdinary = state.goals.length;
      state = await convene(state, "Hand deletions to me", undefined, deps);
      expect(state.goals.length).toBe(beforeOrdinary + 1);
      expect(state.handoffRules.map((rule) => `${rule.id}:${rule.phrase ?? ""}`)).toEqual(before);
      expect(state.messages.at(-1)?.text).not.toContain("named no other step");
      expect(state.messages.at(-1)?.text).not.toContain("The deletion is not handed to you");
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);
      expect(hits.every((hit) => hit.raw.includes('"action":"convene"'))).toBe(true);
      expect(state.messages.some((message) => message.text.includes("I deleted"))).toBe(false);
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("bridge-secret-xyz");
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("Always allow");
    });
  });

  it("ORIEL-F31 asking about one rule keeps client work off Muse", async () => {
    const muse = await startLocalSeat({ seat: "muse", token: "tok-muse" });
    const grok = await startLocalSeat({ seat: "grok", token: "tok-grok" });
    try {
      let state = setConnector(initialState(), "muse", { bridgeUrl: muse.url, token: "tok-muse" }, deps);
      state = setConnector(state, "grok", { bridgeUrl: grok.url, token: "tok-grok" }, deps);
      state = setHandoffRule(state, "delete", true, deps);
      state = setHandoffRule(state, "send", true, deps);
      state = await convene(state, "Is a deletion handed to me?", undefined, deps);
      expect(muse.hits()).toBe(0);
      expect(grok.hits()).toBe(0);
      expect(state.goals).toHaveLength(0);
      expect(state.messages.at(-1)?.text).toContain("the whole deletion");
      expect(state.messages.at(-1)?.text).not.toContain("the whole send");
      state = await convene(state, "Delete the client files for the matter", undefined, deps);
      expect(muse.hits()).toBe(0);
      expect(grok.hits()).toBe(1);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(1);
      expect(state.approvals).toHaveLength(0);
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
    } finally {
      await muse.close();
      await grok.close();
    }
  });

  it("ORIEL-F31 a woken deletion still follows the rule the question did not change", async () => {
    const early: Deps = { ...deps, now: () => new Date("2026-10-23T12:00:00.000Z") };
    const wakeAt = new Date("2026-10-23T13:00:00.000Z");
    await withBridge(200, { summary: "Ready.", points: [], stance: "" }, async (url, hits) => {
      let state = setConnector(initialState(), "dots", { bridgeUrl: url, token: "bridge-secret-xyz" }, early);
      state = setHandoffRule(state, "delete", true, early);
      state = await convene(state, "Delete the archive", undefined, early);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(1);
      state = saveRoutine(state, state.goals[0]?.id ?? "", "Archive", early);
      state = setRoutineCadence(state, state.routines[0]?.id ?? "", "hourly", early);
      state = await convene(state, "Is a deletion handed to me?", undefined, early);
      expect(state.handoffRules).toHaveLength(1);
      expect(state.handoffRules[0]?.phrase).toBeNull();
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(1);
      expect(state.messages.at(-1)?.text).toContain("the whole deletion");
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
      state = await wakeDue(state, { ...deps, now: () => wakeAt });
      expect(state.goals).toHaveLength(2);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(2);
      expect(state.approvals.filter((approval) => approval.status === "open" && approval.kind === "delete")).toHaveLength(0);
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);
      expect(state.messages.some((message) => message.text.includes("I deleted"))).toBe(false);
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("Always allow");
    });
  });

  it("ORIEL-F32 a sentence asks whether the saved words are the ones and does not act", async () => {
    await expect(
      convene(initialState(), "Is a deletion that mentions shared project files handed to me without asking", undefined, deps),
    ).rejects.toThrow(/without asking/);
    await expect(
      convene(initialState(), "Is a deletion that mentions shared project files handed to me always allow", undefined, deps),
    ).rejects.toThrow(/without asking/);
    await expect(convene(initialState(), "Is a deletion that mentions ab handed to me?", undefined, deps)).rejects.toThrow(/short phrase/);
    await expect(
      convene(initialState(), "Is a deletion that mentions always allow the files handed to me?", undefined, deps),
    ).rejects.toThrow(/short phrase/);

    const none = await convene(initialState(), "Is a deletion that mentions shared project files handed to me?", undefined, deps);
    expect(none.handoffRules).toHaveLength(0);
    expect(none.goals).toHaveLength(0);
    expect(none.handoffs).toHaveLength(0);
    expect(none.approvals).toHaveLength(0);
    expect(none.messages.at(-1)?.text).toContain("The deletion is not handed to you");
    expect(none.messages.at(-1)?.text).toContain("no handoff rule for a deletion that mentions “shared project files”");
    expect(none.messages.at(-1)?.text).toContain("named no other step");
    expect(none.messages.at(-1)?.text).toContain("did not open a card");
    expect(none.messages.at(-1)?.text).not.toContain("Nothing is handed to you");
    expect(none.messages.at(-1)?.text).not.toContain("has no such words");
    expect(none.events.some((event) => event.type === "rule_read")).toBe(true);
    expect(none.events.some((event) => event.type === "rule_saved" || event.type === "rule_cleared" || event.type === "approved")).toBe(false);

    const unknown = await convene(none, "Is a note that mentions shared project files handed to me?", undefined, deps);
    expect(unknown.goals).toHaveLength(0);
    expect(unknown.handoffRules).toHaveLength(0);
    expect(unknown.messages.at(-1)?.text).toContain("does not name a send");
    expect(unknown.messages.at(-1)?.text).toContain("did not open a card");
    expect(unknown.events.at(-1)?.type).toBe("rule_ignored");

    let held = await convene(initialState(), "Email Maya the launch update", undefined, deps);
    const openId = held.approvals[0]?.id ?? "";
    const goalId = held.goals[0]?.id ?? "";
    held = setHandoffRule(held, "delete", true, deps);
    held = setHandoffRule(held, "send", true, deps);
    held = setHandoffRule(held, "pay", true, deps, "the vendor invoice");
    const ids = held.handoffRules.map((rule) => rule.id);
    held = await convene(
      held,
      "Please, is a deletion that mentions shared project files handed to me?",
      goalId,
      deps,
      "skill_missing",
    );
    expect(held.approvals.find((approval) => approval.id === openId)?.status).toBe("open");
    expect(held.goals).toHaveLength(1);
    expect(held.goals[0]?.status).toBe("waiting");
    expect(held.handoffs).toHaveLength(0);
    expect(held.handoffRules.map((rule) => rule.id)).toEqual(ids);
    expect(held.handoffRules.find((rule) => rule.action === "delete")?.phrase).toBeNull();
    expect(held.messages.at(-1)?.text).toContain("The deletion is handed to you");
    expect(held.messages.at(-1)?.text).toContain("has no such words");
    expect(held.messages.at(-1)?.text).toContain("did not treat this question as the whole deletion");
    expect(held.messages.at(-1)?.text).toContain("did not treat “shared project files” as the rule");
    expect(held.messages.at(-1)?.text).not.toContain("is the whole deletion");
    expect(held.messages.at(-1)?.text).not.toContain("is only");
    expect(held.messages.at(-1)?.text).not.toContain("the whole send");
    expect(held.messages.at(-1)?.text).not.toContain("the vendor invoice");
    expect(held.messages.at(-1)?.text).not.toContain("These steps are handed to you");
    expect(held.messages.at(-1)?.text).toContain("named no other step");
    expect(held.messages.at(-1)?.text).toContain("did not approve a hold");

    const bare = await convene(held, "Is a deletion handed to me?", undefined, deps);
    expect(bare.goals).toHaveLength(1);
    expect(bare.handoffRules.map((rule) => rule.id)).toEqual(ids);
    expect(bare.messages.at(-1)?.text).toContain("the whole deletion");
    expect(bare.messages.at(-1)?.text).toContain("is the whole deletion");
    expect(bare.messages.at(-1)?.text).not.toContain("has no such words");
    expect(bare.messages.at(-1)?.text).not.toContain("the whole send");
    expect(bare.messages.at(-1)?.text).not.toContain("the vendor invoice");
    expect(bare.approvals.find((approval) => approval.id === openId)?.status).toBe("open");

    const every = await convene(bare, "What is handed to me?", undefined, deps);
    expect(every.goals).toHaveLength(1);
    expect(every.handoffRules.map((rule) => rule.id)).toEqual(ids);
    expect(every.messages.at(-1)?.text).toContain("These steps are handed to you");
    expect(every.messages.at(-1)?.text).toContain("the whole deletion");
    expect(every.messages.at(-1)?.text).toContain("the whole send");
    expect(every.messages.at(-1)?.text).toContain("only “the vendor invoice”");

    let named = setHandoffRule(every, "delete", true, deps, "shared project files");
    const namedIds = named.handoffRules.map((rule) => `${rule.action}:${rule.phrase ?? ""}`);
    named = await convene(
      named,
      "Are deletions that mention “Shared Project Files” handed over to you?",
      undefined,
      deps,
    );
    expect(named.handoffRules.map((rule) => `${rule.action}:${rule.phrase ?? ""}`)).toEqual(namedIds);
    expect(named.goals).toHaveLength(1);
    expect(named.messages.at(-1)?.text).toContain("only “shared project files”");
    expect(named.messages.at(-1)?.text).toContain("named no other step");
    expect(named.messages.at(-1)?.text).not.toContain("has no such words");
    expect(named.messages.at(-1)?.text).not.toContain("The saved words are");
    expect(named.messages.at(-1)?.text).not.toContain("the whole deletion");
    expect(named.messages.at(-1)?.text).not.toContain("the whole send");
    expect(named.messages.at(-1)?.text).not.toContain("the vendor invoice");

    const otherWords = await convene(named, "Is a deletion that mentions unshared project files handed to me?", undefined, deps);
    expect(otherWords.handoffRules.map((rule) => `${rule.action}:${rule.phrase ?? ""}`)).toEqual(namedIds);
    expect(otherWords.messages.at(-1)?.text).toContain("The saved words are “shared project files”");
    expect(otherWords.messages.at(-1)?.text).toContain("Those are not “unshared project files”");
    expect(otherWords.messages.at(-1)?.text).not.toContain("only “unshared project files”");
    expect(otherWords.messages.at(-1)?.text).not.toContain("is only");
    expect(otherWords.messages.at(-1)?.text).not.toContain("the whole send");
    expect(otherWords.messages.at(-1)?.text).not.toContain("has no such words");
    expect(otherWords.goals).toHaveLength(1);

    const early: Deps = { ...deps, now: () => new Date("2026-10-23T12:00:00.000Z") };
    let parked = await convene(initialState(), "Draft the weekly close", undefined, early);
    parked = saveRoutine(parked, parked.goals[0]?.id ?? "", "Close", early);
    parked = setRoutineCadence(parked, parked.routines[0]?.id ?? "", "hourly", early);
    const nextRun = parked.routines[0]?.nextRunAt;
    parked = setPaused(parked, true, early);
    parked = setHandoffRule(parked, "delete", true, early, "shared project files");
    parked = setHandoffRule(parked, "post", true, early);
    parked = await convene(parked, "Is a deletion that mentions shared project files handed to me?", undefined, {
      ...deps,
      now: () => new Date("2026-10-23T13:30:00.000Z"),
    });
    expect(parked.paused).toBe(true);
    expect(parked.routines[0]?.nextRunAt).toBe(nextRun);
    expect(parked.events.some((event) => event.type === "woke" || event.type === "approved")).toBe(false);
    expect(parked.messages.at(-1)?.text).toContain("only “shared project files”");
    expect(parked.messages.at(-1)?.text).not.toContain("the whole public post");
    expect(parked.handoffRules.find((rule) => rule.action === "post")?.phrase).toBeNull();

    await withBridge(200, { summary: "Ready.", points: [], stance: "" }, async (url, hits) => {
      let state = setConnector(initialState(), "grok", { bridgeUrl: url, token: "bridge-secret-xyz" }, deps);
      state = setPaused(state, true, deps);
      state = await convene(state, "Hand deletions that mention shared project files to me", undefined, deps);
      state = setHandoffRule(state, "send", true, deps);
      const before = state.handoffRules.map((rule) => `${rule.id}:${rule.phrase ?? ""}`);
      state = await convene(state, "Is the deletion that mentions shared project files handed off to me?", undefined, deps);
      expect(hits).toHaveLength(0);
      expect(state.paused).toBe(true);
      expect(state.goals).toHaveLength(0);
      expect(state.handoffs).toHaveLength(0);
      expect(state.approvals).toHaveLength(0);
      expect(state.handoffRules.map((rule) => `${rule.id}:${rule.phrase ?? ""}`)).toEqual(before);
      expect(state.messages.at(-1)?.text).toContain("only “shared project files”");
      expect(state.messages.at(-1)?.text).not.toContain("the whole deletion");
      expect(state.messages.at(-1)?.text).not.toContain("the whole send");
      state = await convene(state, "Is a deletion handed to me?", undefined, deps);
      expect(state.messages.at(-1)?.text).toContain("only “shared project files”");
      expect(state.messages.at(-1)?.text).not.toContain("has no such words");
      expect(state.messages.at(-1)?.text).not.toContain("the whole send");
      state = await convene(state, "What is handed to me?", undefined, deps);
      expect(state.messages.at(-1)?.text).toContain("These steps are handed to you");
      expect(state.messages.at(-1)?.text).toContain("only “shared project files”");
      expect(state.messages.at(-1)?.text).toContain("the whole send");
      expect(hits).toHaveLength(0);
      state = await convene(state, "Is a deletion that mentions the vendor archive handed to me and delete the archive", undefined, deps);
      expect(state.handoffRules.map((rule) => `${rule.id}:${rule.phrase ?? ""}`)).toEqual(before);
      const archive = state.goals.at(-1)?.id;
      expect(state.approvals.filter((approval) => approval.goalId === archive && approval.status === "open" && approval.kind === "delete")).toHaveLength(1);
      expect(state.handoffs.filter((item) => item.goalId === archive)).toHaveLength(0);
      expect(state.messages.at(-1)?.text).not.toContain("named no other step");
      expect(state.messages.at(-1)?.text).not.toContain("has no such words");
      state = await convene(state, "Is a deletion that mentions shared project files handed to me and delete the shared project files", undefined, deps);
      const handed = state.goals.at(-1)?.id;
      expect(state.handoffs.filter((item) => item.goalId === handed && item.status === "open")).toHaveLength(1);
      expect(state.approvals.filter((approval) => approval.goalId === handed)).toHaveLength(0);
      expect(state.handoffRules.map((rule) => `${rule.id}:${rule.phrase ?? ""}`)).toEqual(before);
      expect(state.messages.at(-1)?.text).not.toContain("named no other step");
      const beforeOrdinary = state.goals.length;
      state = await convene(state, "Hand deletions to me", undefined, deps);
      expect(state.goals.length).toBe(beforeOrdinary + 1);
      expect(state.handoffRules.map((rule) => `${rule.id}:${rule.phrase ?? ""}`)).toEqual(before);
      expect(state.messages.at(-1)?.text).not.toContain("named no other step");
      expect(state.messages.at(-1)?.text).not.toContain("has no such words");
      expect(state.messages.at(-1)?.text).not.toContain("The saved words are");
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);
      expect(hits.every((hit) => hit.raw.includes('"action":"convene"'))).toBe(true);
      expect(state.messages.some((message) => message.text.includes("I deleted"))).toBe(false);
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("bridge-secret-xyz");
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("Always allow");
    });
  });

  it("ORIEL-F32 asking whether the words match keeps client work off Muse", async () => {
    const muse = await startLocalSeat({ seat: "muse", token: "tok-muse" });
    const grok = await startLocalSeat({ seat: "grok", token: "tok-grok" });
    try {
      let state = setConnector(initialState(), "muse", { bridgeUrl: muse.url, token: "tok-muse" }, deps);
      state = setConnector(state, "grok", { bridgeUrl: grok.url, token: "tok-grok" }, deps);
      state = setHandoffRule(state, "delete", true, deps, "shared project files");
      state = setHandoffRule(state, "send", true, deps);
      state = await convene(state, "Is a deletion that mentions shared project files handed to me?", undefined, deps);
      expect(muse.hits()).toBe(0);
      expect(grok.hits()).toBe(0);
      expect(state.goals).toHaveLength(0);
      expect(state.messages.at(-1)?.text).toContain("only “shared project files”");
      expect(state.messages.at(-1)?.text).not.toContain("the whole send");
      state = await convene(state, "Delete the client files for the shared project files", undefined, deps);
      expect(muse.hits()).toBe(0);
      expect(grok.hits()).toBe(1);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(1);
      expect(state.approvals).toHaveLength(0);
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
    } finally {
      await muse.close();
      await grok.close();
    }
  });

  it("ORIEL-F32 a woken deletion still follows the rule the question did not change", async () => {
    const early: Deps = { ...deps, now: () => new Date("2026-10-23T12:00:00.000Z") };
    const wakeAt = new Date("2026-10-23T13:00:00.000Z");
    await withBridge(200, { summary: "Ready.", points: [], stance: "" }, async (url, hits) => {
      let state = setConnector(initialState(), "dots", { bridgeUrl: url, token: "bridge-secret-xyz" }, early);
      state = setHandoffRule(state, "delete", true, early, "shared project files");
      state = await convene(state, "Delete the shared project files", undefined, early);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(1);
      const openId = state.handoffs[0]?.id ?? "";
      state = saveRoutine(state, state.goals[0]?.id ?? "", "Archive", early);
      state = setRoutineCadence(state, state.routines[0]?.id ?? "", "hourly", early);
      state = await convene(
        state,
        "Is a deletion that mentions the vendor archive handed to me?",
        state.goals[0]?.id,
        early,
        "skill_missing",
      );
      expect(state.handoffRules).toHaveLength(1);
      expect(state.handoffRules[0]?.phrase).toBe("shared project files");
      expect(state.handoffs.find((item) => item.id === openId)?.status).toBe("open");
      expect(state.messages.at(-1)?.text).toContain("The saved words are “shared project files”");
      expect(state.messages.at(-1)?.text).toContain("Those are not “the vendor archive”");
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
      state = await wakeDue(state, { ...deps, now: () => wakeAt });
      expect(state.goals).toHaveLength(2);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(2);
      expect(state.approvals.filter((approval) => approval.status === "open" && approval.kind === "delete")).toHaveLength(0);
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);
      expect(state.messages.some((message) => message.text.includes("I deleted"))).toBe(false);
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("Always allow");
    });
  });

  it("ORIEL-F33 a sentence asks which words a step uses and does not act", async () => {
    await expect(convene(initialState(), "Which words does a deletion hand to me without asking", undefined, deps)).rejects.toThrow(
      /without asking/,
    );
    await expect(convene(initialState(), "Which words does a deletion hand to me always allow", undefined, deps)).rejects.toThrow(
      /without asking/,
    );

    const none = await convene(initialState(), "Which words does a deletion hand to me?", undefined, deps);
    expect(none.handoffRules).toHaveLength(0);
    expect(none.goals).toHaveLength(0);
    expect(none.handoffs).toHaveLength(0);
    expect(none.approvals).toHaveLength(0);
    expect(none.messages.at(-1)?.text).toContain("The deletion is not handed to you");
    expect(none.messages.at(-1)?.text).toContain("no handoff rule for a deletion");
    expect(none.messages.at(-1)?.text).toContain("named no other step");
    expect(none.messages.at(-1)?.text).toContain("did not open a card");
    expect(none.messages.at(-1)?.text).not.toContain("names no words");
    expect(none.messages.at(-1)?.text).not.toContain("Nothing is handed to you");
    expect(none.messages.at(-1)?.text).not.toContain("The words are");
    expect(none.events.some((event) => event.type === "rule_read")).toBe(true);
    expect(none.events.some((event) => event.type === "rule_saved" || event.type === "rule_cleared" || event.type === "approved")).toBe(false);

    const unknown = await convene(none, "Which words does a note hand to me?", undefined, deps);
    expect(unknown.goals).toHaveLength(0);
    expect(unknown.handoffRules).toHaveLength(0);
    expect(unknown.messages.at(-1)?.text).toContain("does not name a send");
    expect(unknown.messages.at(-1)?.text).toContain("did not open a card");
    expect(unknown.events.at(-1)?.type).toBe("rule_ignored");

    let held = await convene(initialState(), "Email Maya the launch update", undefined, deps);
    const openId = held.approvals[0]?.id ?? "";
    const goalId = held.goals[0]?.id ?? "";
    held = setHandoffRule(held, "delete", true, deps);
    held = setHandoffRule(held, "send", true, deps);
    held = setHandoffRule(held, "pay", true, deps, "the vendor invoice");
    const ids = held.handoffRules.map((rule) => rule.id);
    held = await convene(held, "Please, which words does the deletion hand to me?", goalId, deps, "skill_missing");
    expect(held.approvals.find((approval) => approval.id === openId)?.status).toBe("open");
    expect(held.goals).toHaveLength(1);
    expect(held.goals[0]?.status).toBe("waiting");
    expect(held.handoffs).toHaveLength(0);
    expect(held.handoffRules.map((rule) => rule.id)).toEqual(ids);
    expect(held.handoffRules.find((rule) => rule.action === "delete")?.phrase).toBeNull();
    expect(held.messages.at(-1)?.text).toContain("The deletion is handed to you");
    expect(held.messages.at(-1)?.text).toContain("names no words");
    expect(held.messages.at(-1)?.text).toContain("is the whole deletion");
    expect(held.messages.at(-1)?.text).not.toContain("The words are");
    expect(held.messages.at(-1)?.text).not.toContain("the whole send");
    expect(held.messages.at(-1)?.text).not.toContain("the vendor invoice");
    expect(held.messages.at(-1)?.text).not.toContain("These steps are handed to you");
    expect(held.messages.at(-1)?.text).toContain("named no other step");
    expect(held.messages.at(-1)?.text).toContain("did not approve a hold");

    const bare = await convene(held, "Is a deletion handed to me?", undefined, deps);
    expect(bare.goals).toHaveLength(1);
    expect(bare.handoffRules.map((rule) => rule.id)).toEqual(ids);
    expect(bare.messages.at(-1)?.text).toContain("is the whole deletion");
    expect(bare.messages.at(-1)?.text).not.toContain("names no words");
    expect(bare.messages.at(-1)?.text).not.toContain("the whole send");
    expect(bare.messages.at(-1)?.text).not.toContain("the vendor invoice");
    expect(bare.approvals.find((approval) => approval.id === openId)?.status).toBe("open");

    const every = await convene(bare, "What is handed to me?", undefined, deps);
    expect(every.goals).toHaveLength(1);
    expect(every.handoffRules.map((rule) => rule.id)).toEqual(ids);
    expect(every.messages.at(-1)?.text).toContain("These steps are handed to you");
    expect(every.messages.at(-1)?.text).toContain("the whole deletion");
    expect(every.messages.at(-1)?.text).toContain("the whole send");
    expect(every.messages.at(-1)?.text).toContain("only “the vendor invoice”");

    let named = setHandoffRule(every, "delete", true, deps, "shared project files");
    const namedIds = named.handoffRules.map((rule) => `${rule.action}:${rule.phrase ?? ""}`);
    named = await convene(named, "Which words do deletions hand off to you?", undefined, deps);
    expect(named.handoffRules.map((rule) => `${rule.action}:${rule.phrase ?? ""}`)).toEqual(namedIds);
    expect(named.goals).toHaveLength(1);
    expect(named.messages.at(-1)?.text).toContain("The words are “shared project files”");
    expect(named.messages.at(-1)?.text).toContain("named no other step");
    expect(named.messages.at(-1)?.text).not.toContain("names no words");
    expect(named.messages.at(-1)?.text).not.toContain("The saved words are");
    expect(named.messages.at(-1)?.text).not.toContain("is only");
    expect(named.messages.at(-1)?.text).not.toContain("the whole deletion");
    expect(named.messages.at(-1)?.text).not.toContain("the whole send");
    expect(named.messages.at(-1)?.text).not.toContain("the vendor invoice");

    const matched = await convene(named, "Is a deletion that mentions shared project files handed to me?", undefined, deps);
    expect(matched.handoffRules.map((rule) => `${rule.action}:${rule.phrase ?? ""}`)).toEqual(namedIds);
    expect(matched.messages.at(-1)?.text).toContain("only “shared project files”");
    expect(matched.messages.at(-1)?.text).not.toContain("The words are");
    expect(matched.messages.at(-1)?.text).not.toContain("names no words");
    expect(matched.messages.at(-1)?.text).not.toContain("the whole send");
    expect(matched.goals).toHaveLength(1);

    const early: Deps = { ...deps, now: () => new Date("2026-10-23T12:00:00.000Z") };
    let parked = await convene(initialState(), "Draft the weekly close", undefined, early);
    parked = saveRoutine(parked, parked.goals[0]?.id ?? "", "Close", early);
    parked = setRoutineCadence(parked, parked.routines[0]?.id ?? "", "hourly", early);
    const nextRun = parked.routines[0]?.nextRunAt;
    parked = setPaused(parked, true, early);
    parked = setHandoffRule(parked, "delete", true, early, "shared project files");
    parked = setHandoffRule(parked, "post", true, early);
    parked = await convene(parked, "Which words does a deletion hand over to me?", undefined, {
      ...deps,
      now: () => new Date("2026-10-23T13:30:00.000Z"),
    });
    expect(parked.paused).toBe(true);
    expect(parked.routines[0]?.nextRunAt).toBe(nextRun);
    expect(parked.events.some((event) => event.type === "woke" || event.type === "approved")).toBe(false);
    expect(parked.messages.at(-1)?.text).toContain("The words are “shared project files”");
    expect(parked.messages.at(-1)?.text).not.toContain("the whole public post");
    expect(parked.handoffRules.find((rule) => rule.action === "post")?.phrase).toBeNull();

    await withBridge(200, { summary: "Ready.", points: [], stance: "" }, async (url, hits) => {
      let state = setConnector(initialState(), "grok", { bridgeUrl: url, token: "bridge-secret-xyz" }, deps);
      state = setPaused(state, true, deps);
      state = await convene(state, "Hand deletions that mention shared project files to me", undefined, deps);
      state = setHandoffRule(state, "send", true, deps);
      const before = state.handoffRules.map((rule) => `${rule.id}:${rule.phrase ?? ""}`);
      state = await convene(state, "Which words does the deletion handed off to me?", undefined, deps);
      expect(hits).toHaveLength(0);
      expect(state.paused).toBe(true);
      expect(state.goals).toHaveLength(0);
      expect(state.handoffs).toHaveLength(0);
      expect(state.approvals).toHaveLength(0);
      expect(state.handoffRules.map((rule) => `${rule.id}:${rule.phrase ?? ""}`)).toEqual(before);
      expect(state.messages.at(-1)?.text).toContain("The words are “shared project files”");
      expect(state.messages.at(-1)?.text).not.toContain("the whole deletion");
      expect(state.messages.at(-1)?.text).not.toContain("the whole send");
      state = await convene(state, "Is a deletion handed to me?", undefined, deps);
      expect(state.messages.at(-1)?.text).toContain("only “shared project files”");
      expect(state.messages.at(-1)?.text).not.toContain("names no words");
      expect(state.messages.at(-1)?.text).not.toContain("The words are");
      expect(state.messages.at(-1)?.text).not.toContain("the whole send");
      state = await convene(state, "What is handed to me?", undefined, deps);
      expect(state.messages.at(-1)?.text).toContain("These steps are handed to you");
      expect(state.messages.at(-1)?.text).toContain("only “shared project files”");
      expect(state.messages.at(-1)?.text).toContain("the whole send");
      expect(hits).toHaveLength(0);
      state = await convene(state, "Which words does a deletion handed to me and delete the archive", undefined, deps);
      expect(state.handoffRules.map((rule) => `${rule.id}:${rule.phrase ?? ""}`)).toEqual(before);
      const archive = state.goals.at(-1)?.id;
      expect(state.approvals.filter((approval) => approval.goalId === archive && approval.status === "open" && approval.kind === "delete")).toHaveLength(1);
      expect(state.handoffs.filter((item) => item.goalId === archive)).toHaveLength(0);
      expect(state.messages.at(-1)?.text).not.toContain("named no other step");
      expect(state.messages.at(-1)?.text).not.toContain("The words are");
      expect(state.messages.at(-1)?.text).not.toContain("names no words");
      state = await convene(state, "Which words does a deletion handed to me and delete the shared project files", undefined, deps);
      const handed = state.goals.at(-1)?.id;
      expect(state.handoffs.filter((item) => item.goalId === handed && item.status === "open")).toHaveLength(1);
      expect(state.approvals.filter((approval) => approval.goalId === handed)).toHaveLength(0);
      expect(state.handoffRules.map((rule) => `${rule.id}:${rule.phrase ?? ""}`)).toEqual(before);
      expect(state.messages.at(-1)?.text).not.toContain("named no other step");
      const beforeOrdinary = state.goals.length;
      state = await convene(state, "Hand deletions to me", undefined, deps);
      expect(state.goals.length).toBe(beforeOrdinary + 1);
      expect(state.handoffRules.map((rule) => `${rule.id}:${rule.phrase ?? ""}`)).toEqual(before);
      expect(state.messages.at(-1)?.text).not.toContain("The words are");
      expect(state.messages.at(-1)?.text).not.toContain("names no words");
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);
      expect(hits.every((hit) => hit.raw.includes('"action":"convene"'))).toBe(true);
      expect(state.messages.some((message) => message.text.includes("I deleted"))).toBe(false);
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("bridge-secret-xyz");
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("Always allow");
    });
  });

  it("ORIEL-F33 asking which words a step uses keeps client work off Muse", async () => {
    const muse = await startLocalSeat({ seat: "muse", token: "tok-muse" });
    const grok = await startLocalSeat({ seat: "grok", token: "tok-grok" });
    try {
      let state = setConnector(initialState(), "muse", { bridgeUrl: muse.url, token: "tok-muse" }, deps);
      state = setConnector(state, "grok", { bridgeUrl: grok.url, token: "tok-grok" }, deps);
      state = setHandoffRule(state, "delete", true, deps, "shared project files");
      state = setHandoffRule(state, "send", true, deps);
      state = await convene(state, "Which words does a deletion hand to me?", undefined, deps);
      expect(muse.hits()).toBe(0);
      expect(grok.hits()).toBe(0);
      expect(state.goals).toHaveLength(0);
      expect(state.messages.at(-1)?.text).toContain("The words are “shared project files”");
      expect(state.messages.at(-1)?.text).not.toContain("the whole send");
      state = await convene(state, "Delete the client files for the shared project files", undefined, deps);
      expect(muse.hits()).toBe(0);
      expect(grok.hits()).toBe(1);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(1);
      expect(state.approvals).toHaveLength(0);
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
    } finally {
      await muse.close();
      await grok.close();
    }
  });

  it("ORIEL-F33 a woken deletion still follows the rule the question did not change", async () => {
    const early: Deps = { ...deps, now: () => new Date("2026-10-23T12:00:00.000Z") };
    const wakeAt = new Date("2026-10-23T13:00:00.000Z");
    await withBridge(200, { summary: "Ready.", points: [], stance: "" }, async (url, hits) => {
      let state = setConnector(initialState(), "dots", { bridgeUrl: url, token: "bridge-secret-xyz" }, early);
      state = setHandoffRule(state, "delete", true, early, "shared project files");
      state = await convene(state, "Delete the shared project files", undefined, early);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(1);
      const openId = state.handoffs[0]?.id ?? "";
      state = saveRoutine(state, state.goals[0]?.id ?? "", "Archive", early);
      state = setRoutineCadence(state, state.routines[0]?.id ?? "", "hourly", early);
      state = await convene(state, "Which words does a deletion hand to me?", state.goals[0]?.id, early, "skill_missing");
      expect(state.handoffRules).toHaveLength(1);
      expect(state.handoffRules[0]?.phrase).toBe("shared project files");
      expect(state.handoffs.find((item) => item.id === openId)?.status).toBe("open");
      expect(state.messages.at(-1)?.text).toContain("The words are “shared project files”");
      expect(state.messages.at(-1)?.text).not.toContain("the whole deletion");
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
      state = await wakeDue(state, { ...deps, now: () => wakeAt });
      expect(state.goals).toHaveLength(2);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(2);
      expect(state.approvals.filter((approval) => approval.status === "open" && approval.kind === "delete")).toHaveLength(0);
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);
      expect(state.messages.some((message) => message.text.includes("I deleted"))).toBe(false);
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("Always allow");
    });
  });

  it("ORIEL-F34 a sentence asks which step uses certain words and does not act", async () => {
    await expect(convene(initialState(), "Which step mentions shared project files without asking", undefined, deps)).rejects.toThrow(
      /without asking/,
    );
    await expect(convene(initialState(), "Which step mentions shared project files always allow", undefined, deps)).rejects.toThrow(
      /without asking/,
    );
    await expect(convene(initialState(), "Which step mentions ab?", undefined, deps)).rejects.toThrow(/short phrase/);
    await expect(convene(initialState(), "Which step mentions always allow the files?", undefined, deps)).rejects.toThrow(
      /short phrase/,
    );

    const none = await convene(initialState(), "Which step mentions shared project files?", undefined, deps);
    expect(none.handoffRules).toHaveLength(0);
    expect(none.goals).toHaveLength(0);
    expect(none.handoffs).toHaveLength(0);
    expect(none.approvals).toHaveLength(0);
    expect(none.messages.at(-1)?.text).toContain("No step mentions “shared project files”");
    expect(none.messages.at(-1)?.text).toContain("named no other step");
    expect(none.messages.at(-1)?.text).toContain("did not open a card");
    expect(none.messages.at(-1)?.text).not.toContain("The deletion");
    expect(none.messages.at(-1)?.text).not.toContain("Nothing is handed to you");
    expect(none.events.some((event) => event.type === "rule_read")).toBe(true);
    expect(none.events.some((event) => event.type === "rule_saved" || event.type === "rule_cleared" || event.type === "approved")).toBe(false);

    const listed = await convene(none, "Which step mentions photos, emails, and files?", undefined, deps);
    expect(listed.goals).toHaveLength(0);
    expect(listed.approvals).toHaveLength(0);
    expect(listed.messages.at(-1)?.text).toContain("No step mentions “photos, emails, and files”");
    expect(listed.messages.at(-1)?.text).toContain("did not open a card");

    let held = await convene(initialState(), "Email Maya the launch update", undefined, deps);
    const openId = held.approvals[0]?.id ?? "";
    const goalId = held.goals[0]?.id ?? "";
    held = setHandoffRule(held, "delete", true, deps);
    held = setHandoffRule(held, "send", true, deps);
    held = setHandoffRule(held, "pay", true, deps, "the vendor invoice");
    const ids = held.handoffRules.map((rule) => rule.id);
    held = await convene(held, "Please, which step mentions shared project files?", goalId, deps, "skill_missing");
    expect(held.approvals.find((approval) => approval.id === openId)?.status).toBe("open");
    expect(held.goals).toHaveLength(1);
    expect(held.goals[0]?.status).toBe("waiting");
    expect(held.handoffs).toHaveLength(0);
    expect(held.handoffRules.map((rule) => rule.id)).toEqual(ids);
    expect(held.messages.at(-1)?.text).toContain("No step mentions “shared project files”");
    expect(held.messages.at(-1)?.text).not.toContain("The deletion");
    expect(held.messages.at(-1)?.text).not.toContain("the whole deletion");
    expect(held.messages.at(-1)?.text).not.toContain("the whole send");
    expect(held.messages.at(-1)?.text).not.toContain("the vendor invoice");
    expect(held.messages.at(-1)?.text).not.toContain("These steps mention");
    expect(held.messages.at(-1)?.text).toContain("named no other step");
    expect(held.messages.at(-1)?.text).toContain("did not approve a hold");

    let named = setHandoffRule(held, "delete", true, deps, "shared project files");
    named = setHandoffRule(named, "send", true, deps, "shared project files");
    const namedIds = named.handoffRules.map((rule) => `${rule.action}:${rule.phrase ?? ""}`);
    named = await convene(named, "Which steps mention “Shared Project Files” handed over to you?", undefined, deps);
    expect(named.handoffRules.map((rule) => `${rule.action}:${rule.phrase ?? ""}`)).toEqual(namedIds);
    expect(named.goals).toHaveLength(1);
    expect(named.messages.at(-1)?.text).toContain("These steps mention “Shared Project Files”");
    expect(named.messages.at(-1)?.text).toContain("The send mentions “shared project files”");
    expect(named.messages.at(-1)?.text).toContain("The deletion mentions “shared project files”");
    expect(named.messages.at(-1)?.text).not.toContain("The payment");
    expect(named.messages.at(-1)?.text).not.toContain("the vendor invoice");
    expect(named.messages.at(-1)?.text).not.toContain("the whole");
    expect(named.messages.at(-1)?.text).toContain("named no other step");

    const otherWords = await convene(named, "Which step mentions unshared project files?", undefined, deps);
    expect(otherWords.handoffRules.map((rule) => `${rule.action}:${rule.phrase ?? ""}`)).toEqual(namedIds);
    expect(otherWords.messages.at(-1)?.text).toContain("No step mentions “unshared project files”");
    expect(otherWords.messages.at(-1)?.text).not.toContain("“shared project files”");
    expect(otherWords.messages.at(-1)?.text).not.toContain("The deletion");
    expect(otherWords.messages.at(-1)?.text).not.toContain("the vendor invoice");
    expect(otherWords.goals).toHaveLength(1);

    const words = await convene(otherWords, "Which words does a deletion hand to me?", undefined, deps);
    expect(words.messages.at(-1)?.text).toContain("The words are “shared project files”");
    expect(words.messages.at(-1)?.text).not.toContain("No step mentions");
    expect(words.messages.at(-1)?.text).not.toContain("The send");
    expect(words.messages.at(-1)?.text).not.toContain("the vendor invoice");

    const matched = await convene(words, "Is a deletion that mentions shared project files handed to me?", undefined, deps);
    expect(matched.messages.at(-1)?.text).toContain("only “shared project files”");
    expect(matched.messages.at(-1)?.text).not.toContain("No step mentions");
    expect(matched.messages.at(-1)?.text).not.toContain("The send");

    const one = await convene(matched, "Is a deletion handed to me?", undefined, deps);
    expect(one.messages.at(-1)?.text).toContain("only “shared project files”");
    expect(one.messages.at(-1)?.text).not.toContain("No step mentions");
    expect(one.messages.at(-1)?.text).not.toContain("the whole send");
    expect(one.approvals.find((approval) => approval.id === openId)?.status).toBe("open");

    const every = await convene(one, "What is handed to me?", undefined, deps);
    expect(every.goals).toHaveLength(1);
    expect(every.messages.at(-1)?.text).toContain("These steps are handed to you");
    expect(every.messages.at(-1)?.text).toContain("only “shared project files”");
    expect(every.messages.at(-1)?.text).toContain("only “the vendor invoice”");
    expect(every.messages.at(-1)?.text).not.toContain("No step mentions");

    const early: Deps = { ...deps, now: () => new Date("2026-10-23T12:00:00.000Z") };
    let parked = await convene(initialState(), "Draft the weekly close", undefined, early);
    parked = saveRoutine(parked, parked.goals[0]?.id ?? "", "Close", early);
    parked = setRoutineCadence(parked, parked.routines[0]?.id ?? "", "hourly", early);
    const nextRun = parked.routines[0]?.nextRunAt;
    parked = setPaused(parked, true, early);
    parked = setHandoffRule(parked, "delete", true, early, "shared project files");
    parked = setHandoffRule(parked, "post", true, early);
    parked = await convene(parked, "Which step mentioning shared project files to me?", undefined, {
      ...deps,
      now: () => new Date("2026-10-23T13:30:00.000Z"),
    });
    expect(parked.paused).toBe(true);
    expect(parked.routines[0]?.nextRunAt).toBe(nextRun);
    expect(parked.events.some((event) => event.type === "woke" || event.type === "approved")).toBe(false);
    expect(parked.messages.at(-1)?.text).toContain("The deletion mentions “shared project files”");
    expect(parked.messages.at(-1)?.text).not.toContain("The public post");
    expect(parked.messages.at(-1)?.text).not.toContain("the whole public post");
    expect(parked.handoffRules.find((rule) => rule.action === "post")?.phrase).toBeNull();

    await withBridge(200, { summary: "Ready.", points: [], stance: "" }, async (url, hits) => {
      let state = setConnector(initialState(), "grok", { bridgeUrl: url, token: "bridge-secret-xyz" }, deps);
      state = setPaused(state, true, deps);
      state = await convene(state, "Hand deletions that mention shared project files to me", undefined, deps);
      state = setHandoffRule(state, "send", true, deps, "shared project files");
      state = setHandoffRule(state, "pay", true, deps, "the vendor invoice");
      const before = state.handoffRules.map((rule) => `${rule.id}:${rule.phrase ?? ""}`);
      state = await convene(state, "Which step mentions shared project files to me?", undefined, deps);
      expect(hits).toHaveLength(0);
      expect(state.paused).toBe(true);
      expect(state.goals).toHaveLength(0);
      expect(state.handoffs).toHaveLength(0);
      expect(state.approvals).toHaveLength(0);
      expect(state.handoffRules.map((rule) => `${rule.id}:${rule.phrase ?? ""}`)).toEqual(before);
      expect(state.messages.at(-1)?.text).toContain("These steps mention “shared project files”");
      expect(state.messages.at(-1)?.text).toContain("The send mentions “shared project files”");
      expect(state.messages.at(-1)?.text).toContain("The deletion mentions “shared project files”");
      expect(state.messages.at(-1)?.text).not.toContain("the vendor invoice");
      expect(state.messages.at(-1)?.text).not.toContain("the whole");
      state = await convene(state, "Which words does the deletion hand to me?", undefined, deps);
      expect(state.messages.at(-1)?.text).toContain("The words are “shared project files”");
      expect(state.messages.at(-1)?.text).not.toContain("No step mentions");
      expect(state.messages.at(-1)?.text).not.toContain("The send");
      state = await convene(state, "What is handed to me?", undefined, deps);
      expect(state.messages.at(-1)?.text).toContain("These steps are handed to you");
      expect(state.messages.at(-1)?.text).toContain("only “shared project files”");
      expect(state.messages.at(-1)?.text).toContain("only “the vendor invoice”");
      expect(hits).toHaveLength(0);
      state = await convene(state, "Which step mentions the vendor archive and delete the archive", undefined, deps);
      expect(state.handoffRules.map((rule) => `${rule.id}:${rule.phrase ?? ""}`)).toEqual(before);
      const archive = state.goals.at(-1)?.id;
      expect(state.approvals.filter((approval) => approval.goalId === archive && approval.status === "open" && approval.kind === "delete")).toHaveLength(1);
      expect(state.handoffs.filter((item) => item.goalId === archive)).toHaveLength(0);
      expect(state.messages.at(-1)?.text).not.toContain("named no other step");
      expect(state.messages.at(-1)?.text).not.toContain("No step mentions");
      state = await convene(state, "Which step mentions shared project files and delete the shared project files", undefined, deps);
      const handed = state.goals.at(-1)?.id;
      expect(state.handoffs.filter((item) => item.goalId === handed && item.status === "open")).toHaveLength(1);
      expect(state.approvals.filter((approval) => approval.goalId === handed)).toHaveLength(0);
      expect(state.handoffRules.map((rule) => `${rule.id}:${rule.phrase ?? ""}`)).toEqual(before);
      expect(state.messages.at(-1)?.text).not.toContain("named no other step");
      const beforeOrdinary = state.goals.length;
      state = await convene(state, "Hand deletions to me", undefined, deps);
      expect(state.goals.length).toBe(beforeOrdinary + 1);
      expect(state.handoffRules.map((rule) => `${rule.id}:${rule.phrase ?? ""}`)).toEqual(before);
      expect(state.messages.at(-1)?.text).not.toContain("No step mentions");
      expect(state.messages.at(-1)?.text).not.toContain("These steps mention");
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);
      expect(hits.every((hit) => hit.raw.includes('"action":"convene"'))).toBe(true);
      expect(state.messages.some((message) => message.text.includes("I deleted"))).toBe(false);
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("bridge-secret-xyz");
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("Always allow");
    });
  });

  it("ORIEL-F34 asking which step uses certain words keeps client work off Muse", async () => {
    const muse = await startLocalSeat({ seat: "muse", token: "tok-muse" });
    const grok = await startLocalSeat({ seat: "grok", token: "tok-grok" });
    try {
      let state = setConnector(initialState(), "muse", { bridgeUrl: muse.url, token: "tok-muse" }, deps);
      state = setConnector(state, "grok", { bridgeUrl: grok.url, token: "tok-grok" }, deps);
      state = setHandoffRule(state, "delete", true, deps, "shared project files");
      state = setHandoffRule(state, "send", true, deps);
      state = await convene(state, "Which step mentions shared project files?", undefined, deps);
      expect(muse.hits()).toBe(0);
      expect(grok.hits()).toBe(0);
      expect(state.goals).toHaveLength(0);
      expect(state.messages.at(-1)?.text).toContain("The deletion mentions “shared project files”");
      expect(state.messages.at(-1)?.text).not.toContain("the whole send");
      state = await convene(state, "Delete the client files for the shared project files", undefined, deps);
      expect(muse.hits()).toBe(0);
      expect(grok.hits()).toBe(1);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(1);
      expect(state.approvals).toHaveLength(0);
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
    } finally {
      await muse.close();
      await grok.close();
    }
  });

  it("ORIEL-F34 a woken deletion still follows the rule the question did not change", async () => {
    const early: Deps = { ...deps, now: () => new Date("2026-10-23T12:00:00.000Z") };
    const wakeAt = new Date("2026-10-23T13:00:00.000Z");
    await withBridge(200, { summary: "Ready.", points: [], stance: "" }, async (url, hits) => {
      let state = setConnector(initialState(), "dots", { bridgeUrl: url, token: "bridge-secret-xyz" }, early);
      state = setHandoffRule(state, "delete", true, early, "shared project files");
      state = await convene(state, "Delete the shared project files", undefined, early);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(1);
      const openId = state.handoffs[0]?.id ?? "";
      state = saveRoutine(state, state.goals[0]?.id ?? "", "Archive", early);
      state = setRoutineCadence(state, state.routines[0]?.id ?? "", "hourly", early);
      state = await convene(state, "Which step mentions shared project files?", state.goals[0]?.id, early, "skill_missing");
      expect(state.handoffRules).toHaveLength(1);
      expect(state.handoffRules[0]?.phrase).toBe("shared project files");
      expect(state.handoffs.find((item) => item.id === openId)?.status).toBe("open");
      expect(state.messages.at(-1)?.text).toContain("The deletion mentions “shared project files”");
      expect(state.messages.at(-1)?.text).not.toContain("the whole deletion");
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
      state = await wakeDue(state, { ...deps, now: () => wakeAt });
      expect(state.goals).toHaveLength(2);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(2);
      expect(state.approvals.filter((approval) => approval.status === "open" && approval.kind === "delete")).toHaveLength(0);
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);
      expect(state.messages.some((message) => message.text.includes("I deleted"))).toBe(false);
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("Always allow");
    });
  });

  it("ORIEL-F35 a sentence asks which steps name no words and does not act", async () => {
    const start = initialState();
    await expect(convene(start, "Which steps name no words without asking", undefined, deps)).rejects.toThrow(/without asking/);
    await expect(convene(start, "Which steps name no words always allow", undefined, deps)).rejects.toThrow(/without asking/);
    await expect(convene(start, "Please, which step names no words allow automatically", undefined, deps)).rejects.toThrow(
      /without asking/,
    );
    expect(start.messages).toHaveLength(0);
    expect(start.goals).toHaveLength(0);
    expect(start.handoffRules).toHaveLength(0);

    const none = await convene(initialState(), "Which steps name no words?", undefined, deps);
    expect(none.handoffRules).toHaveLength(0);
    expect(none.goals).toHaveLength(0);
    expect(none.handoffs).toHaveLength(0);
    expect(none.approvals).toHaveLength(0);
    expect(none.messages.at(-1)?.text).toContain("No step names no words");
    expect(none.messages.at(-1)?.text).toContain("named no other step");
    expect(none.messages.at(-1)?.text).toContain("did not open a card");
    expect(none.messages.at(-1)?.text).not.toContain("The deletion");
    expect(none.messages.at(-1)?.text).not.toContain("These steps name no words");
    expect(none.messages.at(-1)?.text).not.toContain("Nothing is handed to you");
    expect(none.events.some((event) => event.type === "rule_read")).toBe(true);
    expect(none.events.some((event) => event.type === "rule_saved" || event.type === "rule_cleared" || event.type === "approved")).toBe(false);

    let held = await convene(initialState(), "Email Maya the launch update", undefined, deps);
    const openId = held.approvals[0]?.id ?? "";
    const goalId = held.goals[0]?.id ?? "";
    held = setHandoffRule(held, "post", true, deps);
    held = setHandoffRule(held, "delete", true, deps);
    held = setHandoffRule(held, "send", true, deps);
    held = setHandoffRule(held, "pay", true, deps, "the vendor invoice");
    const ids = held.handoffRules.map((rule) => rule.id);
    held = await convene(held, "Please, which steps name no words?", goalId, deps, "skill_missing");
    expect(held.approvals.find((approval) => approval.id === openId)?.status).toBe("open");
    expect(held.goals).toHaveLength(1);
    expect(held.goals[0]?.status).toBe("waiting");
    expect(held.handoffs).toHaveLength(0);
    expect(held.handoffRules.map((rule) => rule.id)).toEqual(ids);
    const listed = held.messages.at(-1)?.text ?? "";
    expect(listed).toContain("These steps name no words");
    expect(listed.indexOf("The send")).toBeGreaterThan(-1);
    expect(listed.indexOf("The deletion")).toBeGreaterThan(listed.indexOf("The send"));
    expect(listed.indexOf("The public post")).toBeGreaterThan(listed.indexOf("The deletion"));
    expect(listed).toContain("the whole send");
    expect(listed).toContain("the whole deletion");
    expect(listed).toContain("the whole public post");
    expect(listed).not.toContain("The payment");
    expect(listed).not.toContain("the vendor invoice");
    expect(listed).toContain("named no other step");
    expect(listed).toContain("did not approve a hold");
    expect(listed).not.toContain("No step names no words");

    let named = setHandoffRule(held, "delete", true, deps, "shared project files");
    named = await convene(named, "Which step names no words?", undefined, deps);
    expect(named.handoffRules.find((rule) => rule.action === "delete")?.phrase).toBe("shared project files");
    expect(named.goals).toHaveLength(1);
    const twoBare = named.messages.at(-1)?.text ?? "";
    expect(twoBare).toContain("These steps name no words");
    expect(twoBare.indexOf("The send")).toBeGreaterThan(-1);
    expect(twoBare.indexOf("The public post")).toBeGreaterThan(twoBare.indexOf("The send"));
    expect(twoBare).toContain("the whole send");
    expect(twoBare).toContain("the whole public post");
    expect(twoBare).not.toContain("No step names no words");
    expect(twoBare).not.toContain("The deletion");
    expect(twoBare).not.toContain("The payment");
    expect(twoBare).not.toContain("shared project files");
    expect(twoBare).not.toContain("the vendor invoice");

    named = setHandoffRule(named, "post", true, deps, "the launch note");
    const both = await convene(named, "Which steps naming no words handed over to you?", undefined, deps);
    expect(both.handoffRules.find((rule) => rule.action === "send")?.phrase).toBeNull();
    expect(both.goals).toHaveLength(1);
    const onlySend = both.messages.at(-1)?.text ?? "";
    expect(onlySend).toContain("The send is handed to you");
    expect(onlySend).toContain("the whole send");
    expect(onlySend).not.toContain("These steps name no words");
    expect(onlySend).not.toContain("The deletion");
    expect(onlySend).not.toContain("The public post");
    expect(onlySend).not.toContain("shared project files");
    expect(onlySend).not.toContain("the launch note");
    expect(onlySend).not.toContain("the vendor invoice");

    const mentioned = await convene(both, "Which step mentions shared project files?", undefined, deps);
    expect(mentioned.messages.at(-1)?.text).toContain("The deletion mentions “shared project files”");
    expect(mentioned.messages.at(-1)?.text).not.toContain("No step names no words");
    expect(mentioned.messages.at(-1)?.text).not.toContain("the whole send");
    expect(mentioned.messages.at(-1)?.text).not.toContain("the vendor invoice");

    const words = await convene(mentioned, "Which words does a deletion hand to me?", undefined, deps);
    expect(words.messages.at(-1)?.text).toContain("The words are “shared project files”");
    expect(words.messages.at(-1)?.text).not.toContain("No step names no words");
    expect(words.messages.at(-1)?.text).not.toContain("the whole send");

    const one = await convene(words, "Is a deletion handed to me?", undefined, deps);
    expect(one.messages.at(-1)?.text).toContain("only “shared project files”");
    expect(one.messages.at(-1)?.text).not.toContain("No step names no words");
    expect(one.messages.at(-1)?.text).not.toContain("the whole send");
    expect(one.approvals.find((approval) => approval.id === openId)?.status).toBe("open");

    const every = await convene(one, "What is handed to me?", undefined, deps);
    expect(every.goals).toHaveLength(1);
    expect(every.messages.at(-1)?.text).toContain("These steps are handed to you");
    expect(every.messages.at(-1)?.text).toContain("the whole send");
    expect(every.messages.at(-1)?.text).toContain("only “shared project files”");
    expect(every.messages.at(-1)?.text).toContain("only “the vendor invoice”");
    expect(every.messages.at(-1)?.text).toContain("only “the launch note”");
    expect(every.messages.at(-1)?.text).not.toContain("No step names no words");

    const early: Deps = { ...deps, now: () => new Date("2026-10-23T12:00:00.000Z") };
    let parked = await convene(initialState(), "Draft the weekly close", undefined, early);
    parked = saveRoutine(parked, parked.goals[0]?.id ?? "", "Close", early);
    parked = setRoutineCadence(parked, parked.routines[0]?.id ?? "", "hourly", early);
    const nextRun = parked.routines[0]?.nextRunAt;
    parked = setPaused(parked, true, early);
    parked = setHandoffRule(parked, "delete", true, early);
    parked = setHandoffRule(parked, "pay", true, early, "the vendor invoice");
    parked = await convene(parked, "Which steps name no words to me?", undefined, {
      ...deps,
      now: () => new Date("2026-10-23T13:30:00.000Z"),
    });
    expect(parked.paused).toBe(true);
    expect(parked.routines[0]?.nextRunAt).toBe(nextRun);
    expect(parked.events.some((event) => event.type === "woke" || event.type === "approved")).toBe(false);
    expect(parked.messages.at(-1)?.text).toContain("The deletion is handed to you");
    expect(parked.messages.at(-1)?.text).toContain("the whole deletion");
    expect(parked.messages.at(-1)?.text).not.toContain("The payment");
    expect(parked.messages.at(-1)?.text).not.toContain("the vendor invoice");
    expect(parked.handoffRules.find((rule) => rule.action === "delete")?.phrase).toBeNull();

    await withBridge(200, { summary: "Ready.", points: [], stance: "" }, async (url, hits) => {
      let state = setConnector(initialState(), "grok", { bridgeUrl: url, token: "bridge-secret-xyz" }, deps);
      state = setPaused(state, true, deps);
      state = setHandoffRule(state, "delete", true, deps, "shared project files");
      state = setHandoffRule(state, "send", true, deps);
      state = setHandoffRule(state, "pay", true, deps, "the vendor invoice");
      const before = state.handoffRules.map((rule) => `${rule.id}:${rule.phrase ?? ""}`);
      state = await convene(state, "Which steps name no words to you?", undefined, deps);
      expect(hits).toHaveLength(0);
      expect(state.paused).toBe(true);
      expect(state.goals).toHaveLength(0);
      expect(state.handoffs).toHaveLength(0);
      expect(state.approvals).toHaveLength(0);
      expect(state.handoffRules.map((rule) => `${rule.id}:${rule.phrase ?? ""}`)).toEqual(before);
      expect(state.messages.at(-1)?.text).toContain("The send is handed to you");
      expect(state.messages.at(-1)?.text).toContain("the whole send");
      expect(state.messages.at(-1)?.text).not.toContain("The deletion");
      expect(state.messages.at(-1)?.text).not.toContain("shared project files");
      expect(state.messages.at(-1)?.text).not.toContain("the vendor invoice");
      state = await convene(state, "Which steps name no words and delete the archive", undefined, deps);
      expect(state.handoffRules.map((rule) => `${rule.id}:${rule.phrase ?? ""}`)).toEqual(before);
      const archive = state.goals.at(-1)?.id;
      expect(state.approvals.filter((approval) => approval.goalId === archive && approval.status === "open" && approval.kind === "delete")).toHaveLength(1);
      expect(state.handoffs.filter((item) => item.goalId === archive)).toHaveLength(0);
      expect(state.messages.at(-1)?.text).not.toContain("named no other step");
      expect(state.messages.at(-1)?.text).not.toContain("No step names no words");
      state = setHandoffRule(state, "delete", false, deps);
      state = setHandoffRule(state, "delete", true, deps);
      const bareBefore = state.handoffRules.map((rule) => `${rule.action}:${rule.phrase ?? ""}`);
      state = await convene(state, "Which steps name no words and delete the archive", undefined, deps);
      const handed = state.goals.at(-1)?.id;
      expect(state.handoffs.filter((item) => item.goalId === handed && item.status === "open")).toHaveLength(1);
      expect(state.approvals.filter((approval) => approval.goalId === handed)).toHaveLength(0);
      expect(state.handoffRules.map((rule) => `${rule.action}:${rule.phrase ?? ""}`)).toEqual(bareBefore);
      expect(state.messages.at(-1)?.text).not.toContain("No step names no words");
      expect(state.messages.at(-1)?.text).not.toContain("named no other step");
      const beforeOrdinary = state.goals.length;
      state = await convene(state, "Hand deletions to me", undefined, deps);
      expect(state.goals.length).toBe(beforeOrdinary + 1);
      expect(state.handoffRules.map((rule) => `${rule.action}:${rule.phrase ?? ""}`)).toEqual(bareBefore);
      expect(state.messages.at(-1)?.text).not.toContain("No step names no words");
      expect(state.messages.at(-1)?.text).not.toContain("These steps name no words");
      state = await convene(state, "Which step mentions shared project files?", undefined, deps);
      expect(state.messages.at(-1)?.text).toContain("No step mentions “shared project files”");
      expect(state.messages.at(-1)?.text).not.toContain("No step names no words");
      expect(state.messages.at(-1)?.text).not.toContain("the whole send");
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);
      expect(hits.every((hit) => hit.raw.includes('"action":"convene"'))).toBe(true);
      expect(state.messages.some((message) => message.text.includes("I deleted"))).toBe(false);
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("bridge-secret-xyz");
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("Always allow");
    });
  });

  it("ORIEL-F35 asking which steps name no words keeps client work off Muse", async () => {
    const muse = await startLocalSeat({ seat: "muse", token: "tok-muse" });
    const grok = await startLocalSeat({ seat: "grok", token: "tok-grok" });
    try {
      let state = setConnector(initialState(), "muse", { bridgeUrl: muse.url, token: "tok-muse" }, deps);
      state = setConnector(state, "grok", { bridgeUrl: grok.url, token: "tok-grok" }, deps);
      state = setHandoffRule(state, "delete", true, deps);
      state = setHandoffRule(state, "send", true, deps, "shared project files");
      state = await convene(state, "Which steps name no words?", undefined, deps);
      expect(muse.hits()).toBe(0);
      expect(grok.hits()).toBe(0);
      expect(state.goals).toHaveLength(0);
      expect(state.messages.at(-1)?.text).toContain("the whole deletion");
      expect(state.messages.at(-1)?.text).not.toContain("shared project files");
      state = await convene(state, "Delete the client files", undefined, deps);
      expect(muse.hits()).toBe(0);
      expect(grok.hits()).toBe(1);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(1);
      expect(state.approvals).toHaveLength(0);
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
    } finally {
      await muse.close();
      await grok.close();
    }
  });

  it("ORIEL-F35 a woken deletion still follows the rule the question did not change", async () => {
    const early: Deps = { ...deps, now: () => new Date("2026-10-23T12:00:00.000Z") };
    const wakeAt = new Date("2026-10-23T13:00:00.000Z");
    await withBridge(200, { summary: "Ready.", points: [], stance: "" }, async (url, hits) => {
      let state = setConnector(initialState(), "dots", { bridgeUrl: url, token: "bridge-secret-xyz" }, early);
      state = setHandoffRule(state, "delete", true, early);
      state = await convene(state, "Delete the shared project files", undefined, early);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(1);
      const openId = state.handoffs[0]?.id ?? "";
      state = saveRoutine(state, state.goals[0]?.id ?? "", "Archive", early);
      state = setRoutineCadence(state, state.routines[0]?.id ?? "", "hourly", early);
      state = await convene(state, "Which steps name no words?", state.goals[0]?.id, early, "skill_missing");
      expect(state.handoffRules).toHaveLength(1);
      expect(state.handoffRules[0]?.phrase).toBeNull();
      expect(state.handoffs.find((item) => item.id === openId)?.status).toBe("open");
      expect(state.messages.at(-1)?.text).toContain("the whole deletion");
      expect(state.messages.at(-1)?.text).not.toContain("shared project files");
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
      state = await wakeDue(state, { ...deps, now: () => wakeAt });
      expect(state.goals).toHaveLength(2);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(2);
      expect(state.approvals.filter((approval) => approval.status === "open" && approval.kind === "delete")).toHaveLength(0);
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);
      expect(state.messages.some((message) => message.text.includes("I deleted"))).toBe(false);
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("Always allow");
    });
  });

  it("ORIEL-F36 a sentence asks which steps name words and does not act", async () => {
    const start = initialState();
    await expect(convene(start, "Which steps name words without asking", undefined, deps)).rejects.toThrow(/without asking/);
    await expect(convene(start, "Which steps name words always allow", undefined, deps)).rejects.toThrow(/without asking/);
    await expect(convene(start, "Please, which step names words allow automatically", undefined, deps)).rejects.toThrow(
      /without asking/,
    );
    expect(start.messages).toHaveLength(0);
    expect(start.goals).toHaveLength(0);
    expect(start.handoffRules).toHaveLength(0);

    const none = await convene(initialState(), "Which steps name words?", undefined, deps);
    expect(none.handoffRules).toHaveLength(0);
    expect(none.goals).toHaveLength(0);
    expect(none.handoffs).toHaveLength(0);
    expect(none.approvals).toHaveLength(0);
    expect(none.messages.at(-1)?.text).toContain("No step names words");
    expect(none.messages.at(-1)?.text).toContain("named no other step");
    expect(none.messages.at(-1)?.text).toContain("did not open a card");
    expect(none.messages.at(-1)?.text).not.toContain("The deletion");
    expect(none.messages.at(-1)?.text).not.toContain("These steps name words");
    expect(none.messages.at(-1)?.text).not.toContain("No step names no words");
    expect(none.messages.at(-1)?.text).not.toContain("the whole");
    expect(none.messages.at(-1)?.text).not.toContain("Nothing is handed to you");
    expect(none.events.some((event) => event.type === "rule_read")).toBe(true);
    expect(none.events.some((event) => event.type === "rule_saved" || event.type === "rule_cleared" || event.type === "approved")).toBe(
      false,
    );

    let bare = setHandoffRule(initialState(), "delete", true, deps);
    bare = setHandoffRule(bare, "pay", true, deps);
    bare = await convene(bare, "Which step names words?", undefined, deps);
    expect(bare.goals).toHaveLength(0);
    expect(bare.handoffs).toHaveLength(0);
    expect(bare.messages.at(-1)?.text).toContain("No step names words");
    expect(bare.messages.at(-1)?.text).not.toContain("The deletion");
    expect(bare.messages.at(-1)?.text).not.toContain("The payment");
    expect(bare.messages.at(-1)?.text).not.toContain("the whole");
    expect(bare.messages.at(-1)?.text).not.toContain("These steps name words");

    let held = await convene(initialState(), "Email Maya the launch update", undefined, deps);
    const openId = held.approvals[0]?.id ?? "";
    const goalId = held.goals[0]?.id ?? "";
    held = setHandoffRule(held, "post", true, deps, "the launch note");
    held = setHandoffRule(held, "delete", true, deps, "shared project files");
    held = setHandoffRule(held, "send", true, deps, "the vendor files");
    held = setHandoffRule(held, "pay", true, deps);
    const ids = held.handoffRules.map((rule) => rule.id);
    held = await convene(held, "Please, which steps name words?", goalId, deps, "skill_missing");
    expect(held.approvals.find((approval) => approval.id === openId)?.status).toBe("open");
    expect(held.goals).toHaveLength(1);
    expect(held.goals[0]?.status).toBe("waiting");
    expect(held.handoffs).toHaveLength(0);
    expect(held.handoffRules.map((rule) => rule.id)).toEqual(ids);
    const listed = held.messages.at(-1)?.text ?? "";
    expect(listed).toContain("These steps name words");
    expect(listed.indexOf("The send")).toBeGreaterThan(-1);
    expect(listed.indexOf("The deletion")).toBeGreaterThan(listed.indexOf("The send"));
    expect(listed.indexOf("The public post")).toBeGreaterThan(listed.indexOf("The deletion"));
    expect(listed).toContain("“the vendor files”");
    expect(listed).toContain("“shared project files”");
    expect(listed).toContain("“the launch note”");
    expect(listed).not.toContain("The payment");
    expect(listed).not.toContain("the whole");
    expect(listed).toContain("named no other step");
    expect(listed).toContain("did not approve a hold");
    expect(listed).not.toContain("No step names words");
    expect(listed).not.toContain("No step names no words");

    let narrowed = setHandoffRule(held, "delete", false, deps);
    narrowed = setHandoffRule(narrowed, "delete", true, deps);
    narrowed = await convene(narrowed, "Which step names words?", undefined, deps);
    expect(narrowed.handoffRules.find((rule) => rule.action === "delete")?.phrase).toBeNull();
    expect(narrowed.goals).toHaveLength(1);
    const twoNamed = narrowed.messages.at(-1)?.text ?? "";
    expect(twoNamed).toContain("These steps name words");
    expect(twoNamed.indexOf("The send")).toBeGreaterThan(-1);
    expect(twoNamed.indexOf("The public post")).toBeGreaterThan(twoNamed.indexOf("The send"));
    expect(twoNamed).toContain("“the vendor files”");
    expect(twoNamed).toContain("“the launch note”");
    expect(twoNamed).not.toContain("No step names words");
    expect(twoNamed).not.toContain("The deletion");
    expect(twoNamed).not.toContain("The payment");
    expect(twoNamed).not.toContain("shared project files");
    expect(twoNamed).not.toContain("the whole");

    narrowed = setHandoffRule(narrowed, "post", false, deps);
    narrowed = setHandoffRule(narrowed, "post", true, deps);
    const onlySend = await convene(narrowed, "Which steps naming words handed over to you?", undefined, deps);
    expect(onlySend.handoffRules.find((rule) => rule.action === "send")?.phrase).toBe("the vendor files");
    expect(onlySend.goals).toHaveLength(1);
    const oneLine = onlySend.messages.at(-1)?.text ?? "";
    expect(oneLine).toContain("The send is handed to you");
    expect(oneLine).toContain("“the vendor files”");
    expect(oneLine).not.toContain("These steps name words");
    expect(oneLine).not.toContain("The deletion");
    expect(oneLine).not.toContain("The public post");
    expect(oneLine).not.toContain("The payment");
    expect(oneLine).not.toContain("the launch note");
    expect(oneLine).not.toContain("the whole");

    const unnamed = await convene(onlySend, "Which steps name no words?", undefined, deps);
    expect(unnamed.messages.at(-1)?.text).toContain("These steps name no words");
    expect(unnamed.messages.at(-1)?.text).toContain("the whole payment");
    expect(unnamed.messages.at(-1)?.text).toContain("the whole deletion");
    expect(unnamed.messages.at(-1)?.text).toContain("the whole public post");
    expect(unnamed.messages.at(-1)?.text).not.toContain("the vendor files");
    expect(unnamed.messages.at(-1)?.text).not.toContain("These steps name words");
    expect(unnamed.messages.at(-1)?.text).not.toContain("The send");

    const words = await convene(unnamed, "Which words does a deletion hand to me?", undefined, deps);
    expect(words.messages.at(-1)?.text).toContain("names no words");
    expect(words.messages.at(-1)?.text).toContain("the whole deletion");
    expect(words.messages.at(-1)?.text).not.toContain("No step names words");
    expect(words.messages.at(-1)?.text).not.toContain("the vendor files");

    const mentioned = await convene(words, "Which step mentions the vendor files?", undefined, deps);
    expect(mentioned.messages.at(-1)?.text).toContain("The send mentions “the vendor files”");
    expect(mentioned.messages.at(-1)?.text).not.toContain("No step names words");
    expect(mentioned.messages.at(-1)?.text).not.toContain("the whole deletion");

    const one = await convene(mentioned, "Is a deletion handed to me?", undefined, deps);
    expect(one.messages.at(-1)?.text).toContain("the whole deletion");
    expect(one.messages.at(-1)?.text).not.toContain("No step names words");
    expect(one.messages.at(-1)?.text).not.toContain("the vendor files");
    expect(one.approvals.find((approval) => approval.id === openId)?.status).toBe("open");

    const every = await convene(one, "What is handed to me?", undefined, deps);
    expect(every.goals).toHaveLength(1);
    expect(every.messages.at(-1)?.text).toContain("These steps are handed to you");
    expect(every.messages.at(-1)?.text).toContain("only “the vendor files”");
    expect(every.messages.at(-1)?.text).toContain("the whole deletion");
    expect(every.messages.at(-1)?.text).not.toContain("No step names words");
    expect(every.messages.at(-1)?.text).not.toContain("These steps name words");

    const early: Deps = { ...deps, now: () => new Date("2026-10-23T12:00:00.000Z") };
    let parked = await convene(initialState(), "Draft the weekly close", undefined, early);
    parked = saveRoutine(parked, parked.goals[0]?.id ?? "", "Close", early);
    parked = setRoutineCadence(parked, parked.routines[0]?.id ?? "", "hourly", early);
    const nextRun = parked.routines[0]?.nextRunAt;
    parked = setPaused(parked, true, early);
    parked = setHandoffRule(parked, "delete", true, early);
    parked = setHandoffRule(parked, "pay", true, early, "the vendor invoice");
    parked = await convene(parked, "Which steps name words to me?", undefined, {
      ...deps,
      now: () => new Date("2026-10-23T13:30:00.000Z"),
    });
    expect(parked.paused).toBe(true);
    expect(parked.routines[0]?.nextRunAt).toBe(nextRun);
    expect(parked.events.some((event) => event.type === "woke" || event.type === "approved")).toBe(false);
    expect(parked.messages.at(-1)?.text).toContain("The payment is handed to you");
    expect(parked.messages.at(-1)?.text).toContain("“the vendor invoice”");
    expect(parked.messages.at(-1)?.text).not.toContain("The deletion");
    expect(parked.messages.at(-1)?.text).not.toContain("the whole");
    expect(parked.messages.at(-1)?.text).not.toContain("These steps name words");
    expect(parked.handoffRules.find((rule) => rule.action === "delete")?.phrase).toBeNull();

    await withBridge(200, { summary: "Ready.", points: [], stance: "" }, async (url, hits) => {
      let state = setConnector(initialState(), "grok", { bridgeUrl: url, token: "bridge-secret-xyz" }, deps);
      state = setPaused(state, true, deps);
      state = setHandoffRule(state, "delete", true, deps, "shared project files");
      state = setHandoffRule(state, "send", true, deps);
      state = setHandoffRule(state, "pay", true, deps, "the vendor invoice");
      const before = state.handoffRules.map((rule) => `${rule.id}:${rule.phrase ?? ""}`);
      state = await convene(state, "Which steps name words to you?", undefined, deps);
      expect(hits).toHaveLength(0);
      expect(state.paused).toBe(true);
      expect(state.goals).toHaveLength(0);
      expect(state.handoffs).toHaveLength(0);
      expect(state.approvals).toHaveLength(0);
      expect(state.handoffRules.map((rule) => `${rule.id}:${rule.phrase ?? ""}`)).toEqual(before);
      expect(state.messages.at(-1)?.text).toContain("The payment is handed to you");
      expect(state.messages.at(-1)?.text).toContain("“the vendor invoice”");
      expect(state.messages.at(-1)?.text).toContain("The deletion is handed to you");
      expect(state.messages.at(-1)?.text).toContain("“shared project files”");
      expect(state.messages.at(-1)?.text).not.toContain("The send");
      expect(state.messages.at(-1)?.text).not.toContain("the whole");
      state = await convene(state, "Which steps name words and delete the archive", undefined, deps);
      expect(state.handoffRules.map((rule) => `${rule.id}:${rule.phrase ?? ""}`)).toEqual(before);
      const archive = state.goals.at(-1)?.id;
      expect(
        state.approvals.filter((approval) => approval.goalId === archive && approval.status === "open" && approval.kind === "delete"),
      ).toHaveLength(1);
      expect(state.handoffs.filter((item) => item.goalId === archive)).toHaveLength(0);
      expect(state.messages.at(-1)?.text).not.toContain("named no other step");
      expect(state.messages.at(-1)?.text).not.toContain("No step names words");
      state = setHandoffRule(state, "delete", false, deps);
      state = setHandoffRule(state, "delete", true, deps);
      const bareBefore = state.handoffRules.map((rule) => `${rule.action}:${rule.phrase ?? ""}`);
      state = await convene(state, "Which steps name words and delete the archive", undefined, deps);
      const handed = state.goals.at(-1)?.id;
      expect(state.handoffs.filter((item) => item.goalId === handed && item.status === "open")).toHaveLength(1);
      expect(state.approvals.filter((approval) => approval.goalId === handed)).toHaveLength(0);
      expect(state.handoffRules.map((rule) => `${rule.action}:${rule.phrase ?? ""}`)).toEqual(bareBefore);
      expect(state.messages.at(-1)?.text).not.toContain("No step names words");
      expect(state.messages.at(-1)?.text).not.toContain("named no other step");
      const beforeOrdinary = state.goals.length;
      state = await convene(state, "Hand deletions to me", undefined, deps);
      expect(state.goals.length).toBe(beforeOrdinary + 1);
      expect(state.handoffRules.map((rule) => `${rule.action}:${rule.phrase ?? ""}`)).toEqual(bareBefore);
      expect(state.messages.at(-1)?.text).not.toContain("No step names words");
      expect(state.messages.at(-1)?.text).not.toContain("These steps name words");
      state = await convene(state, "Which steps name no words?", undefined, deps);
      expect(state.messages.at(-1)?.text).toContain("the whole deletion");
      expect(state.messages.at(-1)?.text).toContain("the whole send");
      expect(state.messages.at(-1)?.text).not.toContain("No step names words");
      expect(state.messages.at(-1)?.text).not.toContain("the vendor invoice");
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);
      expect(hits.every((hit) => hit.raw.includes('"action":"convene"'))).toBe(true);
      expect(state.messages.some((message) => message.text.includes("I deleted"))).toBe(false);
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("bridge-secret-xyz");
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("Always allow");
    });
  });

  it("ORIEL-F36 asking which steps name words keeps client work off Muse", async () => {
    const muse = await startLocalSeat({ seat: "muse", token: "tok-muse" });
    const grok = await startLocalSeat({ seat: "grok", token: "tok-grok" });
    try {
      let state = setConnector(initialState(), "muse", { bridgeUrl: muse.url, token: "tok-muse" }, deps);
      state = setConnector(state, "grok", { bridgeUrl: grok.url, token: "tok-grok" }, deps);
      state = setHandoffRule(state, "delete", true, deps);
      state = setHandoffRule(state, "send", true, deps, "shared project files");
      state = await convene(state, "Which steps name words?", undefined, deps);
      expect(muse.hits()).toBe(0);
      expect(grok.hits()).toBe(0);
      expect(state.goals).toHaveLength(0);
      expect(state.messages.at(-1)?.text).toContain("“shared project files”");
      expect(state.messages.at(-1)?.text).not.toContain("the whole deletion");
      expect(state.messages.at(-1)?.text).not.toContain("The deletion");
      state = await convene(state, "Delete the client files", undefined, deps);
      expect(muse.hits()).toBe(0);
      expect(grok.hits()).toBe(1);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(1);
      expect(state.approvals).toHaveLength(0);
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
    } finally {
      await muse.close();
      await grok.close();
    }
  });

  it("ORIEL-F36 a woken deletion still follows the rule the question did not change", async () => {
    const early: Deps = { ...deps, now: () => new Date("2026-10-23T12:00:00.000Z") };
    const wakeAt = new Date("2026-10-23T13:00:00.000Z");
    await withBridge(200, { summary: "Ready.", points: [], stance: "" }, async (url, hits) => {
      let state = setConnector(initialState(), "dots", { bridgeUrl: url, token: "bridge-secret-xyz" }, early);
      state = setHandoffRule(state, "delete", true, early, "shared project files");
      state = await convene(state, "Delete the shared project files", undefined, early);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(1);
      const openId = state.handoffs[0]?.id ?? "";
      state = saveRoutine(state, state.goals[0]?.id ?? "", "Archive", early);
      state = setRoutineCadence(state, state.routines[0]?.id ?? "", "hourly", early);
      state = await convene(state, "Which steps name words?", state.goals[0]?.id, early, "skill_missing");
      expect(state.handoffRules).toHaveLength(1);
      expect(state.handoffRules[0]?.phrase).toBe("shared project files");
      expect(state.handoffs.find((item) => item.id === openId)?.status).toBe("open");
      expect(state.messages.at(-1)?.text).toContain("“shared project files”");
      expect(state.messages.at(-1)?.text).not.toContain("the whole deletion");
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
      state = await wakeDue(state, { ...deps, now: () => wakeAt });
      expect(state.goals).toHaveLength(2);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(2);
      expect(state.approvals.filter((approval) => approval.status === "open" && approval.kind === "delete")).toHaveLength(0);
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);
      expect(state.messages.some((message) => message.text.includes("I deleted"))).toBe(false);
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("Always allow");
    });
  });

  it("ORIEL-F37 a sentence asks which steps share words and does not act", async () => {
    const start = initialState();
    await expect(convene(start, "Which steps share words without asking", undefined, deps)).rejects.toThrow(/without asking/);
    await expect(convene(start, "Which steps share words always allow", undefined, deps)).rejects.toThrow(/without asking/);
    await expect(convene(start, "Please, which step shares words allow automatically", undefined, deps)).rejects.toThrow(
      /without asking/,
    );
    expect(start.messages).toHaveLength(0);
    expect(start.goals).toHaveLength(0);
    expect(start.handoffRules).toHaveLength(0);

    const none = await convene(initialState(), "Which steps share words?", undefined, deps);
    expect(none.handoffRules).toHaveLength(0);
    expect(none.goals).toHaveLength(0);
    expect(none.handoffs).toHaveLength(0);
    expect(none.approvals).toHaveLength(0);
    expect(none.messages.at(-1)?.text).toContain("No steps share words");
    expect(none.messages.at(-1)?.text).toContain("named no other step");
    expect(none.messages.at(-1)?.text).toContain("did not open a card");
    expect(none.messages.at(-1)?.text).not.toContain("“");
    expect(none.messages.at(-1)?.text).not.toContain("The deletion");
    expect(none.messages.at(-1)?.text).not.toContain("These steps share words");
    expect(none.messages.at(-1)?.text).not.toContain("the whole");
    expect(none.events.some((event) => event.type === "rule_read")).toBe(true);
    expect(none.events.some((event) => event.type === "rule_saved" || event.type === "rule_cleared" || event.type === "approved")).toBe(
      false,
    );

    const other = await convene(initialState(), "Which steps share no words?", undefined, deps);
    expect(other.goals).toHaveLength(1);
    expect(other.handoffRules).toHaveLength(0);
    expect(other.messages.at(-1)?.text).not.toContain("No steps share words");
    expect(other.messages.at(-1)?.text).not.toContain("These steps share words");

    let bare = setHandoffRule(initialState(), "delete", true, deps);
    bare = setHandoffRule(bare, "pay", true, deps);
    bare = setHandoffRule(bare, "send", true, deps, "the vendor files");
    bare = await convene(bare, "Which step shares words?", undefined, deps);
    expect(bare.goals).toHaveLength(0);
    expect(bare.handoffs).toHaveLength(0);
    expect(bare.messages.at(-1)?.text).toContain("No steps share words");
    expect(bare.messages.at(-1)?.text).not.toContain("“");
    expect(bare.messages.at(-1)?.text).not.toContain("The deletion");
    expect(bare.messages.at(-1)?.text).not.toContain("The payment");
    expect(bare.messages.at(-1)?.text).not.toContain("The send");
    expect(bare.messages.at(-1)?.text).not.toContain("the vendor files");
    expect(bare.messages.at(-1)?.text).not.toContain("the whole");

    let held = await convene(initialState(), "Email Maya the launch update", undefined, deps);
    const openId = held.approvals[0]?.id ?? "";
    const goalId = held.goals[0]?.id ?? "";
    held = setHandoffRule(held, "post", true, deps, "the launch note");
    held = setHandoffRule(held, "delete", true, deps, "shared project files");
    held = setHandoffRule(held, "send", true, deps, "Shared Project Files");
    held = setHandoffRule(held, "pay", true, deps, "unshared project files");
    const ids = held.handoffRules.map((rule) => rule.id);
    held = await convene(held, "Please, which steps share words?", goalId, deps, "skill_missing");
    expect(held.approvals.find((approval) => approval.id === openId)?.status).toBe("open");
    expect(held.goals).toHaveLength(1);
    expect(held.goals[0]?.status).toBe("waiting");
    expect(held.handoffs).toHaveLength(0);
    expect(held.handoffRules.map((rule) => rule.id)).toEqual(ids);
    const listed = held.messages.at(-1)?.text ?? "";
    expect(listed).toContain("These steps share words");
    expect(listed.indexOf("The send")).toBeGreaterThan(-1);
    expect(listed.indexOf("The deletion")).toBeGreaterThan(listed.indexOf("The send"));
    expect(listed).toContain("“Shared Project Files”");
    expect(listed).toContain("“shared project files”");
    expect(listed).not.toContain("The payment");
    expect(listed).not.toContain("The public post");
    expect(listed).not.toContain("unshared project files");
    expect(listed).not.toContain("the launch note");
    expect(listed).not.toContain("the whole");
    expect(listed).toContain("named no other step");
    expect(listed).toContain("did not approve a hold");
    expect(listed).not.toContain("No steps share words");

    let paired = setHandoffRule(held, "pay", false, deps);
    paired = setHandoffRule(paired, "pay", true, deps, "the launch note");
    paired = await convene(paired, "Which steps sharing words handed over to you?", undefined, deps);
    expect(paired.goals).toHaveLength(1);
    const both = paired.messages.at(-1)?.text ?? "";
    expect(both).toContain("These steps share words");
    expect(both.indexOf("The send")).toBeGreaterThan(-1);
    expect(both.indexOf("The payment")).toBeGreaterThan(both.indexOf("The send"));
    expect(both.indexOf("The deletion")).toBeGreaterThan(both.indexOf("The payment"));
    expect(both.indexOf("The public post")).toBeGreaterThan(both.indexOf("The deletion"));
    expect(both).toContain("“Shared Project Files”");
    expect(both).toContain("“shared project files”");
    expect(both).toContain("“the launch note”");
    expect(both).not.toContain("unshared project files");
    expect(both).not.toContain("the whole");
    expect(both).not.toContain("No steps share words");

    const named = await convene(paired, "Which steps name words?", undefined, deps);
    expect(named.messages.at(-1)?.text).toContain("These steps name words");
    expect(named.messages.at(-1)?.text).toContain("“the launch note”");
    expect(named.messages.at(-1)?.text).toContain("“Shared Project Files”");
    expect(named.messages.at(-1)?.text).not.toContain("These steps share words");
    expect(named.messages.at(-1)?.text).not.toContain("the whole");

    let unique = setHandoffRule(named, "pay", false, deps);
    unique = setHandoffRule(unique, "pay", true, deps, "the vendor invoice");
    unique = setHandoffRule(unique, "post", false, deps);
    unique = setHandoffRule(unique, "post", true, deps);
    const once = await convene(unique, "Which steps share words to me?", undefined, deps);
    const onceText = once.messages.at(-1)?.text ?? "";
    expect(onceText).toContain("These steps share words");
    expect(onceText).toContain("The send is handed to you");
    expect(onceText).toContain("The deletion is handed to you");
    expect(onceText).toContain("“Shared Project Files”");
    expect(onceText).toContain("“shared project files”");
    expect(onceText).not.toContain("The payment");
    expect(onceText).not.toContain("The public post");
    expect(onceText).not.toContain("the vendor invoice");
    expect(onceText).not.toContain("the whole");

    const stillNamed = await convene(once, "Which step names words?", undefined, deps);
    expect(stillNamed.messages.at(-1)?.text).toContain("These steps name words");
    expect(stillNamed.messages.at(-1)?.text).toContain("“the vendor invoice”");
    expect(stillNamed.messages.at(-1)?.text).not.toContain("The public post");
    expect(stillNamed.messages.at(-1)?.text).not.toContain("the whole");

    const unnamed = await convene(stillNamed, "Which steps name no words?", undefined, deps);
    expect(unnamed.messages.at(-1)?.text).toContain("the whole public post");
    expect(unnamed.messages.at(-1)?.text).not.toContain("shared project files");
    expect(unnamed.messages.at(-1)?.text).not.toContain("the vendor invoice");
    expect(unnamed.messages.at(-1)?.text).not.toContain("These steps share words");

    const mentioned = await convene(unnamed, "Which step mentions shared project files?", undefined, deps);
    expect(mentioned.messages.at(-1)?.text).toContain("The send mentions");
    expect(mentioned.messages.at(-1)?.text).toContain("The deletion mentions");
    expect(mentioned.messages.at(-1)?.text).not.toContain("The payment");
    expect(mentioned.messages.at(-1)?.text).not.toContain("No steps share words");

    const early: Deps = { ...deps, now: () => new Date("2026-10-23T12:00:00.000Z") };
    let parked = await convene(initialState(), "Draft the weekly close", undefined, early);
    parked = saveRoutine(parked, parked.goals[0]?.id ?? "", "Close", early);
    parked = setRoutineCadence(parked, parked.routines[0]?.id ?? "", "hourly", early);
    const nextRun = parked.routines[0]?.nextRunAt;
    parked = setPaused(parked, true, early);
    parked = setHandoffRule(parked, "delete", true, early, "shared project files");
    parked = setHandoffRule(parked, "send", true, early, "shared project files");
    parked = setHandoffRule(parked, "pay", true, early);
    parked = await convene(parked, "Which steps share words to you?", undefined, {
      ...deps,
      now: () => new Date("2026-10-23T13:30:00.000Z"),
    });
    expect(parked.paused).toBe(true);
    expect(parked.routines[0]?.nextRunAt).toBe(nextRun);
    expect(parked.events.some((event) => event.type === "woke" || event.type === "approved")).toBe(false);
    expect(parked.messages.at(-1)?.text).toContain("These steps share words");
    expect(parked.messages.at(-1)?.text).toContain("“shared project files”");
    expect(parked.messages.at(-1)?.text).not.toContain("The payment");
    expect(parked.messages.at(-1)?.text).not.toContain("the whole");

    await withBridge(200, { summary: "Ready.", points: [], stance: "" }, async (url, hits) => {
      let state = setConnector(initialState(), "grok", { bridgeUrl: url, token: "bridge-secret-xyz" }, deps);
      state = setPaused(state, true, deps);
      state = setHandoffRule(state, "delete", true, deps, "shared project files");
      state = setHandoffRule(state, "send", true, deps, "shared project files");
      state = setHandoffRule(state, "pay", true, deps, "the vendor invoice");
      const before = state.handoffRules.map((rule) => `${rule.id}:${rule.phrase ?? ""}`);
      state = await convene(state, "Which steps share words to you?", undefined, deps);
      expect(hits).toHaveLength(0);
      expect(state.paused).toBe(true);
      expect(state.goals).toHaveLength(0);
      expect(state.handoffs).toHaveLength(0);
      expect(state.approvals).toHaveLength(0);
      expect(state.handoffRules.map((rule) => `${rule.id}:${rule.phrase ?? ""}`)).toEqual(before);
      expect(state.messages.at(-1)?.text).toContain("The send is handed to you");
      expect(state.messages.at(-1)?.text).toContain("The deletion is handed to you");
      expect(state.messages.at(-1)?.text).not.toContain("The payment");
      expect(state.messages.at(-1)?.text).not.toContain("the vendor invoice");
      state = await convene(state, "Which steps share words and delete the archive", undefined, deps);
      expect(state.handoffRules.map((rule) => `${rule.id}:${rule.phrase ?? ""}`)).toEqual(before);
      const archive = state.goals.at(-1)?.id;
      expect(
        state.approvals.filter((approval) => approval.goalId === archive && approval.status === "open" && approval.kind === "delete"),
      ).toHaveLength(1);
      expect(state.handoffs.filter((item) => item.goalId === archive)).toHaveLength(0);
      expect(state.messages.at(-1)?.text).not.toContain("No steps share words");
      expect(state.messages.at(-1)?.text).not.toContain("named no other step");
      state = setHandoffRule(state, "delete", false, deps);
      state = setHandoffRule(state, "delete", true, deps);
      const bareBefore = state.handoffRules.map((rule) => `${rule.action}:${rule.phrase ?? ""}`);
      state = await convene(state, "Which steps share words and delete the archive", undefined, deps);
      const handed = state.goals.at(-1)?.id;
      expect(state.handoffs.filter((item) => item.goalId === handed && item.status === "open")).toHaveLength(1);
      expect(state.approvals.filter((approval) => approval.goalId === handed)).toHaveLength(0);
      expect(state.handoffRules.map((rule) => `${rule.action}:${rule.phrase ?? ""}`)).toEqual(bareBefore);
      expect(state.messages.at(-1)?.text).not.toContain("No steps share words");
      const beforeOrdinary = state.goals.length;
      state = await convene(state, "Hand deletions to me", undefined, deps);
      expect(state.goals.length).toBe(beforeOrdinary + 1);
      expect(state.handoffRules.map((rule) => `${rule.action}:${rule.phrase ?? ""}`)).toEqual(bareBefore);
      expect(state.messages.at(-1)?.text).not.toContain("No steps share words");
      expect(state.messages.at(-1)?.text).not.toContain("These steps share words");
      state = await convene(state, "Which steps name words?", undefined, deps);
      expect(state.messages.at(-1)?.text).toContain("“shared project files”");
      expect(state.messages.at(-1)?.text).toContain("“the vendor invoice”");
      expect(state.messages.at(-1)?.text).not.toContain("The deletion");
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);
      expect(hits.every((hit) => hit.raw.includes('"action":"convene"'))).toBe(true);
      expect(state.messages.some((message) => message.text.includes("I deleted"))).toBe(false);
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("bridge-secret-xyz");
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("Always allow");
    });
  });

  it("ORIEL-F37 asking which steps share words keeps client work off Muse", async () => {
    const muse = await startLocalSeat({ seat: "muse", token: "tok-muse" });
    const grok = await startLocalSeat({ seat: "grok", token: "tok-grok" });
    try {
      let state = setConnector(initialState(), "muse", { bridgeUrl: muse.url, token: "tok-muse" }, deps);
      state = setConnector(state, "grok", { bridgeUrl: grok.url, token: "tok-grok" }, deps);
      state = setHandoffRule(state, "delete", true, deps, "shared project files");
      state = setHandoffRule(state, "send", true, deps, "shared project files");
      state = await convene(state, "Which steps share words?", undefined, deps);
      expect(muse.hits()).toBe(0);
      expect(grok.hits()).toBe(0);
      expect(state.goals).toHaveLength(0);
      expect(state.messages.at(-1)?.text).toContain("These steps share words");
      expect(state.messages.at(-1)?.text).toContain("“shared project files”");
      state = await convene(state, "Delete the client files", undefined, deps);
      expect(muse.hits()).toBe(0);
      expect(grok.hits()).toBe(1);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(0);
      expect(state.approvals.filter((approval) => approval.status === "open" && approval.kind === "delete")).toHaveLength(1);
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
    } finally {
      await muse.close();
      await grok.close();
    }
  });

  it("ORIEL-F37 a woken deletion still follows the rule the question did not change", async () => {
    const early: Deps = { ...deps, now: () => new Date("2026-10-23T12:00:00.000Z") };
    const wakeAt = new Date("2026-10-23T13:00:00.000Z");
    await withBridge(200, { summary: "Ready.", points: [], stance: "" }, async (url, hits) => {
      let state = setConnector(initialState(), "dots", { bridgeUrl: url, token: "bridge-secret-xyz" }, early);
      state = setHandoffRule(state, "delete", true, early, "shared project files");
      state = setHandoffRule(state, "send", true, early, "shared project files");
      state = await convene(state, "Delete the shared project files", undefined, early);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(1);
      const openId = state.handoffs[0]?.id ?? "";
      state = saveRoutine(state, state.goals[0]?.id ?? "", "Archive", early);
      state = setRoutineCadence(state, state.routines[0]?.id ?? "", "hourly", early);
      state = await convene(state, "Which steps share words?", state.goals[0]?.id, early, "skill_missing");
      expect(state.handoffRules).toHaveLength(2);
      expect(state.handoffRules.find((rule) => rule.action === "delete")?.phrase).toBe("shared project files");
      expect(state.handoffs.find((item) => item.id === openId)?.status).toBe("open");
      expect(state.messages.at(-1)?.text).toContain("These steps share words");
      expect(state.messages.at(-1)?.text).not.toContain("the whole deletion");
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
      state = await wakeDue(state, { ...deps, now: () => wakeAt });
      expect(state.goals).toHaveLength(2);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(2);
      expect(state.approvals.filter((approval) => approval.status === "open" && approval.kind === "delete")).toHaveLength(0);
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);
      expect(state.messages.some((message) => message.text.includes("I deleted"))).toBe(false);
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("Always allow");
    });
  });

  it("ORIEL-F38 a sentence asks which words are shared and does not act", async () => {
    const start = initialState();
    await expect(convene(start, "Which words are shared without asking", undefined, deps)).rejects.toThrow(/without asking/);
    await expect(convene(start, "Which words are shared always allow", undefined, deps)).rejects.toThrow(/without asking/);
    await expect(convene(start, "Please, which word is shared allow automatically", undefined, deps)).rejects.toThrow(
      /without asking/,
    );
    expect(start.messages).toHaveLength(0);
    expect(start.goals).toHaveLength(0);
    expect(start.handoffRules).toHaveLength(0);

    const none = await convene(initialState(), "Which words are shared?", undefined, deps);
    expect(none.handoffRules).toHaveLength(0);
    expect(none.goals).toHaveLength(0);
    expect(none.handoffs).toHaveLength(0);
    expect(none.approvals).toHaveLength(0);
    expect(none.messages.at(-1)?.text).toContain("No words are shared");
    expect(none.messages.at(-1)?.text).toContain("named no other step");
    expect(none.messages.at(-1)?.text).toContain("did not open a card");
    expect(none.messages.at(-1)?.text).not.toContain("“");
    expect(none.messages.at(-1)?.text).not.toContain("The deletion");
    expect(none.messages.at(-1)?.text).not.toContain("These words are shared");
    expect(none.messages.at(-1)?.text).not.toContain("These steps share words");
    expect(none.messages.at(-1)?.text).not.toContain("the whole");
    expect(none.events.some((event) => event.type === "rule_read")).toBe(true);
    expect(none.events.some((event) => event.type === "rule_saved" || event.type === "rule_cleared" || event.type === "approved")).toBe(
      false,
    );

    const other = await convene(initialState(), "Which words are not shared?", undefined, deps);
    expect(other.goals).toHaveLength(1);
    expect(other.handoffRules).toHaveLength(0);
    expect(other.messages.at(-1)?.text).not.toContain("No words are shared");
    expect(other.messages.at(-1)?.text).not.toContain("These words are shared");

    let bare = setHandoffRule(initialState(), "delete", true, deps);
    bare = setHandoffRule(bare, "pay", true, deps);
    bare = setHandoffRule(bare, "send", true, deps, "the vendor files");
    bare = await convene(bare, "Please, which word is shared?", undefined, deps);
    expect(bare.goals).toHaveLength(0);
    expect(bare.handoffs).toHaveLength(0);
    expect(bare.messages.at(-1)?.text).toContain("No words are shared");
    expect(bare.messages.at(-1)?.text).not.toContain("“");
    expect(bare.messages.at(-1)?.text).not.toContain("The deletion");
    expect(bare.messages.at(-1)?.text).not.toContain("The payment");
    expect(bare.messages.at(-1)?.text).not.toContain("The send");
    expect(bare.messages.at(-1)?.text).not.toContain("the vendor files");
    expect(bare.messages.at(-1)?.text).not.toContain("the whole");

    let held = await convene(initialState(), "Email Maya the launch update", undefined, deps);
    const openId = held.approvals[0]?.id ?? "";
    const goalId = held.goals[0]?.id ?? "";
    held = setHandoffRule(held, "post", true, deps, "the launch note");
    held = setHandoffRule(held, "delete", true, deps, "shared project files");
    held = setHandoffRule(held, "send", true, deps, "Shared Project Files");
    held = setHandoffRule(held, "pay", true, deps, "unshared project files");
    const ids = held.handoffRules.map((rule) => rule.id);
    held = await convene(held, "Please, which words are shared?", goalId, deps, "skill_missing");
    expect(held.approvals.find((approval) => approval.id === openId)?.status).toBe("open");
    expect(held.goals).toHaveLength(1);
    expect(held.goals[0]?.status).toBe("waiting");
    expect(held.handoffs).toHaveLength(0);
    expect(held.handoffRules.map((rule) => rule.id)).toEqual(ids);
    const listed = held.messages.at(-1)?.text ?? "";
    expect(listed).toContain("These words are shared");
    expect(listed).toContain("“Shared Project Files” is used by The send and The deletion.");
    expect(listed.split("“Shared Project Files”").length - 1).toBe(1);
    expect(listed).not.toContain("“shared project files”");
    expect(listed.indexOf("The send")).toBeGreaterThan(-1);
    expect(listed.indexOf("The deletion")).toBeGreaterThan(listed.indexOf("The send"));
    expect(listed).not.toContain("The payment");
    expect(listed).not.toContain("The public post");
    expect(listed).not.toContain("unshared project files");
    expect(listed).not.toContain("the launch note");
    expect(listed).not.toContain("the whole");
    expect(listed).toContain("named no other step");
    expect(listed).toContain("did not approve a hold");
    expect(listed).not.toContain("No words are shared");
    expect(listed).not.toContain("These steps share words");

    let paired = setHandoffRule(held, "pay", false, deps);
    paired = setHandoffRule(paired, "pay", true, deps, "the launch note");
    paired = await convene(paired, "Which words are shared handed over to you?", undefined, deps);
    expect(paired.goals).toHaveLength(1);
    const both = paired.messages.at(-1)?.text ?? "";
    expect(both).toContain("These words are shared");
    expect(both).toContain("“Shared Project Files” is used by The send and The deletion.");
    expect(both).toContain("“the launch note” is used by The payment and The public post.");
    expect(both.indexOf("“Shared Project Files”")).toBeLessThan(both.indexOf("“the launch note”"));
    expect(both.indexOf("The send")).toBeLessThan(both.indexOf("The deletion"));
    expect(both.indexOf("The payment")).toBeLessThan(both.indexOf("The public post"));
    expect(both.split("“the launch note”").length - 1).toBe(1);
    expect(both).not.toContain("unshared project files");
    expect(both).not.toContain("the whole");
    expect(both).not.toContain("No words are shared");
    expect(both).not.toContain("These steps share words");

    const steps = await convene(paired, "Which steps share words?", undefined, deps);
    const stepsText = steps.messages.at(-1)?.text ?? "";
    expect(stepsText).toContain("These steps share words");
    expect(stepsText).toContain("“Shared Project Files”");
    expect(stepsText).toContain("“shared project files”");
    expect(stepsText).toContain("“the launch note”");
    expect(stepsText.split("“the launch note”").length - 1).toBe(2);
    expect(stepsText).not.toContain("These words are shared");
    expect(stepsText).not.toContain("No words are shared");

    let triple = setHandoffRule(steps, "pay", false, deps);
    triple = setHandoffRule(triple, "pay", true, deps, "shared project files");
    const three = await convene(triple, "Which word is shared to me?", undefined, deps);
    const threeText = three.messages.at(-1)?.text ?? "";
    expect(threeText).toContain("“Shared Project Files” is used by The send, The payment, and The deletion.");
    expect(threeText).not.toContain("the launch note");
    expect(threeText).not.toContain("The public post");
    expect(threeText.split("“Shared Project Files”").length - 1).toBe(1);
    expect(threeText).not.toContain("“shared project files”");
    expect(threeText).not.toContain("the whole");

    const named = await convene(three, "Which steps name words?", undefined, deps);
    expect(named.messages.at(-1)?.text).toContain("These steps name words");
    expect(named.messages.at(-1)?.text).toContain("“the launch note”");
    expect(named.messages.at(-1)?.text).toContain("“Shared Project Files”");
    expect(named.messages.at(-1)?.text).toContain("“shared project files”");
    expect(named.messages.at(-1)?.text).not.toContain("These words are shared");
    expect(named.messages.at(-1)?.text).not.toContain("the whole");

    let unique = setHandoffRule(named, "pay", false, deps);
    unique = setHandoffRule(unique, "pay", true, deps, "the vendor invoice");
    unique = setHandoffRule(unique, "post", false, deps);
    unique = setHandoffRule(unique, "post", true, deps);
    const once = await convene(unique, "Which words are shared to me?", undefined, deps);
    const onceText = once.messages.at(-1)?.text ?? "";
    expect(onceText).toContain("These words are shared");
    expect(onceText).toContain("“Shared Project Files” is used by The send and The deletion.");
    expect(onceText.split("“Shared Project Files”").length - 1).toBe(1);
    expect(onceText).not.toContain("The payment");
    expect(onceText).not.toContain("The public post");
    expect(onceText).not.toContain("the vendor invoice");
    expect(onceText).not.toContain("the whole");

    const stillNamed = await convene(once, "Which step names words?", undefined, deps);
    expect(stillNamed.messages.at(-1)?.text).toContain("These steps name words");
    expect(stillNamed.messages.at(-1)?.text).toContain("“the vendor invoice”");
    expect(stillNamed.messages.at(-1)?.text).not.toContain("The public post");
    expect(stillNamed.messages.at(-1)?.text).not.toContain("the whole");

    const unnamed = await convene(stillNamed, "Which steps name no words?", undefined, deps);
    expect(unnamed.messages.at(-1)?.text).toContain("the whole public post");
    expect(unnamed.messages.at(-1)?.text).not.toContain("shared project files");
    expect(unnamed.messages.at(-1)?.text).not.toContain("the vendor invoice");
    expect(unnamed.messages.at(-1)?.text).not.toContain("These words are shared");

    const mentioned = await convene(unnamed, "Which step mentions shared project files?", undefined, deps);
    expect(mentioned.messages.at(-1)?.text).toContain("The send mentions");
    expect(mentioned.messages.at(-1)?.text).toContain("The deletion mentions");
    expect(mentioned.messages.at(-1)?.text).not.toContain("The payment");
    expect(mentioned.messages.at(-1)?.text).not.toContain("No words are shared");

    const words = await convene(mentioned, "Which words does a deletion hand to me?", undefined, deps);
    expect(words.messages.at(-1)?.text).toContain("The words are “shared project files”");
    expect(words.messages.at(-1)?.text).not.toContain("These words are shared");
    expect(words.messages.at(-1)?.text).not.toContain("The send");

    const early: Deps = { ...deps, now: () => new Date("2026-10-23T12:00:00.000Z") };
    let parked = await convene(initialState(), "Draft the weekly close", undefined, early);
    parked = saveRoutine(parked, parked.goals[0]?.id ?? "", "Close", early);
    parked = setRoutineCadence(parked, parked.routines[0]?.id ?? "", "hourly", early);
    const nextRun = parked.routines[0]?.nextRunAt;
    parked = setPaused(parked, true, early);
    parked = setHandoffRule(parked, "delete", true, early, "shared project files");
    parked = setHandoffRule(parked, "send", true, early, "shared project files");
    parked = setHandoffRule(parked, "pay", true, early);
    parked = await convene(parked, "Which words are shared to you?", undefined, {
      ...deps,
      now: () => new Date("2026-10-23T13:30:00.000Z"),
    });
    expect(parked.paused).toBe(true);
    expect(parked.routines[0]?.nextRunAt).toBe(nextRun);
    expect(parked.events.some((event) => event.type === "woke" || event.type === "approved")).toBe(false);
    expect(parked.messages.at(-1)?.text).toContain("These words are shared");
    expect(parked.messages.at(-1)?.text).toContain("“shared project files” is used by The send and The deletion.");
    expect(parked.messages.at(-1)?.text).not.toContain("The payment");
    expect(parked.messages.at(-1)?.text).not.toContain("the whole");

    await withBridge(200, { summary: "Ready.", points: [], stance: "" }, async (url, hits) => {
      let state = setConnector(initialState(), "grok", { bridgeUrl: url, token: "bridge-secret-xyz" }, deps);
      state = setPaused(state, true, deps);
      state = setHandoffRule(state, "delete", true, deps, "shared project files");
      state = setHandoffRule(state, "send", true, deps, "Shared Project Files");
      state = setHandoffRule(state, "pay", true, deps, "the vendor invoice");
      const before = state.handoffRules.map((rule) => `${rule.id}:${rule.phrase ?? ""}`);
      state = await convene(state, "Which words are shared to you?", undefined, deps);
      expect(hits).toHaveLength(0);
      expect(state.paused).toBe(true);
      expect(state.goals).toHaveLength(0);
      expect(state.handoffs).toHaveLength(0);
      expect(state.approvals).toHaveLength(0);
      expect(state.handoffRules.map((rule) => `${rule.id}:${rule.phrase ?? ""}`)).toEqual(before);
      expect(state.messages.at(-1)?.text).toContain("“Shared Project Files” is used by The send and The deletion.");
      expect(state.messages.at(-1)?.text).not.toContain("The payment");
      expect(state.messages.at(-1)?.text).not.toContain("the vendor invoice");
      state = await convene(state, "Which words are shared and delete the archive", undefined, deps);
      expect(state.handoffRules.map((rule) => `${rule.id}:${rule.phrase ?? ""}`)).toEqual(before);
      const archive = state.goals.at(-1)?.id;
      expect(
        state.approvals.filter((approval) => approval.goalId === archive && approval.status === "open" && approval.kind === "delete"),
      ).toHaveLength(1);
      expect(state.handoffs.filter((item) => item.goalId === archive)).toHaveLength(0);
      expect(state.messages.at(-1)?.text).not.toContain("No words are shared");
      expect(state.messages.at(-1)?.text).not.toContain("named no other step");
      state = setHandoffRule(state, "delete", false, deps);
      state = setHandoffRule(state, "delete", true, deps);
      const bareBefore = state.handoffRules.map((rule) => `${rule.action}:${rule.phrase ?? ""}`);
      state = await convene(state, "Which words are shared and delete the archive", undefined, deps);
      const handed = state.goals.at(-1)?.id;
      expect(state.handoffs.filter((item) => item.goalId === handed && item.status === "open")).toHaveLength(1);
      expect(state.approvals.filter((approval) => approval.goalId === handed)).toHaveLength(0);
      expect(state.handoffRules.map((rule) => `${rule.action}:${rule.phrase ?? ""}`)).toEqual(bareBefore);
      expect(state.messages.at(-1)?.text).not.toContain("No words are shared");
      const beforeOrdinary = state.goals.length;
      state = await convene(state, "Hand deletions to me", undefined, deps);
      expect(state.goals.length).toBe(beforeOrdinary + 1);
      expect(state.handoffRules.map((rule) => `${rule.action}:${rule.phrase ?? ""}`)).toEqual(bareBefore);
      expect(state.messages.at(-1)?.text).not.toContain("No words are shared");
      expect(state.messages.at(-1)?.text).not.toContain("These words are shared");
      state = await convene(state, "Which steps share words?", undefined, deps);
      expect(state.messages.at(-1)?.text).toContain("No steps share words");
      expect(state.messages.at(-1)?.text).not.toContain("The deletion");
      expect(state.messages.at(-1)?.text).not.toContain("Shared Project Files");
      expect(state.messages.at(-1)?.text).not.toContain("the vendor invoice");
      expect(state.messages.at(-1)?.text).not.toContain("These words are shared");
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);
      expect(hits.every((hit) => hit.raw.includes('"action":"convene"'))).toBe(true);
      expect(state.messages.some((message) => message.text.includes("I deleted"))).toBe(false);
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("bridge-secret-xyz");
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("Always allow");
    });
  });

  it("ORIEL-F38 asking which words are shared keeps client work off Muse", async () => {
    const muse = await startLocalSeat({ seat: "muse", token: "tok-muse" });
    const grok = await startLocalSeat({ seat: "grok", token: "tok-grok" });
    try {
      let state = setConnector(initialState(), "muse", { bridgeUrl: muse.url, token: "tok-muse" }, deps);
      state = setConnector(state, "grok", { bridgeUrl: grok.url, token: "tok-grok" }, deps);
      state = setHandoffRule(state, "delete", true, deps, "shared project files");
      state = setHandoffRule(state, "send", true, deps, "shared project files");
      state = await convene(state, "Which words are shared?", undefined, deps);
      expect(muse.hits()).toBe(0);
      expect(grok.hits()).toBe(0);
      expect(state.goals).toHaveLength(0);
      expect(state.messages.at(-1)?.text).toContain("These words are shared");
      expect(state.messages.at(-1)?.text).toContain("“shared project files” is used by The send and The deletion.");
      state = await convene(state, "Delete the client files", undefined, deps);
      expect(muse.hits()).toBe(0);
      expect(grok.hits()).toBe(1);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(0);
      expect(state.approvals.filter((approval) => approval.status === "open" && approval.kind === "delete")).toHaveLength(1);
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
    } finally {
      await muse.close();
      await grok.close();
    }
  });

  it("ORIEL-F38 a woken deletion still follows the rule the question did not change", async () => {
    const early: Deps = { ...deps, now: () => new Date("2026-10-23T12:00:00.000Z") };
    const wakeAt = new Date("2026-10-23T13:00:00.000Z");
    await withBridge(200, { summary: "Ready.", points: [], stance: "" }, async (url, hits) => {
      let state = setConnector(initialState(), "dots", { bridgeUrl: url, token: "bridge-secret-xyz" }, early);
      state = setHandoffRule(state, "delete", true, early, "shared project files");
      state = setHandoffRule(state, "send", true, early, "shared project files");
      state = await convene(state, "Delete the shared project files", undefined, early);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(1);
      const openId = state.handoffs[0]?.id ?? "";
      state = saveRoutine(state, state.goals[0]?.id ?? "", "Archive", early);
      state = setRoutineCadence(state, state.routines[0]?.id ?? "", "hourly", early);
      state = await convene(state, "Which words are shared?", state.goals[0]?.id, early, "skill_missing");
      expect(state.handoffRules).toHaveLength(2);
      expect(state.handoffRules.find((rule) => rule.action === "delete")?.phrase).toBe("shared project files");
      expect(state.handoffs.find((item) => item.id === openId)?.status).toBe("open");
      expect(state.messages.at(-1)?.text).toContain("These words are shared");
      expect(state.messages.at(-1)?.text).not.toContain("the whole deletion");
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
      state = await wakeDue(state, { ...deps, now: () => wakeAt });
      expect(state.goals).toHaveLength(2);
      expect(state.handoffs.filter((item) => item.status === "open")).toHaveLength(2);
      expect(state.approvals.filter((approval) => approval.status === "open" && approval.kind === "delete")).toHaveLength(0);
      expect(state.events.some((event) => event.type === "approved")).toBe(false);
      expect(hits.some((hit) => hit.raw.includes('"action":"released"'))).toBe(false);
      expect(state.messages.some((message) => message.text.includes("I deleted"))).toBe(false);
      expect(JSON.stringify(toPublic(state, 0))).not.toContain("Always allow");
    });
  });
});

describe("flagship traceability", () => {
  it("every flagship id is named by a test", async () => {
    const sources = [
      await readFile("tests/orchestrator.test.ts", "utf8"),
      await readFile("tests/server.test.ts", "utf8"),
      await readFile("e2e/oriel.spec.ts", "utf8"),
    ];
    for (const story of flagshipStories()) {
      expect(sources.some((source) => source.includes(story.id)), story.id).toBe(true);
    }
  });
});
