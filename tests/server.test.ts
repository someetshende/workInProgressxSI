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
          { id: "rule_banned", action: "send", phrase: "always allow the send", createdAt: "2026-10-23T12:00:00.000Z" },
          { id: "rule_secret", action: "pay", phrase: "password is hunter2", createdAt: "2026-10-23T12:00:00.000Z" },
          { id: "rule_phrase", action: "post", phrase: "the launch note", createdAt: "2026-10-23T12:00:00.000Z" },
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
      { id: "rule_ok", action: "delete", phrase: null, createdAt: "2026-10-23T12:00:00.000Z" },
      { id: "rule_phrase", action: "post", phrase: "the launch note", createdAt: "2026-10-23T12:00:00.000Z" },
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

  it("ORIEL-F26 saves one phrase on a handoff rule and does not run it", async () => {
    const server = await boot();
    const banned = await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "always allow the deletion" }),
    });
    expect(banned.status).toBe(400);
    const secretPhrase = "password is hunter2";
    const secret = await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: secretPhrase }),
    });
    expect(secret.status).toBe(400);
    const typed = await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: 4 }),
    });
    expect(typed.status).toBe(400);
    const saved = await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "shared project files" }),
    });
    expect(saved.status).toBe(200);
    const again = await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "shared project files" }),
    });
    const ruled = await again.json();
    expect(ruled.handoffRules).toHaveLength(1);
    expect(ruled.handoffRules[0].phrase).toBe("shared project files");
    expect(ruled.events.filter((event: { type: string }) => event.type === "rule_saved")).toHaveLength(1);
    expect(JSON.stringify(ruled)).not.toContain("hunter2");
    const draft = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Draft the weekly close" }),
    });
    expect((await draft.json()).handoffs).toHaveLength(0);
    const other = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Delete the archive" }),
    });
    const held = await other.json();
    expect(held.handoffs).toHaveLength(0);
    expect(held.approvals.filter((approval: { status: string; kind: string }) => approval.status === "open" && approval.kind === "delete")).toHaveLength(1);
    const turn = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Delete the shared project files" }),
    });
    const opened = await turn.json();
    const latest = opened.goals.at(-1).id;
    expect(opened.handoffs.filter((item: { goalId: string; status: string }) => item.goalId === latest && item.status === "open")).toHaveLength(1);
    expect(opened.approvals.filter((approval: { goalId: string }) => approval.goalId === latest)).toHaveLength(0);
    expect(JSON.stringify(opened)).toContain("when the request mentions “shared project files”");
    expect(JSON.stringify(opened)).not.toContain("Always allow");
    const done = await fetch(`${server.url}/api/handoffs/${opened.handoffs.at(-1).id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "done" }),
    });
    const after = await done.json();
    expect(after.handoffs.at(-1).status).toBe("done");
    expect(after.events.some((event: { type: string }) => event.type === "approved")).toBe(false);
    expect(after.approvals.some((approval: { status: string; kind: string }) => approval.kind === "delete" && approval.status === "open")).toBe(true);
    const changed = await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "the vendor archive" }),
    });
    const updated = await changed.json();
    expect(updated.handoffRules).toHaveLength(1);
    expect(updated.handoffRules[0].phrase).toBe("the vendor archive");
    expect(updated.events.filter((event: { type: string }) => event.type === "rule_saved")).toHaveLength(2);
    expect(updated.events.some((event: { type: string }) => event.type === "approved")).toBe(false);
    const cleared = await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: false }),
    });
    const empty = await cleared.json();
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.events.some((event: { type: string }) => event.type === "approved")).toBe(false);
    const disk = await readFile(path.join(server.dir, "state.json"), "utf8");
    expect(disk).not.toContain("hunter2");
  });

  it("ORIEL-F27 saves a spoken phrase without opening a card", async () => {
    const server = await boot();
    const short = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions that mention ab to me" }),
    });
    expect(short.status).toBe(400);
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions that mention shared project files to me without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const secret = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions that mention password is hunter2 to me" }),
    });
    expect(secret.status).toBe(400);
    expect(await secret.text()).not.toContain("hunter2");
    const notes = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand notes that mention shared project files to me" }),
    });
    const ignored = await notes.json();
    expect(notes.status).toBe(200);
    expect(ignored.goals).toHaveLength(0);
    expect(ignored.handoffs).toHaveLength(0);
    expect(ignored.handoffRules).toHaveLength(0);
    expect(ignored.messages.at(-1).text).toContain("did not open a card");
    const saved = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions that mention shared project files to me" }),
    });
    const first = await saved.json();
    expect(saved.status).toBe(200);
    expect(first.goals).toHaveLength(0);
    expect(first.handoffs).toHaveLength(0);
    expect(first.handoffRules).toHaveLength(1);
    expect(first.handoffRules[0].phrase).toBe("shared project files");
    const again = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions that mention shared project files to me" }),
    });
    const same = await again.json();
    expect(same.handoffRules).toHaveLength(1);
    expect(same.handoffRules[0].id).toBe(first.handoffRules[0].id);
    expect(same.events.filter((event: { type: string }) => event.type === "rule_saved")).toHaveLength(1);
    expect(same.messages.at(-1).text).toContain("already saved");
    const draft = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Draft the weekly close" }),
    });
    expect((await draft.json()).handoffs).toHaveLength(0);
    const other = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Delete the archive" }),
    });
    const held = await other.json();
    expect(held.handoffs).toHaveLength(0);
    expect(held.approvals.filter((approval: { status: string; kind: string }) => approval.status === "open" && approval.kind === "delete")).toHaveLength(1);
    const turn = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Delete the shared project files" }),
    });
    const opened = await turn.json();
    const latest = opened.goals.at(-1).id;
    expect(opened.handoffs.filter((item: { goalId: string; status: string }) => item.goalId === latest && item.status === "open")).toHaveLength(1);
    expect(opened.approvals.filter((approval: { goalId: string }) => approval.goalId === latest)).toHaveLength(0);
    expect(JSON.stringify(opened)).not.toContain("Always allow");
    const done = await fetch(`${server.url}/api/handoffs/${opened.handoffs.at(-1).id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "done" }),
    });
    const after = await done.json();
    expect(after.handoffs.at(-1).status).toBe("done");
    expect(after.events.some((event: { type: string }) => event.type === "approved")).toBe(false);
    const disk = await readFile(path.join(server.dir, "state.json"), "utf8");
    expect(disk).not.toContain("hunter2");
  });

  it("ORIEL-F28 a sentence clears only the saved phrase", async () => {
    const server = await boot();
    const saved = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions that mention shared project files to me" }),
    });
    const first = await saved.json();
    expect(first.handoffRules).toHaveLength(1);
    const ruleId = first.handoffRules[0].id;
    const short = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Stop handing deletions that mention ab to me" }),
    });
    expect(short.status).toBe(400);
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Stop handing deletions that mention shared project files to me without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const secret = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Stop handing deletions that mention password is hunter2 to me" }),
    });
    expect(secret.status).toBe(400);
    expect(await secret.text()).not.toContain("hunter2");
    const wrong = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Stop handing deletions that mention the vendor archive to me" }),
    });
    const missed = await wrong.json();
    expect(wrong.status).toBe(200);
    expect(missed.goals).toHaveLength(0);
    expect(missed.handoffs).toHaveLength(0);
    expect(missed.handoffRules).toHaveLength(1);
    expect(missed.handoffRules[0].id).toBe(ruleId);
    expect(missed.messages.at(-1).text).toContain("not the saved phrase");
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Stop handing deletions that mention shared project files to me and delete them" }),
    });
    const opened = await mixed.json();
    expect(opened.handoffRules).toHaveLength(1);
    expect(opened.handoffRules[0].id).toBe(ruleId);
    expect(opened.handoffs.filter((item: { status: string }) => item.status === "open")).toHaveLength(1);
    expect(opened.events.some((event: { type: string }) => event.type === "approved")).toBe(false);
    const cleared = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Stop handing deletions that mention shared project files to me" }),
    });
    const gone = await cleared.json();
    expect(cleared.status).toBe(200);
    expect(gone.handoffRules).toHaveLength(0);
    expect(gone.handoffs.filter((item: { status: string }) => item.status === "open")).toHaveLength(1);
    expect(gone.messages.at(-1).text).toContain("Cleared the one handoff rule");
    expect(gone.messages.at(-1).text).toContain("did not approve a hold");
    expect(gone.events.some((event: { type: string }) => event.type === "approved")).toBe(false);
    const again = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Stop handing deletions that mention shared project files to me" }),
    });
    const empty = await again.json();
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(1);
    expect(empty.messages.at(-1).text).toContain("no handoff rule");
    const held = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Delete the shared project files" }),
    });
    const after = await held.json();
    const latest = after.goals.at(-1).id;
    expect(after.approvals.filter((approval: { goalId: string; status: string; kind: string }) => approval.goalId === latest && approval.status === "open" && approval.kind === "delete")).toHaveLength(1);
    expect(after.handoffs.filter((item: { goalId: string }) => item.goalId === latest)).toHaveLength(0);
    expect(JSON.stringify(after)).not.toContain("Always allow");
    const disk = await readFile(path.join(server.dir, "state.json"), "utf8");
    expect(disk).not.toContain("hunter2");
  });

  it("ORIEL-F29 a sentence clears only a rule with no phrase", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Stop handing deletions to me" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("no handoff rule");
    const saved = await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true }),
    });
    const armed = await saved.json();
    expect(armed.handoffRules).toHaveLength(1);
    expect(armed.handoffRules[0].phrase).toBeNull();
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Stop handing deletions to me without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(1);
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Stop handing deletions to me and delete them" }),
    });
    const opened = await mixed.json();
    expect(opened.handoffRules).toHaveLength(1);
    expect(opened.handoffs.filter((item: { status: string }) => item.status === "open")).toHaveLength(1);
    expect(opened.events.some((event: { type: string }) => event.type === "approved")).toBe(false);
    const cleared = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Stop handing deletions to me" }),
    });
    const gone = await cleared.json();
    expect(cleared.status).toBe(200);
    expect(gone.handoffRules).toHaveLength(0);
    expect(gone.handoffs.filter((item: { status: string }) => item.status === "open")).toHaveLength(1);
    expect(gone.messages.at(-1).text).toContain("Cleared the one handoff rule");
    expect(gone.messages.at(-1).text).toContain("did not approve a hold");
    const narrowed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions that mention shared project files to me" }),
    });
    const named = await narrowed.json();
    const ruleId = named.handoffRules[0].id;
    const refused = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Stop handing deletions to me" }),
    });
    const kept = await refused.json();
    expect(kept.handoffRules).toHaveLength(1);
    expect(kept.handoffRules[0].id).toBe(ruleId);
    expect(kept.handoffRules[0].phrase).toBe("shared project files");
    expect(kept.messages.at(-1).text).toContain("does not clear it");
    expect(kept.events.some((event: { type: string }) => event.type === "approved")).toBe(false);
    expect(JSON.stringify(kept)).not.toContain("Always allow");
  });

  it("ORIEL-F30 a sentence reads the handoff rules and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "What is handed to me?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("Nothing is handed to you");
    expect(empty.messages.at(-1).text).toContain("no handoff rule");
    expect(empty.messages.at(-1).text).toContain("did not open a card");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "What is handed to me without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    const saved = await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true }),
    });
    const armed = await saved.json();
    const ruleId = armed.handoffRules[0].id;
    const narrowed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions that mention shared project files to me" }),
    });
    const named = await narrowed.json();
    expect(named.goals).toHaveLength(0);
    expect(named.handoffRules[0].id).toBe(ruleId);
    expect(named.handoffRules[0].phrase).toBe("shared project files");
    const read = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which rules are handed to you?", goalId: "goal_missing", skillId: "skill_missing" }),
    });
    const listed = await read.json();
    expect(read.status).toBe(200);
    expect(listed.goals).toHaveLength(0);
    expect(listed.handoffs).toHaveLength(0);
    expect(listed.handoffRules).toHaveLength(1);
    expect(listed.handoffRules[0].id).toBe(ruleId);
    expect(listed.messages.at(-1).text).toContain("only “shared project files”");
    expect(listed.messages.at(-1).text).not.toContain("the whole deletion");
    expect(listed.messages.at(-1).text).toContain("did not approve a hold");
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "What is handed to me and delete the shared project files" }),
    });
    const opened = await mixed.json();
    expect(opened.handoffRules[0].phrase).toBe("shared project files");
    expect(opened.handoffs.filter((item: { status: string }) => item.status === "open")).toHaveLength(1);
    expect(opened.events.some((event: { type: string }) => event.type === "approved")).toBe(false);
    const ordinary = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions to me" }),
    });
    const worked = await ordinary.json();
    expect(worked.goals.length).toBeGreaterThan(0);
    expect(worked.handoffRules[0].id).toBe(ruleId);
    expect(worked.handoffRules[0].phrase).toBe("shared project files");
    expect(worked.messages.at(-1).text).not.toContain("These steps are handed to you");
    expect(JSON.stringify(worked)).not.toContain("Always allow");
  });

  it("ORIEL-F31 a sentence asks about one handoff and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Is a deletion handed to me?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("The deletion is not handed to you");
    expect(empty.messages.at(-1).text).toContain("no handoff rule for a deletion");
    expect(empty.messages.at(-1).text).toContain("named no other step");
    expect(empty.messages.at(-1).text).not.toContain("Nothing is handed to you");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Is a deletion handed to me without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true }),
    });
    const narrowed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions that mention shared project files to me" }),
    });
    const named = await narrowed.json();
    const ruleId = named.handoffRules.find((rule: { action: string }) => rule.action === "delete").id;
    const read = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Is a deletion handed to you?", goalId: "goal_missing", skillId: "skill_missing" }),
    });
    const listed = await read.json();
    expect(read.status).toBe(200);
    expect(listed.goals).toHaveLength(0);
    expect(listed.handoffs).toHaveLength(0);
    expect(listed.handoffRules).toHaveLength(2);
    expect(listed.handoffRules.find((rule: { action: string }) => rule.action === "delete").id).toBe(ruleId);
    expect(listed.messages.at(-1).text).toContain("only “shared project files”");
    expect(listed.messages.at(-1).text).not.toContain("the whole send");
    expect(listed.messages.at(-1).text).not.toContain("the whole deletion");
    expect(listed.messages.at(-1).text).toContain("did not approve a hold");
    const other = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Is a payment handed to me?" }),
    });
    const absent = await other.json();
    expect(absent.handoffRules).toHaveLength(2);
    expect(absent.messages.at(-1).text).toContain("The payment is not handed to you");
    expect(absent.messages.at(-1).text).not.toContain("shared project files");
    expect(absent.messages.at(-1).text).not.toContain("the whole send");
    const all = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "What is handed to me?" }),
    });
    const every = await all.json();
    expect(every.messages.at(-1).text).toContain("These steps are handed to you");
    expect(every.messages.at(-1).text).toContain("the whole send");
    expect(every.messages.at(-1).text).toContain("shared project files");
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Is a deletion handed to me and delete the shared project files" }),
    });
    const opened = await mixed.json();
    expect(opened.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(opened.handoffs.filter((item: { status: string }) => item.status === "open")).toHaveLength(1);
    expect(opened.messages.at(-1).text).not.toContain("named no other step");
    expect(opened.events.some((event: { type: string }) => event.type === "approved")).toBe(false);
    const ordinary = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions to me" }),
    });
    const worked = await ordinary.json();
    expect(worked.goals.length).toBeGreaterThan(0);
    expect(worked.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(worked.messages.at(-1).text).not.toContain("named no other step");
    expect(JSON.stringify(worked)).not.toContain("Always allow");
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
