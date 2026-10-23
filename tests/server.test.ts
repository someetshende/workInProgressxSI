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
    expect(notBody.goals).toHaveLength(1);
    expect(notBody.approvals).toHaveLength(0);
    expect(notBody.handoffs).toHaveLength(0);
    expect(notBody.messages.at(-1).text).not.toContain("shares these words");
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
    expect(once.goals).toHaveLength(1);
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
    expect(paymentBody.goals).toHaveLength(1);
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
