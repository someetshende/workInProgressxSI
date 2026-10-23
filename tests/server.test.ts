import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { startServer } from "../src/server/index.js";

const SECRET = "bridge-token-should-stay-private";
const running: { close: () => Promise<void>; dir: string }[] = [];

afterEach(async () => {
  while (running.length) {
    const server = running.pop();
    if (!server) continue;
    await server.close();
    await rm(server.dir, { recursive: true, force: true });
  }
});

async function boot(testMode = true) {
  const dir = await mkdtemp(path.join(tmpdir(), "oriel-"));
  const server = await startServer({ port: 0, host: "127.0.0.1", dataDir: dir, testMode });
  running.push({ close: server.close, dir });
  return server;
}

describe("Oriel server", () => {
  it("ORIEL-F09 keeps a bridge token out of public state and state.json", async () => {
    const server = await boot();
    const saved = await fetch(`${server.url}/api/connectors/grok`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: SECRET, bridgeUrl: "http://127.0.0.1:9/tasks" }),
    });
    expect(saved.status).toBe(200);
    const body = await saved.text();
    expect(body).not.toContain(SECRET);
    expect(body).toContain('"hasToken":true');
    const disk = await readFile(path.join(server.dir, "state.json"), "utf8");
    expect(disk).not.toContain(SECRET);
    const secrets = await readFile(path.join(server.dir, "secrets.json"), "utf8");
    expect(secrets).toContain(SECRET);
    const events = JSON.parse(body).events.map((event: { detail: string }) => event.detail).join("\n");
    expect(events).toContain("Token updated");
    expect(events).not.toContain(SECRET);
  });

  it("writes a desk brief and refuses path traversal", async () => {
    const server = await boot();
    const turn = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Summarize the market landscape" }),
    });
    const state = await turn.json();
    const goalId = state.goals[0].id as string;
    const brief = await fetch(`${server.url}/api/goals/${goalId}/brief`);
    expect(brief.headers.get("content-type")).toContain("text/markdown");
    expect(await brief.text()).toContain("Recommendation");
    const desk = await readFile(path.join(server.dir, "desk", goalId, "brief.md"), "utf8");
    expect(desk).toContain("market landscape");
    const escaped = await fetch(`${server.url}/fonts/newsreader/%2e%2e/%2e%2e/package.json`);
    expect(escaped.status).toBe(404);
    const secrets = await fetch(`${server.url}/secrets.json`);
    expect(secrets.status).toBe(404);
  });

  it("caps the atlas page and hides reset outside tests", async () => {
    const server = await boot();
    const atlas = await fetch(`${server.url}/api/stories?limit=10000`).then((response) => response.json());
    expect(atlas.total).toBeGreaterThanOrEqual(1000);
    expect(atlas.stories.length).toBeLessThanOrEqual(100);
    const health = await fetch(`${server.url}/api/health`).then((response) => response.json());
    expect(health).toMatchObject({ ok: true, product: "Oriel", atlas: atlas.total });

    const closed = await startServer({
      port: 0,
      host: "127.0.0.1",
      dataDir: await mkdtemp(path.join(tmpdir(), "oriel-closed-")),
      testMode: false,
    });
    running.push({ close: closed.close, dir: closed.dir });
    const reset = await fetch(`${closed.url}/api/reset`, { method: "POST" });
    expect(reset.status).toBe(404);
  });

  it("ORIEL-F19 leaves a future routine asleep, and a forced wake is test-only", async () => {
    const server = await boot();
    const turn = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Draft the weekly close but do not send it" }),
    });
    const goalId = (await turn.json()).goals[0].id as string;
    const saved = await fetch(`${server.url}/api/routines`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goalId }),
    });
    const routineId = (await saved.json()).routines[0].id as string;
    const cadence = await fetch(`${server.url}/api/routines/${routineId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cadence: "daily" }),
    });
    expect(cadence.status).toBe(200);
    const asleep = await fetch(`${server.url}/api/tick`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect((await asleep.json()).goals).toHaveLength(1);

    const closed = await startServer({
      port: 0,
      host: "127.0.0.1",
      dataDir: await mkdtemp(path.join(tmpdir(), "oriel-closed-")),
      testMode: false,
    });
    running.push({ close: closed.close, dir: closed.dir });
    const hidden = await fetch(`${closed.url}/api/tick`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ force: true }),
    });
    expect(hidden.status).toBe(404);

    const woke = await fetch(`${server.url}/api/tick`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ force: true }),
    });
    const body = await woke.json();
    expect(body.goals).toHaveLength(2);
    expect(body.messages.some((message: { via?: string }) => message.via === "wake")).toBe(true);
    expect(body.approvals.filter((approval: { status: string }) => approval.status === "open")).toHaveLength(0);
    expect(JSON.stringify(body)).toContain("Nothing was sent or spent");
  });

  it("wakes a due routine on its own interval", async () => {
    let now = new Date("2026-10-23T12:00:00.000Z");
    const dir = await mkdtemp(path.join(tmpdir(), "oriel-wake-"));
    const server = await startServer({
      port: 0,
      host: "127.0.0.1",
      dataDir: dir,
      testMode: true,
      wake: true,
      wakeMs: 40,
      now: () => now,
    });
    running.push({ close: server.close, dir });
    const turn = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Draft the weekly close but do not send it" }),
    });
    const goalId = (await turn.json()).goals[0].id as string;
    const saved = await fetch(`${server.url}/api/routines`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goalId, cadence: "daily" }),
    });
    expect(saved.status).toBe(200);
    now = new Date("2026-10-24T12:00:00.000Z");
    let goals = 1;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const state = await fetch(`${server.url}/api/state`).then((response) => response.json());
      goals = state.goals.length;
      if (goals >= 2) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(goals).toBe(2);
  });

  it("reads a routine saved before cadences existed", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "oriel-old-"));
    await writeFile(
      path.join(dir, "state.json"),
      JSON.stringify({
        seq: 1,
        memory: { preferences: [], people: [] },
        connectors: [
          { id: "grok", displayName: "Grok Bot", enabled: true, bridgeUrl: null, token: null, lastResult: "idle", lastError: null },
          { id: "dots", displayName: "Dots", enabled: true, bridgeUrl: null, token: null, lastResult: "idle", lastError: null },
          { id: "muse", displayName: "Muse", enabled: true, bridgeUrl: null, token: null, lastResult: "idle", lastError: null },
        ],
        goals: [],
        messages: [],
        approvals: [],
        routines: [
          {
            id: "routine_old",
            name: "Old close",
            instruction: "Draft the weekly close but do not send it",
            createdAt: "2026-10-23T12:00:00.000Z",
            lastRunAt: null,
          },
        ],
        skills: [
          { id: "skill_bad" },
          {
            id: "skill_ok",
            name: "Close",
            method: "Do not send the close",
            createdAt: "2026-10-23T12:00:00.000Z",
          },
        ],
        handoffRules: [
          { id: "rule_bad" },
          { id: "rule_allow", action: "allow", createdAt: "2026-10-23T12:00:00.000Z" },
          { id: "rule_ok", action: "delete", createdAt: "2026-10-23T12:00:00.000Z" },
          { id: "rule_dup", action: "delete", createdAt: "2026-10-23T13:00:00.000Z" },
        ],
        events: [],
      }),
    );
    const server = await startServer({ port: 0, host: "127.0.0.1", dataDir: dir, testMode: true });
    running.push({ close: server.close, dir });
    const state = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(state.routines[0]).toMatchObject({ cadence: "manual", nextRunAt: null, name: "Old close" });
    expect(state.paused).toBe(false);
    expect(state.skills).toEqual([
      {
        id: "skill_ok",
        name: "Close",
        method: "Do not send the close",
        createdAt: "2026-10-23T12:00:00.000Z",
      },
    ]);
    expect(state.handoffRules).toEqual([
      { id: "rule_ok", action: "delete", createdAt: "2026-10-23T12:00:00.000Z" },
    ]);
  });

  it("ORIEL-F22 saves a skill and refuses an unknown one", async () => {
    const server = await boot();
    const turn = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Draft the weekly close but do not send it" }),
    });
    const opened = await turn.json();
    const goalId = opened.goals[0].id as string;
    const saved = await fetch(`${server.url}/api/skills`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goalId, name: "Weekly close" }),
    });
    expect(saved.status).toBe(200);
    const skilled = await saved.json();
    expect(skilled.skills).toHaveLength(1);
    expect(skilled.routines).toHaveLength(0);
    const skillId = skilled.skills[0].id as string;
    const applied = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Email Maya the launch update", skillId }),
    });
    expect(applied.status).toBe(200);
    const next = await applied.json();
    expect(next.approvals.filter((approval: { status: string }) => approval.status === "open")).toHaveLength(0);
    expect(JSON.stringify(next)).toContain("Using the skill");
    expect(JSON.stringify(next)).not.toContain("I sent");
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Compare the market landscape", skillId: "skill_missing" }),
    });
    expect(missing.status).toBe(404);
  });

  it("ORIEL-F21 a pause keeps a forced wake from running", async () => {
    const server = await boot();
    const turn = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Email Maya the launch update" }),
    });
    const opened = await turn.json();
    const goalId = opened.goals[0].id as string;
    expect(opened.approvals[0].status).toBe("open");
    const saved = await fetch(`${server.url}/api/routines`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goalId, cadence: "daily" }),
    });
    expect(saved.status).toBe(200);
    const pause = await fetch(`${server.url}/api/pause`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paused: true }),
    });
    expect(pause.status).toBe(200);
    const paused = await pause.json();
    expect(paused.paused).toBe(true);
    expect(paused.goals).toHaveLength(1);
    expect(paused.approvals[0].status).toBe("open");
    const tick = await fetch(`${server.url}/api/tick`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ force: true }),
    });
    const slept = await tick.json();
    expect(slept.goals).toHaveLength(1);
    expect(slept.approvals.filter((approval: { status: string }) => approval.status === "open")).toHaveLength(1);
    expect(JSON.stringify(slept)).toContain("Nothing was sent or spent");
    const disk = await readFile(path.join(server.dir, "state.json"), "utf8");
    expect(JSON.parse(disk).paused).toBe(true);
  });

  it("ORIEL-F23 expires an unattended hold only in the test desk", async () => {
    const closed = await startServer({
      port: 0,
      host: "127.0.0.1",
      dataDir: await mkdtemp(path.join(tmpdir(), "oriel-closed-")),
      testMode: false,
    });
    running.push({ close: closed.close, dir: closed.dir });
    const hidden = await fetch(`${closed.url}/api/holds/expire`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "approve" }),
    });
    expect(hidden.status).toBe(404);

    const server = await boot();
    const turn = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Email Maya the launch update" }),
    });
    const opened = await turn.json();
    const goalId = opened.goals[0].id as string;
    const presentId = opened.approvals[0].id as string;
    expect(opened.approvals[0].expiresAt).toBeNull();
    await fetch(`${server.url}/api/routines`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goalId }),
    });
    const routineId = (await (await fetch(`${server.url}/api/state`)).json()).routines[0].id as string;
    await fetch(`${server.url}/api/routines/${routineId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cadence: "daily" }),
    });
    const woke = await fetch(`${server.url}/api/tick`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ force: true }),
    });
    const woken = await woke.json();
    const away = woken.approvals.find((approval: { id: string; expiresAt: string | null }) => approval.expiresAt);
    expect(away.status).toBe("open");
    expect(woken.approvals.find((approval: { id: string }) => approval.id === presentId).status).toBe("open");

    const expired = await fetch(`${server.url}/api/holds/expire`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "approve" }),
    });
    expect(expired.status).toBe(200);
    const body = await expired.json();
    expect(body.approvals.find((approval: { id: string }) => approval.id === away.id).status).toBe("expired");
    expect(body.approvals.find((approval: { id: string }) => approval.id === presentId).status).toBe("open");
    expect(JSON.stringify(body)).not.toContain("Always allow");
    expect(JSON.stringify(body)).toContain("did not run");

    const late = await fetch(`${server.url}/api/approvals/${away.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "approve" }),
    });
    expect(late.status).toBe(409);
    const kept = await fetch(`${server.url}/api/approvals/${presentId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "approve" }),
    });
    const released = await kept.json();
    expect(kept.status).toBe(200);
    expect(released.approvals.find((approval: { id: string }) => approval.id === presentId).status).toBe("approved");
    expect(released.approvals.find((approval: { id: string }) => approval.id === away.id).status).toBe("expired");
    expect(released.messages.at(-1).text).toContain("Nothing left this computer");
    expect(JSON.stringify(released)).not.toContain("I sent");
    expect(JSON.stringify(released)).not.toContain("Always allow");
  });

  it("ORIEL-F24 records a handoff without storing the password or releasing a hold", async () => {
    const server = await boot();
    const secret = "server-password-value";
    const turn = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: `Sign in to the shop and email Maya the receipt. Change my password to ${secret}` }),
    });
    expect(turn.status).toBe(200);
    const opened = await turn.json();
    expect(JSON.stringify(opened)).not.toContain(secret);
    expect(opened.handoffs[0].status).toBe("open");
    expect(opened.approvals.some((approval: { status: string; kind: string }) => approval.kind === "send" && approval.status === "open")).toBe(
      true,
    );
    const done = await fetch(`${server.url}/api/handoffs/${opened.handoffs[0].id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "done", password: secret }),
    });
    expect(done.status).toBe(200);
    const after = await done.json();
    expect(after.handoffs[0].status).toBe("done");
    expect(after.approvals.some((approval: { status: string; kind: string }) => approval.kind === "send" && approval.status === "open")).toBe(
      true,
    );
    expect(after.messages.at(-1).text).toContain("did not type a password");
    expect(JSON.stringify(after)).not.toContain(secret);
    expect(after.events.some((event: { type: string }) => event.type === "approved")).toBe(false);
    const disk = await readFile(path.join(server.dir, "state.json"), "utf8");
    expect(disk).not.toContain(secret);
  });

  it("ORIEL-F25 saves one handoff rule per named action and does not run it", async () => {
    const server = await boot();
    const bad = await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "allow", enabled: true }),
    });
    expect(bad.status).toBe(400);
    const saved = await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true }),
    });
    expect(saved.status).toBe(200);
    const again = await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true }),
    });
    const ruled = await again.json();
    expect(ruled.handoffRules).toHaveLength(1);
    expect(ruled.events.filter((event: { type: string }) => event.type === "rule_saved")).toHaveLength(1);
    const draft = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Draft the weekly close" }),
    });
    const drafted = await draft.json();
    expect(drafted.handoffs).toHaveLength(0);
    const turn = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Delete the shared project files" }),
    });
    const opened = await turn.json();
    expect(opened.handoffs).toHaveLength(1);
    expect(opened.approvals.filter((approval: { status: string }) => approval.status === "open")).toHaveLength(0);
    expect(JSON.stringify(opened)).toContain("Your rule hands the deletion to you");
    expect(JSON.stringify(opened)).not.toContain("Always allow");
    const done = await fetch(`${server.url}/api/handoffs/${opened.handoffs[0].id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "done" }),
    });
    const after = await done.json();
    expect(after.handoffs[0].status).toBe("done");
    expect(after.events.some((event: { type: string }) => event.type === "approved")).toBe(false);
    expect(after.messages.at(-1).text).toContain("did not type a password");
    const cleared = await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: false }),
    });
    const empty = await cleared.json();
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.events.some((event: { type: string }) => event.type === "approved")).toBe(false);
    const tick = await fetch(`${server.url}/api/tick`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ force: true }),
    });
    const slept = await tick.json();
    expect(slept.goals).toHaveLength(opened.goals.length);
    expect(slept.routines).toHaveLength(0);
  });

  it("rejects an empty turn", async () => {
    const server = await boot();
    const response = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "   " }),
    });
    expect(response.status).toBe(400);
  });
});
