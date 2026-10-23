import { spawn, type ChildProcess } from "node:child_process";
import { expect, test } from "@playwright/test";

function startSeat(seat: string, token: string): Promise<{ url: string; stop: () => Promise<void> }> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") env[key] = value;
  }
  env.ORIEL_SEAT = seat;
  env.ORIEL_SEAT_TOKEN = token;
  return new Promise((resolve, reject) => {
    const child: ChildProcess = spawn("node_modules/.bin/tsx", ["src/seats/local.ts"], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let buf = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Local seat did not start. ${buf}`));
    }, 15000);
    const fail = (error: Error) => {
      clearTimeout(timer);
      reject(error);
    };
    child.once("error", fail);
    child.stdout?.on("data", (chunk: Buffer) => {
      buf += chunk.toString("utf8");
      const match = buf.match(/listening (http:\/\/127\.0\.0\.1:\d+\/tasks)/);
      const url = match?.[1];
      if (!url) return;
      clearTimeout(timer);
      child.removeListener("error", fail);
      resolve({
        url,
        stop: () =>
          new Promise((done) => {
            if (child.exitCode !== null) {
              done();
              return;
            }
            child.once("exit", () => done());
            child.kill();
          }),
      });
    });
  });
}

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  const response = await request.post("/api/reset");
  expect(response.ok()).toBeTruthy();
});

test("ORIEL-F01 ORIEL-F14 a client comparison stays off Muse and unsent", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Tell Oriel what to finish." })).toBeVisible();
  await page.screenshot({ path: "test-results/oriel-empty.png" });
  await page.getByTestId("prompt-compare").click();
  await expect(page.getByTestId("composer")).toHaveValue(/Do not email anyone/);
  await page.getByTestId("send").click();
  await expect(page.getByTestId("synthesis")).toContainText("Grok Bot should lead");
  await expect(page.getByTestId("synthesis")).toContainText("ruled it out");
  await expect(page.getByTestId("why")).toContainText("consumer seat");
  await expect(page.getByTestId("seat-note-muse")).toHaveCount(0);
  await expect(page.getByTestId("seat-note-grok")).toBeVisible();
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await page.screenshot({ path: "test-results/oriel-compare.png" });
});

test("ORIEL-F04 ORIEL-F11 a payment can be approved and a send can be refused", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Plan a family dinner under $80 and hold any purchase.");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval")).toContainText("Release a payment");
  await page.getByTestId("approve").click();
  await expect(page.getByTestId("thread")).toContainText("did not move money");
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Email Maya the launch update");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval").last()).toContainText("Maya");
  await page.getByTestId("deny").click();
  await expect(page.getByTestId("thread")).toContainText("Nothing was released.");
});

test("ORIEL-F05 ORIEL-F18 a short preference is remembered and collapses the brief", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Remember that I prefer short briefs.");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("thread")).toContainText("I'll keep that.");
  await page.getByTestId("composer").fill("What do you remember?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("thread")).toContainText("I prefer short briefs");
  await page.getByTestId("composer").fill("Compare the market landscape");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("synthesis")).toContainText("should lead");
  const open = await page.getByTestId("brief-rest").evaluate((element) => (element as HTMLDetailsElement).open);
  expect(open).toBe(false);
});

test("ORIEL-F06 switching Grok Bot off moves the work", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("agent-grok").click();
  await expect(page.getByTestId("agent-grok")).toHaveAttribute("aria-pressed", "false");
  await page.getByTestId("composer").fill("Fix the failing test in the repo");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("synthesis")).toContainText("Dots should lead");
  await expect(page.getByTestId("why")).toContainText("Grok Bot is switched off");
  await expect(page.getByTestId("seat-note-grok")).toHaveCount(0);
});

test("ORIEL-F07 a routine runs again without growing a send", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  await page.locator("[data-testid^='run-routine-']").click();
  await expect(page.getByTestId("thread")).toContainText("weekly close");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator("[data-testid^='goal-goal_']")).toHaveCount(2);
});

test("ORIEL-F08 the return card keeps a watch after the hold is released", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Buy a $20 gift for the dinner and keep an eye on the guest list.");
  await page.getByTestId("send").click();
  await page.reload();
  await expect(page.getByTestId("away-card")).toContainText("While you were away");
  await expect(page.getByTestId("away-card")).toContainText("Release a payment");
  await expect(page.getByTestId("away-card")).toContainText("Watch: the guest list");
  await page.getByTestId("approve").click();
  await expect(page.getByTestId("away-card")).toContainText("Watch: the guest list");
  await expect(page.getByTestId("away-card")).not.toContainText("Release a payment");
});

test("ORIEL-F09 a bridge token is not echoed into the window", async ({ page }) => {
  const token = "window-token-not-for-display";
  await page.goto("/");
  await page.getByTestId("bridge-open-grok").click();
  await page.getByLabel("Grok Bot bridge URL").fill("http://127.0.0.1:9/tasks");
  await page.getByTestId("token-grok").fill(token);
  await page.getByRole("button", { name: "Save bridge" }).click();
  await expect(page.getByTestId("agent-grok")).toContainText("Bridged");
  await expect(page.locator("body")).not.toContainText(token);
  const leaked = await page.evaluate(async (secret) => {
    const response = await fetch("/api/state");
    const text = await response.text();
    return text.includes(secret);
  }, token);
  expect(leaked).toBe(false);
});

test("ORIEL-F15 user text cannot become markup", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill('<img src=x alt="xss-probe">');
  await page.getByTestId("send").click();
  await expect(page.locator('img[alt="xss-probe"]')).toHaveCount(0);
  await expect(page.getByTestId("thread")).toContainText('<img src=x alt="xss-probe">');
});

test("the atlas shows the full story count and can be searched", async ({ page }) => {
  await page.goto("/atlas");
  const health = await page.request.get("/api/health");
  const body = await health.json();
  expect(body.atlas).toBeGreaterThanOrEqual(1000);
  await expect(page.getByTestId("atlas-count")).toHaveText(String(body.atlas));
  await page.getByTestId("atlas-search").fill("clinic administrator");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByTestId("atlas-list")).toContainText("clinic administrator");
  await page.screenshot({ path: "test-results/oriel-atlas.png" });
});

test("a bridged Muse stand-in answers live and a check spends nothing", async ({ page }) => {
  const token = "e2e-seat-token";
  const seat = await startSeat("muse", token);
  try {
    const saved = await page.request.post("/api/connectors/muse", {
      data: { bridgeUrl: seat.url, token },
    });
    expect(saved.ok()).toBeTruthy();
    await page.goto("/");
    await expect(page.getByTestId("agent-muse")).toContainText("Bridged");
    await page.getByTestId("composer").fill("Plan a family dinner under $80 and hold any purchase.");
    await page.getByTestId("send").click();
    await expect(page.getByTestId("agent-muse")).toContainText("Live");
    await expect(page.getByTestId("seat-note-muse")).toContainText("Local stand-in for Muse");
    await expect(page.locator("body")).not.toContainText(token);
    await page.getByTestId("review-watches").click();
    await expect(page.getByTestId("thread")).toContainText("Nothing moved");
    await expect(page.getByTestId("approve")).toBeVisible();
    await page.getByTestId("approve").click();
    await expect(page.getByTestId("thread")).toContainText("did not send mail, move money");
    await expect(page.getByTestId("approve")).toHaveCount(0);
    await page.screenshot({ path: "test-results/oriel-live-seat.png" });
  } finally {
    await seat.stop();
  }
});

test("ORIEL-F19 ORIEL-F20 a daily routine wakes and a bridge can be checked", async ({ page }) => {
  const token = "e2e-probe-token";
  const seat = await startSeat("grok", token);
  try {
    await page.goto("/");
    await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
    await page.getByTestId("send").click();
    await page.getByTestId("save-routine").click();
    const cadence = page.locator("[data-testid^='cadence-']");
    await expect(cadence).toHaveText("Manual");
    await cadence.click();
    await expect(cadence).toHaveText("Daily");
    const tick = await page.request.post("/api/tick", { data: { force: true } });
    expect(tick.ok()).toBeTruthy();
    await page.reload();
    await expect(page.getByText("Routine", { exact: true })).toBeVisible();
    await expect(page.locator("[data-testid^='goal-goal_']")).toHaveCount(2);
    await expect(page.getByTestId("approve")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(token);

    const saved = await page.request.post("/api/connectors/grok", {
      data: { bridgeUrl: seat.url, token },
    });
    expect(saved.ok()).toBeTruthy();
    await page.reload();
    await page.getByTestId("bridge-open-grok").click();
    await page.getByTestId("probe-grok").click();
    await expect(page.getByTestId("agent-grok")).toContainText("Live");
    await expect(page.getByTestId("thread")).toContainText("Bridge is reachable");
    await expect(page.getByTestId("thread")).toContainText("Nothing was sent or spent");
    await expect(page.locator("body")).not.toContainText(token);
    await page.screenshot({ path: "test-results/oriel-wake.png" });
  } finally {
    await seat.stop();
  }
});

test("ORIEL-F21 pausing wakes leaves the send held", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Email Maya the launch update");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval")).toContainText("Maya");
  await page.getByTestId("save-routine").click();
  const cadence = page.locator("[data-testid^='cadence-']");
  await cadence.click();
  await expect(cadence).toHaveText("Daily");
  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("thread")).toContainText("Nothing was sent or spent");
  const tick = await page.request.post("/api/tick", { data: { force: true } });
  expect(tick.ok()).toBeTruthy();
  await page.reload();
  await expect(page.locator("[data-testid^='goal-goal_']")).toHaveCount(1);
  await expect(page.getByTestId("approval")).toContainText("Release a send");
  await expect(page.getByTestId("approve")).toBeVisible();
  await expect(page.getByText("Routine", { exact: true })).toHaveCount(0);
  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toHaveAttribute("aria-pressed", "false");
  const woke = await page.request.post("/api/tick", { data: { force: true } });
  expect(woke.ok()).toBeTruthy();
  await page.reload();
  await expect(page.getByText("Routine", { exact: true })).toBeVisible();
  await expect(page.locator("[data-testid^='goal-goal_']")).toHaveCount(2);
  await expect(page.getByTestId("approve").first()).toBeVisible();
  await expect(page.getByTestId("thread")).not.toContainText("I sent");
});

test("ORIEL-F22 a skill applies a do-not-send and does not wake", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-skill").click();
  const skill = page.locator("[data-testid^='skill-']");
  await expect(skill).toContainText("Use");
  await skill.click();
  await expect(page.getByTestId("composer-context")).toContainText("Using");
  await expect(page.locator("[data-testid^='goal-goal_']")).toHaveCount(1);
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Email Maya the launch update");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("synthesis")).toContainText("Using the skill");
  await expect(page.getByTestId("synthesis")).toContainText("ruled it out");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator("[data-testid^='cadence-']")).toHaveCount(0);
  const tick = await page.request.post("/api/tick", { data: { force: true } });
  expect(tick.ok()).toBeTruthy();
  await page.reload();
  await expect(page.locator("[data-testid^='goal-goal_']")).toHaveCount(2);
  await expect(page.getByText("Routine", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: "test-results/oriel-skill.png" });
});

test("ORIEL-F23 a woken hold expires and asking again still waits", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Email Maya the launch update");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approve")).toBeVisible();
  await page.getByTestId("save-routine").click();
  const cadence = page.locator("[data-testid^='cadence-']");
  await cadence.click();
  await expect(cadence).toHaveText("Daily");
  const tick = await page.request.post("/api/tick", { data: { force: true } });
  expect(tick.ok()).toBeTruthy();
  await page.reload();
  await expect(page.getByText("Routine", { exact: true })).toBeVisible();
  await expect(page.getByTestId("hold-expiry")).toContainText("while you were away");
  await expect(page.getByTestId("synthesis")).toContainText("while you were away");
  const expired = await page.request.post("/api/holds/expire", { data: {} });
  expect(expired.ok()).toBeTruthy();
  await page.reload();
  await expect(page.getByTestId("expired")).toContainText("did not run");
  await expect(page.getByTestId("expired")).toContainText("no always-allow");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.locator("[data-testid^='away-approve-']")).toBeVisible();
  await page.getByTestId("try-again").click();
  await expect(page.getByTestId("approve")).toBeVisible();
  await expect(page.getByTestId("expired")).toBeVisible();
  await expect(page.getByTestId("hold-expiry")).toHaveCount(0);
  await page.getByTestId("approve").click();
  await expect(page.getByTestId("thread")).toContainText("Nothing left this computer");
  await expect(page.getByTestId("thread")).not.toContainText("I sent");
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await page.screenshot({ path: "test-results/oriel-expired.png" });
});

test("ORIEL-F24 a password change is handed over and a send stays held", async ({ page }) => {
  await page.goto("/");
  const secret = "hunter2-window";
  await page.getByTestId("composer").fill(`Change my password to ${secret}`);
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toContainText("Hand off to you");
  await expect(page.getByTestId("handoff")).toContainText("Change the password yourself");
  await expect(page.getByTestId("handoff")).toContainText("Do not paste a password");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(secret);
  await page.getByTestId("did-this").click();
  await expect(page.getByTestId("thread")).toContainText("did not type a password");
  await expect(page.getByTestId("did-this")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Sign in to the shop and email Maya the receipt");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toContainText("Sign in yourself");
  await expect(page.getByTestId("approval")).toContainText("Release a send");
  await page.getByTestId("did-this").click();
  await expect(page.getByTestId("approve")).toBeVisible();
  await page.getByTestId("deny").click();
  await expect(page.getByTestId("thread")).toContainText("Nothing was released.");
  await expect(page.locator("body")).not.toContainText(secret);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByTestId("handoff")).toBeVisible();
  await page.screenshot({ path: "test-results/oriel-handoff.png" });
});

test("ORIEL-F25 a rail rule hands a deletion to you and leaves a draft alone", async ({ page }) => {
  await page.goto("/");
  const rule = page.getByTestId("rule-delete");
  await expect(rule).toHaveAttribute("aria-pressed", "false");
  await rule.click();
  await expect(rule).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.getByTestId("composer").fill("Draft the weekly close");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("synthesis")).toBeVisible();
  await expect(page.getByTestId("thread")).toContainText("Draft the weekly close");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Delete the shared project files");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toContainText("Hand off to you");
  await expect(page.getByTestId("handoff")).toContainText("Delete that yourself");
  await expect(page.getByTestId("synthesis")).toContainText("Your rule hands the deletion to you");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await page.getByTestId("did-this").click();
  await expect(page.getByTestId("thread")).toContainText("did not type a password");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");
  const tick = await page.request.post("/api/tick", { data: { force: true } });
  expect(tick.ok()).toBeTruthy();
  await page.reload();
  await expect(page.locator("[data-testid^='goal-goal_']")).toHaveCount(2);
  await expect(page.getByText("Routine", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("rule-delete")).toHaveAttribute("aria-pressed", "true");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByTestId("rule-delete")).toBeVisible();
  await page.screenshot({ path: "test-results/oriel-rule.png" });
});

test("ORIEL-F26 a phrase hands over only the deletion that mentions it", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("rule-phrase-action").selectOption("delete");
  await page.getByTestId("rule-phrase").fill("ab");
  await page.getByTestId("rule-phrase-save").click();
  await expect(page.getByTestId("error")).toContainText("Name the words that narrow this step.");
  await expect(page.getByTestId("rule-delete")).toHaveAttribute("aria-pressed", "false");
  await page.getByTestId("rule-phrase").fill("shared project files");
  await page.getByTestId("rule-phrase-save").click();
  await expect(page.getByTestId("rule-delete")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("shared project files");
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.getByTestId("composer").fill("Draft the weekly close");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("synthesis")).toBeVisible();
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval")).toContainText("Release a deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Delete the shared project files");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toContainText("Hand off to you");
  await expect(page.getByTestId("handoff")).toContainText("shared project files");
  await expect(page.getByTestId("synthesis")).toContainText("when the request mentions “shared project files”");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator("[data-testid^='away-approve-']")).toBeVisible();
  await page.getByTestId("did-this").click();
  await expect(page.getByTestId("thread")).toContainText("did not type a password");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");
  await expect(page.locator("[data-testid^='away-approve-']")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.getByTestId("rule-phrase").scrollIntoViewIfNeeded();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByTestId("rule-phrase-delete")).toBeVisible();
  await page.getByTestId("handoff").scrollIntoViewIfNeeded();
  await expect(page.getByTestId("handoff")).toBeVisible();
  await expect(page.getByTestId("handoff")).toContainText("You did this");
  await page.screenshot({ path: "test-results/oriel-phrase.png" });
});

test("an earlier hold can be released from the return card", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Email Maya the launch update");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approve")).toBeVisible();
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Compare the market landscape");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.getByTestId("away-card")).toContainText("Release a send");
  await page.locator("[data-testid^='away-approve-']").click();
  await expect(page.getByTestId("thread")).toContainText("Nothing left this computer");
  await expect(page.locator("[data-testid^='away-approve-']")).toHaveCount(0);
  await expect(page.getByTestId("thread")).not.toContainText("I sent");
});

test("a phone in the dark still fits the composer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.getByTestId("composer")).toBeVisible();
  const metrics = await page.evaluate(() => {
    const bg = getComputedStyle(document.body).backgroundColor;
    return {
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      bg,
    };
  });
  expect(metrics.overflow).toBe(false);
  const channels = metrics.bg.match(/\d+/g)?.map(Number) ?? [];
  expect((channels[0] ?? 255) + (channels[1] ?? 255) + (channels[2] ?? 255)).toBeLessThan(120);
  await page.screenshot({ path: "test-results/oriel-phone.png" });
});
