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

  it("ORIEL-F32 a sentence asks whether the saved words are the ones and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Is a deletion that mentions shared project files handed to me?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("no handoff rule for a deletion that mentions “shared project files”");
    expect(empty.messages.at(-1).text).toContain("named no other step");
    expect(empty.messages.at(-1).text).not.toContain("Nothing is handed to you");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Is a deletion that mentions shared project files handed to me without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const phrase = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Is a deletion that mentions always allow the files handed to me?" }),
    });
    expect(phrase.status).toBe(400);
    expect(await phrase.json()).toMatchObject({ error: expect.stringMatching(/short phrase/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true }),
    });
    const whole = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Is a deletion that mentions shared project files handed to me?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const unnamed = await whole.json();
    expect(whole.status).toBe(200);
    expect(unnamed.goals).toHaveLength(0);
    expect(unnamed.handoffs).toHaveLength(0);
    expect(unnamed.handoffRules).toHaveLength(2);
    expect(unnamed.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBeNull();
    expect(unnamed.messages.at(-1).text).toContain("has no such words");
    expect(unnamed.messages.at(-1).text).toContain("did not treat this question as the whole deletion");
    expect(unnamed.messages.at(-1).text).not.toContain("is the whole deletion");
    expect(unnamed.messages.at(-1).text).not.toContain("the whole send");
    expect(unnamed.messages.at(-1).text).toContain("did not approve a hold");
    const bare = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Is a deletion handed to me?" }),
    });
    const plain = await bare.json();
    expect(plain.messages.at(-1).text).toContain("is the whole deletion");
    expect(plain.messages.at(-1).text).not.toContain("has no such words");
    expect(plain.messages.at(-1).text).not.toContain("the whole send");
    const narrowed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions that mention shared project files to me" }),
    });
    const named = await narrowed.json();
    const ruleId = named.handoffRules.find((rule: { action: string }) => rule.action === "delete").id;
    expect(named.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    const read = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Is a deletion that mentions shared project files handed to you?" }),
    });
    const listed = await read.json();
    expect(read.status).toBe(200);
    expect(listed.goals).toHaveLength(0);
    expect(listed.handoffs).toHaveLength(0);
    expect(listed.handoffRules.find((rule: { action: string }) => rule.action === "delete").id).toBe(ruleId);
    expect(listed.messages.at(-1).text).toContain("only “shared project files”");
    expect(listed.messages.at(-1).text).not.toContain("the whole send");
    expect(listed.messages.at(-1).text).not.toContain("has no such words");
    const different = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Is a deletion that mentions the vendor archive handed to me?" }),
    });
    const other = await different.json();
    expect(other.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(other.messages.at(-1).text).toContain("The saved words are “shared project files”");
    expect(other.messages.at(-1).text).toContain("Those are not “the vendor archive”");
    expect(other.messages.at(-1).text).not.toContain("only “the vendor archive”");
    expect(other.messages.at(-1).text).not.toContain("the whole send");
    const all = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "What is handed to me?" }),
    });
    const every = await all.json();
    expect(every.messages.at(-1).text).toContain("These steps are handed to you");
    expect(every.messages.at(-1).text).toContain("the whole send");
    expect(every.messages.at(-1).text).toContain("only “shared project files”");
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Is a deletion that mentions shared project files handed to me and delete the shared project files" }),
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
    expect(worked.handoffRules.find((rule: { action: string }) => rule.action === "delete").id).toBe(ruleId);
    expect(worked.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(worked.messages.at(-1).text).not.toContain("has no such words");
    expect(JSON.stringify(worked)).not.toContain("Always allow");
  });

  it("ORIEL-F33 a sentence asks which words a step uses and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion hand to me?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("no handoff rule for a deletion");
    expect(empty.messages.at(-1).text).toContain("named no other step");
    expect(empty.messages.at(-1).text).not.toContain("names no words");
    expect(empty.messages.at(-1).text).not.toContain("Nothing is handed to you");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion hand to me without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const loose = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion hand to me always allow" }),
    });
    expect(loose.status).toBe(400);
    expect(await loose.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true }),
    });
    const whole = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Which words does a deletion hand to me?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const unnamed = await whole.json();
    expect(whole.status).toBe(200);
    expect(unnamed.goals).toHaveLength(0);
    expect(unnamed.handoffs).toHaveLength(0);
    expect(unnamed.handoffRules).toHaveLength(2);
    expect(unnamed.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBeNull();
    expect(unnamed.messages.at(-1).text).toContain("names no words");
    expect(unnamed.messages.at(-1).text).toContain("is the whole deletion");
    expect(unnamed.messages.at(-1).text).not.toContain("The words are");
    expect(unnamed.messages.at(-1).text).not.toContain("the whole send");
    expect(unnamed.messages.at(-1).text).toContain("did not approve a hold");
    const bare = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Is a deletion handed to me?" }),
    });
    const plain = await bare.json();
    expect(plain.messages.at(-1).text).toContain("is the whole deletion");
    expect(plain.messages.at(-1).text).not.toContain("names no words");
    expect(plain.messages.at(-1).text).not.toContain("the whole send");
    const narrowed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions that mention shared project files to me" }),
    });
    const named = await narrowed.json();
    const ruleId = named.handoffRules.find((rule: { action: string }) => rule.action === "delete").id;
    expect(named.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    const read = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion hand to you?" }),
    });
    const listed = await read.json();
    expect(read.status).toBe(200);
    expect(listed.goals).toHaveLength(0);
    expect(listed.handoffs).toHaveLength(0);
    expect(listed.handoffRules.find((rule: { action: string }) => rule.action === "delete").id).toBe(ruleId);
    expect(listed.messages.at(-1).text).toContain("The words are “shared project files”");
    expect(listed.messages.at(-1).text).not.toContain("the whole send");
    expect(listed.messages.at(-1).text).not.toContain("names no words");
    const matched = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Is a deletion that mentions shared project files handed to me?" }),
    });
    const same = await matched.json();
    expect(same.messages.at(-1).text).toContain("only “shared project files”");
    expect(same.messages.at(-1).text).not.toContain("The words are");
    expect(same.messages.at(-1).text).not.toContain("names no words");
    const all = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "What is handed to me?" }),
    });
    const every = await all.json();
    expect(every.messages.at(-1).text).toContain("These steps are handed to you");
    expect(every.messages.at(-1).text).toContain("the whole send");
    expect(every.messages.at(-1).text).toContain("only “shared project files”");
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion handed to me and delete the shared project files" }),
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
    expect(worked.handoffRules.find((rule: { action: string }) => rule.action === "delete").id).toBe(ruleId);
    expect(worked.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(worked.messages.at(-1).text).not.toContain("The words are");
    expect(worked.messages.at(-1).text).not.toContain("names no words");
    expect(JSON.stringify(worked)).not.toContain("Always allow");
  });

  it("ORIEL-F34 a sentence asks which step uses certain words and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which step mentions shared project files?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("No step mentions “shared project files”");
    expect(empty.messages.at(-1).text).toContain("named no other step");
    expect(empty.messages.at(-1).text).not.toContain("The deletion");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which step mentions shared project files without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const loose = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Please, which step mentions shared project files always allow" }),
    });
    expect(loose.status).toBe(400);
    expect(await loose.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const short = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which step mentions ab?" }),
    });
    expect(short.status).toBe(400);
    expect(await short.json()).toMatchObject({ error: expect.stringMatching(/short phrase/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pay", enabled: true, phrase: "the vendor invoice" }),
    });
    const whole = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Which step mentions shared project files?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const unnamed = await whole.json();
    expect(whole.status).toBe(200);
    expect(unnamed.goals).toHaveLength(0);
    expect(unnamed.handoffs).toHaveLength(0);
    expect(unnamed.handoffRules).toHaveLength(3);
    expect(unnamed.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBeNull();
    expect(unnamed.messages.at(-1).text).toContain("The send mentions “shared project files”");
    expect(unnamed.messages.at(-1).text).not.toContain("These steps mention");
    expect(unnamed.messages.at(-1).text).not.toContain("The deletion");
    expect(unnamed.messages.at(-1).text).not.toContain("the whole deletion");
    expect(unnamed.messages.at(-1).text).not.toContain("the vendor invoice");
    expect(unnamed.messages.at(-1).text).toContain("did not approve a hold");
    const both = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions that mention shared project files to me" }),
    });
    const named = await both.json();
    const ruleId = named.handoffRules.find((rule: { action: string }) => rule.action === "delete").id;
    expect(named.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    const read = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps mention shared project files to you?" }),
    });
    const listed = await read.json();
    expect(read.status).toBe(200);
    expect(listed.goals).toHaveLength(0);
    expect(listed.handoffs).toHaveLength(0);
    expect(listed.handoffRules.find((rule: { action: string }) => rule.action === "delete").id).toBe(ruleId);
    expect(listed.messages.at(-1).text).toContain("These steps mention “shared project files”");
    expect(listed.messages.at(-1).text).toContain("The deletion mentions “shared project files”");
    expect(listed.messages.at(-1).text).toContain("The send mentions “shared project files”");
    expect(listed.messages.at(-1).text).not.toContain("the vendor invoice");
    expect(listed.messages.at(-1).text).not.toContain("the whole");
    const words = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion hand to me?" }),
    });
    const phrase = await words.json();
    expect(phrase.messages.at(-1).text).toContain("The words are “shared project files”");
    expect(phrase.messages.at(-1).text).not.toContain("No step mentions");
    expect(phrase.messages.at(-1).text).not.toContain("The send");
    const all = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "What is handed to me?" }),
    });
    const every = await all.json();
    expect(every.messages.at(-1).text).toContain("These steps are handed to you");
    expect(every.messages.at(-1).text).toContain("only “shared project files”");
    expect(every.messages.at(-1).text).toContain("only “the vendor invoice”");
    expect(every.messages.at(-1).text).not.toContain("the whole deletion");
    expect(every.messages.at(-1).text).not.toContain("No step mentions");
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which step mentions shared project files and delete the shared project files" }),
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
    expect(worked.handoffRules.find((rule: { action: string }) => rule.action === "delete").id).toBe(ruleId);
    expect(worked.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(worked.messages.at(-1).text).not.toContain("No step mentions");
    expect(JSON.stringify(worked)).not.toContain("Always allow");
  });

  it("ORIEL-F35 a sentence asks which steps name no words and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps name no words?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("No step names no words");
    expect(empty.messages.at(-1).text).toContain("named no other step");
    expect(empty.messages.at(-1).text).not.toContain("The deletion");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps name no words without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const loose = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Please, which steps name no words always allow" }),
    });
    expect(loose.status).toBe(400);
    expect(await loose.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "post", enabled: true }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pay", enabled: true, phrase: "the vendor invoice" }),
    });
    const whole = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Which step names no words?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const unnamed = await whole.json();
    expect(whole.status).toBe(200);
    expect(unnamed.goals).toHaveLength(0);
    expect(unnamed.handoffs).toHaveLength(0);
    expect(unnamed.handoffRules).toHaveLength(4);
    expect(unnamed.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBeNull();
    const reply = unnamed.messages.at(-1).text as string;
    expect(reply).toContain("These steps name no words");
    expect(reply.indexOf("The deletion")).toBeGreaterThan(-1);
    expect(reply.indexOf("The public post")).toBeGreaterThan(reply.indexOf("The deletion"));
    expect(reply).toContain("the whole deletion");
    expect(reply).toContain("the whole public post");
    expect(reply).not.toContain("The send");
    expect(reply).not.toContain("The payment");
    expect(reply).not.toContain("shared project files");
    expect(reply).not.toContain("the vendor invoice");
    expect(reply).toContain("did not approve a hold");
    const mentioned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which step mentions shared project files?" }),
    });
    const step = await mentioned.json();
    expect(step.messages.at(-1).text).toContain("The send mentions “shared project files”");
    expect(step.messages.at(-1).text).not.toContain("No step names no words");
    expect(step.messages.at(-1).text).not.toContain("the whole deletion");
    const words = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion hand to me?" }),
    });
    const phrase = await words.json();
    expect(phrase.messages.at(-1).text).toContain("names no words");
    expect(phrase.messages.at(-1).text).toContain("the whole deletion");
    expect(phrase.messages.at(-1).text).not.toContain("No step names no words");
    expect(phrase.messages.at(-1).text).not.toContain("The send");
    const all = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "What is handed to me?" }),
    });
    const every = await all.json();
    expect(every.messages.at(-1).text).toContain("These steps are handed to you");
    expect(every.messages.at(-1).text).toContain("the whole deletion");
    expect(every.messages.at(-1).text).toContain("only “shared project files”");
    expect(every.messages.at(-1).text).toContain("only “the vendor invoice”");
    expect(every.messages.at(-1).text).not.toContain("No step names no words");
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps name no words and delete the archive" }),
    });
    const opened = await mixed.json();
    expect(opened.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBeNull();
    expect(opened.handoffs.filter((item: { status: string }) => item.status === "open")).toHaveLength(1);
    expect(opened.messages.at(-1).text).not.toContain("No step names no words");
    expect(opened.events.some((event: { type: string }) => event.type === "approved")).toBe(false);
    const ordinary = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions to me" }),
    });
    const worked = await ordinary.json();
    expect(worked.goals.length).toBeGreaterThan(0);
    expect(worked.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBeNull();
    expect(worked.messages.at(-1).text).not.toContain("No step names no words");
    expect(JSON.stringify(worked)).not.toContain("Always allow");
  });

  it("ORIEL-F36 a sentence asks which steps name words and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps name words?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("No step names words");
    expect(empty.messages.at(-1).text).toContain("named no other step");
    expect(empty.messages.at(-1).text).not.toContain("The deletion");
    expect(empty.messages.at(-1).text).not.toContain("the whole");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps name words without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const loose = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Please, which steps name words always allow" }),
    });
    expect(loose.status).toBe(400);
    expect(await loose.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "post", enabled: true }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pay", enabled: true, phrase: "the vendor invoice" }),
    });
    const whole = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Which step names words?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const named = await whole.json();
    expect(whole.status).toBe(200);
    expect(named.goals).toHaveLength(0);
    expect(named.handoffs).toHaveLength(0);
    expect(named.handoffRules).toHaveLength(4);
    expect(named.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBeNull();
    const reply = named.messages.at(-1).text as string;
    expect(reply).toContain("These steps name words");
    expect(reply.indexOf("The send")).toBeGreaterThan(-1);
    expect(reply.indexOf("The payment")).toBeGreaterThan(reply.indexOf("The send"));
    expect(reply).toContain("“shared project files”");
    expect(reply).toContain("“the vendor invoice”");
    expect(reply).not.toContain("The deletion");
    expect(reply).not.toContain("The public post");
    expect(reply).not.toContain("the whole");
    expect(reply).toContain("did not approve a hold");
    const unnamed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps name no words?" }),
    });
    const bare = await unnamed.json();
    expect(bare.messages.at(-1).text).toContain("These steps name no words");
    expect(bare.messages.at(-1).text).toContain("the whole deletion");
    expect(bare.messages.at(-1).text).toContain("the whole public post");
    expect(bare.messages.at(-1).text).not.toContain("These steps name words");
    expect(bare.messages.at(-1).text).not.toContain("shared project files");
    expect(bare.messages.at(-1).text).not.toContain("the vendor invoice");
    const words = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion hand to me?" }),
    });
    const phrase = await words.json();
    expect(phrase.messages.at(-1).text).toContain("names no words");
    expect(phrase.messages.at(-1).text).toContain("the whole deletion");
    expect(phrase.messages.at(-1).text).not.toContain("No step names words");
    expect(phrase.messages.at(-1).text).not.toContain("The send");
    const mentioned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which step mentions shared project files?" }),
    });
    const step = await mentioned.json();
    expect(step.messages.at(-1).text).toContain("The send mentions “shared project files”");
    expect(step.messages.at(-1).text).not.toContain("No step names words");
    expect(step.messages.at(-1).text).not.toContain("the whole deletion");
    const all = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "What is handed to me?" }),
    });
    const every = await all.json();
    expect(every.messages.at(-1).text).toContain("These steps are handed to you");
    expect(every.messages.at(-1).text).toContain("the whole deletion");
    expect(every.messages.at(-1).text).toContain("only “shared project files”");
    expect(every.messages.at(-1).text).toContain("only “the vendor invoice”");
    expect(every.messages.at(-1).text).not.toContain("No step names words");
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps name words and delete the archive" }),
    });
    const opened = await mixed.json();
    expect(opened.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBeNull();
    expect(opened.handoffs.filter((item: { status: string }) => item.status === "open")).toHaveLength(1);
    expect(opened.messages.at(-1).text).not.toContain("No step names words");
    expect(opened.events.some((event: { type: string }) => event.type === "approved")).toBe(false);
    const ordinary = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions to me" }),
    });
    const worked = await ordinary.json();
    expect(worked.goals.length).toBeGreaterThan(0);
    expect(worked.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBeNull();
    expect(worked.messages.at(-1).text).not.toContain("No step names words");
    expect(JSON.stringify(worked)).not.toContain("Always allow");
  });

  it("ORIEL-F37 a sentence asks which steps share words and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps share words?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("No steps share words");
    expect(empty.messages.at(-1).text).toContain("named no other step");
    expect(empty.messages.at(-1).text).not.toContain("The deletion");
    expect(empty.messages.at(-1).text).not.toContain("the whole");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps share words without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const loose = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Please, which steps share words always allow" }),
    });
    expect(loose.status).toBe(400);
    expect(await loose.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "post", enabled: true }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "Shared Project Files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pay", enabled: true, phrase: "unshared project files" }),
    });
    const whole = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Which step shares words?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const shared = await whole.json();
    expect(whole.status).toBe(200);
    expect(shared.goals).toHaveLength(0);
    expect(shared.handoffs).toHaveLength(0);
    expect(shared.handoffRules).toHaveLength(4);
    const reply = shared.messages.at(-1).text as string;
    expect(reply).toContain("These steps share words");
    expect(reply.indexOf("The send")).toBeGreaterThan(-1);
    expect(reply.indexOf("The deletion")).toBeGreaterThan(reply.indexOf("The send"));
    expect(reply).toContain("“Shared Project Files”");
    expect(reply).toContain("“shared project files”");
    expect(reply).not.toContain("The payment");
    expect(reply).not.toContain("The public post");
    expect(reply).not.toContain("unshared project files");
    expect(reply).not.toContain("the whole");
    expect(reply).toContain("did not approve a hold");
    const named = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps name words?" }),
    });
    const namedBody = await named.json();
    expect(namedBody.messages.at(-1).text).toContain("These steps name words");
    expect(namedBody.messages.at(-1).text).toContain("unshared project files");
    expect(namedBody.messages.at(-1).text).toContain("“Shared Project Files”");
    expect(namedBody.messages.at(-1).text).not.toContain("The public post");
    expect(namedBody.messages.at(-1).text).not.toContain("These steps share words");
    const unnamed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps name no words?" }),
    });
    const bare = await unnamed.json();
    expect(bare.messages.at(-1).text).toContain("the whole public post");
    expect(bare.messages.at(-1).text).not.toContain("shared project files");
    expect(bare.messages.at(-1).text).not.toContain("These steps share words");
    const mentioned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which step mentions shared project files?" }),
    });
    const step = await mentioned.json();
    expect(step.messages.at(-1).text).toContain("The send mentions");
    expect(step.messages.at(-1).text).toContain("The deletion mentions");
    expect(step.messages.at(-1).text).not.toContain("The payment");
    expect(step.messages.at(-1).text).not.toContain("No steps share words");
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps share words and delete the archive" }),
    });
    const opened = await mixed.json();
    expect(opened.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(opened.approvals.filter((item: { status: string; kind: string }) => item.status === "open" && item.kind === "delete")).toHaveLength(
      1,
    );
    expect(opened.handoffs.filter((item: { status: string }) => item.status === "open")).toHaveLength(0);
    expect(opened.messages.at(-1).text).not.toContain("No steps share words");
    expect(opened.events.some((event: { type: string }) => event.type === "approved")).toBe(false);
    const ordinary = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions to me" }),
    });
    const worked = await ordinary.json();
    expect(worked.goals.length).toBeGreaterThan(0);
    expect(worked.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(worked.messages.at(-1).text).not.toContain("No steps share words");
    expect(JSON.stringify(worked)).not.toContain("Always allow");
  });

  it("ORIEL-F38 a sentence asks which words are shared and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are shared?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("No words are shared");
    expect(empty.messages.at(-1).text).toContain("named no other step");
    expect(empty.messages.at(-1).text).not.toContain("The deletion");
    expect(empty.messages.at(-1).text).not.toContain("the whole");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are shared without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const loose = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Please, which word is shared always allow" }),
    });
    expect(loose.status).toBe(400);
    expect(await loose.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "post", enabled: true }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "Shared Project Files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pay", enabled: true, phrase: "unshared project files" }),
    });
    const whole = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Which word is shared?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const shared = await whole.json();
    expect(whole.status).toBe(200);
    expect(shared.goals).toHaveLength(0);
    expect(shared.handoffs).toHaveLength(0);
    expect(shared.handoffRules).toHaveLength(4);
    const reply = shared.messages.at(-1).text as string;
    expect(reply).toContain("These words are shared");
    expect(reply).toContain("“Shared Project Files” is used by The send and The deletion.");
    expect(reply.split("“Shared Project Files”").length - 1).toBe(1);
    expect(reply).not.toContain("“shared project files”");
    expect(reply).not.toContain("The payment");
    expect(reply).not.toContain("The public post");
    expect(reply).not.toContain("unshared project files");
    expect(reply).not.toContain("the whole");
    expect(reply).toContain("did not approve a hold");
    const steps = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps share words?" }),
    });
    const stepsBody = await steps.json();
    expect(stepsBody.messages.at(-1).text).toContain("These steps share words");
    expect(stepsBody.messages.at(-1).text).toContain("“shared project files”");
    expect(stepsBody.messages.at(-1).text).toContain("“Shared Project Files”");
    expect(stepsBody.messages.at(-1).text).not.toContain("These words are shared");
    const named = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps name words?" }),
    });
    const namedBody = await named.json();
    expect(namedBody.messages.at(-1).text).toContain("These steps name words");
    expect(namedBody.messages.at(-1).text).toContain("unshared project files");
    expect(namedBody.messages.at(-1).text).toContain("“Shared Project Files”");
    expect(namedBody.messages.at(-1).text).not.toContain("The public post");
    expect(namedBody.messages.at(-1).text).not.toContain("These words are shared");
    const unnamed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps name no words?" }),
    });
    const bare = await unnamed.json();
    expect(bare.messages.at(-1).text).toContain("the whole public post");
    expect(bare.messages.at(-1).text).not.toContain("shared project files");
    expect(bare.messages.at(-1).text).not.toContain("These words are shared");
    const mentioned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which step mentions shared project files?" }),
    });
    const step = await mentioned.json();
    expect(step.messages.at(-1).text).toContain("The send mentions");
    expect(step.messages.at(-1).text).toContain("The deletion mentions");
    expect(step.messages.at(-1).text).not.toContain("The payment");
    expect(step.messages.at(-1).text).not.toContain("No words are shared");
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are shared and delete the archive" }),
    });
    const opened = await mixed.json();
    expect(opened.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(opened.approvals.filter((item: { status: string; kind: string }) => item.status === "open" && item.kind === "delete")).toHaveLength(
      1,
    );
    expect(opened.handoffs.filter((item: { status: string }) => item.status === "open")).toHaveLength(0);
    expect(opened.messages.at(-1).text).not.toContain("No words are shared");
    expect(opened.events.some((event: { type: string }) => event.type === "approved")).toBe(false);
    const ordinary = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions to me" }),
    });
    const worked = await ordinary.json();
    expect(worked.goals.length).toBeGreaterThan(0);
    expect(worked.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(worked.messages.at(-1).text).not.toContain("No words are shared");
    expect(JSON.stringify(worked)).not.toContain("Always allow");
  });

  it("ORIEL-F39 a sentence asks which words are not shared and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are not shared?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("No words are used once");
    expect(empty.messages.at(-1).text).toContain("named no other step");
    expect(empty.messages.at(-1).text).not.toContain("The deletion");
    expect(empty.messages.at(-1).text).not.toContain("the whole");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are not shared without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const loose = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Please, which word is not shared always allow" }),
    });
    expect(loose.status).toBe(400);
    expect(await loose.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "post", enabled: true }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "Shared Project Files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pay", enabled: true, phrase: "unshared project files" }),
    });
    const whole = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Which word is not shared?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const once = await whole.json();
    expect(whole.status).toBe(200);
    expect(once.goals).toHaveLength(0);
    expect(once.handoffs).toHaveLength(0);
    expect(once.handoffRules).toHaveLength(4);
    const reply = once.messages.at(-1).text as string;
    expect(reply).toContain("These words are used once");
    expect(reply).toContain("“unshared project files” is used by The payment.");
    expect(reply.split("“unshared project files”").length - 1).toBe(1);
    expect(reply).not.toContain("“Shared Project Files”");
    expect(reply).not.toContain("“shared project files”");
    expect(reply).not.toContain("The send");
    expect(reply).not.toContain("The deletion");
    expect(reply).not.toContain("The public post");
    expect(reply).not.toContain("the whole");
    expect(reply).toContain("did not approve a hold");
    const shared = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are shared?" }),
    });
    const sharedBody = await shared.json();
    expect(sharedBody.messages.at(-1).text).toContain("These words are shared");
    expect(sharedBody.messages.at(-1).text).toContain("“Shared Project Files” is used by The send and The deletion.");
    expect(sharedBody.messages.at(-1).text).not.toContain("unshared project files");
    expect(sharedBody.messages.at(-1).text).not.toContain("These words are used once");
    const steps = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps share words?" }),
    });
    const stepsBody = await steps.json();
    expect(stepsBody.messages.at(-1).text).toContain("These steps share words");
    expect(stepsBody.messages.at(-1).text).toContain("“shared project files”");
    expect(stepsBody.messages.at(-1).text).toContain("“Shared Project Files”");
    expect(stepsBody.messages.at(-1).text).not.toContain("These words are used once");
    const named = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps name words?" }),
    });
    const namedBody = await named.json();
    expect(namedBody.messages.at(-1).text).toContain("These steps name words");
    expect(namedBody.messages.at(-1).text).toContain("unshared project files");
    expect(namedBody.messages.at(-1).text).toContain("“Shared Project Files”");
    expect(namedBody.messages.at(-1).text).not.toContain("The public post");
    expect(namedBody.messages.at(-1).text).not.toContain("These words are used once");
    const unnamed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps name no words?" }),
    });
    const bare = await unnamed.json();
    expect(bare.messages.at(-1).text).toContain("the whole public post");
    expect(bare.messages.at(-1).text).not.toContain("“shared project files”");
    expect(bare.messages.at(-1).text).not.toContain("These words are used once");
    const mentioned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which step mentions shared project files?" }),
    });
    const step = await mentioned.json();
    expect(step.messages.at(-1).text).toContain("The send mentions");
    expect(step.messages.at(-1).text).toContain("The deletion mentions");
    expect(step.messages.at(-1).text).not.toContain("The payment");
    expect(step.messages.at(-1).text).not.toContain("No words are used once");
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are not shared and delete the archive" }),
    });
    const opened = await mixed.json();
    expect(opened.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(opened.approvals.filter((item: { status: string; kind: string }) => item.status === "open" && item.kind === "delete")).toHaveLength(
      1,
    );
    expect(opened.handoffs.filter((item: { status: string }) => item.status === "open")).toHaveLength(0);
    expect(opened.messages.at(-1).text).not.toContain("No words are used once");
    expect(opened.events.some((event: { type: string }) => event.type === "approved")).toBe(false);
    const ordinary = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions to me" }),
    });
    const worked = await ordinary.json();
    expect(worked.goals.length).toBeGreaterThan(0);
    expect(worked.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(worked.messages.at(-1).text).not.toContain("No words are used once");
    expect(JSON.stringify(worked)).not.toContain("Always allow");
  });

  it("ORIEL-F40 a sentence asks which steps do not share words and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps do not share words?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("No step uses words once");
    expect(empty.messages.at(-1).text).toContain("named no other step");
    expect(empty.messages.at(-1).text).not.toContain("The deletion");
    expect(empty.messages.at(-1).text).not.toContain("the whole");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps do not share words without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const loose = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Please, which step does not share words always allow" }),
    });
    expect(loose.status).toBe(400);
    expect(await loose.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "post", enabled: true }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "Shared Project Files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pay", enabled: true, phrase: "unshared project files" }),
    });
    const whole = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Which step does not share words?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const once = await whole.json();
    expect(whole.status).toBe(200);
    expect(once.goals).toHaveLength(0);
    expect(once.handoffs).toHaveLength(0);
    expect(once.handoffRules).toHaveLength(4);
    const reply = once.messages.at(-1).text as string;
    expect(reply).toContain("These steps use words once");
    expect(reply).toContain("The payment is handed to you. The words are “unshared project files”.");
    expect(reply.split("“unshared project files”").length - 1).toBe(1);
    expect(reply).not.toContain("“Shared Project Files”");
    expect(reply).not.toContain("“shared project files”");
    expect(reply).not.toContain("The send");
    expect(reply).not.toContain("The deletion");
    expect(reply).not.toContain("The public post");
    expect(reply).not.toContain("the whole");
    expect(reply).toContain("did not approve a hold");
    const shared = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are shared?" }),
    });
    const sharedBody = await shared.json();
    expect(sharedBody.messages.at(-1).text).toContain("These words are shared");
    expect(sharedBody.messages.at(-1).text).toContain("“Shared Project Files” is used by The send and The deletion.");
    expect(sharedBody.messages.at(-1).text).not.toContain("unshared project files");
    expect(sharedBody.messages.at(-1).text).not.toContain("These steps use words once");
    const steps = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps share words?" }),
    });
    const stepsBody = await steps.json();
    expect(stepsBody.messages.at(-1).text).toContain("These steps share words");
    expect(stepsBody.messages.at(-1).text).toContain("“shared project files”");
    expect(stepsBody.messages.at(-1).text).toContain("“Shared Project Files”");
    expect(stepsBody.messages.at(-1).text).not.toContain("These steps use words once");
    const named = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps name words?" }),
    });
    const namedBody = await named.json();
    expect(namedBody.messages.at(-1).text).toContain("These steps name words");
    expect(namedBody.messages.at(-1).text).toContain("unshared project files");
    expect(namedBody.messages.at(-1).text).toContain("“Shared Project Files”");
    expect(namedBody.messages.at(-1).text).not.toContain("The public post");
    expect(namedBody.messages.at(-1).text).not.toContain("These steps use words once");
    const unnamed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps name no words?" }),
    });
    const bare = await unnamed.json();
    expect(bare.messages.at(-1).text).toContain("the whole public post");
    expect(bare.messages.at(-1).text).not.toContain("“shared project files”");
    expect(bare.messages.at(-1).text).not.toContain("These steps use words once");
    const onceWords = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are not shared?" }),
    });
    const onceWordsBody = await onceWords.json();
    expect(onceWordsBody.messages.at(-1).text).toContain("These words are used once");
    expect(onceWordsBody.messages.at(-1).text).toContain("“unshared project files” is used by The payment.");
    expect(onceWordsBody.messages.at(-1).text).not.toContain("The public post");
    expect(onceWordsBody.messages.at(-1).text).not.toContain("These steps use words once");
    const mentioned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which step mentions shared project files?" }),
    });
    const step = await mentioned.json();
    expect(step.messages.at(-1).text).toContain("The send mentions");
    expect(step.messages.at(-1).text).toContain("The deletion mentions");
    expect(step.messages.at(-1).text).not.toContain("The payment");
    expect(step.messages.at(-1).text).not.toContain("No step uses words once");
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps do not share words on this saved desk and delete the archive" }),
    });
    const opened = await mixed.json();
    expect(opened.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(opened.approvals.filter((item: { status: string; kind: string }) => item.status === "open" && item.kind === "delete")).toHaveLength(
      1,
    );
    expect(opened.handoffs.filter((item: { status: string }) => item.status === "open")).toHaveLength(0);
    expect(opened.messages.at(-1).text).not.toContain("No step uses words once");
    expect(opened.events.some((event: { type: string }) => event.type === "approved")).toBe(false);
    const ordinary = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions to me" }),
    });
    const worked = await ordinary.json();
    expect(worked.goals.length).toBeGreaterThan(0);
    expect(worked.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(worked.messages.at(-1).text).not.toContain("No step uses words once");
    expect(JSON.stringify(worked)).not.toContain("Always allow");
  });

  it("ORIEL-F41 a sentence asks whether one step shares words and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion share words?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("There is no handoff rule for a deletion");
    expect(empty.messages.at(-1).text).toContain("named no other step");
    expect(empty.messages.at(-1).text).not.toContain("The send");
    expect(empty.messages.at(-1).text).not.toContain("the whole");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion share words without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const loose = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Please, does a payment share words always allow" }),
    });
    expect(loose.status).toBe(400);
    expect(await loose.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    const note = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a note share words?" }),
    });
    const noted = await note.json();
    expect(note.status).toBe(200);
    expect(noted.goals).toHaveLength(0);
    expect(noted.messages.at(-1).text).toContain("does not name a send");
    expect(noted.messages.at(-1).text).toContain("did not open a card");
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "post", enabled: true, phrase: "the launch note" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "Shared Project Files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pay", enabled: true, phrase: "unshared project files" }),
    });
    const whole = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Does a deletion share words?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const once = await whole.json();
    expect(whole.status).toBe(200);
    expect(once.goals).toHaveLength(0);
    expect(once.handoffs).toHaveLength(0);
    expect(once.handoffRules).toHaveLength(4);
    const reply = once.messages.at(-1).text as string;
    expect(reply).toContain("The deletion shares those words");
    expect(reply).toContain("The words are “shared project files”.");
    expect(reply).toContain("The send uses them.");
    expect(reply.split("“shared project files”").length - 1).toBe(1);
    expect(reply).not.toContain("“Shared Project Files”");
    expect(reply).not.toContain("The payment");
    expect(reply).not.toContain("The public post");
    expect(reply).not.toContain("the whole");
    expect(reply).toContain("did not approve a hold");
    const payment = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a payment share words to you?" }),
    });
    const paymentBody = await payment.json();
    expect(paymentBody.messages.at(-1).text).toContain("Those words are used once");
    expect(paymentBody.messages.at(-1).text).toContain("“unshared project files”");
    expect(paymentBody.messages.at(-1).text).not.toContain("The deletion");
    expect(paymentBody.messages.at(-1).text).not.toContain("shares those words");
    const steps = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps do not share words?" }),
    });
    const stepsBody = await steps.json();
    expect(stepsBody.messages.at(-1).text).toContain("These steps use words once");
    expect(stepsBody.messages.at(-1).text).toContain("unshared project files");
    expect(stepsBody.messages.at(-1).text).not.toContain("The deletion shares those words");
    const shared = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are shared?" }),
    });
    const sharedBody = await shared.json();
    expect(sharedBody.messages.at(-1).text).toContain("These words are shared");
    expect(sharedBody.messages.at(-1).text).toContain("“Shared Project Files” is used by The send and The deletion.");
    expect(sharedBody.messages.at(-1).text).not.toContain("The deletion shares those words");
    const shareSteps = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps share words?" }),
    });
    const shareStepsBody = await shareSteps.json();
    expect(shareStepsBody.messages.at(-1).text).toContain("These steps share words");
    expect(shareStepsBody.messages.at(-1).text).not.toContain("The deletion shares those words");
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion share words and delete the archive" }),
    });
    const opened = await mixed.json();
    expect(opened.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(opened.approvals.filter((item: { status: string; kind: string }) => item.status === "open" && item.kind === "delete")).toHaveLength(
      1,
    );
    expect(opened.handoffs.filter((item: { status: string }) => item.status === "open")).toHaveLength(0);
    expect(opened.messages.at(-1).text).not.toContain("shares those words");
    expect(opened.events.some((event: { type: string }) => event.type === "approved")).toBe(false);
    const notThis = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion not share words?" }),
    });
    const skipped = await notThis.json();
    expect(skipped.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(skipped.messages.at(-1).text).not.toContain("shares those words");
    expect(skipped.messages.at(-1).text).not.toContain("Those words are used once");
    expect(skipped.events.some((event: { type: string }) => event.type === "approved")).toBe(false);
    const ordinary = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions to me" }),
    });
    const worked = await ordinary.json();
    expect(worked.goals.length).toBeGreaterThan(0);
    expect(worked.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(worked.messages.at(-1).text).not.toContain("shares those words");
    expect(JSON.stringify(worked)).not.toContain("Always allow");
  });

  it("ORIEL-F42 a sentence asks whether one step does not share words and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion not share words?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("There is no handoff rule for a deletion");
    expect(empty.messages.at(-1).text).toContain("named no other step");
    expect(empty.messages.at(-1).text).not.toContain("The send");
    expect(empty.messages.at(-1).text).not.toContain("the whole");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion not share words without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const loose = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Please, does a payment not share words always allow" }),
    });
    expect(loose.status).toBe(400);
    expect(await loose.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    const note = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a note not share words?" }),
    });
    const noted = await note.json();
    expect(note.status).toBe(200);
    expect(noted.goals).toHaveLength(0);
    expect(noted.messages.at(-1).text).toContain("does not name a send");
    expect(noted.messages.at(-1).text).toContain("did not open a card");
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "post", enabled: true, phrase: "the launch note" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "Shared Project Files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pay", enabled: true, phrase: "unshared project files" }),
    });
    const whole = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Does a deletion not share words?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const once = await whole.json();
    expect(whole.status).toBe(200);
    expect(once.goals).toHaveLength(0);
    expect(once.handoffs).toHaveLength(0);
    expect(once.handoffRules).toHaveLength(4);
    const reply = once.messages.at(-1).text as string;
    expect(reply).toContain("The deletion does share those words");
    expect(reply).toContain("The words are “shared project files”.");
    expect(reply).toContain("The send uses them.");
    expect(reply.split("“shared project files”").length - 1).toBe(1);
    expect(reply).not.toContain("“Shared Project Files”");
    expect(reply).not.toContain("The payment");
    expect(reply).not.toContain("The public post");
    expect(reply).not.toContain("the whole");
    expect(reply).not.toContain("shares those words");
    expect(reply).toContain("did not approve a hold");
    const payment = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a payment not share words to you?" }),
    });
    const paymentBody = await payment.json();
    expect(paymentBody.messages.at(-1).text).toContain("does not share those words");
    expect(paymentBody.messages.at(-1).text).toContain("“unshared project files”");
    expect(paymentBody.messages.at(-1).text).not.toContain("The deletion");
    expect(paymentBody.messages.at(-1).text).not.toContain("does share those words");
    const share = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion share words?" }),
    });
    const shareBody = await share.json();
    expect(shareBody.messages.at(-1).text).toContain("The deletion shares those words");
    expect(shareBody.messages.at(-1).text).toContain("The send uses them.");
    expect(shareBody.messages.at(-1).text).not.toContain("does not share those words");
    const steps = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps do not share words?" }),
    });
    const stepsBody = await steps.json();
    expect(stepsBody.messages.at(-1).text).toContain("These steps use words once");
    expect(stepsBody.messages.at(-1).text).toContain("unshared project files");
    expect(stepsBody.messages.at(-1).text).not.toContain("does not share those words");
    const shared = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are shared?" }),
    });
    const sharedBody = await shared.json();
    expect(sharedBody.messages.at(-1).text).toContain("These words are shared");
    expect(sharedBody.messages.at(-1).text).toContain("“Shared Project Files” is used by The send and The deletion.");
    expect(sharedBody.messages.at(-1).text).not.toContain("does not share those words");
    const shareSteps = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps share words?" }),
    });
    const shareStepsBody = await shareSteps.json();
    expect(shareStepsBody.messages.at(-1).text).toContain("These steps share words");
    expect(shareStepsBody.messages.at(-1).text).not.toContain("does not share those words");
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion not share words and delete the archive" }),
    });
    const opened = await mixed.json();
    expect(opened.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(opened.approvals.filter((item: { status: string; kind: string }) => item.status === "open" && item.kind === "delete")).toHaveLength(
      1,
    );
    expect(opened.handoffs.filter((item: { status: string }) => item.status === "open")).toHaveLength(0);
    expect(opened.messages.at(-1).text).not.toContain("does share those words");
    expect(opened.messages.at(-1).text).not.toContain("does not share those words");
    expect(opened.events.some((event: { type: string }) => event.type === "approved")).toBe(false);
    const ordinary = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions to me" }),
    });
    const worked = await ordinary.json();
    expect(worked.goals.length).toBeGreaterThan(0);
    expect(worked.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(worked.messages.at(-1).text).not.toContain("does not share those words");
    expect(JSON.stringify(worked)).not.toContain("Always allow");
  });

  it("ORIEL-F43 a sentence asks whether one step shares words with another and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion share words with a send?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.approvals).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("There is no handoff rule for a deletion");
    expect(empty.messages.at(-1).text).toContain("named no other step");
    expect(empty.messages.at(-1).text).not.toContain("with the send");
    expect(empty.messages.at(-1).text).not.toContain("The send");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion share words with a send without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const loose = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Please, does a payment share words with a post always allow" }),
    });
    expect(loose.status).toBe(400);
    expect(await loose.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    const note = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a note share words with a send?" }),
    });
    const noted = await note.json();
    expect(note.status).toBe(200);
    expect(noted.goals).toHaveLength(0);
    expect(noted.approvals).toHaveLength(0);
    expect(noted.messages.at(-1).text).toContain("does not name two different steps");
    expect(noted.messages.at(-1).text).toContain("did not open a card");
    const same = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion share words with a deletion?" }),
    });
    const sameBody = await same.json();
    expect(sameBody.goals).toHaveLength(0);
    expect(sameBody.approvals).toHaveLength(0);
    expect(sameBody.messages.at(-1).text).toContain("does not name two different steps");
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "post", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "Shared Project Files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pay", enabled: true, phrase: "unshared project files" }),
    });
    const asked = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Does a deletion share words with a send?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const once = await asked.json();
    expect(asked.status).toBe(200);
    expect(once.goals).toHaveLength(0);
    expect(once.handoffs).toHaveLength(0);
    expect(once.approvals).toHaveLength(0);
    expect(once.handoffRules).toHaveLength(4);
    const reply = once.messages.at(-1).text as string;
    expect(reply).toContain("The deletion shares those words with the send.");
    expect(reply).toContain("The words are “shared project files”.");
    expect(reply.split("“shared project files”").length - 1).toBe(1);
    expect(reply).not.toContain("“Shared Project Files”");
    expect(reply).not.toContain("The payment");
    expect(reply).not.toContain("The public post");
    expect(reply).not.toContain("The send uses them");
    expect(reply).toContain("did not approve a hold");
    const payment = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion share words with a payment to you?" }),
    });
    const paymentBody = await payment.json();
    expect(paymentBody.messages.at(-1).text).toContain("The deletion does not share those words with the payment.");
    expect(paymentBody.messages.at(-1).text).toContain("“shared project files”");
    expect(paymentBody.messages.at(-1).text).not.toContain("“unshared project files”");
    expect(paymentBody.goals).toHaveLength(0);
    expect(paymentBody.approvals).toHaveLength(0);
    const share = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion share words?" }),
    });
    const shareBody = await share.json();
    expect(shareBody.messages.at(-1).text).toContain("The deletion shares those words");
    expect(shareBody.messages.at(-1).text).toContain("The send and The public post use them.");
    expect(shareBody.messages.at(-1).text).not.toContain("with the send");
    const notShare = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion not share words?" }),
    });
    const notShareBody = await notShare.json();
    expect(notShareBody.messages.at(-1).text).toContain("does share those words");
    expect(notShareBody.messages.at(-1).text).not.toContain("with the send");
    expect(notShareBody.goals).toHaveLength(0);
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion share words with a payment and delete the archive" }),
    });
    const opened = await mixed.json();
    expect(opened.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(opened.approvals.filter((item: { status: string; kind: string }) => item.status === "open" && item.kind === "delete")).toHaveLength(
      1,
    );
    expect(opened.approvals.filter((item: { kind: string }) => item.kind === "pay")).toHaveLength(0);
    expect(opened.handoffs.filter((item: { status: string }) => item.status === "open")).toHaveLength(0);
    expect(opened.messages.at(-1).text).not.toContain("shares those words with");
    expect(opened.messages.at(-1).text).not.toContain("does not share those words with");
    const slipped = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion not share words with a send?" }),
    });
    const slippedBody = await slipped.json();
    expect(slippedBody.goals).toHaveLength(1);
    expect(slippedBody.approvals.filter((item: { kind: string }) => item.kind === "delete")).toHaveLength(1);
    expect(slippedBody.approvals.filter((item: { kind: string }) => item.kind === "send")).toHaveLength(0);
    expect(slippedBody.handoffs).toHaveLength(0);
    expect(slippedBody.messages.at(-1).text).toContain("The deletion does share those words with the send.");
    expect(slippedBody.messages.at(-1).text).toContain("The words are “shared project files”.");
    expect(slippedBody.messages.at(-1).text).not.toContain("“Shared Project Files”");
    expect(slippedBody.messages.at(-1).text).not.toContain("The deletion shares those words with the send.");
    const ordinary = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions to me" }),
    });
    const worked = await ordinary.json();
    expect(worked.goals.length).toBeGreaterThan(0);
    expect(worked.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(worked.messages.at(-1).text).not.toContain("shares those words with");
    expect(JSON.stringify(worked)).not.toContain("Always allow");
  });

  it("ORIEL-F44 a sentence asks whether one step does not share words with another and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion not share words with a send?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.approvals).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("There is no handoff rule for a deletion");
    expect(empty.messages.at(-1).text).toContain("named no other step");
    expect(empty.messages.at(-1).text).not.toContain("with the send");
    expect(empty.messages.at(-1).text).not.toContain("The send");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion not share words with a send without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const loose = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Please, does a payment not share words with a post always allow" }),
    });
    expect(loose.status).toBe(400);
    expect(await loose.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    const note = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a note not share words with a send?" }),
    });
    const noted = await note.json();
    expect(note.status).toBe(200);
    expect(noted.goals).toHaveLength(0);
    expect(noted.approvals).toHaveLength(0);
    expect(noted.messages.at(-1).text).toContain("does not name two different steps");
    expect(noted.messages.at(-1).text).toContain("did not open a card");
    const same = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion not share words with a deletion?" }),
    });
    const sameBody = await same.json();
    expect(sameBody.goals).toHaveLength(0);
    expect(sameBody.approvals).toHaveLength(0);
    expect(sameBody.messages.at(-1).text).toContain("does not name two different steps");
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "post", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "Shared Project Files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pay", enabled: true, phrase: "unshared project files" }),
    });
    const asked = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Does a deletion not share words with a send?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const once = await asked.json();
    expect(asked.status).toBe(200);
    expect(once.goals).toHaveLength(0);
    expect(once.handoffs).toHaveLength(0);
    expect(once.approvals).toHaveLength(0);
    expect(once.handoffRules).toHaveLength(4);
    const reply = once.messages.at(-1).text as string;
    expect(reply).toContain("The deletion does share those words with the send.");
    expect(reply).toContain("The words are “shared project files”.");
    expect(reply.split("“shared project files”").length - 1).toBe(1);
    expect(reply).not.toContain("“Shared Project Files”");
    expect(reply).not.toContain("The deletion shares those words with the send.");
    expect(reply).not.toContain("The payment");
    expect(reply).not.toContain("The public post");
    expect(reply).not.toContain("The send uses them");
    expect(reply).toContain("did not approve a hold");
    const payment = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion not share words with a payment to you?" }),
    });
    const paymentBody = await payment.json();
    expect(paymentBody.messages.at(-1).text).toContain("The deletion does not share those words with the payment.");
    expect(paymentBody.messages.at(-1).text).toContain("“shared project files”");
    expect(paymentBody.messages.at(-1).text).not.toContain("“unshared project files”");
    expect(paymentBody.messages.at(-1).text).not.toContain("does share those words");
    expect(paymentBody.goals).toHaveLength(0);
    expect(paymentBody.approvals).toHaveLength(0);
    const share = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion share words with a send?" }),
    });
    const shareBody = await share.json();
    expect(shareBody.messages.at(-1).text).toContain("The deletion shares those words with the send.");
    expect(shareBody.messages.at(-1).text).not.toContain("does share those words with the send");
    const notShare = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion not share words?" }),
    });
    const notShareBody = await notShare.json();
    expect(notShareBody.messages.at(-1).text).toContain("does share those words");
    expect(notShareBody.messages.at(-1).text).not.toContain("with the send");
    expect(notShareBody.goals).toHaveLength(0);
    const plain = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion share words?" }),
    });
    const plainBody = await plain.json();
    expect(plainBody.messages.at(-1).text).toContain("The deletion shares those words");
    expect(plainBody.messages.at(-1).text).not.toContain("with the send");
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion not share words with a payment and delete the archive" }),
    });
    const opened = await mixed.json();
    expect(opened.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(opened.approvals.filter((item: { status: string; kind: string }) => item.status === "open" && item.kind === "delete")).toHaveLength(
      1,
    );
    expect(opened.approvals.filter((item: { kind: string }) => item.kind === "pay")).toHaveLength(0);
    expect(opened.handoffs.filter((item: { status: string }) => item.status === "open")).toHaveLength(0);
    expect(opened.messages.at(-1).text).not.toContain("does share those words with");
    expect(opened.messages.at(-1).text).not.toContain("does not share those words with");
    const ordinary = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions to me" }),
    });
    const worked = await ordinary.json();
    expect(worked.goals.length).toBeGreaterThan(0);
    expect(worked.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(worked.messages.at(-1).text).not.toContain("does share those words with");
    expect(JSON.stringify(worked)).not.toContain("Always allow");
  });

  it("ORIEL-F45 a sentence asks which steps share words with one step and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps share words with a deletion?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.approvals).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("There is no handoff rule for a deletion");
    expect(empty.messages.at(-1).text).toContain("named no other step");
    expect(empty.messages.at(-1).text).not.toContain("with the deletion");
    expect(empty.messages.at(-1).text).not.toContain("The send");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps share words with a deletion without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const loose = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Please, which step shares words with a post always allow" }),
    });
    expect(loose.status).toBe(400);
    expect(await loose.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    const note = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps share words with a note?" }),
    });
    const noted = await note.json();
    expect(note.status).toBe(200);
    expect(noted.goals).toHaveLength(0);
    expect(noted.approvals).toHaveLength(0);
    expect(noted.messages.at(-1).text).toContain("does not name a send, a payment, a deletion, or a public post");
    expect(noted.messages.at(-1).text).toContain("did not open a card");
    const sendOnly = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps share words with a send?" }),
    });
    const sendBody = await sendOnly.json();
    expect(sendBody.goals).toHaveLength(0);
    expect(sendBody.approvals).toHaveLength(0);
    expect(sendBody.messages.at(-1).text).toContain("There is no handoff rule for a send");
    expect(sendBody.messages.at(-1).text).not.toContain("with the send");
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "post", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "Shared Project Files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pay", enabled: true, phrase: "unshared project files" }),
    });
    const asked = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Which steps share words with a deletion?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const once = await asked.json();
    expect(asked.status).toBe(200);
    expect(once.goals).toHaveLength(0);
    expect(once.handoffs).toHaveLength(0);
    expect(once.approvals).toHaveLength(0);
    expect(once.handoffRules).toHaveLength(4);
    const reply = once.messages.at(-1).text as string;
    expect(reply).toContain("These steps share those words with the deletion.");
    expect(reply).toContain("The words are “shared project files”.");
    expect(reply.split("“shared project files”").length - 1).toBe(1);
    expect(reply).toContain("The send and The public post use them.");
    expect(reply).not.toContain("“Shared Project Files”");
    expect(reply).not.toContain("The payment");
    expect(reply).not.toContain("The deletion");
    expect(reply).toContain("did not approve a hold");
    const payment = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps share words with a payment to you?" }),
    });
    const paymentBody = await payment.json();
    expect(paymentBody.messages.at(-1).text).toContain("No other step shares those words with the payment.");
    expect(paymentBody.messages.at(-1).text).toContain("“unshared project files”");
    expect(paymentBody.messages.at(-1).text).not.toContain("These steps share those words");
    expect(paymentBody.messages.at(-1).text).not.toContain("“shared project files”");
    expect(paymentBody.goals).toHaveLength(0);
    expect(paymentBody.approvals).toHaveLength(0);
    const share = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion share words with a send?" }),
    });
    const shareBody = await share.json();
    expect(shareBody.messages.at(-1).text).toContain("The deletion shares those words with the send.");
    expect(shareBody.messages.at(-1).text).not.toContain("These steps share those words");
    expect(shareBody.messages.at(-1).text).not.toContain("No other step shares those words");
    const notShare = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion not share words with a send?" }),
    });
    const notShareBody = await notShare.json();
    expect(notShareBody.messages.at(-1).text).toContain("does share those words with the send");
    expect(notShareBody.messages.at(-1).text).not.toContain("These steps share those words");
    const plain = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps share words?" }),
    });
    const plainBody = await plain.json();
    expect(plainBody.messages.at(-1).text).toContain("These steps share words");
    expect(plainBody.messages.at(-1).text).not.toContain("with the deletion");
    expect(plainBody.messages.at(-1).text).not.toContain("These steps share those words");
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps share words with a deletion and delete the archive" }),
    });
    const opened = await mixed.json();
    expect(opened.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(opened.approvals.filter((item: { status: string; kind: string }) => item.status === "open" && item.kind === "delete")).toHaveLength(
      1,
    );
    expect(opened.handoffs.filter((item: { status: string }) => item.status === "open")).toHaveLength(0);
    expect(opened.messages.at(-1).text).not.toContain("These steps share those words");
    expect(opened.messages.at(-1).text).not.toContain("No other step shares those words");
    const ordinary = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions to me" }),
    });
    const worked = await ordinary.json();
    expect(worked.goals.length).toBeGreaterThan(0);
    expect(worked.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(worked.messages.at(-1).text).not.toContain("These steps share those words");
    expect(JSON.stringify(worked)).not.toContain("Always allow");
  });

  it("ORIEL-F46 a sentence asks which steps do not share words with one step and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps do not share words with a deletion?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.approvals).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("There is no handoff rule for a deletion");
    expect(empty.messages.at(-1).text).toContain("named no other step");
    expect(empty.messages.at(-1).text).not.toContain("with the deletion");
    expect(empty.messages.at(-1).text).not.toContain("The send");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps do not share words with a deletion without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const loose = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Please, which step does not share words with a post always allow" }),
    });
    expect(loose.status).toBe(400);
    expect(await loose.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    const note = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps do not share words with a note?" }),
    });
    const noted = await note.json();
    expect(note.status).toBe(200);
    expect(noted.goals).toHaveLength(0);
    expect(noted.approvals).toHaveLength(0);
    expect(noted.messages.at(-1).text).toContain("does not name a send, a payment, a deletion, or a public post");
    expect(noted.messages.at(-1).text).toContain("did not open a card");
    const sendOnly = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps do not share words with a send?" }),
    });
    const sendBody = await sendOnly.json();
    expect(sendBody.goals).toHaveLength(0);
    expect(sendBody.approvals).toHaveLength(0);
    expect(sendBody.messages.at(-1).text).toContain("There is no handoff rule for a send");
    expect(sendBody.messages.at(-1).text).not.toContain("with the send");
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "post", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "Shared Project Files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pay", enabled: true, phrase: "unshared project files" }),
    });
    const asked = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Which steps do not share words with a deletion?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const once = await asked.json();
    expect(asked.status).toBe(200);
    expect(once.goals).toHaveLength(0);
    expect(once.handoffs).toHaveLength(0);
    expect(once.approvals).toHaveLength(0);
    expect(once.handoffRules).toHaveLength(4);
    const reply = once.messages.at(-1).text as string;
    expect(reply).toContain("These steps do share those words with the deletion.");
    expect(reply).toContain("The words are “shared project files”.");
    expect(reply.split("“shared project files”").length - 1).toBe(1);
    expect(reply).toContain("The send and The public post use them.");
    expect(reply).not.toContain("These steps share those words");
    expect(reply).not.toContain("“Shared Project Files”");
    expect(reply).not.toContain("The payment");
    expect(reply).not.toContain("The deletion");
    expect(reply).toContain("did not approve a hold");
    const payment = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps do not share words with a payment to you?" }),
    });
    const paymentBody = await payment.json();
    expect(paymentBody.messages.at(-1).text).toContain("No other step shares those words with the payment.");
    expect(paymentBody.messages.at(-1).text).toContain("“unshared project files”");
    expect(paymentBody.messages.at(-1).text).not.toContain("No other step does share");
    expect(paymentBody.messages.at(-1).text).not.toContain("These steps do share those words");
    expect(paymentBody.messages.at(-1).text).not.toContain("“shared project files”");
    expect(paymentBody.goals).toHaveLength(0);
    expect(paymentBody.approvals).toHaveLength(0);
    const share = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion share words with a send?" }),
    });
    const shareBody = await share.json();
    expect(shareBody.messages.at(-1).text).toContain("The deletion shares those words with the send.");
    expect(shareBody.messages.at(-1).text).not.toContain("These steps do share those words");
    const notShare = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion not share words with a send?" }),
    });
    const notShareBody = await notShare.json();
    expect(notShareBody.messages.at(-1).text).toContain("does share those words with the send");
    expect(notShareBody.messages.at(-1).text).not.toContain("These steps do share those words");
    const positive = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps share words with a deletion?" }),
    });
    const positiveBody = await positive.json();
    expect(positiveBody.messages.at(-1).text).toContain("These steps share those words with the deletion.");
    expect(positiveBody.messages.at(-1).text).not.toContain("does share those words");
    const plain = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps do not share words?" }),
    });
    const plainBody = await plain.json();
    expect(plainBody.messages.at(-1).text).toContain("These steps use words once");
    expect(plainBody.messages.at(-1).text).not.toContain("with the deletion");
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps do not share words with a deletion and delete the archive" }),
    });
    const opened = await mixed.json();
    expect(opened.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(opened.approvals.filter((item: { status: string; kind: string }) => item.status === "open" && item.kind === "delete")).toHaveLength(
      1,
    );
    expect(opened.handoffs.filter((item: { status: string }) => item.status === "open")).toHaveLength(0);
    expect(opened.messages.at(-1).text).not.toContain("These steps do share those words");
    expect(opened.messages.at(-1).text).not.toContain("No other step shares those words");
    const ordinary = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions to me" }),
    });
    const worked = await ordinary.json();
    expect(worked.goals.length).toBeGreaterThan(0);
    expect(worked.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(worked.messages.at(-1).text).not.toContain("These steps do share those words");
    expect(JSON.stringify(worked)).not.toContain("Always allow");
  });

  it("ORIEL-F47 a sentence asks which words one step shares and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion share?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.approvals).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("There is no handoff rule for a deletion");
    expect(empty.messages.at(-1).text).toContain("named no other step");
    expect(empty.messages.at(-1).text).not.toContain("shares these words");
    expect(empty.messages.at(-1).text).not.toContain("with the deletion");
    expect(empty.messages.at(-1).text).not.toContain("The send");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion share without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const loose = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Please, which word does a post share always allow" }),
    });
    expect(loose.status).toBe(400);
    expect(await loose.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    const note = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a note share?" }),
    });
    const noted = await note.json();
    expect(note.status).toBe(200);
    expect(noted.goals).toHaveLength(0);
    expect(noted.approvals).toHaveLength(0);
    expect(noted.messages.at(-1).text).toContain("does not name a send, a payment, a deletion, or a public post");
    expect(noted.messages.at(-1).text).toContain("did not open a card");
    const sendOnly = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a send share?" }),
    });
    const sendBody = await sendOnly.json();
    expect(sendBody.goals).toHaveLength(0);
    expect(sendBody.approvals).toHaveLength(0);
    expect(sendBody.messages.at(-1).text).toContain("There is no handoff rule for a send");
    expect(sendBody.messages.at(-1).text).not.toContain("shares these words");
    expect(sendBody.messages.at(-1).text).not.toContain("with the send");
    const notThis = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion not share?" }),
    });
    const notBody = await notThis.json();
    expect(notBody.goals).toHaveLength(0);
    expect(notBody.approvals).toHaveLength(0);
    expect(notBody.handoffs).toHaveLength(0);
    expect(notBody.messages.at(-1).text).toContain("There is no handoff rule for a deletion");
    expect(notBody.messages.at(-1).text).not.toContain("shares these words");
    expect(notBody.messages.at(-1).text).not.toContain("does share these words");
    expect(notBody.messages.at(-1).text).not.toContain("does not share these words");
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "post", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "Shared Project Files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pay", enabled: true, phrase: "unshared project files" }),
    });
    const asked = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Which words does a deletion share?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const once = await asked.json();
    expect(asked.status).toBe(200);
    expect(once.goals).toHaveLength(0);
    expect(once.handoffs).toHaveLength(0);
    expect(once.approvals).toHaveLength(0);
    expect(once.handoffRules).toHaveLength(4);
    const reply = once.messages.at(-1).text as string;
    expect(reply).toContain("The deletion shares these words.");
    expect(reply).toContain("The words are “shared project files”.");
    expect(reply.split("“shared project files”").length - 1).toBe(1);
    expect(reply).toContain("The send and The public post use them.");
    expect(reply).not.toContain("with the deletion");
    expect(reply).not.toContain("These steps share those words");
    expect(reply).not.toContain("does share those words");
    expect(reply).not.toContain("“Shared Project Files”");
    expect(reply).not.toContain("The payment");
    expect(reply).not.toContain("The deletion use");
    expect(reply).toContain("did not approve a hold");
    const payment = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a payment share to you?" }),
    });
    const paymentBody = await payment.json();
    expect(paymentBody.messages.at(-1).text).toContain("Those words are used once.");
    expect(paymentBody.messages.at(-1).text).toContain("“unshared project files”");
    expect(paymentBody.messages.at(-1).text).not.toContain("shares these words");
    expect(paymentBody.messages.at(-1).text).not.toContain("with the payment");
    expect(paymentBody.messages.at(-1).text).not.toContain("“shared project files”");
    expect(paymentBody.goals).toHaveLength(0);
    expect(paymentBody.approvals).toHaveLength(0);
    const share = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion share words with a send?" }),
    });
    const shareBody = await share.json();
    expect(shareBody.messages.at(-1).text).toContain("The deletion shares those words with the send.");
    expect(shareBody.messages.at(-1).text).not.toContain("shares these words");
    const positive = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps share words with a deletion?" }),
    });
    const positiveBody = await positive.json();
    expect(positiveBody.messages.at(-1).text).toContain("These steps share those words with the deletion.");
    expect(positiveBody.messages.at(-1).text).not.toContain("shares these words");
    const plain = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion hand to me?" }),
    });
    const plainBody = await plain.json();
    expect(plainBody.messages.at(-1).text).toContain("The words are “shared project files”.");
    expect(plainBody.messages.at(-1).text).not.toContain("shares these words");
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion share and delete the archive" }),
    });
    const opened = await mixed.json();
    expect(opened.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(opened.approvals.filter((item: { status: string; kind: string }) => item.status === "open" && item.kind === "delete")).toHaveLength(
      1,
    );
    expect(opened.handoffs.filter((item: { status: string }) => item.status === "open")).toHaveLength(0);
    expect(opened.messages.at(-1).text).not.toContain("shares these words");
    expect(opened.messages.at(-1).text).not.toContain("Those words are used once");
    const ordinary = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions to me" }),
    });
    const worked = await ordinary.json();
    expect(worked.goals.length).toBeGreaterThan(0);
    expect(worked.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(worked.messages.at(-1).text).not.toContain("shares these words");
    expect(JSON.stringify(worked)).not.toContain("Always allow");
  });

  it("ORIEL-F48 a sentence asks which words one step does not share and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion not share?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.approvals).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("There is no handoff rule for a deletion");
    expect(empty.messages.at(-1).text).toContain("named no other step");
    expect(empty.messages.at(-1).text).not.toContain("does share these words");
    expect(empty.messages.at(-1).text).not.toContain("does not share these words");
    expect(empty.messages.at(-1).text).not.toContain("shares these words");
    expect(empty.messages.at(-1).text).not.toContain("with the deletion");
    expect(empty.messages.at(-1).text).not.toContain("The send");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion not share without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const loose = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Please, which word does a post not share always allow" }),
    });
    expect(loose.status).toBe(400);
    expect(await loose.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    const note = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a note not share?" }),
    });
    const noted = await note.json();
    expect(note.status).toBe(200);
    expect(noted.goals).toHaveLength(0);
    expect(noted.approvals).toHaveLength(0);
    expect(noted.messages.at(-1).text).toContain("does not name a send, a payment, a deletion, or a public post");
    expect(noted.messages.at(-1).text).toContain("did not open a card");
    const sendOnly = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a send not share?" }),
    });
    const sendBody = await sendOnly.json();
    expect(sendBody.goals).toHaveLength(0);
    expect(sendBody.approvals).toHaveLength(0);
    expect(sendBody.messages.at(-1).text).toContain("There is no handoff rule for a send");
    expect(sendBody.messages.at(-1).text).not.toContain("does share these words");
    expect(sendBody.messages.at(-1).text).not.toContain("with the send");
    const positive = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion share?" }),
    });
    const positiveBody = await positive.json();
    expect(positiveBody.goals).toHaveLength(0);
    expect(positiveBody.messages.at(-1).text).not.toContain("does share these words");
    expect(positiveBody.messages.at(-1).text).not.toContain("does not share these words");
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "post", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "Shared Project Files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pay", enabled: true, phrase: "unshared project files" }),
    });
    const asked = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Which words does a deletion not share?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const once = await asked.json();
    expect(asked.status).toBe(200);
    expect(once.goals).toHaveLength(0);
    expect(once.handoffs).toHaveLength(0);
    expect(once.approvals).toHaveLength(0);
    expect(once.handoffRules).toHaveLength(4);
    const reply = once.messages.at(-1).text as string;
    expect(reply).toContain("The deletion does share these words.");
    expect(reply).toContain("The words are “shared project files”.");
    expect(reply.split("“shared project files”").length - 1).toBe(1);
    expect(reply).toContain("The send and The public post use them.");
    expect(reply).not.toContain("The deletion shares these words");
    expect(reply).not.toContain("with the deletion");
    expect(reply).not.toContain("These steps share those words");
    expect(reply).not.toContain("These steps do share those words");
    expect(reply).not.toContain("“Shared Project Files”");
    expect(reply).not.toContain("The payment");
    expect(reply).not.toContain("The deletion use");
    expect(reply).toContain("did not approve a hold");
    const payment = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a payment not share to you?" }),
    });
    const paymentBody = await payment.json();
    expect(paymentBody.messages.at(-1).text).toContain("The payment does not share these words.");
    expect(paymentBody.messages.at(-1).text).toContain("“unshared project files”");
    expect(paymentBody.messages.at(-1).text).not.toContain("does share these words");
    expect(paymentBody.messages.at(-1).text).not.toContain("Those words are used once");
    expect(paymentBody.messages.at(-1).text).not.toContain("with the payment");
    expect(paymentBody.messages.at(-1).text).not.toContain("“shared project files”");
    expect(paymentBody.goals).toHaveLength(0);
    expect(paymentBody.approvals).toHaveLength(0);
    const share = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion share?" }),
    });
    const shareBody = await share.json();
    expect(shareBody.messages.at(-1).text).toContain("The deletion shares these words.");
    expect(shareBody.messages.at(-1).text).not.toContain("does share these words");
    expect(shareBody.messages.at(-1).text).not.toContain("does not share these words");
    const plain = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion hand to me?" }),
    });
    const plainBody = await plain.json();
    expect(plainBody.messages.at(-1).text).toContain("The words are “shared project files”.");
    expect(plainBody.messages.at(-1).text).not.toContain("does share these words");
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion not share and delete the archive" }),
    });
    const opened = await mixed.json();
    expect(opened.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(opened.approvals.filter((item: { status: string; kind: string }) => item.status === "open" && item.kind === "delete")).toHaveLength(
      1,
    );
    expect(opened.handoffs.filter((item: { status: string }) => item.status === "open")).toHaveLength(0);
    expect(opened.messages.at(-1).text).not.toContain("does share these words");
    expect(opened.messages.at(-1).text).not.toContain("does not share these words");
    const ordinary = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions to me" }),
    });
    const worked = await ordinary.json();
    expect(worked.goals.length).toBeGreaterThan(0);
    expect(worked.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(worked.messages.at(-1).text).not.toContain("does share these words");
    expect(JSON.stringify(worked)).not.toContain("Always allow");
  });

  it("ORIEL-F49 a sentence asks which words one step shares with one other step and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion share with a send?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.approvals).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("There is no handoff rule for a deletion");
    expect(empty.messages.at(-1).text).toContain("named no other step");
    expect(empty.messages.at(-1).text).not.toContain("with the send");
    expect(empty.messages.at(-1).text).not.toContain("shares these words");
    expect(empty.messages.at(-1).text).not.toContain("does share these words");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion share with a send without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const loose = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Please, which word does a post share with a payment always allow" }),
    });
    expect(loose.status).toBe(400);
    expect(await loose.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    const note = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a note share with a send?" }),
    });
    const noted = await note.json();
    expect(note.status).toBe(200);
    expect(noted.goals).toHaveLength(0);
    expect(noted.approvals).toHaveLength(0);
    expect(noted.messages.at(-1).text).toContain("does not name two different steps");
    expect(noted.messages.at(-1).text).toContain("did not open a card");
    const notThis = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion not share with a send?" }),
    });
    const notBody = await notThis.json();
    expect(notBody.goals).toHaveLength(0);
    expect(notBody.approvals).toHaveLength(0);
    expect(notBody.messages.at(-1).text).toContain("There is no handoff rule for a deletion");
    expect(notBody.messages.at(-1).text).not.toContain("shares these words with the send");
    expect(notBody.messages.at(-1).text).not.toContain("does share these words with the send");
    expect(notBody.messages.at(-1).text).not.toContain("does not share these words with the send");
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "post", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "Shared Project Files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pay", enabled: true, phrase: "unshared project files" }),
    });
    const asked = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Which words does a deletion share with a send?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const once = await asked.json();
    expect(asked.status).toBe(200);
    expect(once.goals).toHaveLength(0);
    expect(once.handoffs).toHaveLength(0);
    expect(once.approvals.filter((item: { kind: string }) => item.kind === "send")).toHaveLength(0);
    expect(once.handoffRules).toHaveLength(4);
    const reply = once.messages.at(-1).text as string;
    expect(reply).toContain("The deletion shares these words with the send.");
    expect(reply).not.toContain("The deletion shares these words.");
    expect(reply).toContain("The words are “shared project files”.");
    expect(reply.split("“shared project files”").length - 1).toBe(1);
    expect(reply).not.toContain("does share these words");
    expect(reply).not.toContain("“Shared Project Files”");
    expect(reply).not.toContain("The payment");
    expect(reply).not.toContain("The public post");
    expect(reply).toContain("did not approve a hold");
    const payment = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a payment share with a deletion to you?" }),
    });
    const paymentBody = await payment.json();
    expect(paymentBody.messages.at(-1).text).toContain("The payment does not share these words with the deletion.");
    expect(paymentBody.messages.at(-1).text).toContain("“unshared project files”");
    expect(paymentBody.messages.at(-1).text).not.toContain("Those words are used once");
    expect(paymentBody.messages.at(-1).text).not.toContain("“shared project files”");
    expect(paymentBody.approvals.filter((item: { kind: string }) => item.kind === "pay")).toHaveLength(0);
    const positive = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion share?" }),
    });
    const positiveBody = await positive.json();
    expect(positiveBody.messages.at(-1).text).toContain("The deletion shares these words.");
    expect(positiveBody.messages.at(-1).text).not.toContain("with the send");
    const plain = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion hand to me?" }),
    });
    const plainBody = await plain.json();
    expect(plainBody.messages.at(-1).text).toContain("The words are “shared project files”.");
    expect(plainBody.messages.at(-1).text).not.toContain("shares these words");
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion share with a send and delete the archive" }),
    });
    const opened = await mixed.json();
    expect(opened.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(opened.approvals.filter((item: { status: string; kind: string }) => item.status === "open" && item.kind === "delete")).toHaveLength(
      1,
    );
    expect(opened.handoffs.filter((item: { status: string }) => item.status === "open")).toHaveLength(0);
    expect(opened.messages.at(-1).text).not.toContain("shares these words with the send");
    const ordinary = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions to me" }),
    });
    const worked = await ordinary.json();
    expect(worked.goals.length).toBeGreaterThan(1);
    expect(worked.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(worked.messages.at(-1).text).not.toContain("shares these words with the send");
    expect(JSON.stringify(worked)).not.toContain("Always allow");
  });

  it("ORIEL-F50 a sentence asks which words one step does not share with one other step and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion not share with a send?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.approvals).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("There is no handoff rule for a deletion");
    expect(empty.messages.at(-1).text).toContain("named no other step");
    expect(empty.messages.at(-1).text).not.toContain("with the send");
    expect(empty.messages.at(-1).text).not.toContain("shares these words");
    expect(empty.messages.at(-1).text).not.toContain("does share these words");
    expect(empty.messages.at(-1).text).not.toContain("does not share these words");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion not share with a send without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const loose = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Please, which word does a post not share with a payment always allow" }),
    });
    expect(loose.status).toBe(400);
    expect(await loose.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    const note = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a note not share with a send?" }),
    });
    const noted = await note.json();
    expect(note.status).toBe(200);
    expect(noted.goals).toHaveLength(0);
    expect(noted.approvals).toHaveLength(0);
    expect(noted.messages.at(-1).text).toContain("does not name two different steps");
    expect(noted.messages.at(-1).text).toContain("did not open a card");
    const shareWith = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion share with a send?" }),
    });
    const shareBody = await shareWith.json();
    expect(shareBody.goals).toHaveLength(0);
    expect(shareBody.approvals).toHaveLength(0);
    expect(shareBody.messages.at(-1).text).toContain("There is no handoff rule for a deletion");
    expect(shareBody.messages.at(-1).text).not.toContain("does share these words with the send");
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "post", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "Shared Project Files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pay", enabled: true, phrase: "unshared project files" }),
    });
    const asked = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Which words does a deletion not share with a send?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const once = await asked.json();
    expect(asked.status).toBe(200);
    expect(once.goals).toHaveLength(0);
    expect(once.handoffs).toHaveLength(0);
    expect(once.approvals).toHaveLength(0);
    expect(once.handoffRules).toHaveLength(4);
    const reply = once.messages.at(-1).text as string;
    expect(reply).toContain("The deletion does share these words with the send.");
    expect(reply).not.toContain("The deletion does share these words.");
    expect(reply).not.toContain("The deletion shares these words with the send");
    expect(reply).toContain("The words are “shared project files”.");
    expect(reply.split("“shared project files”").length - 1).toBe(1);
    expect(reply).not.toContain("does not share these words with the send");
    expect(reply).not.toContain("“Shared Project Files”");
    expect(reply).not.toContain("The payment");
    expect(reply).not.toContain("The public post");
    expect(reply).toContain("did not approve a hold");
    const payment = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a payment not share with a deletion to you?" }),
    });
    const paymentBody = await payment.json();
    expect(paymentBody.messages.at(-1).text).toContain("The payment does not share these words with the deletion.");
    expect(paymentBody.messages.at(-1).text).toContain("“unshared project files”");
    expect(paymentBody.messages.at(-1).text).not.toContain("Those words are used once");
    expect(paymentBody.messages.at(-1).text).not.toContain("“shared project files”");
    expect(paymentBody.approvals.filter((item: { kind: string }) => item.kind === "pay")).toHaveLength(0);
    const positive = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion share with a send?" }),
    });
    const positiveBody = await positive.json();
    expect(positiveBody.messages.at(-1).text).toContain("The deletion shares these words with the send.");
    expect(positiveBody.messages.at(-1).text).not.toContain("does share these words with the send");
    const plain = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion not share?" }),
    });
    const plainBody = await plain.json();
    expect(plainBody.messages.at(-1).text).toContain("The deletion does share these words.");
    expect(plainBody.messages.at(-1).text).not.toContain("with the send");
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion not share with a send and delete the archive" }),
    });
    const opened = await mixed.json();
    expect(opened.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(opened.approvals.filter((item: { status: string; kind: string }) => item.status === "open" && item.kind === "delete")).toHaveLength(
      1,
    );
    expect(opened.approvals.filter((item: { status: string; kind: string }) => item.status === "open" && item.kind === "send")).toHaveLength(1);
    expect(opened.handoffs.filter((item: { status: string }) => item.status === "open")).toHaveLength(0);
    expect(opened.messages.at(-1).text).not.toContain("does share these words with the send");
    const ordinary = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions to me" }),
    });
    const worked = await ordinary.json();
    expect(worked.goals.length).toBeGreaterThan(1);
    expect(worked.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(worked.messages.at(-1).text).not.toContain("does share these words with the send");
    expect(JSON.stringify(worked)).not.toContain("Always allow");
  });

  it("ORIEL-F51 a sentence asks which steps do not mention certain words and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps do not mention shared project files?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.approvals).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("No step does not mention “shared project files”");
    expect(empty.messages.at(-1).text).not.toContain("does not mention those words");
    expect(empty.messages.at(-1).text).not.toContain("The deletion");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps do not mention shared project files without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const loose = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Please, which step does not mention shared project files always allow" }),
    });
    expect(loose.status).toBe(400);
    expect(await loose.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const short = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps do not mention ab?" }),
    });
    expect(short.status).toBe(400);
    expect(await short.json()).toMatchObject({ error: expect.stringMatching(/short phrase/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pay", enabled: true, phrase: "the vendor invoice" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "launch note" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "post", enabled: true }),
    });
    const asked = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Which steps do not mention shared project files?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const once = await asked.json();
    expect(asked.status).toBe(200);
    expect(once.goals).toHaveLength(0);
    expect(once.handoffs).toHaveLength(0);
    expect(once.approvals).toHaveLength(0);
    expect(once.handoffRules).toHaveLength(4);
    const reply = once.messages.at(-1).text as string;
    expect(reply).toContain("These steps do not mention those words.");
    expect(reply).toContain("The send does not mention those words. The words are “launch note”.");
    expect(reply).toContain("The payment does not mention those words. The words are “the vendor invoice”.");
    expect(reply.indexOf("The send")).toBeLessThan(reply.indexOf("The payment"));
    expect(reply).not.toContain("The deletion");
    expect(reply).not.toContain("The public post");
    expect(reply).not.toContain("“shared project files”");
    expect(reply).not.toContain("the whole");
    expect(reply).toContain("did not approve a hold");
    const positive = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which step mentions shared project files?" }),
    });
    const positiveBody = await positive.json();
    expect(positiveBody.messages.at(-1).text).toContain("The deletion mentions “shared project files”");
    expect(positiveBody.messages.at(-1).text).not.toContain("does not mention");
    const other = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion not share with a send?" }),
    });
    const otherBody = await other.json();
    expect(otherBody.messages.at(-1).text).toContain("does not share these words with the send");
    expect(otherBody.messages.at(-1).text).not.toContain("does not mention");
    expect(otherBody.approvals.filter((item: { kind: string }) => item.kind === "send")).toHaveLength(0);
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps do not mention shared project files and delete the archive" }),
    });
    const skipped = await mixed.json();
    expect(skipped.approvals).toHaveLength(0);
    expect(skipped.handoffs).toHaveLength(0);
    expect(skipped.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(skipped.messages.at(-1).text).not.toContain("No step does not mention");
    const ordinary = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions to me" }),
    });
    const worked = await ordinary.json();
    expect(worked.goals.length).toBeGreaterThan(0);
    expect(worked.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(worked.messages.at(-1).text).not.toContain("No step does not mention");
    expect(JSON.stringify(worked)).not.toContain("Always allow");
  });

  it("ORIEL-F52 a sentence asks whether one step does not mention certain words and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion not mention shared project files?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.approvals).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("The deletion is not handed to you.");
    expect(empty.messages.at(-1).text).not.toContain("does mention those words");
    expect(empty.messages.at(-1).text).not.toContain("does not mention those words");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion not mention shared project files without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const short = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion not mention ab?" }),
    });
    expect(short.status).toBe(400);
    expect(await short.json()).toMatchObject({ error: expect.stringMatching(/short phrase/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pay", enabled: true, phrase: "the vendor invoice" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "post", enabled: true }),
    });
    const asked = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Does a deletion not mention shared project files?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const once = await asked.json();
    expect(asked.status).toBe(200);
    expect(once.goals).toHaveLength(0);
    expect(once.handoffs).toHaveLength(0);
    expect(once.approvals).toHaveLength(0);
    expect(once.handoffRules).toHaveLength(3);
    const reply = once.messages.at(-1).text as string;
    expect(reply).toContain("The deletion does mention those words.");
    expect(reply).toContain("The words are “shared project files”.");
    expect(reply).not.toContain("The deletion does not mention those words");
    expect(reply).not.toContain("The payment");
    expect(reply).not.toContain("The public post");
    expect(reply).not.toContain("the whole");
    expect(reply).toContain("did not approve a hold");
    const different = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a payment not mention shared project files?" }),
    });
    const differentBody = await different.json();
    expect(differentBody.messages.at(-1).text).toContain("The payment does not mention those words.");
    expect(differentBody.messages.at(-1).text).toContain("The words are “the vendor invoice”.");
    expect(differentBody.messages.at(-1).text).not.toContain("The payment does mention those words");
    expect(differentBody.approvals.filter((item: { kind: string }) => item.kind === "pay")).toHaveLength(0);
    const positive = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps do not mention shared project files?" }),
    });
    const positiveBody = await positive.json();
    expect(positiveBody.messages.at(-1).text).toContain("The payment does not mention those words.");
    expect(positiveBody.messages.at(-1).text).not.toContain("These steps do not mention those words");
    expect(positiveBody.messages.at(-1).text).not.toContain("does mention those words");
    const plain = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion mention shared project files?" }),
    });
    const opened = await plain.json();
    expect(opened.goals).toHaveLength(0);
    expect(opened.handoffs).toHaveLength(0);
    expect(opened.approvals.filter((item: { kind: string }) => item.kind === "delete")).toHaveLength(0);
    expect(opened.messages.at(-1).text).toContain("The deletion mentions those words.");
    expect(opened.messages.at(-1).text).not.toContain("The deletion mentions other words");
    expect(opened.messages.at(-1).text).not.toContain("The deletion does mention those words");
    expect(opened.messages.at(-1).text).not.toContain("The deletion does not mention those words");
    expect(opened.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    const ordinary = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions to me" }),
    });
    const worked = await ordinary.json();
    expect(worked.goals.length).toBeGreaterThan(0);
    expect(worked.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(worked.messages.at(-1).text).not.toContain("The deletion does mention those words");
    expect(JSON.stringify(worked)).not.toContain("Always allow");
  });

  it("ORIEL-F53 a sentence asks whether one step mentions certain words and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion mention shared project files?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.approvals).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("The deletion is not handed to you.");
    expect(empty.messages.at(-1).text).not.toContain("mentions those words");
    expect(empty.messages.at(-1).text).not.toContain("mentions other words");
    expect(empty.messages.at(-1).text).not.toContain("does mention those words");
    expect(empty.messages.at(-1).text).not.toContain("does not mention those words");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion mention shared project files without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const short = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion mention ab?" }),
    });
    expect(short.status).toBe(400);
    expect(await short.json()).toMatchObject({ error: expect.stringMatching(/short phrase/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pay", enabled: true, phrase: "the vendor invoice" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "post", enabled: true }),
    });
    const asked = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Does a deletion mention shared project files?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const once = await asked.json();
    expect(asked.status).toBe(200);
    expect(once.goals).toHaveLength(0);
    expect(once.handoffs).toHaveLength(0);
    expect(once.approvals).toHaveLength(0);
    expect(once.handoffRules).toHaveLength(3);
    const reply = once.messages.at(-1).text as string;
    expect(reply).toContain("The deletion mentions those words.");
    expect(reply).toContain("The words are “shared project files”.");
    expect(reply).not.toContain("The deletion mentions other words");
    expect(reply).not.toContain("The deletion does mention those words");
    expect(reply).not.toContain("The deletion does not mention those words");
    expect(reply).not.toContain("The payment");
    expect(reply).not.toContain("The public post");
    expect(reply).not.toContain("the whole");
    expect(reply).toContain("did not approve a hold");
    const different = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a payment mention shared project files?" }),
    });
    const differentBody = await different.json();
    expect(differentBody.messages.at(-1).text).toContain("The payment mentions other words.");
    expect(differentBody.messages.at(-1).text).toContain("The words are “the vendor invoice”.");
    expect(differentBody.messages.at(-1).text).not.toContain("The payment mentions those words");
    expect(differentBody.approvals.filter((item: { kind: string }) => item.kind === "pay")).toHaveLength(0);
    const positive = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion not mention shared project files?" }),
    });
    const positiveBody = await positive.json();
    expect(positiveBody.messages.at(-1).text).toContain("The deletion does mention those words.");
    expect(positiveBody.messages.at(-1).text).not.toContain("The deletion mentions those words");
    expect(positiveBody.messages.at(-1).text).not.toContain("The deletion mentions other words");
    const plain = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion share the words?" }),
    });
    const opened = await plain.json();
    expect(opened.goals.length).toBeGreaterThan(0);
    expect(opened.handoffs).toHaveLength(0);
    expect(opened.approvals.filter((item: { kind: string }) => item.kind === "delete")).toHaveLength(0);
    expect(opened.messages.at(-1).text).not.toContain("The deletion mentions those words");
    expect(opened.messages.at(-1).text).not.toContain("The deletion mentions other words");
    expect(opened.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    const ordinary = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions to me" }),
    });
    const worked = await ordinary.json();
    expect(worked.goals.length).toBeGreaterThan(0);
    expect(worked.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(worked.messages.at(-1).text).not.toContain("The deletion mentions those words");
    expect(JSON.stringify(worked)).not.toContain("Always allow");
  });

  it("ORIEL-F54 a sentence asks whether one step mentions the same words as another and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion mention the same words as a send?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.approvals).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("The deletion is not handed to you.");
    expect(empty.messages.at(-1).text).not.toContain("the send");
    expect(empty.messages.at(-1).text).not.toContain("mentions the same words");
    expect(empty.messages.at(-1).text).not.toContain("does not mention the same words");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion mention the same words as a send without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pay", enabled: true, phrase: "the vendor invoice" }),
    });
    const asked = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Does a deletion mention the same words as a send?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const once = await asked.json();
    expect(asked.status).toBe(200);
    expect(once.goals).toHaveLength(0);
    expect(once.handoffs).toHaveLength(0);
    expect(once.approvals).toHaveLength(0);
    expect(once.handoffRules).toHaveLength(3);
    const reply = once.messages.at(-1).text as string;
    expect(reply).toContain("The deletion mentions the same words as the send.");
    expect(reply).toContain("The words are “shared project files”.");
    expect(reply.split("“shared project files”").length - 1).toBe(1);
    expect(reply).not.toContain("The deletion does not mention the same words");
    expect(reply).not.toContain("The payment");
    expect(reply).not.toContain("the whole");
    expect(reply).toContain("did not approve a hold");
    const different = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a payment mention the same words as a send?" }),
    });
    const differentBody = await different.json();
    expect(differentBody.messages.at(-1).text).toContain("The payment does not mention the same words as the send.");
    expect(differentBody.messages.at(-1).text).toContain("The words are “the vendor invoice”.");
    expect(differentBody.messages.at(-1).text).not.toContain("“shared project files”");
    expect(differentBody.approvals.filter((item: { kind: string }) => item.kind === "pay")).toHaveLength(0);
    const positive = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion mention shared project files?" }),
    });
    const positiveBody = await positive.json();
    expect(positiveBody.messages.at(-1).text).toContain("The deletion mentions those words.");
    expect(positiveBody.messages.at(-1).text).not.toContain("the same words as the send");
    const notQuestion = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion not mention the same words as a send?" }),
    });
    const opened = await notQuestion.json();
    expect(opened.goals).toHaveLength(0);
    expect(opened.approvals).toHaveLength(0);
    expect(opened.handoffs).toHaveLength(0);
    expect(opened.messages.at(-1).text).toContain("The deletion does mention the same words as the send.");
    expect(opened.messages.at(-1).text).not.toContain("The deletion mentions the same words as the send.");
    expect(opened.messages.at(-1).text).toContain("The words are “shared project files”.");
    expect(opened.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    const ordinary = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions to me" }),
    });
    const worked = await ordinary.json();
    expect(worked.goals.length).toBeGreaterThan(opened.goals.length);
    expect(worked.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(worked.messages.at(-1).text).not.toContain("mentions the same words");
    expect(JSON.stringify(worked)).not.toContain("Always allow");
  });

  it("ORIEL-F55 a sentence asks whether one step does not mention the same words as another and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion not mention the same words as a send?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.approvals).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("The deletion is not handed to you.");
    expect(empty.messages.at(-1).text).not.toContain("the send");
    expect(empty.messages.at(-1).text).not.toContain("does mention the same words");
    expect(empty.messages.at(-1).text).not.toContain("does not mention the same words");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion not mention the same words as a send without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pay", enabled: true, phrase: "the vendor invoice" }),
    });
    const asked = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Does a deletion not mention the same words as a send?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const once = await asked.json();
    expect(asked.status).toBe(200);
    expect(once.goals).toHaveLength(0);
    expect(once.handoffs).toHaveLength(0);
    expect(once.approvals).toHaveLength(0);
    expect(once.handoffRules).toHaveLength(3);
    const reply = once.messages.at(-1).text as string;
    expect(reply).toContain("The deletion does mention the same words as the send.");
    expect(reply).toContain("The words are “shared project files”.");
    expect(reply.split("“shared project files”").length - 1).toBe(1);
    expect(reply).not.toContain("The deletion mentions the same words as the send");
    expect(reply).not.toContain("The payment");
    expect(reply).not.toContain("the whole");
    expect(reply).toContain("did not approve a hold");
    const different = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a payment not mention the same words as a send?" }),
    });
    const differentBody = await different.json();
    expect(differentBody.messages.at(-1).text).toContain("The payment does not mention the same words as the send.");
    expect(differentBody.messages.at(-1).text).toContain("The words are “the vendor invoice”.");
    expect(differentBody.messages.at(-1).text).not.toContain("“shared project files”");
    expect(differentBody.approvals.filter((item: { kind: string }) => item.kind === "pay")).toHaveLength(0);
    const positive = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion mention the same words as a send?" }),
    });
    const positiveBody = await positive.json();
    expect(positiveBody.messages.at(-1).text).toContain("The deletion mentions the same words as the send.");
    expect(positiveBody.messages.at(-1).text).not.toContain("The deletion does mention the same words");
    const notQuestion = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion not mention the same words as a send and delete the archive" }),
    });
    const opened = await notQuestion.json();
    expect(opened.goals.length).toBeGreaterThan(0);
    expect(opened.approvals.filter((item: { kind: string }) => item.kind === "send")).toHaveLength(1);
    expect(opened.approvals.filter((item: { kind: string }) => item.kind === "delete")).toHaveLength(1);
    expect(opened.handoffs).toHaveLength(0);
    expect(opened.messages.at(-1).text).not.toContain("does mention the same words");
    expect(opened.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    const ordinary = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions to me" }),
    });
    const worked = await ordinary.json();
    expect(worked.goals.length).toBeGreaterThan(opened.goals.length);
    expect(worked.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(worked.messages.at(-1).text).not.toContain("does mention the same words");
    expect(JSON.stringify(worked)).not.toContain("Always allow");
  });

  it("ORIEL-F56 a sentence asks which steps mention the same words as one step and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps mention the same words as a deletion?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.approvals).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("There is no handoff rule for a deletion");
    expect(empty.messages.at(-1).text).toContain("named no other step");
    expect(empty.messages.at(-1).text).not.toContain("the same words as the deletion");
    expect(empty.messages.at(-1).text).not.toContain("The send");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps mention the same words as a deletion without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const loose = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Please, which step mentions the same words as a post always allow" }),
    });
    expect(loose.status).toBe(400);
    expect(await loose.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    const note = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps mention the same words as a note?" }),
    });
    const noted = await note.json();
    expect(note.status).toBe(200);
    expect(noted.goals).toHaveLength(0);
    expect(noted.approvals).toHaveLength(0);
    expect(noted.messages.at(-1).text).toContain("does not name a send, a payment, a deletion, or a public post");
    expect(noted.messages.at(-1).text).toContain("did not open a card");
    const sendOnly = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps mention the same words as a send?" }),
    });
    const sendBody = await sendOnly.json();
    expect(sendBody.goals).toHaveLength(0);
    expect(sendBody.approvals).toHaveLength(0);
    expect(sendBody.messages.at(-1).text).toContain("There is no handoff rule for a send");
    expect(sendBody.messages.at(-1).text).not.toContain("the same words as the send");
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "post", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "Shared Project Files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pay", enabled: true, phrase: "unshared project files" }),
    });
    const asked = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Which steps mention the same words as a deletion?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const once = await asked.json();
    expect(asked.status).toBe(200);
    expect(once.goals).toHaveLength(0);
    expect(once.handoffs).toHaveLength(0);
    expect(once.approvals).toHaveLength(0);
    expect(once.handoffRules).toHaveLength(4);
    const reply = once.messages.at(-1).text as string;
    expect(reply).toContain("These steps mention the same words as the deletion.");
    expect(reply).toContain("The words are “shared project files”.");
    expect(reply.split("“shared project files”").length - 1).toBe(1);
    expect(reply).toContain("The send and The public post use them.");
    expect(reply).not.toContain("“Shared Project Files”");
    expect(reply).not.toContain("The payment");
    expect(reply).not.toContain("The deletion");
    expect(reply).toContain("did not approve a hold");
    const payment = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps mention the same words as a payment to you?" }),
    });
    const paymentBody = await payment.json();
    expect(paymentBody.messages.at(-1).text).toContain("No other step mentions the same words as the payment.");
    expect(paymentBody.messages.at(-1).text).toContain("“unshared project files”");
    expect(paymentBody.messages.at(-1).text).not.toContain("These steps mention the same words");
    expect(paymentBody.messages.at(-1).text).not.toContain("“shared project files”");
    expect(paymentBody.goals).toHaveLength(0);
    expect(paymentBody.approvals).toHaveLength(0);
    const same = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion mention the same words as a send?" }),
    });
    const sameBody = await same.json();
    expect(sameBody.messages.at(-1).text).toContain("The deletion mentions the same words as the send.");
    expect(sameBody.messages.at(-1).text).not.toContain("These steps mention the same words");
    expect(sameBody.messages.at(-1).text).not.toContain("No other step mentions the same words");
    const notSame = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion not mention the same words as a send?" }),
    });
    const notSameBody = await notSame.json();
    expect(notSameBody.messages.at(-1).text).toContain("The deletion does mention the same words as the send.");
    expect(notSameBody.messages.at(-1).text).not.toContain("These steps mention the same words");
    const plain = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which step mentions shared project files?" }),
    });
    const plainBody = await plain.json();
    expect(plainBody.messages.at(-1).text).toContain("mentions “shared project files”");
    expect(plainBody.messages.at(-1).text).not.toContain("the same words as the deletion");
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps mention the same words as a deletion and delete the archive" }),
    });
    const opened = await mixed.json();
    expect(opened.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(opened.approvals.filter((item: { status: string; kind: string }) => item.status === "open" && item.kind === "delete")).toHaveLength(
      1,
    );
    expect(opened.handoffs.filter((item: { status: string }) => item.status === "open")).toHaveLength(0);
    expect(opened.messages.at(-1).text).not.toContain("These steps mention the same words");
    expect(opened.messages.at(-1).text).not.toContain("No other step mentions the same words");
    const ordinary = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions to me" }),
    });
    const worked = await ordinary.json();
    expect(worked.goals.length).toBeGreaterThan(0);
    expect(worked.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(worked.messages.at(-1).text).not.toContain("These steps mention the same words");
    expect(JSON.stringify(worked)).not.toContain("Always allow");
  });

  it("ORIEL-F57 a sentence asks which steps do not mention the same words as one step and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps do not mention the same words as a deletion?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.approvals).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("There is no handoff rule for a deletion");
    expect(empty.messages.at(-1).text).toContain("named no other step");
    expect(empty.messages.at(-1).text).not.toContain("the same words as the deletion");
    expect(empty.messages.at(-1).text).not.toContain("These steps do mention the same words");
    expect(empty.messages.at(-1).text).not.toContain("The send");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps do not mention the same words as a deletion without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const loose = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Please, which step does not mention the same words as a post always allow" }),
    });
    expect(loose.status).toBe(400);
    expect(await loose.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    const note = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps do not mention the same words as a note?" }),
    });
    const noted = await note.json();
    expect(note.status).toBe(200);
    expect(noted.goals).toHaveLength(0);
    expect(noted.approvals).toHaveLength(0);
    expect(noted.messages.at(-1).text).toContain("does not name a send, a payment, a deletion, or a public post");
    expect(noted.messages.at(-1).text).toContain("did not open a card");
    const sendOnly = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps do not mention the same words as a send?" }),
    });
    const sendBody = await sendOnly.json();
    expect(sendBody.goals).toHaveLength(0);
    expect(sendBody.approvals).toHaveLength(0);
    expect(sendBody.messages.at(-1).text).toContain("There is no handoff rule for a send");
    expect(sendBody.messages.at(-1).text).not.toContain("the same words as the send");
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "post", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "Shared Project Files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pay", enabled: true, phrase: "unshared project files" }),
    });
    const asked = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Which steps do not mention the same words as a deletion?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const once = await asked.json();
    expect(asked.status).toBe(200);
    expect(once.goals).toHaveLength(0);
    expect(once.handoffs).toHaveLength(0);
    expect(once.approvals).toHaveLength(0);
    expect(once.handoffRules).toHaveLength(4);
    const reply = once.messages.at(-1).text as string;
    expect(reply).toContain("These steps do mention the same words as the deletion.");
    expect(reply).toContain("The words are “shared project files”.");
    expect(reply.split("“shared project files”").length - 1).toBe(1);
    expect(reply).toContain("The send and The public post use them.");
    expect(reply).not.toContain("“Shared Project Files”");
    expect(reply).not.toContain("These steps mention the same words");
    expect(reply).not.toContain("The payment");
    expect(reply).not.toContain("The deletion");
    expect(reply).toContain("did not approve a hold");
    const payment = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps do not mention the same words as a payment to you?" }),
    });
    const paymentBody = await payment.json();
    expect(paymentBody.messages.at(-1).text).toContain("No other step mentions the same words as the payment.");
    expect(paymentBody.messages.at(-1).text).toContain("“unshared project files”");
    expect(paymentBody.messages.at(-1).text).not.toContain("No other step does mention");
    expect(paymentBody.messages.at(-1).text).not.toContain("These steps do mention the same words");
    expect(paymentBody.messages.at(-1).text).not.toContain("“shared project files”");
    expect(paymentBody.goals).toHaveLength(0);
    expect(paymentBody.approvals).toHaveLength(0);
    const same = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion mention the same words as a send?" }),
    });
    const sameBody = await same.json();
    expect(sameBody.messages.at(-1).text).toContain("The deletion mentions the same words as the send.");
    expect(sameBody.messages.at(-1).text).not.toContain("These steps do mention the same words");
    const notSame = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion not mention the same words as a send?" }),
    });
    const notSameBody = await notSame.json();
    expect(notSameBody.messages.at(-1).text).toContain("The deletion does mention the same words as the send.");
    expect(notSameBody.messages.at(-1).text).not.toContain("These steps do mention the same words");
    const plain = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which step mentions shared project files?" }),
    });
    const plainBody = await plain.json();
    expect(plainBody.messages.at(-1).text).toContain("mentions “shared project files”");
    expect(plainBody.messages.at(-1).text).not.toContain("the same words as the deletion");
    const other = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps do not mention shared project files?" }),
    });
    const otherBody = await other.json();
    expect(otherBody.messages.at(-1).text).toContain("does not mention those words");
    expect(otherBody.messages.at(-1).text).not.toContain("the same words as the deletion");
    expect(otherBody.messages.at(-1).text).not.toContain("does mention the same words");
    const positive = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps mention the same words as a deletion?" }),
    });
    const positiveBody = await positive.json();
    expect(positiveBody.messages.at(-1).text).toContain("These steps mention the same words as the deletion.");
    expect(positiveBody.messages.at(-1).text).not.toContain("These steps do mention the same words");
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps do not mention the same words as a deletion and delete the archive" }),
    });
    const opened = await mixed.json();
    expect(opened.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(opened.approvals.filter((item: { status: string; kind: string }) => item.status === "open" && item.kind === "delete")).toHaveLength(
      1,
    );
    expect(opened.handoffs.filter((item: { status: string }) => item.status === "open")).toHaveLength(0);
    expect(opened.messages.at(-1).text).not.toContain("These steps do mention the same words");
    expect(opened.messages.at(-1).text).not.toContain("No other step mentions the same words");
    const ordinary = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions to me" }),
    });
    const worked = await ordinary.json();
    expect(worked.goals.length).toBeGreaterThan(0);
    expect(worked.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(worked.messages.at(-1).text).not.toContain("These steps do mention the same words");
    expect(JSON.stringify(worked)).not.toContain("Always allow");
  });

  it("ORIEL-F58 a sentence asks which words one step mentions and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion mention?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.approvals).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("There is no handoff rule for a deletion");
    expect(empty.messages.at(-1).text).toContain("named no other step");
    expect(empty.messages.at(-1).text).not.toContain("mentions these words");
    expect(empty.messages.at(-1).text).not.toContain("with the deletion");
    expect(empty.messages.at(-1).text).not.toContain("The send");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion mention without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const loose = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Please, which word does a post mention always allow" }),
    });
    expect(loose.status).toBe(400);
    expect(await loose.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    const note = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a note mention?" }),
    });
    const noted = await note.json();
    expect(note.status).toBe(200);
    expect(noted.goals).toHaveLength(0);
    expect(noted.approvals).toHaveLength(0);
    expect(noted.messages.at(-1).text).toContain("does not name a send, a payment, a deletion, or a public post");
    expect(noted.messages.at(-1).text).toContain("did not open a card");
    const sendOnly = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a send mention?" }),
    });
    const sendBody = await sendOnly.json();
    expect(sendBody.goals).toHaveLength(0);
    expect(sendBody.approvals).toHaveLength(0);
    expect(sendBody.messages.at(-1).text).toContain("There is no handoff rule for a send");
    expect(sendBody.messages.at(-1).text).not.toContain("mentions these words");
    expect(sendBody.messages.at(-1).text).not.toContain("with the send");
    const notThis = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion not mention?" }),
    });
    const notBody = await notThis.json();
    expect(notBody.goals).toHaveLength(0);
    expect(notBody.approvals).toHaveLength(0);
    expect(notBody.messages.at(-1).text).toContain("There is no handoff rule for a deletion");
    expect(notBody.messages.at(-1).text).not.toContain("mentions these words");
    expect(notBody.messages.at(-1).text).not.toContain("does mention these words");
    expect(notBody.messages.at(-1).text).toContain("named no other step");
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "post", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "Shared Project Files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pay", enabled: true, phrase: "unshared project files" }),
    });
    const asked = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Which words does a deletion mention?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const once = await asked.json();
    expect(asked.status).toBe(200);
    expect(once.goals).toHaveLength(0);
    expect(once.handoffs).toHaveLength(0);
    expect(once.approvals).toHaveLength(0);
    expect(once.handoffRules).toHaveLength(4);
    const reply = once.messages.at(-1).text as string;
    expect(reply).toContain("The deletion mentions these words.");
    expect(reply).toContain("The words are “shared project files”.");
    expect(reply.split("“shared project files”").length - 1).toBe(1);
    expect(reply).toContain("named no other step");
    expect(reply).not.toContain("The send");
    expect(reply).not.toContain("The public post");
    expect(reply).not.toContain("use them");
    expect(reply).not.toContain("with the deletion");
    expect(reply).not.toContain("These steps mention the same words");
    expect(reply).not.toContain("shares these words");
    expect(reply).not.toContain("“Shared Project Files”");
    expect(reply).not.toContain("The payment");
    expect(reply).not.toContain("The deletion use");
    expect(reply).toContain("did not approve a hold");
    const payment = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a payment mention to you?" }),
    });
    const paymentBody = await payment.json();
    expect(paymentBody.messages.at(-1).text).toContain("The payment mentions these words.");
    expect(paymentBody.messages.at(-1).text).toContain("“unshared project files”");
    expect(paymentBody.messages.at(-1).text).not.toContain("The deletion");
    expect(paymentBody.messages.at(-1).text).not.toContain("use them");
    expect(paymentBody.messages.at(-1).text).not.toContain("with the payment");
    expect(paymentBody.messages.at(-1).text).not.toContain("“shared project files”");
    expect(paymentBody.goals).toHaveLength(0);
    expect(paymentBody.approvals).toHaveLength(0);
    const share = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion share?" }),
    });
    const shareBody = await share.json();
    expect(shareBody.messages.at(-1).text).toContain("The deletion shares these words.");
    expect(shareBody.messages.at(-1).text).not.toContain("mentions these words");
    const same = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps do not mention the same words as a deletion?" }),
    });
    const sameBody = await same.json();
    expect(sameBody.messages.at(-1).text).toContain("These steps do mention the same words as the deletion.");
    expect(sameBody.messages.at(-1).text).not.toContain("mentions these words");
    const plain = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion hand to me?" }),
    });
    const plainBody = await plain.json();
    expect(plainBody.messages.at(-1).text).toContain("The words are “shared project files”.");
    expect(plainBody.messages.at(-1).text).not.toContain("mentions these words");
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion mention and delete the archive" }),
    });
    const opened = await mixed.json();
    expect(opened.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(opened.approvals.filter((item: { status: string; kind: string }) => item.status === "open" && item.kind === "delete")).toHaveLength(
      1,
    );
    expect(opened.handoffs.filter((item: { status: string }) => item.status === "open")).toHaveLength(0);
    expect(opened.messages.at(-1).text).not.toContain("mentions these words");
    expect(opened.messages.at(-1).text).not.toContain("These words are mentioned once");
    const ordinary = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hand deletions to me" }),
    });
    const worked = await ordinary.json();
    expect(worked.goals.length).toBeGreaterThan(1);
    expect(worked.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(worked.messages.at(-1).text).not.toContain("mentions these words");
    expect(JSON.stringify(worked)).not.toContain("Always allow");
  });

  it("ORIEL-F59 a sentence asks which words one step does not mention and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion not mention?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.approvals).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("There is no handoff rule for a deletion");
    expect(empty.messages.at(-1).text).not.toContain("does mention these words");
    expect(empty.messages.at(-1).text).not.toContain("mentions these words");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion not mention without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    const sendOnly = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a send not mention?" }),
    });
    const sendBody = await sendOnly.json();
    expect(sendBody.goals).toHaveLength(0);
    expect(sendBody.approvals).toHaveLength(0);
    expect(sendBody.messages.at(-1).text).toContain("There is no handoff rule for a send");
    expect(sendBody.messages.at(-1).text).not.toContain("does mention these words");
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "Shared Project Files" }),
    });
    const asked = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Which words does a deletion not mention?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const once = await asked.json();
    expect(asked.status).toBe(200);
    expect(once.goals).toHaveLength(0);
    expect(once.handoffs).toHaveLength(0);
    expect(once.approvals).toHaveLength(0);
    const reply = once.messages.at(-1).text as string;
    expect(reply).toContain("The deletion does mention these words.");
    expect(reply).not.toContain("The deletion mentions these words.");
    expect(reply).not.toContain("mentions these words");
    expect(reply).toContain("The words are “shared project files”.");
    expect(reply.split("“shared project files”").length - 1).toBe(1);
    expect(reply).not.toContain("The send");
    expect(reply).toContain("did not approve a hold");
    const plain = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion mention?" }),
    });
    const plainBody = await plain.json();
    expect(plainBody.messages.at(-1).text).toContain("The deletion mentions these words.");
    expect(plainBody.messages.at(-1).text).not.toContain("does mention these words");
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion not mention and delete the archive" }),
    });
    const opened = await mixed.json();
    expect(opened.handoffRules.find((rule: { action: string }) => rule.action === "delete").phrase).toBe("shared project files");
    expect(opened.approvals.filter((item: { status: string; kind: string }) => item.status === "open" && item.kind === "delete")).toHaveLength(
      1,
    );
    expect(opened.messages.at(-1).text).not.toContain("does mention these words");
    expect(JSON.stringify(opened)).not.toContain("Always allow");
  });

  it("ORIEL-F60 a sentence asks which words one step mentions with one other step and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion mention with a send?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.approvals).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("There is no handoff rule for a deletion");
    expect(empty.messages.at(-1).text).not.toContain("mentions these words with the send");
    expect(empty.messages.at(-1).text).not.toContain("does not mention these words with the send");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion mention with a send without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    const note = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a note mention with a send?" }),
    });
    const noteBody = await note.json();
    expect(noteBody.goals).toHaveLength(0);
    expect(noteBody.approvals).toHaveLength(0);
    expect(noteBody.messages.at(-1).text).toContain("does not name two different steps");
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "Shared Project Files" }),
    });
    const asked = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Which words does a deletion mention with a send?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const once = await asked.json();
    expect(asked.status).toBe(200);
    expect(once.goals).toHaveLength(0);
    expect(once.handoffs).toHaveLength(0);
    expect(once.approvals).toHaveLength(0);
    const reply = once.messages.at(-1).text as string;
    expect(reply).toContain("The deletion mentions these words with the send.");
    expect(reply).not.toContain("The deletion mentions these words.");
    expect(reply).not.toContain("The deletion does mention these words.");
    expect(reply).toContain("The words are “shared project files”.");
    expect(reply.split("“shared project files”").length - 1).toBe(1);
    expect(reply).not.toContain("The send");
    expect(reply).toContain("did not approve a hold");
    const plain = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion mention?" }),
    });
    const plainBody = await plain.json();
    expect(plainBody.messages.at(-1).text).toContain("The deletion mentions these words.");
    expect(plainBody.messages.at(-1).text).not.toContain("with the send");
    const differed = await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "unshared project files" }),
    });
    expect(differed.ok).toBe(true);
    const apart = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion mention with a send?" }),
    });
    const apartBody = await apart.json();
    expect(apartBody.messages.at(-1).text).toContain("The deletion does not mention these words with the send.");
    expect(apartBody.messages.at(-1).text).toContain("The words are “shared project files”.");
    expect(apartBody.messages.at(-1).text).not.toContain("unshared project files");
    expect(apartBody.messages.at(-1).text).not.toContain("Those words are used once");
    expect(apartBody.approvals).toHaveLength(0);
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion mention with a send and delete the archive" }),
    });
    const opened = await mixed.json();
    expect(opened.approvals.filter((item: { status: string; kind: string }) => item.status === "open" && item.kind === "delete")).toHaveLength(1);
    expect(opened.approvals.filter((item: { status: string; kind: string }) => item.status === "open" && item.kind === "send")).toHaveLength(1);
    expect(opened.messages.at(-1).text).not.toContain("mentions these words with the send");
    expect(JSON.stringify(opened)).not.toContain("Always allow");
  });

  it("ORIEL-F61 a sentence asks which words one step does not mention with one other step and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion not mention with a send?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.approvals).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("There is no handoff rule for a deletion");
    expect(empty.messages.at(-1).text).not.toContain("does mention these words with the send");
    expect(empty.messages.at(-1).text).not.toContain("does not mention these words with the send");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion not mention with a send without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    const note = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a note not mention with a send?" }),
    });
    const noteBody = await note.json();
    expect(noteBody.goals).toHaveLength(0);
    expect(noteBody.approvals).toHaveLength(0);
    expect(noteBody.messages.at(-1).text).toContain("does not name two different steps");
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "Shared Project Files" }),
    });
    const asked = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Which words does a deletion not mention with a send?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const once = await asked.json();
    expect(asked.status).toBe(200);
    expect(once.goals).toHaveLength(0);
    expect(once.handoffs).toHaveLength(0);
    expect(once.approvals).toHaveLength(0);
    const reply = once.messages.at(-1).text as string;
    expect(reply).toContain("The deletion does mention these words with the send.");
    expect(reply).not.toContain("The deletion mentions these words with the send.");
    expect(reply).not.toContain("The deletion does mention these words.");
    expect(reply).toContain("The words are “shared project files”.");
    expect(reply.split("“shared project files”").length - 1).toBe(1);
    expect(reply).not.toContain("The send");
    expect(reply).toContain("did not approve a hold");
    const plain = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion mention with a send?" }),
    });
    const plainBody = await plain.json();
    expect(plainBody.messages.at(-1).text).toContain("The deletion mentions these words with the send.");
    expect(plainBody.messages.at(-1).text).not.toContain("The deletion does mention these words with the send.");
    const differed = await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "unshared project files" }),
    });
    expect(differed.ok).toBe(true);
    const apart = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion not mention with a send?" }),
    });
    const apartBody = await apart.json();
    expect(apartBody.messages.at(-1).text).toContain("The deletion does not mention these words with the send.");
    expect(apartBody.messages.at(-1).text).toContain("The words are “shared project files”.");
    expect(apartBody.messages.at(-1).text).not.toContain("unshared project files");
    expect(apartBody.messages.at(-1).text).not.toContain("Those words are used once");
    expect(apartBody.approvals).toHaveLength(0);
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words does a deletion not mention with a send and delete the archive" }),
    });
    const opened = await mixed.json();
    expect(opened.approvals.filter((item: { status: string; kind: string }) => item.status === "open" && item.kind === "delete")).toHaveLength(1);
    expect(opened.approvals.filter((item: { status: string; kind: string }) => item.status === "open" && item.kind === "send")).toHaveLength(1);
    expect(opened.messages.at(-1).text).not.toContain("does mention these words with the send");
    expect(JSON.stringify(opened)).not.toContain("Always allow");
  });

  it("ORIEL-F62 a sentence asks whether one step mentions the same words and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion mention the same words?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.approvals).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("There is no handoff rule for a deletion");
    expect(empty.messages.at(-1).text).not.toContain("mentions the same words.");
    expect(empty.messages.at(-1).text).not.toContain("does not mention the same words");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion mention the same words without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    const note = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a note mention the same words?" }),
    });
    const noteBody = await note.json();
    expect(noteBody.goals).toHaveLength(0);
    expect(noteBody.approvals).toHaveLength(0);
    expect(noteBody.messages.at(-1).text).toContain("does not name a send, a payment, a deletion, or a public post");
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "Shared Project Files" }),
    });
    const asked = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Does a deletion mention the same words?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const once = await asked.json();
    expect(asked.status).toBe(200);
    expect(once.goals).toHaveLength(0);
    expect(once.handoffs).toHaveLength(0);
    expect(once.approvals).toHaveLength(0);
    const reply = once.messages.at(-1).text as string;
    expect(reply).toContain("The deletion mentions the same words.");
    expect(reply).not.toContain("The deletion mentions the same words as the send.");
    expect(reply).toContain("The send uses them.");
    expect(reply).toContain("The words are “shared project files”.");
    expect(reply.split("“shared project files”").length - 1).toBe(1);
    expect(reply).not.toContain("The public post");
    expect(reply).toContain("did not approve a hold");
    const plain = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion mention the same words as a send?" }),
    });
    const plainBody = await plain.json();
    expect(plainBody.messages.at(-1).text).toContain("The deletion mentions the same words as the send.");
    expect(plainBody.messages.at(-1).text).not.toContain("The deletion mentions the same words.");
    const differed = await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "unshared project files" }),
    });
    expect(differed.ok).toBe(true);
    const apart = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion mention the same words?" }),
    });
    const apartBody = await apart.json();
    expect(apartBody.messages.at(-1).text).toContain("The deletion does not mention the same words.");
    expect(apartBody.messages.at(-1).text).toContain("The words are “shared project files”.");
    expect(apartBody.messages.at(-1).text).not.toContain("unshared project files");
    expect(apartBody.messages.at(-1).text).not.toContain("Those words are used once");
    expect(apartBody.messages.at(-1).text).not.toContain("The send");
    expect(apartBody.approvals).toHaveLength(0);
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion mention the same words and delete the archive" }),
    });
    const opened = await mixed.json();
    expect(opened.approvals.filter((item: { status: string; kind: string }) => item.status === "open" && item.kind === "delete")).toHaveLength(1);
    expect(opened.approvals.filter((item: { status: string; kind: string }) => item.status === "open" && item.kind === "send")).toHaveLength(0);
    expect(opened.messages.at(-1).text).not.toContain("mentions the same words.");
    expect(JSON.stringify(opened)).not.toContain("Always allow");
  });

  it("ORIEL-F63 a sentence asks whether one step does not mention the same words and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion not mention the same words?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.approvals).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("There is no handoff rule for a deletion");
    expect(empty.messages.at(-1).text).not.toContain("does mention the same words");
    expect(empty.messages.at(-1).text).not.toContain("does not mention the same words");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion not mention the same words without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    const note = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a note not mention the same words?" }),
    });
    const noteBody = await note.json();
    expect(noteBody.goals).toHaveLength(0);
    expect(noteBody.approvals).toHaveLength(0);
    expect(noteBody.messages.at(-1).text).toContain("does not name a send, a payment, a deletion, or a public post");
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "Shared Project Files" }),
    });
    const asked = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Does a deletion not mention the same words?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const once = await asked.json();
    expect(asked.status).toBe(200);
    expect(once.goals).toHaveLength(0);
    expect(once.handoffs).toHaveLength(0);
    expect(once.approvals).toHaveLength(0);
    const reply = once.messages.at(-1).text as string;
    expect(reply).toContain("The deletion does mention the same words.");
    expect(reply).not.toContain("The deletion mentions the same words.");
    expect(reply).toContain("The send uses them.");
    expect(reply).toContain("The words are “shared project files”.");
    expect(reply.split("“shared project files”").length - 1).toBe(1);
    expect(reply).not.toContain("The public post");
    expect(reply).toContain("did not approve a hold");
    const plain = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion mention the same words?" }),
    });
    const plainBody = await plain.json();
    expect(plainBody.messages.at(-1).text).toContain("The deletion mentions the same words.");
    expect(plainBody.messages.at(-1).text).not.toContain("The deletion does mention the same words");
    const differed = await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "unshared project files" }),
    });
    expect(differed.ok).toBe(true);
    const apart = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion not mention the same words?" }),
    });
    const apartBody = await apart.json();
    expect(apartBody.messages.at(-1).text).toContain("The deletion does not mention the same words.");
    expect(apartBody.messages.at(-1).text).toContain("The words are “shared project files”.");
    expect(apartBody.messages.at(-1).text).not.toContain("The deletion does mention the same words.");
    expect(apartBody.messages.at(-1).text).not.toContain("unshared project files");
    expect(apartBody.messages.at(-1).text).not.toContain("Those words are used once");
    expect(apartBody.messages.at(-1).text).not.toContain("The send");
    expect(apartBody.approvals).toHaveLength(0);
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion not mention the same words and delete the archive" }),
    });
    const opened = await mixed.json();
    expect(opened.approvals.filter((item: { status: string; kind: string }) => item.status === "open" && item.kind === "delete")).toHaveLength(1);
    expect(opened.approvals.filter((item: { status: string; kind: string }) => item.status === "open" && item.kind === "send")).toHaveLength(0);
    expect(opened.messages.at(-1).text).not.toContain("does mention the same words");
    expect(JSON.stringify(opened)).not.toContain("Always allow");
  });

  it("ORIEL-F64 a sentence asks which steps mention the same words and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps mention the same words?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.approvals).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("No steps mention the same words");
    expect(empty.messages.at(-1).text).toContain("named no other step");
    expect(empty.messages.at(-1).text).not.toContain("The deletion");
    expect(empty.messages.at(-1).text).not.toContain("the whole");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps mention the same words without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    const asDeletion = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps mention the same words as a deletion?" }),
    });
    const asBody = await asDeletion.json();
    expect(asBody.goals).toHaveLength(0);
    expect(asBody.messages.at(-1).text).toContain("There is no handoff rule for a deletion");
    expect(asBody.messages.at(-1).text).not.toContain("No steps mention the same words");
    const negated = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps do not mention the same words?" }),
    });
    const negatedBody = await negated.json();
    expect(negatedBody.goals).toHaveLength(0);
    expect(negatedBody.messages.at(-1).text).toContain("No step mentions words only once");
    expect(negatedBody.messages.at(-1).text).not.toContain("No step does not mention");
    expect(negatedBody.messages.at(-1).text).not.toContain("No steps mention the same words");
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "Shared Project Files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pay", enabled: true, phrase: "the vendor invoice" }),
    });
    const asked = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Which steps mention the same words?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const once = await asked.json();
    expect(asked.status).toBe(200);
    expect(once.goals).toHaveLength(0);
    expect(once.handoffs).toHaveLength(0);
    expect(once.approvals).toHaveLength(0);
    const reply = once.messages.at(-1).text as string;
    expect(reply).toContain("These steps mention the same words.");
    expect(reply).toContain("The send is handed to you");
    expect(reply).toContain("The deletion is handed to you");
    expect(reply).toContain("“shared project files”");
    expect(reply).toContain("“Shared Project Files”");
    expect(reply).not.toContain("The payment");
    expect(reply).not.toContain("the vendor invoice");
    expect(reply).toContain("did not approve a hold");
    const plain = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps mention the same words as a deletion?" }),
    });
    const plainBody = await plain.json();
    expect(plainBody.messages.at(-1).text).toContain("The send mentions the same words as the deletion.");
    expect(plainBody.messages.at(-1).text).not.toContain("These steps mention the same words.");
    const share = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps share words?" }),
    });
    const shareBody = await share.json();
    expect(shareBody.messages.at(-1).text).toContain("These steps share words");
    expect(shareBody.messages.at(-1).text).not.toContain("These steps mention the same words.");
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps mention the same words and delete the archive" }),
    });
    const opened = await mixed.json();
    expect(opened.approvals.filter((item: { status: string; kind: string }) => item.status === "open" && item.kind === "delete")).toHaveLength(1);
    expect(opened.messages.at(-1).text).not.toContain("These steps mention the same words.");
    expect(JSON.stringify(opened)).not.toContain("Always allow");
  });

  it("ORIEL-F65 a sentence asks which steps do not mention the same words and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps do not mention the same words?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.approvals).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("No step mentions words only once");
    expect(empty.messages.at(-1).text).toContain("named no other step");
    expect(empty.messages.at(-1).text).not.toContain("The deletion");
    expect(empty.messages.at(-1).text).not.toContain("the whole");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps do not mention the same words without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    const asDeletion = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps do not mention the same words as a deletion?" }),
    });
    const asBody = await asDeletion.json();
    expect(asBody.goals).toHaveLength(0);
    expect(asBody.messages.at(-1).text).toContain("There is no handoff rule for a deletion");
    expect(asBody.messages.at(-1).text).not.toContain("No step mentions words only once");
    const positive = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps mention the same words?" }),
    });
    const positiveBody = await positive.json();
    expect(positiveBody.messages.at(-1).text).toContain("No steps mention the same words");
    expect(positiveBody.messages.at(-1).text).not.toContain("No step mentions words only once");
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "Shared Project Files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pay", enabled: true, phrase: "the vendor invoice" }),
    });
    const asked = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Which steps do not mention the same words?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const once = await asked.json();
    expect(asked.status).toBe(200);
    expect(once.goals).toHaveLength(0);
    expect(once.handoffs).toHaveLength(0);
    expect(once.approvals).toHaveLength(0);
    const reply = once.messages.at(-1).text as string;
    expect(reply).toContain("These steps do not mention the same words.");
    expect(reply).toContain("The payment is handed to you");
    expect(reply).toContain("“the vendor invoice”");
    expect(reply).not.toContain("The send");
    expect(reply).not.toContain("The deletion");
    expect(reply).not.toContain("shared project files");
    expect(reply).toContain("did not approve a hold");
    const plain = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps do not mention the same words as a deletion?" }),
    });
    const plainBody = await plain.json();
    expect(plainBody.messages.at(-1).text).toContain("The send does mention the same words as the deletion.");
    expect(plainBody.messages.at(-1).text).not.toContain("These steps do not mention the same words.");
    const oneStep = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Does a deletion not mention the same words?" }),
    });
    const oneBody = await oneStep.json();
    expect(oneBody.messages.at(-1).text).toContain("The deletion does mention the same words.");
    expect(oneBody.messages.at(-1).text).not.toContain("No step mentions words only once");
    const ruled = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps do not mention the same words and delete the archive" }),
    });
    const skipped = await ruled.json();
    expect(skipped.approvals.filter((item: { status: string; kind: string }) => item.status === "open" && item.kind === "delete")).toHaveLength(0);
    expect(skipped.messages.at(-1).text).toContain("I did not delete anything, because you ruled it out.");
    expect(skipped.messages.at(-1).text).not.toContain("These steps do not mention the same words.");
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps do not mention the same words on this saved desk and delete the archive" }),
    });
    const opened = await mixed.json();
    expect(opened.approvals.filter((item: { status: string; kind: string }) => item.status === "open" && item.kind === "delete")).toHaveLength(1);
    expect(opened.messages.at(-1).text).not.toContain("These steps do not mention the same words.");
    expect(JSON.stringify(opened)).not.toContain("Always allow");
  });

  it("ORIEL-F66 a sentence asks which words are not mentioned and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are not mentioned?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.approvals).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("No words are mentioned only once");
    expect(empty.messages.at(-1).text).toContain("named no other step");
    expect(empty.messages.at(-1).text).not.toContain("The deletion");
    expect(empty.messages.at(-1).text).not.toContain("the whole");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are not mentioned without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    const ordinary = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are mentioned?" }),
    });
    const ordinaryBody = await ordinary.json();
    expect(ordinaryBody.goals).toHaveLength(0);
    expect(ordinaryBody.messages.at(-1).text).toContain("No words are mentioned.");
    expect(ordinaryBody.messages.at(-1).text).not.toContain("No words are mentioned only once");
    expect(ordinaryBody.messages.at(-1).text).not.toContain("These words are mentioned");
    const shared = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are not shared?" }),
    });
    const sharedBody = await shared.json();
    expect(sharedBody.messages.at(-1).text).toContain("No words are used once");
    expect(sharedBody.messages.at(-1).text).not.toContain("No words are mentioned only once");
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "Shared Project Files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pay", enabled: true, phrase: "the vendor invoice" }),
    });
    const asked = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Which words are not mentioned?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const once = await asked.json();
    expect(asked.status).toBe(200);
    expect(once.goals).toHaveLength(0);
    expect(once.handoffs).toHaveLength(0);
    expect(once.approvals.filter((item: { status: string }) => item.status === "open")).toHaveLength(0);
    const reply = once.messages.at(-1).text as string;
    expect(reply).toContain("These words are not mentioned.");
    expect(reply).toContain("“the vendor invoice” is used by The payment.");
    expect(reply).not.toContain("The send");
    expect(reply).not.toContain("The deletion");
    expect(reply).not.toContain("shared project files");
    expect(reply).toContain("did not approve a hold");
    const steps = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which steps do not mention the same words?" }),
    });
    const stepsBody = await steps.json();
    expect(stepsBody.messages.at(-1).text).toContain("These steps do not mention the same words.");
    expect(stepsBody.messages.at(-1).text).toContain("The payment is handed to you");
    expect(stepsBody.messages.at(-1).text).not.toContain("These words are not mentioned.");
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are not mentioned and delete the archive" }),
    });
    const opened = await mixed.json();
    expect(opened.approvals.filter((item: { status: string; kind: string }) => item.status === "open" && item.kind === "delete")).toHaveLength(1);
    expect(opened.messages.at(-1).text).not.toContain("These words are not mentioned.");
    expect(JSON.stringify(opened)).not.toContain("Always allow");
  });

  it("ORIEL-F67 a sentence asks which words are mentioned and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are mentioned?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.approvals).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("No words are mentioned.");
    expect(empty.messages.at(-1).text).toContain("named no other step");
    expect(empty.messages.at(-1).text).not.toContain("The deletion");
    expect(empty.messages.at(-1).text).not.toContain("These words are mentioned");
    expect(empty.messages.at(-1).text).not.toContain("the whole");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are mentioned without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    const onceOrdinary = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are mentioned once?" }),
    });
    const onceBody = await onceOrdinary.json();
    expect(onceBody.goals).toHaveLength(0);
    expect(onceBody.messages.at(-1).text).toContain("No words are mentioned once.");
    expect(onceBody.messages.at(-1).text).not.toContain("No words are mentioned.");
    expect(onceBody.messages.at(-1).text).not.toContain("These words are mentioned.");
    const absent = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are not mentioned?" }),
    });
    const absentBody = await absent.json();
    expect(absentBody.messages.at(-1).text).toContain("No words are mentioned only once");
    expect(absentBody.messages.at(-1).text).not.toContain("No words are mentioned.");
    const shared = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are shared?" }),
    });
    const sharedBody = await shared.json();
    expect(sharedBody.messages.at(-1).text).toContain("No words are shared");
    expect(sharedBody.messages.at(-1).text).not.toContain("No words are mentioned.");
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "Shared Project Files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pay", enabled: true, phrase: "the vendor invoice" }),
    });
    const asked = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Which words are mentioned?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const mentioned = await asked.json();
    expect(asked.status).toBe(200);
    expect(mentioned.goals).toHaveLength(0);
    expect(mentioned.handoffs).toHaveLength(0);
    expect(mentioned.approvals.filter((item: { status: string }) => item.status === "open")).toHaveLength(0);
    const reply = mentioned.messages.at(-1).text as string;
    expect(reply).toContain("These words are mentioned.");
    expect(reply).toContain("“Shared Project Files” is used by The send and The deletion.");
    expect(reply).not.toContain("The payment");
    expect(reply).not.toContain("shared project files");
    expect(reply).not.toContain("the vendor invoice");
    expect(reply).toContain("did not approve a hold");
    expect(reply).not.toContain("These words are mentioned more than once");
    const unmentioned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are not mentioned?" }),
    });
    const unmentionedBody = await unmentioned.json();
    expect(unmentionedBody.messages.at(-1).text).toContain("These words are not mentioned.");
    expect(unmentionedBody.messages.at(-1).text).toContain("“the vendor invoice” is used by The payment.");
    expect(unmentionedBody.messages.at(-1).text).not.toContain("These words are mentioned.");
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are mentioned and delete the archive" }),
    });
    const opened = await mixed.json();
    expect(opened.approvals.filter((item: { status: string; kind: string }) => item.status === "open" && item.kind === "delete")).toHaveLength(1);
    expect(opened.messages.at(-1).text).not.toContain("These words are mentioned.");
    expect(JSON.stringify(opened)).not.toContain("Always allow");
  });

  it("ORIEL-F68 a sentence asks which words are mentioned once and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are mentioned once?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.approvals).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("No words are mentioned once.");
    expect(empty.messages.at(-1).text).toContain("named no other step");
    expect(empty.messages.at(-1).text).not.toContain("The deletion");
    expect(empty.messages.at(-1).text).not.toContain("These words are mentioned once.");
    expect(empty.messages.at(-1).text).not.toContain("No words are mentioned.");
    expect(empty.messages.at(-1).text).not.toContain("the whole");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are mentioned once without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    const shorter = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are mentioned?" }),
    });
    const shorterBody = await shorter.json();
    expect(shorterBody.goals).toHaveLength(0);
    expect(shorterBody.messages.at(-1).text).toContain("No words are mentioned.");
    expect(shorterBody.messages.at(-1).text).not.toContain("No words are mentioned once");
    const more = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are mentioned more than once?" }),
    });
    const moreBody = await more.json();
    expect(moreBody.goals).toHaveLength(0);
    expect(moreBody.messages.at(-1).text).toContain("No words are mentioned more than once.");
    expect(moreBody.messages.at(-1).text).not.toContain("No words are mentioned once.");
    expect(moreBody.messages.at(-1).text).not.toContain("These words are mentioned.");
    expect(moreBody.messages.at(-1).text).not.toContain("These words are mentioned more than once");
    const absent = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are not mentioned?" }),
    });
    const absentBody = await absent.json();
    expect(absentBody.messages.at(-1).text).toContain("No words are mentioned only once");
    expect(absentBody.messages.at(-1).text).not.toContain("No words are mentioned once.");
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "Shared Project Files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pay", enabled: true, phrase: "the vendor invoice" }),
    });
    const asked = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Which words are mentioned once?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const mentioned = await asked.json();
    expect(asked.status).toBe(200);
    expect(mentioned.goals).toHaveLength(0);
    expect(mentioned.handoffs).toHaveLength(0);
    expect(mentioned.approvals.filter((item: { status: string }) => item.status === "open")).toHaveLength(0);
    const reply = mentioned.messages.at(-1).text as string;
    expect(reply).toContain("These words are mentioned once.");
    expect(reply).toContain("“the vendor invoice” is used by The payment.");
    expect(reply).not.toContain("The send");
    expect(reply).not.toContain("The deletion");
    expect(reply).not.toContain("shared project files");
    expect(reply).not.toContain("Shared Project Files");
    expect(reply).toContain("did not approve a hold");
    expect(reply).not.toContain("These words are mentioned.");
    expect(reply).not.toContain("These words are mentioned only once");
    const shared = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are mentioned?" }),
    });
    const sharedBody = await shared.json();
    expect(sharedBody.messages.at(-1).text).toContain("These words are mentioned.");
    expect(sharedBody.messages.at(-1).text).toContain("“Shared Project Files” is used by The send and The deletion.");
    expect(sharedBody.messages.at(-1).text).not.toContain("These words are mentioned once");
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are mentioned once and delete the archive" }),
    });
    const opened = await mixed.json();
    expect(opened.approvals.filter((item: { status: string; kind: string }) => item.status === "open" && item.kind === "delete")).toHaveLength(1);
    expect(opened.messages.at(-1).text).not.toContain("These words are mentioned once.");
    expect(JSON.stringify(opened)).not.toContain("Always allow");
  });

  it("ORIEL-F69 a sentence asks which words are mentioned more than once and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are mentioned more than once?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.approvals).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("No words are mentioned more than once.");
    expect(empty.messages.at(-1).text).toContain("named no other step");
    expect(empty.messages.at(-1).text).not.toContain("The deletion");
    expect(empty.messages.at(-1).text).not.toContain("These words are mentioned more than once.");
    expect(empty.messages.at(-1).text).not.toContain("No words are mentioned.");
    expect(empty.messages.at(-1).text).not.toContain("the whole");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are mentioned more than once without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    const shorter = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are mentioned?" }),
    });
    const shorterBody = await shorter.json();
    expect(shorterBody.goals).toHaveLength(0);
    expect(shorterBody.messages.at(-1).text).toContain("No words are mentioned.");
    expect(shorterBody.messages.at(-1).text).not.toContain("No words are mentioned more than once");
    const once = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are mentioned once?" }),
    });
    const onceBody = await once.json();
    expect(onceBody.goals).toHaveLength(0);
    expect(onceBody.messages.at(-1).text).toContain("No words are mentioned once.");
    expect(onceBody.messages.at(-1).text).not.toContain("No words are mentioned more than once");
    const only = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are mentioned only once?" }),
    });
    const onlyBody = await only.json();
    expect(onlyBody.goals).toHaveLength(0);
    expect(onlyBody.messages.at(-1).text).toContain("No saved words are mentioned only once.");
    expect(onlyBody.messages.at(-1).text).not.toContain("These words are mentioned more than once");
    const absent = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are not mentioned?" }),
    });
    const absentBody = await absent.json();
    expect(absentBody.messages.at(-1).text).toContain("No words are mentioned only once");
    expect(absentBody.messages.at(-1).text).not.toContain("No words are mentioned more than once");
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "Shared Project Files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pay", enabled: true, phrase: "the vendor invoice" }),
    });
    const asked = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Which words are mentioned more than once?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const mentioned = await asked.json();
    expect(asked.status).toBe(200);
    expect(mentioned.goals).toHaveLength(0);
    expect(mentioned.handoffs).toHaveLength(0);
    expect(mentioned.approvals.filter((item: { status: string }) => item.status === "open")).toHaveLength(0);
    const reply = mentioned.messages.at(-1).text as string;
    expect(reply).toContain("These words are mentioned more than once.");
    expect(reply).toContain("“Shared Project Files” is used by The send and The deletion.");
    expect(reply).not.toContain("The payment");
    expect(reply).not.toContain("the vendor invoice");
    expect(reply).not.toContain("“shared project files”");
    expect(reply).toContain("did not approve a hold");
    expect(reply).not.toContain("These words are mentioned.");
    expect(reply).not.toContain("These words are mentioned once");
    const plain = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are mentioned?" }),
    });
    const plainBody = await plain.json();
    expect(plainBody.messages.at(-1).text).toContain("These words are mentioned.");
    expect(plainBody.messages.at(-1).text).toContain("“Shared Project Files” is used by The send and The deletion.");
    expect(plainBody.messages.at(-1).text).not.toContain("These words are mentioned more than once");
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are mentioned more than once and delete the archive" }),
    });
    const opened = await mixed.json();
    expect(opened.approvals.filter((item: { status: string; kind: string }) => item.status === "open" && item.kind === "delete")).toHaveLength(1);
    expect(opened.messages.at(-1).text).not.toContain("These words are mentioned more than once.");
    expect(JSON.stringify(opened)).not.toContain("Always allow");
  });

  it("ORIEL-F70 a sentence asks which words are mentioned only once and does not act", async () => {
    const server = await boot();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are mentioned only once?" }),
    });
    const empty = await missing.json();
    expect(missing.status).toBe(200);
    expect(empty.handoffRules).toHaveLength(0);
    expect(empty.goals).toHaveLength(0);
    expect(empty.handoffs).toHaveLength(0);
    expect(empty.approvals).toHaveLength(0);
    expect(empty.messages.at(-1).text).toContain("No saved words are mentioned only once.");
    expect(empty.messages.at(-1).text).toContain("named no other step");
    expect(empty.messages.at(-1).text).not.toContain("The deletion");
    expect(empty.messages.at(-1).text).not.toContain("These words are mentioned only once.");
    expect(empty.messages.at(-1).text).not.toContain("No words are mentioned only once");
    expect(empty.messages.at(-1).text).not.toContain("No words are mentioned.");
    expect(empty.messages.at(-1).text).not.toContain("the whole");
    const banned = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are mentioned only once without asking" }),
    });
    expect(banned.status).toBe(400);
    expect(await banned.json()).toMatchObject({ error: expect.stringMatching(/without asking/) });
    const still = await fetch(`${server.url}/api/state`).then((response) => response.json());
    expect(still.handoffRules).toHaveLength(0);
    expect(still.goals).toHaveLength(0);
    const once = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are mentioned once?" }),
    });
    const onceBody = await once.json();
    expect(onceBody.goals).toHaveLength(0);
    expect(onceBody.messages.at(-1).text).toContain("No words are mentioned once.");
    expect(onceBody.messages.at(-1).text).not.toContain("No saved words are mentioned only once");
    const more = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are mentioned more than once?" }),
    });
    const moreBody = await more.json();
    expect(moreBody.goals).toHaveLength(0);
    expect(moreBody.messages.at(-1).text).toContain("No words are mentioned more than once.");
    expect(moreBody.messages.at(-1).text).not.toContain("No saved words are mentioned only once");
    const absent = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are not mentioned?" }),
    });
    const absentBody = await absent.json();
    expect(absentBody.messages.at(-1).text).toContain("No words are mentioned only once");
    expect(absentBody.messages.at(-1).text).not.toContain("No saved words are mentioned only once");
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", enabled: true, phrase: "shared project files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", enabled: true, phrase: "Shared Project Files" }),
    });
    await fetch(`${server.url}/api/handoff-rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pay", enabled: true, phrase: "the vendor invoice" }),
    });
    const asked = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Which words are mentioned only once?",
        goalId: "goal_missing",
        skillId: "skill_missing",
      }),
    });
    const mentionedOnly = await asked.json();
    expect(asked.status).toBe(200);
    expect(mentionedOnly.goals).toHaveLength(0);
    expect(mentionedOnly.handoffs).toHaveLength(0);
    expect(mentionedOnly.approvals.filter((item: { status: string }) => item.status === "open")).toHaveLength(0);
    const reply = mentionedOnly.messages.at(-1).text as string;
    expect(reply).toContain("These words are mentioned only once.");
    expect(reply).toContain("“the vendor invoice” is used by The payment.");
    expect(reply).not.toContain("The send");
    expect(reply).not.toContain("The deletion");
    expect(reply).not.toContain("shared project files");
    expect(reply).not.toContain("“Shared Project Files”");
    expect(reply).toContain("did not approve a hold");
    expect(reply).not.toContain("These words are mentioned once.");
    expect(reply).not.toContain("These words are mentioned.");
    expect(reply).not.toContain("No words are mentioned only once");
    const plain = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are mentioned once?" }),
    });
    const plainBody = await plain.json();
    expect(plainBody.messages.at(-1).text).toContain("These words are mentioned once.");
    expect(plainBody.messages.at(-1).text).toContain("“the vendor invoice” is used by The payment.");
    expect(plainBody.messages.at(-1).text).not.toContain("These words are mentioned only once");
    const mixed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Which words are mentioned only once and delete the archive" }),
    });
    const opened = await mixed.json();
    expect(opened.approvals.filter((item: { status: string; kind: string }) => item.status === "open" && item.kind === "delete")).toHaveLength(1);
    expect(opened.messages.at(-1).text).not.toContain("These words are mentioned only once.");
    expect(JSON.stringify(opened)).not.toContain("Always allow");
  });

  it("ORIEL-F71 a denied wake does not raise the same step until you send a message", async () => {
    const server = await boot();
    const first = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Email Maya the launch update" }),
    });
    const opened = await first.json();
    expect(first.status).toBe(200);
    const presentId = opened.approvals[0].id as string;
    const denied = await fetch(`${server.url}/api/approvals/${presentId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "deny" }),
    });
    expect(denied.status).toBe(200);
    const saved = await fetch(`${server.url}/api/routines`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goalId: opened.goals[0].id, name: "Launch note", cadence: "hourly" }),
    });
    expect(saved.status).toBe(200);
    const woke = await fetch(`${server.url}/api/tick`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ force: true }),
    });
    const afterWake = await woke.json();
    expect(woke.status).toBe(200);
    const wakeHold = afterWake.approvals.find((approval: { status: string; routineId?: string | null }) => approval.status === "open" && approval.routineId);
    expect(wakeHold?.kind).toBe("send");
    const stopped = await fetch(`${server.url}/api/approvals/${wakeHold.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "deny" }),
    });
    const held = await stopped.json();
    expect(held.routines[0].heldBack).toEqual(["send"]);
    const quiet = await fetch(`${server.url}/api/tick`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ force: true }),
    });
    const suppressed = await quiet.json();
    expect(quiet.status).toBe(200);
    expect(suppressed.approvals.filter((approval: { status: string }) => approval.status === "open")).toHaveLength(0);
    expect(suppressed.messages.at(-1).text).toContain("The send stays held back until you send a message.");
    expect(suppressed.messages.at(-1).text).not.toContain("I held the send for your approval.");
    expect(JSON.stringify(suppressed)).not.toContain("Always allow");
    const asked = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "What is handed to me?" }),
    });
    const cleared = await asked.json();
    expect(cleared.routines[0].heldBack).toEqual([]);
    expect(cleared.messages.at(-1).text).toContain("Nothing is handed to you");
    const resumed = await fetch(`${server.url}/api/tick`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ force: true }),
    });
    const again = await resumed.json();
    expect(again.approvals.filter((approval: { status: string; kind: string }) => approval.status === "open" && approval.kind === "send")).toHaveLength(1);
    expect(again.messages.at(-1).text).toContain("I held the send for your approval.");
    expect(JSON.stringify(again)).not.toContain("Always allow");
  });

  it("ORIEL-F72 a drafted email does not open a send, and a real send still does", async () => {
    const server = await boot();
    const drafted = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Draft an email to Maya about the launch" }),
    });
    const draftBody = await drafted.json();
    expect(drafted.status).toBe(200);
    expect(draftBody.approvals.filter((approval: { kind: string }) => approval.kind === "send")).toHaveLength(0);
    expect(draftBody.messages.at(-1).text).toContain("This stays a draft. Nothing was sent.");
    expect(draftBody.messages.at(-1).text).not.toContain("I held the send for your approval.");
    expect(JSON.stringify(draftBody)).not.toContain("Always allow");
    const asked = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Draft an email to Maya and send it" }),
    });
    const askedBody = await asked.json();
    expect(askedBody.approvals.filter((approval: { status: string; kind: string }) => approval.status === "open" && approval.kind === "send")).toHaveLength(1);
    expect(askedBody.messages.at(-1).text).toContain("I held the send for your approval.");
    expect(askedBody.messages.at(-1).text).not.toContain("This stays a draft. Nothing was sent.");
    const saved = await fetch(`${server.url}/api/routines`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goalId: askedBody.goals.at(-1).id, name: "Launch note", cadence: "hourly" }),
    });
    expect(saved.status).toBe(200);
    const woke = await fetch(`${server.url}/api/tick`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ force: true }),
    });
    const afterWake = await woke.json();
    expect(afterWake.approvals.filter((approval: { status: string; kind: string }) => approval.status === "open" && approval.kind === "send").length).toBeGreaterThan(0);
    expect(afterWake.messages.at(-1).text).toContain("I held the send for your approval.");
    expect(afterWake.messages.at(-1).text).not.toContain("This stays a draft.");
    expect(JSON.stringify(afterWake)).not.toContain("Always allow");
  });

  it("ORIEL-F73 a forward waits, and who asked for the Slack note does not send", async () => {
    const server = await boot();
    const forwarded = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Forward the vendor email to Maya" }),
    });
    const forwardBody = await forwarded.json();
    expect(forwarded.status).toBe(200);
    expect(forwardBody.approvals.filter((approval: { status: string; kind: string }) => approval.status === "open" && approval.kind === "send")).toHaveLength(1);
    expect(forwardBody.messages.at(-1).text).toContain("This is a forward. Oriel did not pull the original message or its attachments. Nothing was sent.");
    expect(forwardBody.messages.at(-1).text).not.toContain("This stays a draft.");
    expect(JSON.stringify(forwardBody)).not.toContain("Always allow");
    const asked = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Who asked for the Slack note?" }),
    });
    const askedBody = await asked.json();
    expect(askedBody.messages.at(-1).text).toBe("No Slack note in this record was asked for. Nothing was sent.");
    expect(askedBody.approvals.filter((approval: { status: string }) => approval.status === "open")).toHaveLength(1);
    const slack = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Forward the Slack note to Maya" }),
    });
    const slackBody = await slack.json();
    const open = slackBody.approvals.filter((approval: { status: string; kind: string }) => approval.status === "open" && approval.kind === "send");
    expect(open.length).toBeGreaterThan(0);
    const who = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Who asked for the Slack note?" }),
    });
    const whoBody = await who.json();
    expect(whoBody.messages.at(-1).text).toBe("You asked Oriel to forward that Slack note. Nothing was sent from here.");
    const held = whoBody.approvals.find((approval: { id: string }) => approval.id === open.at(-1).id);
    expect(held.status).toBe("open");
    const decision = await fetch(`${server.url}/api/approvals/${open.at(-1).id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "approve" }),
    });
    const done = await decision.json();
    expect(done.messages.at(-1).text).toContain("Nothing left this computer");
    expect(done.messages.at(-1).text).not.toContain("I sent");
    expect(JSON.stringify(done)).not.toContain("Always allow");
  });

  it("ORIEL-F74 allow for this task covers the same goal only", async () => {
    const server = await boot();
    const opened = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Email Maya the launch update" }),
    });
    const openedBody = await opened.json();
    const hold = openedBody.approvals.find((approval: { status: string; kind: string }) => approval.status === "open" && approval.kind === "send");
    const goalId = openedBody.goals[0].id as string;
    const decision = await fetch(`${server.url}/api/approvals/${hold.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "task" }),
    });
    const allowed = await decision.json();
    expect(decision.status).toBe(200);
    expect(allowed.messages.at(-1).text).toContain("The send stays allowed for the rest of this goal. Nothing was sent. A later goal still asks.");
    expect(allowed.messages.at(-1).text).not.toContain("I sent");
    expect(JSON.stringify(allowed)).not.toContain("Always allow");
    const same = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Email Maya the follow-up", goalId }),
    });
    const sameBody = await same.json();
    expect(sameBody.approvals.filter((approval: { status: string; kind: string; goalId: string }) => approval.goalId === goalId && approval.status === "open" && approval.kind === "send")).toHaveLength(0);
    expect(sameBody.messages.at(-1).text).toContain("The send stays allowed for the rest of this goal.");
    expect(sameBody.messages.at(-1).text).not.toContain("I held the send for your approval.");
    const next = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Email Maya from a new goal" }),
    });
    const nextBody = await next.json();
    expect(nextBody.approvals.filter((approval: { status: string; kind: string }) => approval.status === "open" && approval.kind === "send")).toHaveLength(1);
    expect(nextBody.messages.at(-1).text).toContain("I held the send for your approval.");
    expect(nextBody.messages.at(-1).text).not.toContain("stays allowed");
    const bad = await fetch(`${server.url}/api/approvals/${hold.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "always" }),
    });
    expect(bad.status).toBe(400);
  });

  it("ORIEL-F75 stop this task clears the same goal only", async () => {
    const server = await boot();
    const opened = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Email Maya the launch update" }),
    });
    const openedBody = await opened.json();
    const hold = openedBody.approvals.find((approval: { status: string; kind: string }) => approval.status === "open" && approval.kind === "send");
    const goalId = openedBody.goals[0].id as string;
    const decision = await fetch(`${server.url}/api/approvals/${hold.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "task" }),
    });
    expect(decision.status).toBe(200);
    const stopped = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Stop this task", goalId }),
    });
    const stoppedBody = await stopped.json();
    expect(stopped.status).toBe(200);
    expect(stoppedBody.messages.at(-1).text).toContain("The send is no longer allowed for the rest of this goal.");
    expect(stoppedBody.messages.at(-1).text).toContain("A sent email cannot be reversed from here.");
    expect(stoppedBody.messages.at(-1).text).not.toContain("I sent");
    expect(stoppedBody.approvals.find((approval: { id: string }) => approval.id === hold.id).scope).toBe("once");
    expect(JSON.stringify(stoppedBody)).not.toContain("Always allow");
    const again = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Email Maya the follow-up", goalId }),
    });
    const againBody = await again.json();
    expect(againBody.approvals.filter((approval: { goalId: string; status: string; kind: string }) => approval.goalId === goalId && approval.status === "open" && approval.kind === "send")).toHaveLength(1);
    expect(againBody.messages.at(-1).text).toContain("I held the send for your approval.");
    const other = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Email Noah from a new goal" }),
    });
    const otherBody = await other.json();
    const otherId = otherBody.goals.at(-1).id as string;
    const otherHold = otherBody.approvals.find((approval: { goalId: string; status: string; kind: string }) => approval.goalId === otherId && approval.status === "open" && approval.kind === "send");
    const allowed = await fetch(`${server.url}/api/approvals/${otherHold.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "task" }),
    });
    expect(allowed.status).toBe(200);
    const onlyFirst = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Stop this task", goalId: otherId }),
    });
    const onlyFirstBody = await onlyFirst.json();
    expect(onlyFirstBody.approvals.find((approval: { id: string }) => approval.id === otherHold.id).scope).toBe("once");
    expect(onlyFirstBody.approvals.find((approval: { goalId: string; kind: string; status: string }) => approval.goalId === goalId && approval.kind === "send" && approval.status === "open")).toBeTruthy();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Stop this task", goalId: "goal_missing" }),
    });
    expect(missing.status).toBe(404);
    const widened = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Stop this task without asking", goalId: otherId }),
    });
    expect(widened.status).toBe(400);
  });

  it("ORIEL-F76 stop one named routine leaves the other", async () => {
    const server = await boot();
    const opened = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Email Maya the launch update" }),
    });
    const openedBody = await opened.json();
    const goalId = openedBody.goals[0].id as string;
    const hold = openedBody.approvals.find((approval: { status: string; kind: string }) => approval.status === "open" && approval.kind === "send");
    const saved = await fetch(`${server.url}/api/routines`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goalId, name: "Launch note", cadence: "hourly" }),
    });
    expect(saved.status).toBe(200);
    const other = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Compare the market landscape" }),
    });
    const otherBody = await other.json();
    const otherId = otherBody.goals.at(-1).id as string;
    const savedOther = await fetch(`${server.url}/api/routines`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goalId: otherId, name: "Market check", cadence: "daily" }),
    });
    const savedOtherBody = await savedOther.json();
    const market = savedOtherBody.routines.find((routine: { name: string }) => routine.name === "Market check");
    const stopped = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Stop the Launch note routine", goalId }),
    });
    const stoppedBody = await stopped.json();
    expect(stopped.status).toBe(200);
    const launch = stoppedBody.routines.find((routine: { name: string }) => routine.name === "Launch note");
    const marketAfter = stoppedBody.routines.find((routine: { name: string }) => routine.name === "Market check");
    expect(launch.cadence).toBe("manual");
    expect(launch.nextRunAt).toBeNull();
    expect(launch.instruction).toBe("Email Maya the launch update");
    expect(marketAfter.cadence).toBe("daily");
    expect(marketAfter.nextRunAt).toBe(market.nextRunAt);
    expect(stoppedBody.messages.at(-1).text).toContain("“Launch note” wakes only when you run it.");
    expect(stoppedBody.messages.at(-1).text).toContain("Another routine is unchanged.");
    expect(stoppedBody.messages.at(-1).text).toContain("A completed action was not undone.");
    expect(stoppedBody.messages.at(-1).text).not.toContain("I sent");
    expect(stoppedBody.approvals.find((approval: { id: string }) => approval.id === hold.id).status).toBe("open");
    expect(stoppedBody.goals).toHaveLength(2);
    expect(JSON.stringify(stoppedBody)).not.toContain("Always allow");
    const tick = await fetch(`${server.url}/api/tick`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ force: true }),
    });
    const tickBody = await tick.json();
    expect(tick.status).toBe(200);
    expect(tickBody.routines.find((routine: { name: string }) => routine.name === "Launch note").cadence).toBe("manual");
    expect(tickBody.routines.find((routine: { name: string }) => routine.name === "Launch note").lastRunAt).toBeNull();
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Stop the Market check routine", goalId: "goal_missing" }),
    });
    expect(missing.status).toBe(404);
    const widened = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Stop the Market check routine without asking" }),
    });
    expect(widened.status).toBe(400);
    const still = await fetch(`${server.url}/api/state`);
    const stillBody = await still.json();
    expect(stillBody.routines.find((routine: { name: string }) => routine.name === "Market check").cadence).toBe("daily");
  });

  it("ORIEL-F77 names the schedule and leaves the routines", async () => {
    const server = await boot();
    const empty = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "What is scheduled?" }),
    });
    const emptyBody = await empty.json();
    expect(empty.status).toBe(200);
    expect(emptyBody.goals).toHaveLength(0);
    expect(emptyBody.routines).toHaveLength(0);
    expect(emptyBody.messages.at(-1).text).toBe(
      "Nothing is scheduled. Nothing was run and nothing was changed. A completed action stays completed. Nothing was sent or spent.",
    );
    const opened = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Email Maya the launch update" }),
    });
    const openedBody = await opened.json();
    const goalId = openedBody.goals[0].id as string;
    const hold = openedBody.approvals.find((approval: { status: string; kind: string }) => approval.status === "open" && approval.kind === "send");
    const saved = await fetch(`${server.url}/api/routines`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goalId, name: "Launch note", cadence: "hourly" }),
    });
    expect(saved.status).toBe(200);
    const other = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Compare the market landscape" }),
    });
    const otherBody = await other.json();
    const otherId = otherBody.goals.at(-1).id as string;
    const savedOther = await fetch(`${server.url}/api/routines`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goalId: otherId, name: "Market check", cadence: "daily" }),
    });
    const savedOtherBody = await savedOther.json();
    const market = savedOtherBody.routines.find((routine: { name: string }) => routine.name === "Market check");
    const listed = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Please what's scheduled?", goalId, skillId: "missing-skill" }),
    });
    const listedBody = await listed.json();
    expect(listed.status).toBe(200);
    const launch = listedBody.routines.find((routine: { name: string }) => routine.name === "Launch note");
    const marketAfter = listedBody.routines.find((routine: { name: string }) => routine.name === "Market check");
    expect(launch.cadence).toBe("hourly");
    expect(launch.lastRunAt).toBeNull();
    expect(launch.instruction).toBe("Email Maya the launch update");
    expect(marketAfter.cadence).toBe("daily");
    expect(marketAfter.nextRunAt).toBe(market.nextRunAt);
    expect(marketAfter.lastRunAt).toBeNull();
    expect(listedBody.messages.at(-1).text).toBe(
      "Scheduled. “Launch note” is hourly. “Market check” is daily. Nothing was run and nothing was changed. A completed action stays completed. Nothing was sent or spent.",
    );
    expect(listedBody.messages.at(-1).text).not.toContain("I sent");
    expect(listedBody.approvals.find((approval: { id: string }) => approval.id === hold.id).status).toBe("open");
    expect(listedBody.goals).toHaveLength(2);
    expect(JSON.stringify(listedBody)).not.toContain("Always allow");
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "What is scheduled?", goalId: "goal_missing" }),
    });
    expect(missing.status).toBe(404);
    const widened = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "What is scheduled without asking" }),
    });
    expect(widened.status).toBe(400);
    const still = await fetch(`${server.url}/api/state`);
    const stillBody = await still.json();
    expect(stillBody.routines.find((routine: { name: string }) => routine.name === "Launch note").cadence).toBe("hourly");
    expect(stillBody.routines.find((routine: { name: string }) => routine.name === "Market check").nextRunAt).toBe(market.nextRunAt);
    const tick = await fetch(`${server.url}/api/tick`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ force: true }),
    });
    const tickBody = await tick.json();
    expect(tick.status).toBe(200);
    expect(tickBody.routines.find((routine: { name: string }) => routine.name === "Launch note").lastRunAt).toBeTruthy();
    expect(tickBody.routines.find((routine: { name: string }) => routine.name === "Launch note").cadence).toBe("hourly");
    expect(tickBody.routines.find((routine: { name: string }) => routine.name === "Market check").lastRunAt).toBeNull();
    expect(tickBody.routines.find((routine: { name: string }) => routine.name === "Market check").nextRunAt).toBe(market.nextRunAt);
    expect(tickBody.messages.some((message: { text: string }) => message.text.includes("“Launch note” is hourly."))).toBe(true);
  });

  it("ORIEL-F78 names when one routine wakes and leaves the schedule", async () => {
    const server = await boot();
    const empty = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "When does the Launch note routine wake?" }),
    });
    const emptyBody = await empty.json();
    expect(empty.status).toBe(200);
    expect(emptyBody.goals).toHaveLength(0);
    expect(emptyBody.routines).toHaveLength(0);
    expect(emptyBody.messages.at(-1).text).toBe(
      "There is no such routine as “Launch note”. Nothing was run and nothing was changed. A completed action stays completed. Nothing was sent or spent.",
    );
    const opened = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Email Maya the launch update" }),
    });
    const openedBody = await opened.json();
    const goalId = openedBody.goals[0].id as string;
    const hold = openedBody.approvals.find((approval: { status: string; kind: string }) => approval.status === "open" && approval.kind === "send");
    const saved = await fetch(`${server.url}/api/routines`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goalId, name: "Launch note", cadence: "hourly" }),
    });
    const savedBody = await saved.json();
    expect(saved.status).toBe(200);
    const launchNext = savedBody.routines.find((routine: { name: string }) => routine.name === "Launch note").nextRunAt as string;
    const other = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Compare the market landscape" }),
    });
    const otherBody = await other.json();
    const otherId = otherBody.goals.at(-1).id as string;
    const savedOther = await fetch(`${server.url}/api/routines`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goalId: otherId, name: "Market check", cadence: "daily" }),
    });
    const savedOtherBody = await savedOther.json();
    const market = savedOtherBody.routines.find((routine: { name: string }) => routine.name === "Market check");
    const named = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Please, when does the Launch note routine wake?", goalId, skillId: "missing-skill" }),
    });
    const namedBody = await named.json();
    expect(named.status).toBe(200);
    const launch = namedBody.routines.find((routine: { name: string }) => routine.name === "Launch note");
    const marketAfter = namedBody.routines.find((routine: { name: string }) => routine.name === "Market check");
    expect(launch.cadence).toBe("hourly");
    expect(launch.nextRunAt).toBe(launchNext);
    expect(launch.lastRunAt).toBeNull();
    expect(launch.instruction).toBe("Email Maya the launch update");
    expect(marketAfter.cadence).toBe("daily");
    expect(marketAfter.nextRunAt).toBe(market.nextRunAt);
    expect(marketAfter.lastRunAt).toBeNull();
    expect(namedBody.messages.at(-1).text).toBe(
      `“Launch note” is hourly. It next wakes at ${launchNext}. Another routine is unchanged. Nothing was run and nothing was changed. A completed action stays completed. Nothing was sent or spent.`,
    );
    expect(namedBody.messages.at(-1).text).not.toContain("I sent");
    expect(namedBody.messages.at(-1).text).not.toContain(market.nextRunAt);
    expect(namedBody.approvals.find((approval: { id: string }) => approval.id === hold.id).status).toBe("open");
    expect(namedBody.goals).toHaveLength(2);
    expect(JSON.stringify(namedBody)).not.toContain("Always allow");
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "When does the Market check routine wake?", goalId: "goal_missing" }),
    });
    expect(missing.status).toBe(404);
    const widened = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "When does the Launch note routine wake without asking" }),
    });
    expect(widened.status).toBe(400);
    const still = await fetch(`${server.url}/api/state`);
    const stillBody = await still.json();
    expect(stillBody.routines.find((routine: { name: string }) => routine.name === "Launch note").cadence).toBe("hourly");
    expect(stillBody.routines.find((routine: { name: string }) => routine.name === "Launch note").nextRunAt).toBe(launchNext);
    expect(stillBody.routines.find((routine: { name: string }) => routine.name === "Market check").nextRunAt).toBe(market.nextRunAt);
    const tick = await fetch(`${server.url}/api/tick`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ force: true }),
    });
    const tickBody = await tick.json();
    expect(tick.status).toBe(200);
    expect(tickBody.routines.find((routine: { name: string }) => routine.name === "Launch note").lastRunAt).toBeTruthy();
    expect(tickBody.routines.find((routine: { name: string }) => routine.name === "Launch note").cadence).toBe("hourly");
    expect(tickBody.routines.find((routine: { name: string }) => routine.name === "Market check").lastRunAt).toBeNull();
    expect(tickBody.routines.find((routine: { name: string }) => routine.name === "Market check").nextRunAt).toBe(market.nextRunAt);
    expect(tickBody.messages.some((message: { text: string }) => message.text.includes(`It next wakes at ${launchNext}.`))).toBe(true);
  });

  it("ORIEL-F79 names what one routine does and leaves the instruction", async () => {
    const server = await boot();
    const empty = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "What does the Launch note routine do?" }),
    });
    const emptyBody = await empty.json();
    expect(empty.status).toBe(200);
    expect(emptyBody.goals).toHaveLength(0);
    expect(emptyBody.routines).toHaveLength(0);
    expect(emptyBody.messages.at(-1).text).toBe(
      "There is no such routine as “Launch note”. Nothing was run and nothing was changed. A completed action stays completed. Nothing was sent or spent.",
    );
    const opened = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Email Maya the launch update" }),
    });
    const openedBody = await opened.json();
    const goalId = openedBody.goals[0].id as string;
    const hold = openedBody.approvals.find((approval: { status: string; kind: string }) => approval.status === "open" && approval.kind === "send");
    const saved = await fetch(`${server.url}/api/routines`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goalId, name: "Launch note", cadence: "hourly" }),
    });
    const savedBody = await saved.json();
    expect(saved.status).toBe(200);
    const launchNext = savedBody.routines.find((routine: { name: string }) => routine.name === "Launch note").nextRunAt as string;
    const alone = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "What does the Launch note routine do?", goalId, skillId: "missing-skill" }),
    });
    const aloneBody = await alone.json();
    expect(alone.status).toBe(200);
    expect(aloneBody.messages.at(-1).text).toBe(
      "“Launch note” does this: “Email Maya the launch update”. Nothing was run and nothing was changed. A completed action stays completed. Nothing was sent or spent.",
    );
    expect(aloneBody.messages.at(-1).text).not.toContain("Another routine");
    expect(aloneBody.routines.find((routine: { name: string }) => routine.name === "Launch note").instruction).toBe("Email Maya the launch update");
    expect(aloneBody.routines.find((routine: { name: string }) => routine.name === "Launch note").nextRunAt).toBe(launchNext);
    const other = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Compare the market landscape" }),
    });
    const otherBody = await other.json();
    const otherId = otherBody.goals.at(-1).id as string;
    const savedOther = await fetch(`${server.url}/api/routines`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goalId: otherId, name: "Market check", cadence: "daily" }),
    });
    const savedOtherBody = await savedOther.json();
    const market = savedOtherBody.routines.find((routine: { name: string }) => routine.name === "Market check");
    const named = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Please, what does the Launch note routine do?", goalId, skillId: "missing-skill" }),
    });
    const namedBody = await named.json();
    expect(named.status).toBe(200);
    const launch = namedBody.routines.find((routine: { name: string }) => routine.name === "Launch note");
    const marketAfter = namedBody.routines.find((routine: { name: string }) => routine.name === "Market check");
    expect(launch.cadence).toBe("hourly");
    expect(launch.nextRunAt).toBe(launchNext);
    expect(launch.lastRunAt).toBeNull();
    expect(launch.instruction).toBe("Email Maya the launch update");
    expect(marketAfter.cadence).toBe("daily");
    expect(marketAfter.nextRunAt).toBe(market.nextRunAt);
    expect(marketAfter.instruction).toBe("Compare the market landscape");
    expect(marketAfter.lastRunAt).toBeNull();
    expect(namedBody.messages.at(-1).text).toBe(
      "“Launch note” does this: “Email Maya the launch update”. Another routine is unchanged. Nothing was run and nothing was changed. A completed action stays completed. Nothing was sent or spent.",
    );
    expect(namedBody.messages.at(-1).text).not.toContain("I sent");
    expect(namedBody.messages.at(-1).text).not.toContain("It next wakes");
    expect(namedBody.messages.at(-1).text).not.toContain("Compare the market landscape");
    expect(namedBody.approvals.find((approval: { id: string }) => approval.id === hold.id).status).toBe("open");
    expect(namedBody.goals).toHaveLength(2);
    expect(JSON.stringify(namedBody)).not.toContain("Always allow");
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "What does the Market check routine do?", goalId: "goal_missing" }),
    });
    expect(missing.status).toBe(404);
    const widened = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "What does the Launch note routine do without asking" }),
    });
    expect(widened.status).toBe(400);
    const still = await fetch(`${server.url}/api/state`);
    const stillBody = await still.json();
    expect(stillBody.routines.find((routine: { name: string }) => routine.name === "Launch note").cadence).toBe("hourly");
    expect(stillBody.routines.find((routine: { name: string }) => routine.name === "Launch note").instruction).toBe("Email Maya the launch update");
    expect(stillBody.routines.find((routine: { name: string }) => routine.name === "Launch note").nextRunAt).toBe(launchNext);
    expect(stillBody.routines.find((routine: { name: string }) => routine.name === "Market check").nextRunAt).toBe(market.nextRunAt);
    expect(stillBody.routines.find((routine: { name: string }) => routine.name === "Market check").instruction).toBe("Compare the market landscape");
    const tick = await fetch(`${server.url}/api/tick`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ force: true }),
    });
    const tickBody = await tick.json();
    expect(tick.status).toBe(200);
    expect(tickBody.routines.find((routine: { name: string }) => routine.name === "Launch note").lastRunAt).toBeTruthy();
    expect(tickBody.routines.find((routine: { name: string }) => routine.name === "Launch note").instruction).toBe("Email Maya the launch update");
    expect(tickBody.routines.find((routine: { name: string }) => routine.name === "Launch note").cadence).toBe("hourly");
    expect(tickBody.routines.find((routine: { name: string }) => routine.name === "Market check").lastRunAt).toBeNull();
    expect(tickBody.routines.find((routine: { name: string }) => routine.name === "Market check").instruction).toBe("Compare the market landscape");
    expect(tickBody.routines.find((routine: { name: string }) => routine.name === "Market check").nextRunAt).toBe(market.nextRunAt);
    expect(tickBody.messages.some((message: { text: string }) => message.text.includes("“Launch note” does this: “Email Maya the launch update”."))).toBe(true);
  });

  it("ORIEL-F80 names when one routine last ran and leaves that time", async () => {
    const server = await boot();
    const empty = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "When did the Launch note routine last run?" }),
    });
    const emptyBody = await empty.json();
    expect(empty.status).toBe(200);
    expect(emptyBody.goals).toHaveLength(0);
    expect(emptyBody.routines).toHaveLength(0);
    expect(emptyBody.messages.at(-1).text).toBe(
      "There is no such routine as “Launch note”. Nothing was run and nothing was changed. A completed action stays completed. Nothing was sent or spent.",
    );
    const opened = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Email Maya the launch update" }),
    });
    const openedBody = await opened.json();
    const goalId = openedBody.goals[0].id as string;
    const hold = openedBody.approvals.find((approval: { status: string; kind: string }) => approval.status === "open" && approval.kind === "send");
    const saved = await fetch(`${server.url}/api/routines`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goalId, name: "Launch note", cadence: "hourly" }),
    });
    const savedBody = await saved.json();
    expect(saved.status).toBe(200);
    const launchNext = savedBody.routines.find((routine: { name: string }) => routine.name === "Launch note").nextRunAt as string;
    const alone = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "When did the Launch note routine last run?", goalId, skillId: "missing-skill" }),
    });
    const aloneBody = await alone.json();
    expect(alone.status).toBe(200);
    expect(aloneBody.messages.at(-1).text).toBe(
      "“Launch note” has no last run in the record. Nothing was run and nothing was changed. A completed action stays completed. Nothing was sent or spent.",
    );
    expect(aloneBody.messages.at(-1).text).not.toContain("Another routine");
    expect(aloneBody.messages.at(-1).text).not.toContain("Email Maya");
    expect(aloneBody.routines.find((routine: { name: string }) => routine.name === "Launch note").instruction).toBe("Email Maya the launch update");
    expect(aloneBody.routines.find((routine: { name: string }) => routine.name === "Launch note").lastRunAt).toBeNull();
    expect(aloneBody.routines.find((routine: { name: string }) => routine.name === "Launch note").nextRunAt).toBe(launchNext);
    const other = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Compare the market landscape" }),
    });
    const otherBody = await other.json();
    const otherId = otherBody.goals.at(-1).id as string;
    const savedOther = await fetch(`${server.url}/api/routines`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goalId: otherId, name: "Market check", cadence: "daily" }),
    });
    const savedOtherBody = await savedOther.json();
    const market = savedOtherBody.routines.find((routine: { name: string }) => routine.name === "Market check");
    const named = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Please, when did the Launch note routine last run?", goalId, skillId: "missing-skill" }),
    });
    const namedBody = await named.json();
    expect(named.status).toBe(200);
    const launch = namedBody.routines.find((routine: { name: string }) => routine.name === "Launch note");
    const marketAfter = namedBody.routines.find((routine: { name: string }) => routine.name === "Market check");
    expect(launch.cadence).toBe("hourly");
    expect(launch.nextRunAt).toBe(launchNext);
    expect(launch.lastRunAt).toBeNull();
    expect(launch.instruction).toBe("Email Maya the launch update");
    expect(marketAfter.cadence).toBe("daily");
    expect(marketAfter.nextRunAt).toBe(market.nextRunAt);
    expect(marketAfter.instruction).toBe("Compare the market landscape");
    expect(marketAfter.lastRunAt).toBeNull();
    expect(namedBody.messages.at(-1).text).toBe(
      "“Launch note” has no last run in the record. Another routine is unchanged. Nothing was run and nothing was changed. A completed action stays completed. Nothing was sent or spent.",
    );
    expect(namedBody.messages.at(-1).text).not.toContain("I sent");
    expect(namedBody.messages.at(-1).text).not.toContain("It next wakes");
    expect(namedBody.messages.at(-1).text).not.toContain("does this");
    expect(namedBody.messages.at(-1).text).not.toContain("Compare the market landscape");
    expect(namedBody.approvals.find((approval: { id: string }) => approval.id === hold.id).status).toBe("open");
    expect(namedBody.goals).toHaveLength(2);
    expect(JSON.stringify(namedBody)).not.toContain("Always allow");
    const missing = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "When did the Market check routine last run?", goalId: "goal_missing" }),
    });
    expect(missing.status).toBe(404);
    const widened = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "When did the Launch note routine last run without asking" }),
    });
    expect(widened.status).toBe(400);
    const still = await fetch(`${server.url}/api/state`);
    const stillBody = await still.json();
    expect(stillBody.routines.find((routine: { name: string }) => routine.name === "Launch note").cadence).toBe("hourly");
    expect(stillBody.routines.find((routine: { name: string }) => routine.name === "Launch note").instruction).toBe("Email Maya the launch update");
    expect(stillBody.routines.find((routine: { name: string }) => routine.name === "Launch note").lastRunAt).toBeNull();
    expect(stillBody.routines.find((routine: { name: string }) => routine.name === "Launch note").nextRunAt).toBe(launchNext);
    expect(stillBody.routines.find((routine: { name: string }) => routine.name === "Market check").nextRunAt).toBe(market.nextRunAt);
    expect(stillBody.routines.find((routine: { name: string }) => routine.name === "Market check").instruction).toBe("Compare the market landscape");
    const tick = await fetch(`${server.url}/api/tick`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ force: true }),
    });
    const tickBody = await tick.json();
    expect(tick.status).toBe(200);
    expect(tickBody.routines.find((routine: { name: string }) => routine.name === "Launch note").lastRunAt).toBe(launchNext);
    expect(tickBody.routines.find((routine: { name: string }) => routine.name === "Launch note").instruction).toBe("Email Maya the launch update");
    expect(tickBody.routines.find((routine: { name: string }) => routine.name === "Launch note").cadence).toBe("hourly");
    expect(tickBody.routines.find((routine: { name: string }) => routine.name === "Market check").lastRunAt).toBeNull();
    expect(tickBody.routines.find((routine: { name: string }) => routine.name === "Market check").instruction).toBe("Compare the market landscape");
    expect(tickBody.routines.find((routine: { name: string }) => routine.name === "Market check").nextRunAt).toBe(market.nextRunAt);
    const after = await fetch(`${server.url}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "When did the Launch note routine last run?" }),
    });
    const afterBody = await after.json();
    expect(after.status).toBe(200);
    expect(afterBody.messages.at(-1).text).toBe(
      `“Launch note” last ran at ${launchNext}. Another routine is unchanged. Nothing was run and nothing was changed. A completed action stays completed. Nothing was sent or spent.`,
    );
    expect(afterBody.routines.find((routine: { name: string }) => routine.name === "Launch note").lastRunAt).toBe(launchNext);
    expect(afterBody.routines.find((routine: { name: string }) => routine.name === "Market check").lastRunAt).toBeNull();
    expect(afterBody.messages.some((message: { text: string }) => message.text.includes("“Launch note” has no last run in the record."))).toBe(true);
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
