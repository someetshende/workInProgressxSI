import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../src/core/brief.js";
import { convene, reviewWatches, runRoutine, saveRoutine, setConnector, settle } from "../src/core/convene.js";
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
