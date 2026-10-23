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
        events: [],
      }),
    );
    const server = await startServer({ port: 0, host: "127.0.0.1", dataDir: dir, testMode: true });
    running.push({ close: server.close, dir });
    const state = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(state.routines[0]).toMatchObject({ cadence: "manual", nextRunAt: null, name: "Old close" });
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
