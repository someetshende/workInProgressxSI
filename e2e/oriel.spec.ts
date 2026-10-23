import { spawn, type ChildProcess } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

async function bringIntoView(page: Page, testId: string) {
  const locator = page.getByTestId(testId);
  await expect(locator).toBeVisible();
  await locator.evaluate((node) => node.scrollIntoView({ block: "center", inline: "nearest" }));
}

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
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByTestId("rule-phrase-delete")).toBeVisible();
  await bringIntoView(page, "handoff");
  await expect(page.getByTestId("handoff")).toBeVisible();
  await expect(page.getByTestId("handoff")).toContainText("You did this");
  await page.screenshot({ path: "test-results/oriel-phrase.png" });
});

test("ORIEL-F27 a sentence names the words and does not open a card", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Hand deletions that mention ab to me");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("error")).toContainText("short phrase");
  await expect(page.getByTestId("rule-delete")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await page.getByTestId("composer").fill("Hand notes that mention shared project files to me");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("thread")).toContainText("did not save a rule");
  await expect(page.getByTestId("thread")).toContainText("did not open a card");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.getByTestId("rule-phrase-delete")).toHaveCount(0);
  await page.getByTestId("composer").fill("Hand deletions that mention shared project files to me");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("thread")).toContainText("Saved one handoff rule for a delete");
  await expect(page.getByTestId("thread")).toContainText("did not approve a hold");
  await expect(page.getByTestId("rule-delete")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.getByTestId("composer").fill("Hand deletions that mention shared project files to me");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("thread")).toContainText("already saved");
  await expect(page.getByTestId("rule-phrase-delete")).toHaveCount(1);
  await page.getByTestId("composer").fill("Hand the weekly close to me");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("synthesis")).toBeVisible();
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.getByTestId("rule-phrase-delete")).toHaveCount(1);
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Draft the weekly close");
  await page.getByTestId("send").click();
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
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await page.getByTestId("did-this").click();
  await expect(page.getByTestId("thread")).toContainText("did not type a password");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByTestId("rule-phrase-delete")).toBeVisible();
  await bringIntoView(page, "handoff");
  await expect(page.getByTestId("handoff")).toBeVisible();
  await page.screenshot({ path: "test-results/oriel-spoken.png" });
});

test("ORIEL-F28 a sentence clears the saved words and a deletion stays held", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Stop handing deletions that mention ab to me");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("error")).toContainText("short phrase");
  await expect(page.getByTestId("rule-delete")).toHaveAttribute("aria-pressed", "false");
  await page.getByTestId("composer").fill("Hand deletions that mention shared project files to me");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("rule-delete")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await page.getByTestId("composer").fill("Stop handing deletions that mention the vendor archive to me");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("thread")).toContainText("not the saved phrase");
  await expect(page.getByTestId("thread")).toContainText("did not open a card");
  await expect(page.getByTestId("rule-delete")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await page.getByTestId("composer").fill("Stop handing notes that mention shared project files to me");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("thread")).toContainText("did not clear a rule");
  await expect(page.getByTestId("rule-phrase-delete")).toHaveCount(1);
  await page.getByTestId("composer").fill("Stop handing deletions that mention shared project files to me and delete them");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toContainText("Hand off to you");
  await expect(page.getByTestId("handoff")).toContainText("shared project files");
  await expect(page.getByTestId("rule-delete")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await page.getByTestId("composer").fill("Stop handing deletions that mention shared project files to me");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("thread")).toContainText("Cleared the one handoff rule for a delete");
  await expect(page.getByTestId("thread")).toContainText("did not approve a hold");
  await expect(page.getByTestId("rule-delete")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("rule-phrase-delete")).toHaveCount(0);
  await expect(page.getByTestId("handoff")).toContainText("Hand off to you");
  await expect(page.getByTestId("did-this")).toBeVisible();
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Delete the shared project files");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval")).toContainText("Release a deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("away-handoff")).toContainText("Hand off to you");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByTestId("approval")).toBeVisible();
  await page.screenshot({ path: "test-results/oriel-clear.png" });
});

test("ORIEL-F29 a sentence clears a rule with no words and leaves a phrased rule", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Stop handing deletions to me");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("thread")).toContainText("no handoff rule");
  await expect(page.getByTestId("thread")).toContainText("did not open a card");
  await expect(page.getByTestId("rule-delete")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-delete")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("rule-phrase-delete")).toHaveCount(0);
  await page.getByTestId("composer").fill("Stop handing deletions to me and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toContainText("Hand off to you");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.getByTestId("rule-delete")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");
  await page.getByTestId("composer").fill("Stop handing deletions to me");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("thread")).toContainText("Cleared the one handoff rule for a delete");
  await expect(page.getByTestId("thread")).toContainText("did not approve a hold");
  await expect(page.getByTestId("rule-delete")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("did-this")).toBeVisible();
  await page.getByTestId("composer").fill("Hand deletions that mention shared project files to me");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await page.getByTestId("composer").fill("Stop handing deletions to me");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("thread")).toContainText("does not clear it");
  await expect(page.getByTestId("thread")).toContainText("shared project files");
  await expect(page.getByTestId("rule-delete")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("rule-phrase-delete")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval")).toContainText("Release a deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("away-handoff")).toContainText("Hand off to you");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByTestId("approval")).toBeVisible();
  await page.screenshot({ path: "test-results/oriel-clear-whole.png" });
});

test("ORIEL-F30 a sentence reads the handoff rules and does not act", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("What is handed to me?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("Nothing is handed to you");
  await expect(reply()).toContainText("no handoff rule");
  await expect(reply()).toContainText("did not open a card");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.getByTestId("rule-delete")).toHaveAttribute("aria-pressed", "false");

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-delete")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("composer").fill("What's handed to me");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("This step is handed to you");
  await expect(reply()).toContainText("the whole deletion");
  await expect(reply()).toContainText("did not approve a hold");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("What is handed to me and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toContainText("Hand off to you");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.getByTestId("rule-delete")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("composer").fill("Please, what is handed to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("the whole deletion");
  await expect(reply()).toContainText("did not open a card");
  await expect(page.getByTestId("did-this")).toBeVisible();
  await expect(page.getByTestId("rule-delete")).toHaveAttribute("aria-pressed", "true");

  await page.getByTestId("composer").fill("Hand deletions that mention shared project files to me");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("rule-whole-delete")).toHaveCount(0);
  await page.getByTestId("composer").fill("Which steps are handed to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("only");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("the whole deletion");
  await expect(page.getByTestId("did-this")).toBeVisible();

  await page.getByTestId("rule-send").click();
  await expect(page.getByTestId("rule-whole-send")).toContainText("the whole send");
  await page.getByTestId("composer").fill("What is handed to you?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps are handed to you");
  await expect(reply()).toContainText("the whole send");
  await expect(reply()).toContainText("shared project files");

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await page.getByTestId("composer").fill("What is handed to me?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await expect(reply()).toContainText("These steps are handed to you");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");

  await page.getByTestId("composer").fill("Hand deletions to me");
  await page.getByTestId("send").click();
  await expect(reply()).not.toContainText("These steps are handed to you");
  await expect(reply()).not.toContainText("Nothing is handed to you");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("rule-whole-send")).toContainText("the whole send");
  await expect(page.getByTestId("away-handoff")).toContainText("Hand off to you");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval")).toContainText("Release a deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByTestId("approval")).toBeVisible();
  await page.screenshot({ path: "test-results/oriel-read-rules.png" });
});

test("ORIEL-F31 a sentence asks about one handoff and does not act", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Is a deletion handed to me?");
  await page.getByTestId("composer").fill("Is a deletion handed to me?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("The deletion is not handed to you");
  await expect(reply()).toContainText("no handoff rule for a deletion");
  await expect(reply()).toContainText("named no other step");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("Nothing is handed to you");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.getByTestId("rule-delete")).toHaveAttribute("aria-pressed", "false");

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("rule-send").click();
  await expect(page.getByTestId("rule-whole-send")).toContainText("the whole send");
  await page.getByTestId("composer").fill("Please, is a deletion handed to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion is handed to you");
  await expect(reply()).toContainText("the whole deletion");
  await expect(reply()).toContainText("named no other step");
  await expect(reply()).not.toContainText("the whole send");
  await expect(reply()).not.toContainText("These steps are handed to you");
  await expect(reply()).toContainText("did not approve a hold");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("What is handed to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps are handed to you");
  await expect(reply()).toContainText("the whole send");
  await expect(reply()).toContainText("the whole deletion");

  await page.getByTestId("composer").fill("Hand deletions that mention shared project files to me");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("rule-whole-delete")).toHaveCount(0);
  await page.getByTestId("composer").fill("Is the deletion handed to you?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("only");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("the whole deletion");
  await expect(reply()).not.toContainText("the whole send");
  await expect(page.getByTestId("rule-whole-send")).toContainText("the whole send");

  await page.getByTestId("composer").fill("Is a send handed to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("the whole send");
  await expect(reply()).not.toContainText("shared project files");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await page.getByTestId("composer").fill("Are deletions handed to me?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("the whole send");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await page.getByTestId("composer").fill("Is a deletion handed to me and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval")).toContainText("Release a deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Is a deletion handed to me and delete the shared project files");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toContainText("Hand off to you");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(reply()).not.toContainText("named no other step");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("composer").fill("Hand deletions to me");
  await page.getByTestId("send").click();
  await expect(reply()).not.toContainText("named no other step");
  await expect(reply()).not.toContainText("The deletion is not handed to you");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("rule-whole-send")).toContainText("the whole send");
  await expect(page.getByTestId("away-handoff")).toContainText("Hand off to you");

  await page.getByTestId("composer").fill("Is a note handed to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does not name a send");
  await expect(reply()).toContainText("did not open a card");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("away-handoff")).toContainText("Hand off to you");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByTestId("away-handoff")).toBeVisible();
  await page.screenshot({ path: "test-results/oriel-ask-one.png" });
});

test("ORIEL-F32 a sentence asks whether the saved words are the ones and does not act", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Is a deletion that mentions shared project files handed to me?");
  await expect(page.locator(".rule-note")).toContainText("Is a deletion handed to me?");
  await page.getByTestId("composer").fill("Is a deletion that mentions shared project files handed to me?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("The deletion is not handed to you");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).toContainText("named no other step");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("Nothing is handed to you");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("rule-send").click();
  await expect(page.getByTestId("rule-whole-send")).toContainText("the whole send");
  await page.getByTestId("composer").fill("Please, is a deletion that mentions shared project files handed to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("has no such words");
  await expect(reply()).toContainText("did not treat this question as the whole deletion");
  await expect(reply()).not.toContainText("is the whole deletion");
  await expect(reply()).not.toContainText("is only");
  await expect(reply()).not.toContainText("the whole send");
  await expect(reply()).toContainText("named no other step");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");

  await page.getByTestId("composer").fill("Is a deletion handed to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("is the whole deletion");
  await expect(reply()).not.toContainText("has no such words");
  await expect(reply()).not.toContainText("the whole send");

  await page.getByTestId("composer").fill("What is handed to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps are handed to you");
  await expect(reply()).toContainText("the whole send");
  await expect(reply()).toContainText("the whole deletion");

  await page.getByTestId("composer").fill("Hand deletions that mention shared project files to me");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("rule-whole-delete")).toHaveCount(0);
  await page.getByTestId("composer").fill("Is a deletion that mentions shared project files handed to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("only");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("has no such words");
  await expect(reply()).not.toContainText("the whole send");
  await expect(page.getByTestId("rule-whole-send")).toContainText("the whole send");

  await page.getByTestId("composer").fill("Is a deletion handed to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("only");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("has no such words");
  await expect(reply()).not.toContainText("the whole send");

  await page.getByTestId("composer").fill("Is a deletion that mentions the vendor archive handed to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The saved words are");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).toContainText("Those are not");
  await expect(reply()).toContainText("the vendor archive");
  await expect(reply()).not.toContainText("the whole send");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await page.getByTestId("composer").fill("Are deletions that mention shared project files handed to me?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await expect(reply()).toContainText("only");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("the whole send");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await page.getByTestId("composer").fill("Is a deletion that mentions the vendor archive handed to me and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval")).toContainText("Release a deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Is a deletion that mentions shared project files handed to me and delete the shared project files");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toContainText("Hand off to you");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(reply()).not.toContainText("named no other step");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("composer").fill("Hand deletions to me");
  await page.getByTestId("send").click();
  await expect(reply()).not.toContainText("has no such words");
  await expect(reply()).not.toContainText("The saved words are");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("rule-whole-send")).toContainText("the whole send");

  await page.getByTestId("composer").fill("Is a note that mentions shared project files handed to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does not name a send");
  await expect(reply()).toContainText("did not open a card");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");

  await page.getByTestId("composer").fill("What is handed to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps are handed to you");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).toContainText("the whole send");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByTestId("away-handoff")).toBeVisible();
  await page.screenshot({ path: "test-results/oriel-ask-words.png" });
});

test("ORIEL-F33 a sentence asks which words a step uses and does not act", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Which words does a deletion hand to me?");
  await expect(page.locator(".rule-note")).toContainText("Is a deletion that mentions shared project files handed to me?");
  await page.getByTestId("composer").fill("Which words does a deletion hand to me?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("The deletion is not handed to you");
  await expect(reply()).toContainText("named no other step");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("names no words");
  await expect(reply()).not.toContainText("Nothing is handed to you");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("rule-send").click();
  await expect(page.getByTestId("rule-whole-send")).toContainText("the whole send");
  await page.getByTestId("composer").fill("Please, which words does the deletion hand to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("names no words");
  await expect(reply()).toContainText("is the whole deletion");
  await expect(reply()).not.toContainText("The words are");
  await expect(reply()).not.toContainText("the whole send");
  await expect(reply()).toContainText("named no other step");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");

  await page.getByTestId("composer").fill("Is a deletion handed to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("is the whole deletion");
  await expect(reply()).not.toContainText("names no words");
  await expect(reply()).not.toContainText("the whole send");

  await page.getByTestId("composer").fill("What is handed to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps are handed to you");
  await expect(reply()).toContainText("the whole send");
  await expect(reply()).toContainText("the whole deletion");

  await page.getByTestId("composer").fill("Hand deletions that mention shared project files to me");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("rule-whole-delete")).toHaveCount(0);
  await page.getByTestId("composer").fill("Which words does a deletion hand to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The words are");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("names no words");
  await expect(reply()).not.toContainText("the whole send");
  await expect(page.getByTestId("rule-whole-send")).toContainText("the whole send");

  await page.getByTestId("composer").fill("Is a deletion that mentions shared project files handed to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("only");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("The words are");
  await expect(reply()).not.toContainText("names no words");
  await expect(reply()).not.toContainText("the whole send");

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await page.getByTestId("composer").fill("Which words do deletions hand to me?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await expect(reply()).toContainText("The words are");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("the whole send");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a deletion handed to me and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval")).toContainText("Release a deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which words does a deletion handed to me and delete the shared project files");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toContainText("Hand off to you");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(reply()).not.toContainText("named no other step");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("composer").fill("Hand deletions to me");
  await page.getByTestId("send").click();
  await expect(reply()).not.toContainText("The words are");
  await expect(reply()).not.toContainText("names no words");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("rule-whole-send")).toContainText("the whole send");

  await page.getByTestId("composer").fill("Which words does a note hand to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does not name a send");
  await expect(reply()).toContainText("did not open a card");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");

  await page.getByTestId("composer").fill("What is handed to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps are handed to you");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).toContainText("the whole send");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByTestId("away-handoff")).toBeVisible();
  await page.screenshot({ path: "test-results/oriel-which-words.png" });
});

test("ORIEL-F34 a sentence asks which step uses certain words and does not act", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Which step mentions shared project files?");
  await expect(page.locator(".rule-note")).toContainText("Which words does a deletion hand to me?");
  await page.getByTestId("composer").fill("Which step mentions shared project files?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("No step mentions");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).toContainText("named no other step");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("The deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("rule-send").click();
  await expect(page.getByTestId("rule-whole-send")).toContainText("the whole send");
  await page.getByTestId("composer").fill("Please, which step mentions shared project files?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("No step mentions");
  await expect(reply()).not.toContainText("the whole deletion");
  await expect(reply()).not.toContainText("the whole send");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");

  await page.getByTestId("rule-phrase-action").selectOption("delete");
  await page.getByTestId("rule-phrase").click();
  await page.getByTestId("rule-phrase").fill("shared project files");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("shared project files");
  await page.getByTestId("rule-phrase-save").click();
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await page.getByTestId("composer").fill("Which step mentions shared project files?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion mentions");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("the whole send");
  await expect(reply()).not.toContainText("These steps mention");
  await expect(page.getByTestId("rule-whole-send")).toContainText("the whole send");

  await page.getByTestId("rule-phrase-action").selectOption("pay");
  await page.getByTestId("rule-phrase").fill("shared project files");
  await page.getByTestId("rule-phrase-save").click();
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("shared project files");
  await page.getByTestId("composer").fill("Which steps mention “Shared Project Files”?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps mention");
  await expect(reply()).toContainText("The payment mentions");
  await expect(reply()).toContainText("The deletion mentions");
  await expect(reply()).not.toContainText("the whole send");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await page.getByTestId("composer").fill("Which step mentioning shared project files to me?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await expect(reply()).toContainText("The deletion mentions");
  await expect(reply()).toContainText("The payment mentions");
  await expect(reply()).not.toContainText("the whole send");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which step mentions the vendor archive and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval")).toContainText("Release a deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which step mentions shared project files and delete the shared project files");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toContainText("Hand off to you");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(reply()).not.toContainText("named no other step");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("composer").fill("Hand deletions to me");
  await page.getByTestId("send").click();
  await expect(reply()).not.toContainText("No step mentions");
  await expect(reply()).not.toContainText("These steps mention");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("rule-whole-send")).toContainText("the whole send");

  await page.getByTestId("composer").fill("Which words does a deletion hand to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The words are");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("No step mentions");
  await expect(reply()).not.toContainText("the whole send");

  await page.getByTestId("composer").fill("What is handed to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps are handed to you");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).toContainText("the whole send");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByTestId("away-handoff")).toBeVisible();
  await page.screenshot({ path: "test-results/oriel-which-step.png" });
});

test("ORIEL-F35 a sentence asks which steps name no words and does not act", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Which steps name no words?");
  await expect(page.locator(".rule-note")).toContainText("Which step mentions shared project files?");
  await page.getByTestId("composer").fill("Which steps name no words?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("No step names no words");
  await expect(reply()).toContainText("named no other step");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("The deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("rule-send").click();
  await expect(page.getByTestId("rule-whole-send")).toContainText("the whole send");
  await page.getByTestId("composer").fill("Please, which steps name no words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps name no words");
  await expect(reply()).toContainText("the whole deletion");
  await expect(reply()).toContainText("the whole send");
  await expect(reply()).not.toContainText("The payment");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await page.getByTestId("rule-phrase-action").selectOption("delete");
  await page.getByTestId("rule-phrase").click();
  await page.getByTestId("rule-phrase").fill("shared project files");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("shared project files");
  await page.getByTestId("rule-phrase-save").click();
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await page.getByTestId("composer").fill("Which step names no words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("the whole send");
  await expect(reply()).not.toContainText("shared project files");
  await expect(reply()).not.toContainText("The deletion");
  await expect(reply()).not.toContainText("These steps name no words");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");

  await page.getByTestId("rule-post").click();
  await expect(page.getByTestId("rule-whole-post")).toContainText("the whole public post");
  await page.getByTestId("composer").fill("Which steps naming no words to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps name no words");
  await expect(reply()).toContainText("the whole send");
  await expect(reply()).toContainText("the whole public post");
  await expect(reply()).not.toContainText("shared project files");
  await expect(reply()).not.toContainText("The deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await page.getByTestId("composer").fill("Which steps name no words handed over to you?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await expect(reply()).toContainText("the whole send");
  await expect(reply()).toContainText("the whole public post");
  await expect(reply()).not.toContainText("shared project files");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which steps name no words and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval")).toContainText("Release a deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-phrase-delete")).toHaveCount(0);
  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which steps name no words and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toContainText("Hand off to you");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(reply()).not.toContainText("No step names no words");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("composer").fill("Hand deletions to me");
  await page.getByTestId("send").click();
  await expect(reply()).not.toContainText("No step names no words");
  await expect(reply()).not.toContainText("These steps name no words");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("rule-whole-send")).toContainText("the whole send");

  await page.getByTestId("composer").fill("Which words does a deletion hand to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("names no words");
  await expect(reply()).toContainText("the whole deletion");
  await expect(reply()).not.toContainText("No step names no words");
  await expect(reply()).not.toContainText("the whole send");

  await page.getByTestId("composer").fill("Which step mentions shared project files?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("No step mentions");
  await expect(reply()).not.toContainText("No step names no words");

  await page.getByTestId("composer").fill("What is handed to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps are handed to you");
  await expect(reply()).toContainText("the whole deletion");
  await expect(reply()).toContainText("the whole send");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByTestId("away-handoff")).toBeVisible();
  await page.screenshot({ path: "test-results/oriel-unnamed-steps.png" });
});

test("ORIEL-F36 a sentence asks which steps name words and does not act", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Which steps name words?");
  await expect(page.locator(".rule-note")).toContainText("Which steps name no words?");
  await page.getByTestId("composer").fill("Which steps name words?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("No step names words");
  await expect(reply()).toContainText("named no other step");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("The deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("rule-pay").click();
  await expect(page.getByTestId("rule-whole-pay")).toContainText("the whole payment");
  await page.getByTestId("composer").fill("Please, which steps name words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("No step names words");
  await expect(reply()).not.toContainText("The deletion");
  await expect(reply()).not.toContainText("The payment");
  await expect(reply()).not.toContainText("the whole");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await page.getByTestId("rule-phrase-action").selectOption("delete");
  await page.getByTestId("rule-phrase").click();
  await page.getByTestId("rule-phrase").fill("shared project files");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("shared project files");
  await page.getByTestId("rule-phrase-save").click();
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await page.getByTestId("rule-phrase-action").selectOption("send");
  await page.getByTestId("rule-phrase").fill("the vendor files");
  await page.getByTestId("rule-phrase-save").click();
  await expect(page.getByTestId("rule-phrase-send")).toContainText("the vendor files");
  await page.getByTestId("composer").fill("Which step names words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps name words");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).toContainText("the vendor files");
  await expect(reply()).not.toContainText("The payment");
  await expect(reply()).not.toContainText("the whole");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await page.getByTestId("composer").fill("Which steps naming words handed over to you?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).toContainText("the vendor files");
  await expect(reply()).not.toContainText("The payment");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which steps name no words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("the whole payment");
  await expect(reply()).not.toContainText("shared project files");
  await expect(reply()).not.toContainText("These steps name words");

  await page.getByTestId("composer").fill("Which steps name words and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval")).toContainText("Release a deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-phrase-delete")).toHaveCount(0);
  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which steps name words and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toContainText("Hand off to you");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(reply()).not.toContainText("No step names words");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("composer").fill("Hand deletions to me");
  await page.getByTestId("send").click();
  await expect(reply()).not.toContainText("No step names words");
  await expect(reply()).not.toContainText("These steps name words");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("rule-phrase-send")).toContainText("the vendor files");

  await page.getByTestId("composer").fill("Which words does a deletion hand to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("names no words");
  await expect(reply()).toContainText("the whole deletion");
  await expect(reply()).not.toContainText("No step names words");
  await expect(reply()).not.toContainText("the vendor files");

  await page.getByTestId("composer").fill("Which step mentions shared project files?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("No step mentions");
  await expect(reply()).not.toContainText("No step names words");

  await page.getByTestId("composer").fill("What is handed to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps are handed to you");
  await expect(reply()).toContainText("the whole deletion");
  await expect(reply()).toContainText("the vendor files");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByTestId("away-handoff")).toBeVisible();
  await page.screenshot({ path: "test-results/oriel-named-steps.png" });
});

test("ORIEL-F37 a sentence asks which steps share words and does not act", async ({ page }) => {
  async function narrow(action: string, phrase: string) {
    await page.getByTestId("rule-phrase-action").selectOption(action);
    await expect(page.getByTestId("rule-phrase-action")).toHaveValue(action);
    const input = page.getByTestId("rule-phrase");
    await input.click();
    await input.fill(phrase);
    await expect(input).toHaveValue(phrase);
    const saved = page.waitForResponse(
      (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
    );
    await page.getByTestId("rule-phrase-save").click();
    await saved;
  }

  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Which steps share words?");
  await expect(page.locator(".rule-note")).toContainText("Which steps name words?");
  await page.getByTestId("composer").fill("Which steps share words?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("No steps share words");
  await expect(reply()).toContainText("named no other step");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("The deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("rule-pay").click();
  await expect(page.getByTestId("rule-whole-pay")).toContainText("the whole payment");
  await page.getByTestId("composer").fill("Please, which step shares words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("No steps share words");
  await expect(reply()).not.toContainText("The deletion");
  await expect(reply()).not.toContainText("The payment");
  await expect(reply()).not.toContainText("the whole");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await narrow("delete", "shared project files");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await narrow("send", "the vendor files");
  await expect(page.getByTestId("rule-phrase-send")).toContainText("the vendor files");
  await narrow("pay", "the vendor invoice");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("the vendor invoice");
  await page.getByTestId("composer").fill("Which steps share words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("No steps share words");
  await expect(reply()).not.toContainText("shared project files");
  await expect(reply()).not.toContainText("the vendor files");
  await expect(reply()).not.toContainText("The payment");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await page.getByTestId("composer").fill("Hand sends that mention shared project files to me");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("Updated the one handoff rule for a send");
  await expect(page.getByTestId("rule-phrase-send")).toContainText("shared project files");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await page.getByTestId("composer").fill("Which steps sharing words to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps share words");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("The payment");
  await expect(reply()).not.toContainText("the whole");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await page.getByTestId("composer").fill("Which step shares words handed over to you?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await expect(reply()).toContainText("These steps share words");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("The payment");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which steps name words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps name words");
  await expect(reply()).toContainText("the vendor invoice");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("These steps share words");

  await page.getByTestId("composer").fill("Which steps share words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps share words");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("the vendor invoice");
  await expect(reply()).not.toContainText("The payment");

  await page.getByTestId("composer").fill("Which steps share words and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval")).toContainText("Release a deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-phrase-delete")).toHaveCount(0);
  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which steps share words and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toContainText("Hand off to you");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(reply()).not.toContainText("No steps share words");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("composer").fill("Hand deletions to me");
  await page.getByTestId("send").click();
  await expect(reply()).not.toContainText("No steps share words");
  await expect(reply()).not.toContainText("These steps share words");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("rule-phrase-send")).toContainText("shared project files");

  await page.getByTestId("composer").fill("Which steps name no words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("the whole deletion");
  await expect(reply()).not.toContainText("shared project files");
  await expect(reply()).not.toContainText("These steps share words");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByTestId("away-handoff")).toBeVisible();
  await page.screenshot({ path: "test-results/oriel-shared-steps.png" });
});

test("ORIEL-F38 a sentence asks which words are shared and does not act", async ({ page }) => {
  async function narrow(action: string, phrase: string) {
    await page.getByTestId("rule-phrase-action").selectOption(action);
    await expect(page.getByTestId("rule-phrase-action")).toHaveValue(action);
    const input = page.getByTestId("rule-phrase");
    await input.click();
    await input.fill(phrase);
    await expect(input).toHaveValue(phrase);
    const saved = page.waitForResponse(
      (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
    );
    await page.getByTestId("rule-phrase-save").click();
    await saved;
  }

  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Which words are shared?");
  await expect(page.locator(".rule-note")).toContainText("Which steps share words?");
  await page.getByTestId("composer").fill("Which words are shared?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("No words are shared");
  await expect(reply()).toContainText("named no other step");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("The deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("rule-pay").click();
  await expect(page.getByTestId("rule-whole-pay")).toContainText("the whole payment");
  await page.getByTestId("composer").fill("Please, which word is shared?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("No words are shared");
  await expect(reply()).not.toContainText("The deletion");
  await expect(reply()).not.toContainText("The payment");
  await expect(reply()).not.toContainText("the whole");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await narrow("delete", "shared project files");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await narrow("send", "the vendor files");
  await expect(page.getByTestId("rule-phrase-send")).toContainText("the vendor files");
  await narrow("pay", "the vendor invoice");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("the vendor invoice");
  await page.getByTestId("rule-phrase-action").selectOption("delete");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("shared project files");
  await page.getByTestId("rule-phrase").fill("notes I just typed");
  await page.getByTestId("rule-phrase-action").dispatchEvent("change");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("notes I just typed");
  await page.getByTestId("rule-phrase-action").selectOption("pay");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("the vendor invoice");
  await page.getByTestId("composer").fill("Which words are shared?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("No words are shared");
  await expect(reply()).not.toContainText("shared project files");
  await expect(reply()).not.toContainText("the vendor files");
  await expect(reply()).not.toContainText("The payment");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await page.getByTestId("composer").fill("Hand sends that mention shared project files to me");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("Updated the one handoff rule for a send");
  await expect(page.getByTestId("rule-phrase-send")).toContainText("shared project files");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await page.getByTestId("composer").fill("Which words are shared to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These words are shared");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).toContainText("The send and The deletion");
  await expect(reply()).not.toContainText("The payment");
  await expect(reply()).not.toContainText("the vendor invoice");
  await expect(reply()).not.toContainText("the whole");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await page.getByTestId("composer").fill("Which word is shared handed over to you?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await expect(reply()).toContainText("These words are shared");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("The payment");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which steps name words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps name words");
  await expect(reply()).toContainText("the vendor invoice");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("These words are shared");

  await page.getByTestId("composer").fill("Which steps share words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps share words");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("These words are shared");
  await expect(reply()).not.toContainText("the vendor invoice");

  await page.getByTestId("composer").fill("Which words are shared and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval")).toContainText("Release a deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-phrase-delete")).toHaveCount(0);
  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which words are shared and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toContainText("Hand off to you");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(reply()).not.toContainText("No words are shared");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("composer").fill("Hand deletions to me");
  await page.getByTestId("send").click();
  await expect(reply()).not.toContainText("No words are shared");
  await expect(reply()).not.toContainText("These words are shared");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("rule-phrase-send")).toContainText("shared project files");

  await page.getByTestId("composer").fill("Which steps name no words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("the whole deletion");
  await expect(reply()).not.toContainText("shared project files");
  await expect(reply()).not.toContainText("These words are shared");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByTestId("away-handoff")).toBeVisible();
  await page.screenshot({ path: "test-results/oriel-shared-words.png" });
});

test("ORIEL-F39 a sentence asks which words are not shared and does not act", async ({ page }) => {
  async function chooseAction(action: string) {
    const picker = page.getByTestId("rule-phrase-action");
    await expect(async () => {
      await picker.selectOption(action);
      await expect(picker).toHaveValue(action, { timeout: 500 });
    }).toPass();
  }

  async function narrow(action: string, phrase: string) {
    await chooseAction(action);
    const input = page.getByTestId("rule-phrase");
    await input.click();
    await input.fill(phrase);
    await expect(input).toHaveValue(phrase);
    await expect(page.getByTestId("rule-phrase-action")).toHaveValue(action);
    const saved = page.waitForResponse(
      (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
    );
    await page.getByTestId("rule-phrase-save").click();
    await saved;
  }

  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Which words are not shared?");
  await expect(page.locator(".rule-note")).toContainText("Which words are shared?");
  await page.getByTestId("composer").fill("Which words are not shared?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("No words are used once");
  await expect(reply()).toContainText("named no other step");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("The deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("rule-pay").click();
  await expect(page.getByTestId("rule-whole-pay")).toContainText("the whole payment");
  await narrow("send", "shared project files");
  await expect(page.getByTestId("rule-phrase-send")).toContainText("shared project files");
  await narrow("post", "shared project files");
  await expect(page.getByTestId("rule-phrase-post")).toContainText("shared project files");
  await page.getByTestId("composer").fill("Please, which word is not shared?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("No words are used once");
  await expect(reply()).not.toContainText("The deletion");
  await expect(reply()).not.toContainText("The payment");
  await expect(reply()).not.toContainText("The send");
  await expect(reply()).not.toContainText("shared project files");
  await expect(reply()).not.toContainText("the whole");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await narrow("pay", "the vendor invoice");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("the vendor invoice");
  await chooseAction("pay");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("the vendor invoice");
  await page.getByTestId("rule-phrase").fill("notes I just typed");
  await page.getByTestId("rule-phrase-action").dispatchEvent("change");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("notes I just typed");
  await chooseAction("send");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("shared project files");
  await page.getByTestId("composer").fill("Which words are not shared?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These words are used once");
  await expect(reply()).toContainText("the vendor invoice");
  await expect(reply()).toContainText("The payment");
  await expect(reply()).not.toContainText("The send");
  await expect(reply()).not.toContainText("The public post");
  await expect(reply()).not.toContainText("the whole");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await page.getByTestId("composer").fill("Which word is not shared handed over to you?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await expect(reply()).toContainText("These words are used once");
  await expect(reply()).toContainText("the vendor invoice");
  await expect(reply()).not.toContainText("The send");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words are shared?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These words are shared");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).toContainText("The send and The public post");
  await expect(reply()).not.toContainText("the vendor invoice");
  await expect(reply()).not.toContainText("These words are used once");

  await page.getByTestId("composer").fill("Which steps share words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps share words");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("These words are used once");
  await expect(reply()).not.toContainText("the vendor invoice");

  await page.getByTestId("composer").fill("Which steps name words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps name words");
  await expect(reply()).toContainText("the vendor invoice");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("These words are used once");

  await narrow("delete", "shared project files");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await page.getByTestId("composer").fill("Which words are not shared and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval")).toContainText("Release a deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(reply()).not.toContainText("No words are used once");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-phrase-delete")).toHaveCount(0);
  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which words are not shared and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toContainText("Hand off to you");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(reply()).not.toContainText("No words are used once");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("composer").fill("Hand deletions to me");
  await page.getByTestId("send").click();
  await expect(reply()).not.toContainText("No words are used once");
  await expect(reply()).not.toContainText("These words are used once");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("the vendor invoice");

  await page.getByTestId("composer").fill("Which steps name no words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("the whole deletion");
  await expect(reply()).not.toContainText("the vendor invoice");
  await expect(reply()).not.toContainText("These words are used once");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByTestId("away-handoff")).toBeVisible();
  await page.screenshot({ path: "test-results/oriel-unshared-words.png" });
});

test("ORIEL-F40 a sentence asks which steps do not share words and does not act", async ({ page }) => {
  async function chooseAction(action: string) {
    const picker = page.getByTestId("rule-phrase-action");
    await expect(async () => {
      await picker.selectOption(action);
      await expect(picker).toHaveValue(action, { timeout: 500 });
    }).toPass();
  }

  async function narrow(action: string, phrase: string) {
    await chooseAction(action);
    const input = page.getByTestId("rule-phrase");
    await input.click();
    await input.fill(phrase);
    await expect(input).toHaveValue(phrase);
    await expect(page.getByTestId("rule-phrase-action")).toHaveValue(action);
    const saved = page.waitForResponse(
      (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
    );
    await page.getByTestId("rule-phrase-save").click();
    await saved;
  }

  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Which steps do not share words?");
  await expect(page.locator(".rule-note")).toContainText("Which words are not shared?");
  await page.getByTestId("composer").fill("Which steps do not share words?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("No step uses words once");
  await expect(reply()).toContainText("named no other step");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("The deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("rule-pay").click();
  await expect(page.getByTestId("rule-whole-pay")).toContainText("the whole payment");
  await narrow("send", "shared project files");
  await expect(page.getByTestId("rule-phrase-send")).toContainText("shared project files");
  await narrow("post", "shared project files");
  await expect(page.getByTestId("rule-phrase-post")).toContainText("shared project files");
  await page.getByTestId("composer").fill("Please, which step does not share words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("No step uses words once");
  await expect(reply()).not.toContainText("The deletion");
  await expect(reply()).not.toContainText("The payment");
  await expect(reply()).not.toContainText("The send");
  await expect(reply()).not.toContainText("shared project files");
  await expect(reply()).not.toContainText("the whole");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await narrow("pay", "the vendor invoice");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("the vendor invoice");
  await chooseAction("pay");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("the vendor invoice");
  await page.getByTestId("rule-phrase").fill("notes I just typed");
  await page.getByTestId("rule-phrase-action").dispatchEvent("change");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("notes I just typed");
  await chooseAction("send");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("shared project files");
  await page.getByTestId("composer").fill("Which steps do not share words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps use words once");
  await expect(reply()).toContainText("the vendor invoice");
  await expect(reply()).toContainText("The payment");
  await expect(reply()).not.toContainText("The send");
  await expect(reply()).not.toContainText("The public post");
  await expect(reply()).not.toContainText("the whole");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await page.getByTestId("composer").fill("Which step does not share words handed over to you?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await expect(reply()).toContainText("These steps use words once");
  await expect(reply()).toContainText("the vendor invoice");
  await expect(reply()).not.toContainText("The send");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words are not shared?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These words are used once");
  await expect(reply()).toContainText("the vendor invoice");
  await expect(reply()).toContainText("The payment");
  await expect(reply()).not.toContainText("The send");
  await expect(reply()).not.toContainText("These steps use words once");

  await page.getByTestId("composer").fill("Which words are shared?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These words are shared");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).toContainText("The send and The public post");
  await expect(reply()).not.toContainText("the vendor invoice");
  await expect(reply()).not.toContainText("These steps use words once");

  await page.getByTestId("composer").fill("Which steps share words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps share words");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("These steps use words once");
  await expect(reply()).not.toContainText("the vendor invoice");

  await page.getByTestId("composer").fill("Which steps name words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps name words");
  await expect(reply()).toContainText("the vendor invoice");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("These steps use words once");

  await narrow("delete", "shared project files");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await page.getByTestId("composer").fill("Which steps do not share words on this saved desk and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval")).toContainText("Release a deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(reply()).not.toContainText("No step uses words once");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-phrase-delete")).toHaveCount(0);
  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which steps do not share words on this saved desk and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toContainText("Hand off to you");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(reply()).not.toContainText("No step uses words once");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("composer").fill("Hand deletions to me");
  await page.getByTestId("send").click();
  await expect(reply()).not.toContainText("No step uses words once");
  await expect(reply()).not.toContainText("These steps use words once");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("the vendor invoice");

  await page.getByTestId("composer").fill("Which steps name no words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("the whole deletion");
  await expect(reply()).not.toContainText("the vendor invoice");
  await expect(reply()).not.toContainText("These steps use words once");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByTestId("away-handoff")).toBeVisible();
  await page.screenshot({ path: "test-results/oriel-unshared-steps.png" });
});

test("ORIEL-F41 a sentence asks whether one step shares words and does not act", async ({ page }) => {
  async function chooseAction(action: string) {
    const picker = page.getByTestId("rule-phrase-action");
    await expect(async () => {
      await picker.selectOption(action);
      await expect(picker).toHaveValue(action, { timeout: 500 });
    }).toPass();
  }

  async function narrow(action: string, phrase: string) {
    await chooseAction(action);
    const input = page.getByTestId("rule-phrase");
    await input.click();
    await input.fill(phrase);
    await expect(input).toHaveValue(phrase);
    await expect(page.getByTestId("rule-phrase-action")).toHaveValue(action);
    const saved = page.waitForResponse(
      (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
    );
    await page.getByTestId("rule-phrase-save").click();
    await saved;
  }

  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Does a deletion share words?");
  await expect(page.locator(".rule-note")).toContainText("Which steps do not share words?");
  await page.getByTestId("composer").fill("Does a deletion share words?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("There is no handoff rule for a deletion");
  await expect(reply()).toContainText("named no other step");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("The send");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Does a note share words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does not name a send");
  await expect(reply()).toContainText("did not open a card");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("composer").fill("Does a deletion share words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("names no words and is the whole deletion");
  await expect(reply()).toContainText("did not treat this question as a share");
  await expect(reply()).not.toContainText("shares those words");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await narrow("send", "Shared Project Files");
  await expect(page.getByTestId("rule-phrase-send")).toContainText("Shared Project Files");
  await narrow("delete", "shared project files");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await narrow("pay", "unshared project files");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("unshared project files");
  await chooseAction("pay");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("unshared project files");
  await page.getByTestId("rule-phrase").fill("notes I just typed");
  await page.getByTestId("rule-phrase-action").dispatchEvent("change");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("notes I just typed");
  await chooseAction("delete");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("shared project files");
  await page.getByTestId("composer").fill("Please, does a deletion share words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion shares those words");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).toContainText("The send uses them");
  await expect(reply()).not.toContainText("The payment");
  await expect(reply()).not.toContainText("unshared project files");
  await expect(reply()).not.toContainText("the whole");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await page.getByTestId("composer").fill("Does a deletion share words handed over to you?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await expect(reply()).toContainText("The deletion shares those words");
  await expect(reply()).toContainText("The send uses them");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await page.getByTestId("composer").fill("Does a payment share words to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("Those words are used once");
  await expect(reply()).toContainText("unshared project files");
  await expect(reply()).not.toContainText("The deletion");
  await expect(reply()).not.toContainText("The send");
  await expect(reply()).not.toContainText("shares those words");

  await page.getByTestId("composer").fill("Which steps do not share words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps use words once");
  await expect(reply()).toContainText("unshared project files");
  await expect(reply()).not.toContainText("The deletion shares those words");

  await page.getByTestId("composer").fill("Which words are not shared?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These words are used once");
  await expect(reply()).toContainText("unshared project files");
  await expect(reply()).not.toContainText("The deletion shares those words");

  await page.getByTestId("composer").fill("Which words are shared?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These words are shared");
  await expect(reply()).toContainText("The send and The deletion");
  await expect(reply()).not.toContainText("unshared project files");
  await expect(reply()).not.toContainText("The deletion shares those words");

  await page.getByTestId("composer").fill("Which steps share words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps share words");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("The deletion shares those words");
  await expect(reply()).not.toContainText("unshared project files");

  await page.getByTestId("composer").fill("Does a deletion not share words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does share those words");
  await expect(reply()).not.toContainText("shares those words");
  await expect(reply()).not.toContainText("Those words are used once");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Does a deletion share words and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval")).toContainText("Release a deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(reply()).not.toContainText("shares those words");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-phrase-delete")).toHaveCount(0);
  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Does a deletion share words and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toContainText("Hand off to you");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(reply()).not.toContainText("shares those words");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("composer").fill("Hand deletions to me");
  await page.getByTestId("send").click();
  await expect(reply()).not.toContainText("shares those words");
  await expect(reply()).not.toContainText("Those words are used once");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("unshared project files");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByTestId("away-handoff")).toBeVisible();
  await page.screenshot({ path: "test-results/oriel-step-share.png" });
});

test("ORIEL-F42 a sentence asks whether one step does not share words and does not act", async ({ page }) => {
  async function chooseAction(action: string) {
    const picker = page.getByTestId("rule-phrase-action");
    await expect(async () => {
      await picker.selectOption(action);
      await expect(picker).toHaveValue(action, { timeout: 500 });
    }).toPass();
  }

  async function narrow(action: string, phrase: string) {
    await chooseAction(action);
    const input = page.getByTestId("rule-phrase");
    await input.click();
    await input.fill(phrase);
    await expect(input).toHaveValue(phrase);
    await expect(page.getByTestId("rule-phrase-action")).toHaveValue(action);
    const saved = page.waitForResponse(
      (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
    );
    await page.getByTestId("rule-phrase-save").click();
    await saved;
  }

  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Does a deletion not share words?");
  await expect(page.locator(".rule-note")).toContainText("Does a deletion share words?");
  await page.getByTestId("composer").fill("Does a deletion not share words?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("There is no handoff rule for a deletion");
  await expect(reply()).toContainText("named no other step");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("The send");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Does a note not share words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does not name a send");
  await expect(reply()).toContainText("did not open a card");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("composer").fill("Does a deletion not share words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("names no words and is the whole deletion");
  await expect(reply()).toContainText("did not treat this question as a share");
  await expect(reply()).not.toContainText("does share those words");
  await expect(reply()).not.toContainText("does not share those words");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await narrow("send", "Shared Project Files");
  await expect(page.getByTestId("rule-phrase-send")).toContainText("Shared Project Files");
  await narrow("delete", "shared project files");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await narrow("pay", "unshared project files");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("unshared project files");
  await chooseAction("pay");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("unshared project files");
  await page.getByTestId("rule-phrase").fill("notes I just typed");
  await page.getByTestId("rule-phrase-action").dispatchEvent("change");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("notes I just typed");
  await chooseAction("delete");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("shared project files");
  await page.getByTestId("composer").fill("Please, does a deletion not share words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion does share those words");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).toContainText("The send uses them");
  await expect(reply()).not.toContainText("The payment");
  await expect(reply()).not.toContainText("unshared project files");
  await expect(reply()).not.toContainText("the whole");
  await expect(reply()).not.toContainText("shares those words");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await page.getByTestId("composer").fill("Does a deletion not share words handed over to you?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await expect(reply()).toContainText("The deletion does share those words");
  await expect(reply()).toContainText("The send uses them");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await page.getByTestId("composer").fill("Does a payment not share words to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does not share those words");
  await expect(reply()).toContainText("unshared project files");
  await expect(reply()).not.toContainText("The deletion");
  await expect(reply()).not.toContainText("The send");
  await expect(reply()).not.toContainText("does share those words");
  await expect(reply()).not.toContainText("Those words are used once");

  await page.getByTestId("composer").fill("Does a deletion share words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion shares those words");
  await expect(reply()).toContainText("The send uses them");
  await expect(reply()).not.toContainText("does not share those words");

  await page.getByTestId("composer").fill("Which steps do not share words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps use words once");
  await expect(reply()).toContainText("unshared project files");
  await expect(reply()).not.toContainText("does not share those words");

  await page.getByTestId("composer").fill("Which words are not shared?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These words are used once");
  await expect(reply()).toContainText("unshared project files");

  await page.getByTestId("composer").fill("Which words are shared?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These words are shared");
  await expect(reply()).toContainText("The send and The deletion");
  await expect(reply()).not.toContainText("unshared project files");

  await page.getByTestId("composer").fill("Which steps share words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps share words");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("unshared project files");

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Does a deletion not share words and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval")).toContainText("Release a deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(reply()).not.toContainText("does share those words");
  await expect(reply()).not.toContainText("does not share those words");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-phrase-delete")).toHaveCount(0);
  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Does a deletion not share words and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toContainText("Hand off to you");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(reply()).not.toContainText("does share those words");
  await expect(reply()).not.toContainText("does not share those words");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("composer").fill("Hand deletions to me");
  await page.getByTestId("send").click();
  await expect(reply()).not.toContainText("does share those words");
  await expect(reply()).not.toContainText("does not share those words");
  await expect(reply()).not.toContainText("Those words are used once");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("unshared project files");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByTestId("away-handoff")).toBeVisible();
  await page.screenshot({ path: "test-results/oriel-step-not-share.png" });
});

test("ORIEL-F43 a sentence asks whether one step shares words with another and does not act", async ({ page }) => {
  async function chooseAction(action: string) {
    const picker = page.getByTestId("rule-phrase-action");
    await expect(async () => {
      await picker.selectOption(action);
      await expect(picker).toHaveValue(action, { timeout: 500 });
    }).toPass();
  }

  async function narrow(action: string, phrase: string) {
    await chooseAction(action);
    const input = page.getByTestId("rule-phrase");
    await input.click();
    await input.fill(phrase);
    await expect(input).toHaveValue(phrase);
    await expect(page.getByTestId("rule-phrase-action")).toHaveValue(action);
    const saved = page.waitForResponse(
      (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
    );
    await page.getByTestId("rule-phrase-save").click();
    await saved;
  }

  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Does a deletion share words with a send?");
  await expect(page.locator(".rule-note")).toContainText("Does a deletion not share words?");
  await page.getByTestId("composer").fill("Does a deletion share words with a send?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("There is no handoff rule for a deletion");
  await expect(reply()).toContainText("named no other step");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("with the send");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Does a note share words with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does not name two different steps");
  await expect(reply()).toContainText("did not open a card");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Does a deletion share words with a deletion?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does not name two different steps");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("composer").fill("Does a deletion share words with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("names no words and is the whole deletion");
  await expect(reply()).toContainText("did not treat this question as a share with the other step");
  await expect(reply()).not.toContainText("with the send");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await narrow("send", "Shared Project Files");
  await expect(page.getByTestId("rule-phrase-send")).toContainText("Shared Project Files");
  await narrow("delete", "shared project files");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await narrow("pay", "unshared project files");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("unshared project files");
  await chooseAction("pay");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("unshared project files");
  await page.getByTestId("rule-phrase").fill("notes I just typed");
  await page.getByTestId("rule-phrase-action").dispatchEvent("change");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("notes I just typed");
  await chooseAction("delete");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("shared project files");
  await page.getByTestId("composer").fill("Please, does a deletion share words with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion shares those words with the send");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("The payment");
  await expect(reply()).not.toContainText("unshared project files");
  await expect(reply()).not.toContainText("The public post");
  await expect(reply()).not.toContainText("the whole");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await page.getByTestId("composer").fill("Does a deletion share words with a send handed over to you?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await expect(reply()).toContainText("The deletion shares those words with the send");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Does a deletion share words with a payment to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does not share those words with the payment");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("unshared project files");
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Does a deletion share words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion shares those words");
  await expect(reply()).toContainText("The send uses them");
  await expect(reply()).not.toContainText("with the send");

  await page.getByTestId("composer").fill("Does a deletion not share words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does share those words");
  await expect(reply()).not.toContainText("with the send");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Does a deletion not share words with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does share those words with the send");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("The deletion shares those words with the send");
  await expect(page.getByTestId("approval")).toHaveCount(0);
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Does a deletion share words with a payment and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval")).toContainText("Release a deletion");
  await expect(page.getByTestId("approval")).not.toContainText("Release a payment");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(reply()).not.toContainText("shares those words with");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-phrase-delete")).toHaveCount(0);
  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Does a deletion share words with a payment and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toContainText("Hand off to you");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(reply()).not.toContainText("shares those words with");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("composer").fill("Hand deletions to me");
  await page.getByTestId("send").click();
  await expect(reply()).not.toContainText("shares those words with");
  await expect(reply()).not.toContainText("does not share those words with");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("unshared project files");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByTestId("away-handoff")).toBeVisible();
  await page.screenshot({ path: "test-results/oriel-step-share-with.png" });
});

test("ORIEL-F44 a sentence asks whether one step does not share words with another and does not act", async ({ page }) => {
  async function chooseAction(action: string) {
    const picker = page.getByTestId("rule-phrase-action");
    await expect(async () => {
      await picker.selectOption(action);
      await expect(picker).toHaveValue(action, { timeout: 500 });
    }).toPass();
  }

  async function narrow(action: string, phrase: string) {
    await chooseAction(action);
    const input = page.getByTestId("rule-phrase");
    await input.click();
    await input.fill(phrase);
    await expect(input).toHaveValue(phrase);
    await expect(page.getByTestId("rule-phrase-action")).toHaveValue(action);
    const saved = page.waitForResponse(
      (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
    );
    await page.getByTestId("rule-phrase-save").click();
    await saved;
  }

  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Does a deletion not share words with a send?");
  await expect(page.locator(".rule-note")).toContainText("Does a deletion share words with a send?");
  await page.getByTestId("composer").fill("Does a deletion not share words with a send?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("There is no handoff rule for a deletion");
  await expect(reply()).toContainText("named no other step");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("with the send");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Does a note not share words with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does not name two different steps");
  await expect(reply()).toContainText("did not open a card");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Does a deletion not share words with a deletion?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does not name two different steps");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("composer").fill("Does a deletion not share words with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("names no words and is the whole deletion");
  await expect(reply()).toContainText("did not treat this question as a comparison with the other step");
  await expect(reply()).not.toContainText("with the send");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await narrow("send", "Shared Project Files");
  await expect(page.getByTestId("rule-phrase-send")).toContainText("Shared Project Files");
  await narrow("delete", "shared project files");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await narrow("pay", "unshared project files");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("unshared project files");
  await chooseAction("pay");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("unshared project files");
  await page.getByTestId("rule-phrase").fill("notes I just typed");
  await page.getByTestId("rule-phrase-action").dispatchEvent("change");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("notes I just typed");
  await chooseAction("delete");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("shared project files");
  await page.getByTestId("composer").fill("Please, does a deletion not share words with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does share those words with the send");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("The deletion shares those words with the send");
  await expect(reply()).not.toContainText("The payment");
  await expect(reply()).not.toContainText("unshared project files");
  await expect(reply()).not.toContainText("The public post");
  await expect(reply()).not.toContainText("the whole");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await page.getByTestId("composer").fill("Does a deletion not share words with a send handed over to you?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await expect(reply()).toContainText("does share those words with the send");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Does a deletion not share words with a payment to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does not share those words with the payment");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("unshared project files");
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Does a deletion share words with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion shares those words with the send");
  await expect(reply()).not.toContainText("does share those words with the send");

  await page.getByTestId("composer").fill("Does a deletion not share words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does share those words");
  await expect(reply()).not.toContainText("with the send");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Does a deletion share words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion shares those words");
  await expect(reply()).not.toContainText("with the send");

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Does a deletion not share words with a payment and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval")).toContainText("Release a deletion");
  await expect(page.getByTestId("approval")).not.toContainText("Release a payment");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(reply()).not.toContainText("does share those words with");
  await expect(reply()).not.toContainText("does not share those words with");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-phrase-delete")).toHaveCount(0);
  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Does a deletion not share words with a payment and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toContainText("Hand off to you");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(reply()).not.toContainText("does share those words with");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("composer").fill("Hand deletions to me");
  await page.getByTestId("send").click();
  await expect(reply()).not.toContainText("does share those words with");
  await expect(reply()).not.toContainText("does not share those words with");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("unshared project files");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByTestId("away-handoff")).toBeVisible();
  await page.screenshot({ path: "test-results/oriel-step-not-share-with.png" });
});

test("ORIEL-F45 a sentence asks which steps share words with one step and does not act", async ({ page }) => {
  async function chooseAction(action: string) {
    const picker = page.getByTestId("rule-phrase-action");
    await expect(async () => {
      await picker.selectOption(action);
      await expect(picker).toHaveValue(action, { timeout: 500 });
    }).toPass();
  }

  async function narrow(action: string, phrase: string) {
    await chooseAction(action);
    const input = page.getByTestId("rule-phrase");
    await input.click();
    await input.fill(phrase);
    await expect(input).toHaveValue(phrase);
    await expect(page.getByTestId("rule-phrase-action")).toHaveValue(action);
    const saved = page.waitForResponse(
      (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
    );
    await page.getByTestId("rule-phrase-save").click();
    await saved;
  }

  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Which steps share words with a deletion?");
  await expect(page.locator(".rule-note")).toContainText("Which steps share words?");
  await expect(page.locator(".rule-note")).toContainText("Does a deletion not share words with a send?");
  await page.getByTestId("composer").fill("Which steps share words with a deletion?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("There is no handoff rule for a deletion");
  await expect(reply()).toContainText("named no other step");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("with the deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which steps share words with a note?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does not name a send, a payment, a deletion, or a public post");
  await expect(reply()).toContainText("did not open a card");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which steps share words with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("There is no handoff rule for a send");
  await expect(reply()).not.toContainText("with the send");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("composer").fill("Which steps share words with a deletion?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("names no words and is the whole deletion");
  await expect(reply()).toContainText("did not treat this question as a share with the other steps");
  await expect(reply()).not.toContainText("with the deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await narrow("send", "Shared Project Files");
  await expect(page.getByTestId("rule-phrase-send")).toContainText("Shared Project Files");
  await narrow("delete", "shared project files");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await narrow("pay", "unshared project files");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("unshared project files");
  await narrow("post", "shared project files");
  await expect(page.getByTestId("rule-phrase-post")).toContainText("shared project files");
  await chooseAction("pay");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("unshared project files");
  await page.getByTestId("rule-phrase").fill("notes I just typed");
  await page.getByTestId("rule-phrase-action").dispatchEvent("change");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("notes I just typed");
  await chooseAction("delete");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("shared project files");
  await page.getByTestId("composer").fill("Please, which steps share words with a deletion?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps share those words with the deletion");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).toContainText("The send and The public post use them");
  await expect(reply()).not.toContainText("The payment");
  await expect(reply()).not.toContainText("unshared project files");
  await expect(reply()).not.toContainText("The deletion");
  await expect(reply()).not.toContainText("the whole");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await page.getByTestId("composer").fill("Which steps share words with a deletion handed over to you?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await expect(reply()).toContainText("These steps share those words with the deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which steps share words with a payment to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("No other step shares those words with the payment");
  await expect(reply()).toContainText("unshared project files");
  await expect(reply()).not.toContainText("These steps share those words");
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which steps share words with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps share those words with the send");
  await expect(reply()).toContainText("Shared Project Files");
  await expect(reply()).toContainText("The deletion and The public post use them");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which steps share words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps share words");
  await expect(reply()).not.toContainText("with the deletion");
  await expect(reply()).not.toContainText("These steps share those words");

  await page.getByTestId("composer").fill("Does a deletion share words with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion shares those words with the send");
  await expect(reply()).not.toContainText("These steps share those words");
  await expect(reply()).not.toContainText("No other step shares those words");

  await page.getByTestId("composer").fill("Does a deletion not share words with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does share those words with the send");
  await expect(reply()).not.toContainText("These steps share those words");

  await page.getByTestId("composer").fill("Does a deletion share words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion shares those words");
  await expect(reply()).not.toContainText("with the deletion");

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which steps share words with a deletion and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval")).toContainText("Release a deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(reply()).not.toContainText("These steps share those words");
  await expect(reply()).not.toContainText("No other step shares those words");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-phrase-delete")).toHaveCount(0);
  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which steps share words with a deletion and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toContainText("Hand off to you");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(reply()).not.toContainText("These steps share those words");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("composer").fill("Hand deletions to me");
  await page.getByTestId("send").click();
  await expect(reply()).not.toContainText("These steps share those words");
  await expect(reply()).not.toContainText("No other step shares those words");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("unshared project files");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByTestId("away-handoff")).toBeVisible();
  await page.screenshot({ path: "test-results/oriel-steps-share-with.png" });
});

test("ORIEL-F46 a sentence asks which steps do not share words with one step and does not act", async ({ page }) => {
  async function chooseAction(action: string) {
    const picker = page.getByTestId("rule-phrase-action");
    await expect(async () => {
      await picker.selectOption(action);
      await expect(picker).toHaveValue(action, { timeout: 500 });
    }).toPass();
  }

  async function narrow(action: string, phrase: string) {
    await chooseAction(action);
    const input = page.getByTestId("rule-phrase");
    await input.click();
    await input.fill(phrase);
    await expect(input).toHaveValue(phrase);
    await expect(page.getByTestId("rule-phrase-action")).toHaveValue(action);
    const saved = page.waitForResponse(
      (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
    );
    await page.getByTestId("rule-phrase-save").click();
    await saved;
  }

  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Which steps do not share words with a deletion?");
  await expect(page.locator(".rule-note")).toContainText("Which steps share words with a deletion?");
  await expect(page.locator(".rule-note")).toContainText("Which steps do not share words?");
  await page.getByTestId("composer").fill("Which steps do not share words with a deletion?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("There is no handoff rule for a deletion");
  await expect(reply()).toContainText("named no other step");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("with the deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which steps do not share words with a note?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does not name a send, a payment, a deletion, or a public post");
  await expect(reply()).toContainText("did not open a card");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which steps do not share words with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("There is no handoff rule for a send");
  await expect(reply()).not.toContainText("with the send");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("composer").fill("Which steps do not share words with a deletion?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("names no words and is the whole deletion");
  await expect(reply()).toContainText("did not treat this question as a comparison with the other steps");
  await expect(reply()).not.toContainText("with the deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await narrow("send", "Shared Project Files");
  await expect(page.getByTestId("rule-phrase-send")).toContainText("Shared Project Files");
  await narrow("delete", "shared project files");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await narrow("pay", "unshared project files");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("unshared project files");
  await narrow("post", "shared project files");
  await expect(page.getByTestId("rule-phrase-post")).toContainText("shared project files");
  await chooseAction("pay");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("unshared project files");
  await page.getByTestId("rule-phrase").fill("notes I just typed");
  await page.getByTestId("rule-phrase-action").dispatchEvent("change");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("notes I just typed");
  await chooseAction("delete");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("shared project files");
  await page.getByTestId("composer").fill("Please, which steps do not share words with a deletion?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps do share those words with the deletion");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).toContainText("The send and The public post use them");
  await expect(reply()).not.toContainText("These steps share those words");
  await expect(reply()).not.toContainText("The payment");
  await expect(reply()).not.toContainText("unshared project files");
  await expect(reply()).not.toContainText("The deletion");
  await expect(reply()).not.toContainText("the whole");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await page.getByTestId("composer").fill("Which steps do not share words with a deletion handed over to you?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await expect(reply()).toContainText("These steps do share those words with the deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which steps do not share words with a payment to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("No other step shares those words with the payment");
  await expect(reply()).toContainText("unshared project files");
  await expect(reply()).not.toContainText("No other step does share");
  await expect(reply()).not.toContainText("These steps do share those words");
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which steps do not share words with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps do share those words with the send");
  await expect(reply()).toContainText("Shared Project Files");
  await expect(reply()).toContainText("The deletion and The public post use them");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which steps share words with a deletion?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps share those words with the deletion");
  await expect(reply()).not.toContainText("does share those words");

  await page.getByTestId("composer").fill("Which steps do not share words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps use words once");
  await expect(reply()).not.toContainText("with the deletion");

  await page.getByTestId("composer").fill("Which steps share words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps share words");
  await expect(reply()).not.toContainText("with the deletion");

  await page.getByTestId("composer").fill("Does a deletion share words with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion shares those words with the send");
  await expect(reply()).not.toContainText("These steps do share those words");

  await page.getByTestId("composer").fill("Does a deletion not share words with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does share those words with the send");
  await expect(reply()).not.toContainText("These steps do share those words");

  await page.getByTestId("composer").fill("Does a deletion share words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion shares those words");
  await expect(reply()).not.toContainText("with the deletion");

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which steps do not share words with a deletion and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval")).toContainText("Release a deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(reply()).not.toContainText("These steps do share those words");
  await expect(reply()).not.toContainText("No other step shares those words");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-phrase-delete")).toHaveCount(0);
  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which steps do not share words with a deletion and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toContainText("Hand off to you");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(reply()).not.toContainText("These steps do share those words");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("composer").fill("Hand deletions to me");
  await page.getByTestId("send").click();
  await expect(reply()).not.toContainText("These steps do share those words");
  await expect(reply()).not.toContainText("No other step shares those words");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("unshared project files");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByTestId("away-handoff")).toBeVisible();
  await page.screenshot({ path: "test-results/oriel-steps-do-not-share-with.png" });
});

test("ORIEL-F47 a sentence asks which words one step shares and does not act", async ({ page }) => {
  async function chooseAction(action: string) {
    const picker = page.getByTestId("rule-phrase-action");
    await expect(async () => {
      await picker.selectOption(action);
      await expect(picker).toHaveValue(action, { timeout: 500 });
    }).toPass();
  }

  async function narrow(action: string, phrase: string) {
    await chooseAction(action);
    const input = page.getByTestId("rule-phrase");
    await input.click();
    await input.fill(phrase);
    await expect(input).toHaveValue(phrase);
    await expect(page.getByTestId("rule-phrase-action")).toHaveValue(action);
    const saved = page.waitForResponse(
      (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
    );
    await page.getByTestId("rule-phrase-save").click();
    await saved;
  }

  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Which words does a deletion share?");
  await expect(page.locator(".rule-note")).toContainText("Which words does a deletion hand to me?");
  await expect(page.locator(".rule-note")).toContainText("Which steps do not share words with a deletion?");
  await page.getByTestId("composer").fill("Which words does a deletion share?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("There is no handoff rule for a deletion");
  await expect(reply()).toContainText("named no other step");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("shares these words");
  await expect(reply()).not.toContainText("with the deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a note share?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does not name a send, a payment, a deletion, or a public post");
  await expect(reply()).toContainText("did not open a card");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a send share?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("There is no handoff rule for a send");
  await expect(reply()).not.toContainText("shares these words");
  await expect(reply()).not.toContainText("with the send");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("composer").fill("Which words does a deletion share?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("names no words and is the whole deletion");
  await expect(reply()).toContainText("did not treat this question as a share and did not quote a phrase");
  await expect(reply()).not.toContainText("shares these words");
  await expect(reply()).not.toContainText("with the deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await narrow("send", "Shared Project Files");
  await expect(page.getByTestId("rule-phrase-send")).toContainText("Shared Project Files");
  await narrow("delete", "shared project files");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await narrow("pay", "unshared project files");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("unshared project files");
  await narrow("post", "shared project files");
  await expect(page.getByTestId("rule-phrase-post")).toContainText("shared project files");
  await chooseAction("pay");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("unshared project files");
  await page.getByTestId("rule-phrase").fill("notes I just typed");
  await page.getByTestId("rule-phrase-action").dispatchEvent("change");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("notes I just typed");
  await chooseAction("delete");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("shared project files");
  await page.getByTestId("composer").fill("Please, which words does a deletion share?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion shares these words");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).toContainText("The send and The public post use them");
  await expect(reply()).not.toContainText("with the deletion");
  await expect(reply()).not.toContainText("These steps share those words");
  await expect(reply()).not.toContainText("The payment");
  await expect(reply()).not.toContainText("unshared project files");
  await expect(reply()).not.toContainText("the whole");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await page.getByTestId("composer").fill("Which words does a deletion share handed over to you?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await expect(reply()).toContainText("The deletion shares these words");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a payment share to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("Those words are used once");
  await expect(reply()).toContainText("unshared project files");
  await expect(reply()).not.toContainText("shares these words");
  await expect(reply()).not.toContainText("with the payment");
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a send share?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The send shares these words");
  await expect(reply()).toContainText("Shared Project Files");
  await expect(reply()).toContainText("The deletion and The public post use them");
  await expect(reply()).not.toContainText("with the send");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a deletion hand to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("shares these words");

  await page.getByTestId("composer").fill("Which words are shared?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These words are shared");
  await expect(reply()).not.toContainText("shares these words");

  await page.getByTestId("composer").fill("Which words are not shared?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These words are used once");
  await expect(reply()).not.toContainText("Those words are used once");

  await page.getByTestId("composer").fill("Which steps share words with a deletion?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps share those words with the deletion");
  await expect(reply()).not.toContainText("shares these words");

  await page.getByTestId("composer").fill("Which steps do not share words with a deletion?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("do share those words with the deletion");
  await expect(reply()).not.toContainText("shares these words");

  await page.getByTestId("composer").fill("Does a deletion share words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion shares those words");
  await expect(reply()).not.toContainText("shares these words");
  await expect(reply()).not.toContainText("with the deletion");

  await page.getByTestId("composer").fill("Does a deletion share words with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("with the send");
  await expect(reply()).not.toContainText("shares these words");

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which words does a deletion share and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval")).toContainText("Release a deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(reply()).not.toContainText("shares these words");
  await expect(reply()).not.toContainText("Those words are used once");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-phrase-delete")).toHaveCount(0);
  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which words does a deletion share and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toContainText("Hand off to you");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(reply()).not.toContainText("shares these words");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("composer").fill("Hand deletions to me");
  await page.getByTestId("send").click();
  await expect(reply()).not.toContainText("shares these words");
  await expect(reply()).not.toContainText("Those words are used once");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("unshared project files");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByTestId("away-handoff")).toBeVisible();
  await page.screenshot({ path: "test-results/oriel-words-one-step-shares.png" });
});

test("ORIEL-F48 a sentence asks which words one step does not share and does not act", async ({ page }) => {
  async function chooseAction(action: string) {
    const picker = page.getByTestId("rule-phrase-action");
    await expect(async () => {
      await picker.selectOption(action);
      await expect(picker).toHaveValue(action, { timeout: 500 });
    }).toPass();
  }

  async function narrow(action: string, phrase: string) {
    await chooseAction(action);
    const input = page.getByTestId("rule-phrase");
    await input.click();
    await input.fill(phrase);
    await expect(input).toHaveValue(phrase);
    await expect(page.getByTestId("rule-phrase-action")).toHaveValue(action);
    const saved = page.waitForResponse(
      (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
    );
    await page.getByTestId("rule-phrase-save").click();
    await saved;
  }

  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Which words does a deletion not share?");
  await expect(page.locator(".rule-note")).toContainText("Which words does a deletion share?");
  await expect(page.locator(".rule-note")).toContainText("Which words does a deletion hand to me?");
  await page.getByTestId("composer").fill("Which words does a deletion not share?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("There is no handoff rule for a deletion");
  await expect(reply()).toContainText("named no other step");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("does share these words");
  await expect(reply()).not.toContainText("does not share these words");
  await expect(reply()).not.toContainText("with the deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a note not share?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does not name a send, a payment, a deletion, or a public post");
  await expect(reply()).toContainText("did not open a card");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a send not share?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("There is no handoff rule for a send");
  await expect(reply()).not.toContainText("does share these words");
  await expect(reply()).not.toContainText("with the send");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("composer").fill("Which words does a deletion not share?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("names no words and is the whole deletion");
  await expect(reply()).toContainText("did not treat this question as a comparison and did not quote a phrase");
  await expect(reply()).not.toContainText("does share these words");
  await expect(reply()).not.toContainText("does not share these words");
  await expect(reply()).not.toContainText("with the deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await narrow("send", "Shared Project Files");
  await expect(page.getByTestId("rule-phrase-send")).toContainText("Shared Project Files");
  await narrow("delete", "shared project files");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await narrow("pay", "unshared project files");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("unshared project files");
  await narrow("post", "shared project files");
  await expect(page.getByTestId("rule-phrase-post")).toContainText("shared project files");
  await chooseAction("pay");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("unshared project files");
  await page.getByTestId("rule-phrase").fill("notes I just typed");
  await page.getByTestId("rule-phrase-action").dispatchEvent("change");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("notes I just typed");
  await chooseAction("delete");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("shared project files");
  await page.getByTestId("composer").fill("Please, which words does a deletion not share?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion does share these words");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).toContainText("The send and The public post use them");
  await expect(reply()).not.toContainText("The deletion shares these words");
  await expect(reply()).not.toContainText("with the deletion");
  await expect(reply()).not.toContainText("These steps share those words");
  await expect(reply()).not.toContainText("The payment");
  await expect(reply()).not.toContainText("unshared project files");
  await expect(reply()).not.toContainText("the whole");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await page.getByTestId("composer").fill("Which words does a deletion not share handed over to you?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await expect(reply()).toContainText("The deletion does share these words");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a payment not share to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The payment does not share these words");
  await expect(reply()).toContainText("unshared project files");
  await expect(reply()).not.toContainText("does share these words");
  await expect(reply()).not.toContainText("Those words are used once");
  await expect(reply()).not.toContainText("with the payment");
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a send not share?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The send does share these words");
  await expect(reply()).toContainText("Shared Project Files");
  await expect(reply()).toContainText("The deletion and The public post use them");
  await expect(reply()).not.toContainText("with the send");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a deletion share?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion shares these words");
  await expect(reply()).not.toContainText("does share these words");
  await expect(reply()).not.toContainText("does not share these words");

  await page.getByTestId("composer").fill("Which words does a deletion hand to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("does share these words");

  await page.getByTestId("composer").fill("Which words are shared?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These words are shared");
  await expect(reply()).not.toContainText("does share these words");

  await page.getByTestId("composer").fill("Which words are not shared?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These words are used once");
  await expect(reply()).not.toContainText("does not share these words");

  await page.getByTestId("composer").fill("Which steps do not share words with a deletion?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("do share those words with the deletion");
  await expect(reply()).not.toContainText("does share these words");

  await page.getByTestId("composer").fill("Does a deletion not share words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does share those words");
  await expect(reply()).not.toContainText("does share these words");

  await page.getByTestId("composer").fill("Does a deletion share words with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("with the send");
  await expect(reply()).not.toContainText("does share these words");

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which words does a deletion not share and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval")).toContainText("Release a deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(reply()).not.toContainText("does share these words");
  await expect(reply()).not.toContainText("does not share these words");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-phrase-delete")).toHaveCount(0);
  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which words does a deletion not share and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toContainText("Hand off to you");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(reply()).not.toContainText("does share these words");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("composer").fill("Hand deletions to me");
  await page.getByTestId("send").click();
  await expect(reply()).not.toContainText("does share these words");
  await expect(reply()).not.toContainText("does not share these words");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("unshared project files");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByTestId("away-handoff")).toBeVisible();
  await page.screenshot({ path: "test-results/oriel-words-one-step-does-not-share.png" });
});

test("ORIEL-F49 a sentence asks which words one step shares with one other step and does not act", async ({ page }) => {
  async function chooseAction(action: string) {
    const picker = page.getByTestId("rule-phrase-action");
    await expect(async () => {
      await picker.selectOption(action);
      await expect(picker).toHaveValue(action, { timeout: 500 });
    }).toPass();
  }

  async function narrow(action: string, phrase: string) {
    await chooseAction(action);
    const input = page.getByTestId("rule-phrase");
    await input.click();
    await input.fill(phrase);
    await expect(input).toHaveValue(phrase);
    await expect(page.getByTestId("rule-phrase-action")).toHaveValue(action);
    const saved = page.waitForResponse(
      (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
    );
    await page.getByTestId("rule-phrase-save").click();
    await saved;
  }

  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Which words does a deletion share with a send?");
  await expect(page.locator(".rule-note")).toContainText("Which words does a deletion not share?");
  await expect(page.locator(".rule-note")).toContainText("Which words does a deletion share?");
  await page.getByTestId("composer").fill("Which words does a deletion share with a send?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("There is no handoff rule for a deletion");
  await expect(reply()).toContainText("named no other step");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("with the send");
  await expect(reply()).not.toContainText("shares these words");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a note share with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does not name two different steps");
  await expect(reply()).toContainText("did not open a card");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a deletion share with a deletion?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does not name two different steps");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("composer").fill("Which words does a deletion share with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("names no words and is the whole deletion");
  await expect(reply()).toContainText("did not treat this question as a share with the other step");
  await expect(reply()).not.toContainText("with the send");
  await expect(reply()).not.toContainText("shares these words");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await narrow("send", "Shared Project Files");
  await expect(page.getByTestId("rule-phrase-send")).toContainText("Shared Project Files");
  await narrow("delete", "shared project files");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await narrow("pay", "unshared project files");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("unshared project files");
  await narrow("post", "shared project files");
  await expect(page.getByTestId("rule-phrase-post")).toContainText("shared project files");
  await chooseAction("pay");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("unshared project files");
  await page.getByTestId("rule-phrase").fill("notes I just typed");
  await page.getByTestId("rule-phrase-action").dispatchEvent("change");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("notes I just typed");
  await chooseAction("delete");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("shared project files");
  await page.getByTestId("composer").fill("Please, which words does a deletion share with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion shares these words with the send");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("The deletion shares these words.");
  await expect(reply()).not.toContainText("does share these words");
  await expect(reply()).not.toContainText("The payment");
  await expect(reply()).not.toContainText("unshared project files");
  await expect(reply()).not.toContainText("the whole");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await page.getByTestId("composer").fill("Which words does a deletion share with a send handed over to you?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await expect(reply()).toContainText("The deletion shares these words with the send");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a payment share with a deletion to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The payment does not share these words with the deletion");
  await expect(reply()).toContainText("unshared project files");
  await expect(reply()).not.toContainText("Those words are used once");
  await expect(reply()).not.toContainText("“shared project files”");
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a send share with a deletion?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The send shares these words with the deletion");
  await expect(reply()).toContainText("Shared Project Files");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a deletion share?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion shares these words");
  await expect(reply()).not.toContainText("with the send");

  await page.getByTestId("composer").fill("Which words does a deletion not share?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion does share these words");
  await expect(reply()).not.toContainText("with the send");

  await page.getByTestId("composer").fill("Which words does a deletion hand to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("shares these words");

  await page.getByTestId("composer").fill("Does a deletion share words with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("shares those words with the send");
  await expect(reply()).not.toContainText("shares these words");

  await page.getByTestId("composer").fill("Which words does a deletion not share with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion does share these words with the send");
  await expect(reply()).not.toContainText("The deletion shares these words with the send");
  await expect(reply()).not.toContainText("does not share these words with the send");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which words does a deletion share with a send and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval").filter({ hasText: "Release a deletion" })).toHaveCount(1);
  await expect(page.getByTestId("approval").filter({ hasText: "Release a send" })).toHaveCount(1);
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(reply()).not.toContainText("shares these words with the send");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-phrase-delete")).toHaveCount(0);
  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which words does a deletion share with a send and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toContainText("Hand off to you");
  await expect(page.getByTestId("approval").filter({ hasText: "Release a send" })).toHaveCount(1);
  await expect(page.getByTestId("approval").filter({ hasText: "Release a deletion" })).toHaveCount(0);
  await expect(reply()).not.toContainText("shares these words with");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("composer").fill("Hand deletions to me");
  await page.getByTestId("send").click();
  await expect(reply()).not.toContainText("shares these words with the send");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("unshared project files");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByTestId("away-handoff")).toBeVisible();
  await page.screenshot({ path: "test-results/oriel-words-one-step-shares-with-another.png" });
});

test("ORIEL-F50 a sentence asks which words one step does not share with one other step and does not act", async ({ page }) => {
  async function chooseAction(action: string) {
    const picker = page.getByTestId("rule-phrase-action");
    await expect(async () => {
      await picker.selectOption(action);
      await expect(picker).toHaveValue(action, { timeout: 500 });
    }).toPass();
  }

  async function narrow(action: string, phrase: string) {
    await chooseAction(action);
    const input = page.getByTestId("rule-phrase");
    await input.click();
    await input.fill(phrase);
    await expect(input).toHaveValue(phrase);
    await expect(page.getByTestId("rule-phrase-action")).toHaveValue(action);
    const saved = page.waitForResponse(
      (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
    );
    await page.getByTestId("rule-phrase-save").click();
    await saved;
  }

  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Which words does a deletion not share with a send?");
  await expect(page.locator(".rule-note")).toContainText("Which words does a deletion share with a send?");
  await page.getByTestId("composer").fill("Which words does a deletion not share with a send?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("There is no handoff rule for a deletion");
  await expect(reply()).toContainText("named no other step");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("with the send");
  await expect(reply()).not.toContainText("does share these words");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a note not share with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does not name two different steps");
  await expect(reply()).toContainText("did not open a card");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a deletion not share with a deletion?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does not name two different steps");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("composer").fill("Which words does a deletion not share with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("names no words and is the whole deletion");
  await expect(reply()).toContainText("did not treat this question as a comparison with the other step");
  await expect(reply()).not.toContainText("with the send");
  await expect(reply()).not.toContainText("does share these words");
  await expect(reply()).not.toContainText("does not share these words");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await narrow("send", "Shared Project Files");
  await expect(page.getByTestId("rule-phrase-send")).toContainText("Shared Project Files");
  await narrow("delete", "shared project files");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await narrow("pay", "unshared project files");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("unshared project files");
  await narrow("post", "shared project files");
  await expect(page.getByTestId("rule-phrase-post")).toContainText("shared project files");
  await chooseAction("pay");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("unshared project files");
  await page.getByTestId("rule-phrase").fill("notes I just typed");
  await page.getByTestId("rule-phrase-action").dispatchEvent("change");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("notes I just typed");
  await chooseAction("delete");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("shared project files");
  await page.getByTestId("composer").fill("Please, which words does a deletion not share with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion does share these words with the send");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("The deletion does share these words.");
  await expect(reply()).not.toContainText("The deletion shares these words with the send");
  await expect(reply()).not.toContainText("The payment");
  await expect(reply()).not.toContainText("unshared project files");
  await expect(reply()).not.toContainText("the whole");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await page.getByTestId("composer").fill("Which words does a deletion not share with a send handed over to you?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await expect(reply()).toContainText("The deletion does share these words with the send");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a payment not share with a deletion to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The payment does not share these words with the deletion");
  await expect(reply()).toContainText("unshared project files");
  await expect(reply()).not.toContainText("Those words are used once");
  await expect(reply()).not.toContainText("“shared project files”");
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a send not share with a deletion?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The send does share these words with the deletion");
  await expect(reply()).toContainText("Shared Project Files");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a deletion share with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion shares these words with the send");
  await expect(reply()).not.toContainText("does share these words with the send");

  await page.getByTestId("composer").fill("Which words does a deletion not share?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion does share these words");
  await expect(reply()).not.toContainText("with the send");

  await page.getByTestId("composer").fill("Which words does a deletion share?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion shares these words");
  await expect(reply()).not.toContainText("with the send");

  await page.getByTestId("composer").fill("Does a deletion not share words with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does share those words with the send");
  await expect(reply()).not.toContainText("does share these words");

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which words does a deletion not share with a send and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval").filter({ hasText: "Release a deletion" })).toHaveCount(1);
  await expect(page.getByTestId("approval").filter({ hasText: "Release a send" })).toHaveCount(1);
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(reply()).not.toContainText("does share these words with the send");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-phrase-delete")).toHaveCount(0);
  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which words does a deletion not share with a send and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toContainText("Hand off to you");
  await expect(page.getByTestId("approval").filter({ hasText: "Release a send" })).toHaveCount(1);
  await expect(page.getByTestId("approval").filter({ hasText: "Release a deletion" })).toHaveCount(0);
  await expect(reply()).not.toContainText("does share these words with");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("composer").fill("Hand deletions to me");
  await page.getByTestId("send").click();
  await expect(reply()).not.toContainText("does share these words with the send");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("unshared project files");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByTestId("away-handoff")).toBeVisible();
  await page.screenshot({ path: "test-results/oriel-words-one-step-does-not-share-with-another.png" });
});

test("ORIEL-F51 a sentence asks which steps do not mention certain words and does not act", async ({ page }) => {
  async function chooseAction(action: string) {
    const picker = page.getByTestId("rule-phrase-action");
    await expect(async () => {
      await picker.selectOption(action);
      await expect(picker).toHaveValue(action, { timeout: 500 });
    }).toPass();
  }

  async function narrow(action: string, phrase: string) {
    await chooseAction(action);
    const input = page.getByTestId("rule-phrase");
    await input.click();
    await input.fill(phrase);
    await expect(input).toHaveValue(phrase);
    await expect(page.getByTestId("rule-phrase-action")).toHaveValue(action);
    const saved = page.waitForResponse(
      (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
    );
    await page.getByTestId("rule-phrase-save").click();
    await saved;
  }

  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Which steps do not mention shared project files?");
  await expect(page.locator(".rule-note")).toContainText("Which step mentions shared project files?");
  await page.getByTestId("composer").fill("Which steps do not mention shared project files?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("No step does not mention");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).toContainText("named no other step");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("does not mention those words");
  await expect(reply()).not.toContainText("The deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("rule-send").click();
  await expect(page.getByTestId("rule-whole-send")).toContainText("the whole send");
  await page.getByTestId("composer").fill("Please, which steps do not mention shared project files?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("No step does not mention");
  await expect(reply()).not.toContainText("the whole deletion");
  await expect(reply()).not.toContainText("the whole send");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await narrow("delete", "shared project files");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await narrow("pay", "the vendor invoice");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("the vendor invoice");
  await chooseAction("pay");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("the vendor invoice");
  await page.getByTestId("rule-phrase").fill("notes I just typed");
  await page.getByTestId("rule-phrase-action").dispatchEvent("change");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("notes I just typed");
  await chooseAction("delete");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("shared project files");
  await page.getByTestId("composer").fill("Which step does not mention shared project files?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The payment does not mention those words");
  await expect(reply()).toContainText("the vendor invoice");
  await expect(reply()).not.toContainText("These steps do not mention those words");
  await expect(reply()).not.toContainText("The deletion");
  await expect(reply()).not.toContainText("shared project files");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.getByTestId("rule-phrase-action")).toHaveValue("delete");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("shared project files");

  await narrow("send", "launch note");
  await expect(page.getByTestId("rule-phrase-send")).toContainText("launch note");
  await page.getByTestId("composer").fill("Which steps do not mention “shared project files”?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps do not mention those words");
  await expect(reply()).toContainText("launch note");
  await expect(reply()).toContainText("the vendor invoice");
  await expect(reply()).not.toContainText("The deletion");
  await expect(reply()).not.toContainText("the whole");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await page.getByTestId("composer").fill("Which step does not mentioning shared project files to me?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await expect(reply()).toContainText("These steps do not mention those words");
  await expect(reply()).not.toContainText("The deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which step mentions shared project files?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion mentions");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("does not mention");

  await page.getByTestId("composer").fill("Which words does a deletion not share with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does not share these words with the send");
  await expect(reply()).not.toContainText("does not mention");
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which steps do not mention shared project files and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval")).toHaveCount(0);
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(reply()).not.toContainText("No step does not mention");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await narrow("delete", "the vendor archive");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("the vendor archive");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which steps do not mention shared project files on this saved desk and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval")).toContainText("Release a deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("the vendor archive");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-phrase-delete")).toHaveCount(0);
  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which steps do not mention shared project files on this saved desk and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toContainText("Hand off to you");
  await expect(page.getByTestId("approval")).toHaveCount(0);
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("composer").fill("Hand deletions to me");
  await page.getByTestId("send").click();
  await expect(reply()).not.toContainText("No step does not mention");
  await expect(reply()).not.toContainText("These steps do not mention those words");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("the vendor invoice");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByTestId("away-handoff")).toBeVisible();
  await page.screenshot({ path: "test-results/oriel-steps-do-not-mention.png" });
});

test("ORIEL-F52 a sentence asks whether one step does not mention certain words and does not act", async ({ page }) => {
  async function chooseAction(action: string) {
    const picker = page.getByTestId("rule-phrase-action");
    await expect(async () => {
      await picker.selectOption(action);
      await expect(picker).toHaveValue(action, { timeout: 500 });
    }).toPass();
  }

  async function narrow(action: string, phrase: string) {
    await chooseAction(action);
    const input = page.getByTestId("rule-phrase");
    await input.click();
    await input.fill(phrase);
    await expect(input).toHaveValue(phrase);
    await expect(page.getByTestId("rule-phrase-action")).toHaveValue(action);
    const saved = page.waitForResponse(
      (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
    );
    await page.getByTestId("rule-phrase-save").click();
    await saved;
  }

  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Does a deletion not mention shared project files?");
  await expect(page.locator(".rule-note")).toContainText("Which steps do not mention shared project files?");
  await page.getByTestId("composer").fill("Does a deletion not mention shared project files?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("The deletion is not handed to you");
  await expect(reply()).toContainText("named no other step");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("does mention those words");
  await expect(reply()).not.toContainText("does not mention those words");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Does a note not mention shared project files?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does not name a send, a payment, a deletion, or a public post");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("composer").fill("Please, does the deletion not mention shared project files?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("names no words");
  await expect(reply()).toContainText("the whole deletion");
  await expect(reply()).toContainText("did not treat this question as a mention");
  await expect(reply()).not.toContainText("does mention those words");
  await expect(reply()).not.toContainText("does not mention those words");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await narrow("delete", "shared project files");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await narrow("pay", "the vendor invoice");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("the vendor invoice");
  await chooseAction("pay");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("the vendor invoice");
  await page.getByTestId("rule-phrase").fill("notes I just typed");
  await page.getByTestId("rule-phrase-action").dispatchEvent("change");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("notes I just typed");
  await chooseAction("delete");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("shared project files");
  await page.getByTestId("composer").fill("Does a deletion not mention “Shared Project Files”?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion does mention those words");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("The deletion does not mention those words");
  await expect(reply()).not.toContainText("These steps do not mention those words");
  await expect(reply()).not.toContainText("The payment");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.getByTestId("rule-phrase-action")).toHaveValue("delete");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("shared project files");

  await page.getByTestId("composer").fill("Does a deletion not mention unshared project files?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion does not mention those words");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("The deletion does mention those words");
  await expect(reply()).not.toContainText("unshared project files");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await page.getByTestId("composer").fill("Does a deletion not mentioning shared project files to me?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await expect(reply()).toContainText("The deletion does mention those words");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which steps do not mention shared project files?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The payment does not mention those words");
  await expect(reply()).toContainText("the vendor invoice");
  await expect(reply()).not.toContainText("These steps do not mention those words");
  await expect(reply()).not.toContainText("does mention those words");
  await expect(reply()).not.toContainText("The deletion");

  await page.getByTestId("composer").fill("Which step mentions shared project files?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion mentions");
  await expect(reply()).not.toContainText("does not mention");

  await page.getByTestId("composer").fill("Which words does a deletion not share with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does not share these words with the send");
  await expect(reply()).not.toContainText("does not mention");
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Does a deletion not mention shared project files and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toContainText("Hand off to you");
  await expect(page.getByTestId("approval")).toHaveCount(0);
  await expect(reply()).not.toContainText("does mention those words");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await narrow("delete", "the vendor archive");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("the vendor archive");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Does a deletion not mention shared project files and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval")).toContainText("Release a deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("the vendor archive");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-phrase-delete")).toHaveCount(0);
  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Does a deletion mention shared project files?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approval")).toContainText("Release a deletion");
  await expect(reply()).toContainText("names no words");
  await expect(reply()).toContainText("did not treat this question as a mention");
  await expect(reply()).not.toContainText("mentions those words");
  await expect(reply()).not.toContainText("mentions other words");
  await expect(reply()).not.toContainText("The deletion does mention those words");
  await expect(reply()).not.toContainText("The deletion does not mention those words");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.locator(".goal")).toHaveCount(2);

  await page.getByTestId("composer").fill("Hand deletions to me");
  await page.getByTestId("send").click();
  await expect(reply()).not.toContainText("The deletion does mention those words");
  await expect(reply()).not.toContainText("The deletion does not mention those words");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("the vendor invoice");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByTestId("away-handoff")).toBeVisible();
  await page.screenshot({ path: "test-results/oriel-step-does-not-mention.png" });
});

test("ORIEL-F53 a sentence asks whether one step mentions certain words and does not act", async ({ page }) => {
  async function chooseAction(action: string) {
    const picker = page.getByTestId("rule-phrase-action");
    await expect(async () => {
      await picker.selectOption(action);
      await expect(picker).toHaveValue(action, { timeout: 500 });
    }).toPass();
  }

  async function narrow(action: string, phrase: string) {
    await chooseAction(action);
    const input = page.getByTestId("rule-phrase");
    await input.click();
    await input.fill(phrase);
    await expect(input).toHaveValue(phrase);
    await expect(page.getByTestId("rule-phrase-action")).toHaveValue(action);
    const saved = page.waitForResponse(
      (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
    );
    await page.getByTestId("rule-phrase-save").click();
    await saved;
  }

  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Does a deletion mention shared project files?");
  await expect(page.locator(".rule-note")).toContainText("Does a deletion not mention shared project files?");
  await page.getByTestId("composer").fill("Does a deletion mention shared project files?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("The deletion is not handed to you");
  await expect(reply()).toContainText("named no other step");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("mentions those words");
  await expect(reply()).not.toContainText("mentions other words");
  await expect(reply()).not.toContainText("does mention those words");
  await expect(reply()).not.toContainText("does not mention those words");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Does a note mention shared project files?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does not name a send, a payment, a deletion, or a public post");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("composer").fill("Please, does the deletion mention shared project files?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("names no words");
  await expect(reply()).toContainText("the whole deletion");
  await expect(reply()).toContainText("did not treat this question as a mention");
  await expect(reply()).not.toContainText("mentions those words");
  await expect(reply()).not.toContainText("mentions other words");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await narrow("delete", "shared project files");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await narrow("pay", "the vendor invoice");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("the vendor invoice");
  await chooseAction("pay");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("the vendor invoice");
  await page.getByTestId("rule-phrase").fill("notes I just typed");
  await page.getByTestId("rule-phrase-action").dispatchEvent("change");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("notes I just typed");
  await chooseAction("delete");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("shared project files");
  await page.getByTestId("composer").fill("Does a deletion mention “Shared Project Files”?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion mentions those words");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("The deletion mentions other words");
  await expect(reply()).not.toContainText("The deletion does mention those words");
  await expect(reply()).not.toContainText("The payment");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.getByTestId("rule-phrase-action")).toHaveValue("delete");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("shared project files");

  await page.getByTestId("composer").fill("Does a deletion mention unshared project files?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion mentions other words");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("The deletion mentions those words");
  await expect(reply()).not.toContainText("unshared project files");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await page.getByTestId("composer").fill("Does a deletion mentioning shared project files to me?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await expect(reply()).toContainText("The deletion mentions those words");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await page.getByTestId("composer").fill("Does a deletion not mention shared project files?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion does mention those words");
  await expect(reply()).not.toContainText("The deletion mentions those words");
  await expect(reply()).not.toContainText("The deletion mentions other words");

  await page.getByTestId("composer").fill("Which step mentions shared project files?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion mentions");
  await expect(reply()).not.toContainText("mentions those words");

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Does a deletion mention shared project files and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toContainText("Hand off to you");
  await expect(page.getByTestId("approval")).toHaveCount(0);
  await expect(reply()).not.toContainText("The deletion mentions those words");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await narrow("delete", "the vendor archive");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("the vendor archive");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Does a deletion mention shared project files and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval")).toContainText("Release a deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("the vendor archive");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-phrase-delete")).toHaveCount(0);
  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Does a deletion not mention shared project files?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approval")).toContainText("Release a deletion");
  await expect(reply()).toContainText("names no words");
  await expect(reply()).not.toContainText("The deletion mentions those words");
  await expect(reply()).not.toContainText("The deletion does mention those words");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.locator(".goal")).toHaveCount(2);

  await page.getByTestId("composer").fill("Hand deletions to me");
  await page.getByTestId("send").click();
  await expect(reply()).not.toContainText("The deletion mentions those words");
  await expect(reply()).not.toContainText("The deletion mentions other words");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("the vendor invoice");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByTestId("away-handoff")).toBeVisible();
  await page.screenshot({ path: "test-results/oriel-step-mentions.png" });
});

test("ORIEL-F54 a sentence asks whether one step mentions the same words as another and does not act", async ({ page }) => {
  async function chooseAction(action: string) {
    const picker = page.getByTestId("rule-phrase-action");
    await expect(async () => {
      await picker.selectOption(action);
      await expect(picker).toHaveValue(action, { timeout: 500 });
    }).toPass();
  }

  async function narrow(action: string, phrase: string) {
    await chooseAction(action);
    const input = page.getByTestId("rule-phrase");
    await input.click();
    await input.fill(phrase);
    await expect(input).toHaveValue(phrase);
    await expect(page.getByTestId("rule-phrase-action")).toHaveValue(action);
    const saved = page.waitForResponse(
      (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
    );
    await page.getByTestId("rule-phrase-save").click();
    await saved;
  }

  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Does a deletion mention the same words as a send?");
  await expect(page.locator(".rule-note")).toContainText("Does a deletion not mention the same words as a send?");
  await expect(page.locator(".rule-note")).toContainText("Does a deletion mention shared project files?");
  await page.getByTestId("composer").fill("Does a deletion mention the same words as a send?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("The deletion is not handed to you");
  await expect(reply()).toContainText("named no other step");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("mentions the same words");
  await expect(reply()).not.toContainText("does not mention the same words");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Does a note mention the same words as a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does not name two different steps");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("composer").fill("Please, does the deletion mention the same words as a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("names no words");
  await expect(reply()).toContainText("the whole deletion");
  await expect(reply()).toContainText("did not treat this question as a comparison with the other step");
  await expect(reply()).not.toContainText("mentions the same words");
  await expect(reply()).not.toContainText("the send");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await narrow("delete", "shared project files");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await narrow("send", "shared project files");
  await expect(page.getByTestId("rule-phrase-send")).toContainText("shared project files");
  await narrow("pay", "the vendor invoice");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("the vendor invoice");
  await chooseAction("pay");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("the vendor invoice");
  await page.getByTestId("rule-phrase").fill("notes I just typed");
  await page.getByTestId("rule-phrase-action").dispatchEvent("change");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("notes I just typed");
  await chooseAction("delete");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("shared project files");
  await page.getByTestId("composer").fill("Does a deletion mention the same words as a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion mentions the same words as the send");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("The deletion does not mention the same words");
  await expect(reply()).not.toContainText("The payment");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.getByTestId("rule-phrase-action")).toHaveValue("delete");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("shared project files");

  await narrow("send", "launch note");
  await page.getByTestId("composer").fill("Does a deletion mention the same words as a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion does not mention the same words as the send");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("launch note");
  await expect(reply()).not.toContainText("The deletion mentions the same words");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await narrow("send", "shared project files");
  await page.getByTestId("composer").fill("Does a deletion mentioning the same words as a send to me?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await expect(reply()).toContainText("The deletion mentions the same words as the send");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Does a deletion mention shared project files?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion mentions those words");
  await expect(reply()).not.toContainText("the same words as the send");

  await page.getByTestId("composer").fill("Does a deletion not mention the same words as a send?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval")).toHaveCount(0);
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(reply()).toContainText("The deletion does mention the same words as the send");
  await expect(reply()).not.toContainText("The deletion mentions the same words as the send");
  await expect(reply()).not.toContainText("does not mention the same words as the send");

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Does a deletion mention the same words as a send and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval").filter({ hasText: "Release a deletion" })).toHaveCount(1);
  await expect(page.getByTestId("approval").filter({ hasText: "Release a send" })).toHaveCount(1);
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(reply()).not.toContainText("mentions the same words");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-phrase-delete")).toHaveCount(0);
  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Does a deletion mention the same words as a send and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toContainText("Hand off to you");
  await expect(reply()).not.toContainText("mentions the same words");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("composer").fill("Hand deletions to me");
  await page.getByTestId("send").click();
  await expect(reply()).not.toContainText("mentions the same words");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("the vendor invoice");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByTestId("away-handoff")).toBeVisible();
  await page.screenshot({ path: "test-results/oriel-same-words.png" });
});

test("ORIEL-F55 a sentence asks whether one step does not mention the same words as another and does not act", async ({ page }) => {
  async function chooseAction(action: string) {
    const picker = page.getByTestId("rule-phrase-action");
    await expect(async () => {
      await picker.selectOption(action);
      await expect(picker).toHaveValue(action, { timeout: 500 });
    }).toPass();
  }

  async function narrow(action: string, phrase: string) {
    await chooseAction(action);
    const input = page.getByTestId("rule-phrase");
    await input.click();
    await input.fill(phrase);
    await expect(input).toHaveValue(phrase);
    await expect(page.getByTestId("rule-phrase-action")).toHaveValue(action);
    const saved = page.waitForResponse(
      (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
    );
    await page.getByTestId("rule-phrase-save").click();
    await saved;
  }

  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Does a deletion not mention the same words as a send?");
  await expect(page.locator(".rule-note")).toContainText("Does a deletion mention the same words as a send?");
  await page.getByTestId("composer").fill("Does a deletion not mention the same words as a send?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("The deletion is not handed to you");
  await expect(reply()).toContainText("named no other step");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("does mention the same words");
  await expect(reply()).not.toContainText("does not mention the same words");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Does a note not mention the same words as a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does not name two different steps");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("composer").fill("Please, does the deletion not mention the same words as a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("names no words");
  await expect(reply()).toContainText("the whole deletion");
  await expect(reply()).toContainText("did not treat this question as a comparison with the other step");
  await expect(reply()).not.toContainText("does mention the same words");
  await expect(reply()).not.toContainText("the send");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await narrow("delete", "shared project files");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await narrow("send", "shared project files");
  await expect(page.getByTestId("rule-phrase-send")).toContainText("shared project files");
  await narrow("pay", "the vendor invoice");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("the vendor invoice");
  await chooseAction("pay");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("the vendor invoice");
  await page.getByTestId("rule-phrase").fill("notes I just typed");
  await page.getByTestId("rule-phrase-action").dispatchEvent("change");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("notes I just typed");
  await chooseAction("delete");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("shared project files");
  await page.getByTestId("composer").fill("Does a deletion not mention the same words as a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion does mention the same words as the send");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("The deletion mentions the same words as the send");
  await expect(reply()).not.toContainText("The payment");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.getByTestId("rule-phrase-action")).toHaveValue("delete");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("shared project files");

  await narrow("send", "launch note");
  await page.getByTestId("composer").fill("Does a deletion not mention the same words as a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion does not mention the same words as the send");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("launch note");
  await expect(reply()).not.toContainText("The deletion does mention the same words");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await narrow("send", "shared project files");
  await page.getByTestId("composer").fill("Does a deletion not mentioning the same words as a send to me?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await expect(reply()).toContainText("The deletion does mention the same words as the send");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Does a deletion mention the same words as a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion mentions the same words as the send");
  await expect(reply()).not.toContainText("The deletion does mention the same words");

  await page.getByTestId("composer").fill("Does a deletion not mention the same words as a send and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval").filter({ hasText: "Release a deletion" })).toHaveCount(1);
  await expect(page.getByTestId("approval").filter({ hasText: "Release a send" })).toHaveCount(1);
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(reply()).not.toContainText("does mention the same words");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-phrase-delete")).toHaveCount(0);
  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Does a deletion not mention the same words as a send and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toContainText("Hand off to you");
  await expect(reply()).not.toContainText("does mention the same words");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("composer").fill("Hand deletions to me");
  await page.getByTestId("send").click();
  await expect(reply()).not.toContainText("does mention the same words");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("the vendor invoice");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByTestId("away-handoff")).toBeVisible();
  await page.screenshot({ path: "test-results/oriel-same-not-words.png" });
});

test("ORIEL-F56 a sentence asks which steps mention the same words as one step and does not act", async ({ page }) => {
  async function chooseAction(action: string) {
    const picker = page.getByTestId("rule-phrase-action");
    await expect(async () => {
      await picker.selectOption(action);
      await expect(picker).toHaveValue(action, { timeout: 500 });
    }).toPass();
  }

  async function narrow(action: string, phrase: string) {
    await chooseAction(action);
    const input = page.getByTestId("rule-phrase");
    await input.click();
    await input.fill(phrase);
    await expect(input).toHaveValue(phrase);
    await expect(page.getByTestId("rule-phrase-action")).toHaveValue(action);
    const saved = page.waitForResponse(
      (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
    );
    await page.getByTestId("rule-phrase-save").click();
    await saved;
  }

  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Which steps mention the same words as a deletion?");
  await expect(page.locator(".rule-note")).toContainText("Does a deletion mention the same words as a send?");
  await expect(page.locator(".rule-note")).toContainText("Does a deletion not mention the same words as a send?");
  await page.getByTestId("composer").fill("Which steps mention the same words as a deletion?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("There is no handoff rule for a deletion");
  await expect(reply()).toContainText("named no other step");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("the same words as the deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which steps mention the same words as a note?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does not name a send, a payment, a deletion, or a public post");
  await expect(reply()).toContainText("did not open a card");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which steps mention the same words as a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("There is no handoff rule for a send");
  await expect(reply()).not.toContainText("the same words as the send");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("composer").fill("Which steps mention the same words as a deletion?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("names no words and is the whole deletion");
  await expect(reply()).toContainText("did not treat this question as a comparison with the other steps");
  await expect(reply()).not.toContainText("the same words as the deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await narrow("send", "Shared Project Files");
  await expect(page.getByTestId("rule-phrase-send")).toContainText("Shared Project Files");
  await narrow("delete", "shared project files");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await narrow("pay", "unshared project files");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("unshared project files");
  await narrow("post", "shared project files");
  await expect(page.getByTestId("rule-phrase-post")).toContainText("shared project files");
  await chooseAction("pay");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("unshared project files");
  await page.getByTestId("rule-phrase").fill("notes I just typed");
  await page.getByTestId("rule-phrase-action").dispatchEvent("change");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("notes I just typed");
  await chooseAction("delete");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("shared project files");
  await page.getByTestId("composer").fill("Please, which steps mention the same words as a deletion?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps mention the same words as the deletion");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).toContainText("The send and The public post use them");
  await expect(reply()).not.toContainText("The payment");
  await expect(reply()).not.toContainText("unshared project files");
  await expect(reply()).not.toContainText("The deletion");
  await expect(reply()).not.toContainText("the whole");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await page.getByTestId("composer").fill("Which steps mention the same words as a deletion handed over to you?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await expect(reply()).toContainText("These steps mention the same words as the deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which steps mention the same words as a payment to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("No other step mentions the same words as the payment");
  await expect(reply()).toContainText("unshared project files");
  await expect(reply()).not.toContainText("These steps mention the same words");
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which steps mention the same words as a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps mention the same words as the send");
  await expect(reply()).toContainText("Shared Project Files");
  await expect(reply()).toContainText("The deletion and The public post use them");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Does a deletion mention the same words as a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion mentions the same words as the send");
  await expect(reply()).not.toContainText("These steps mention the same words");
  await expect(reply()).not.toContainText("No other step mentions the same words");

  await page.getByTestId("composer").fill("Does a deletion not mention the same words as a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does mention the same words as the send");
  await expect(reply()).not.toContainText("These steps mention the same words");
  await expect(reply()).not.toContainText("The deletion mentions the same words as the send.");

  await page.getByTestId("composer").fill("Which step mentions shared project files?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("the same words as the deletion");

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which steps mention the same words as a deletion and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval")).toContainText("Release a deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(reply()).not.toContainText("These steps mention the same words");
  await expect(reply()).not.toContainText("No other step mentions the same words");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-phrase-delete")).toHaveCount(0);
  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which steps mention the same words as a deletion and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toContainText("Hand off to you");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(reply()).not.toContainText("These steps mention the same words");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("composer").fill("Hand deletions to me");
  await page.getByTestId("send").click();
  await expect(reply()).not.toContainText("These steps mention the same words");
  await expect(reply()).not.toContainText("No other step mentions the same words");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("unshared project files");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByTestId("away-handoff")).toBeVisible();
  await page.screenshot({ path: "test-results/oriel-steps-mention-same.png" });
});

test("ORIEL-F57 a sentence asks which steps do not mention the same words as one step and does not act", async ({ page }) => {
  async function chooseAction(action: string) {
    const picker = page.getByTestId("rule-phrase-action");
    await expect(async () => {
      await picker.selectOption(action);
      await expect(picker).toHaveValue(action, { timeout: 500 });
    }).toPass();
  }

  async function narrow(action: string, phrase: string) {
    await chooseAction(action);
    const input = page.getByTestId("rule-phrase");
    await input.click();
    await input.fill(phrase);
    await expect(input).toHaveValue(phrase);
    await expect(page.getByTestId("rule-phrase-action")).toHaveValue(action);
    const saved = page.waitForResponse(
      (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
    );
    await page.getByTestId("rule-phrase-save").click();
    await saved;
  }

  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Which steps do not mention the same words as a deletion?");
  await expect(page.locator(".rule-note")).toContainText("Which steps mention the same words as a deletion?");
  await expect(page.locator(".rule-note")).toContainText("Which steps do not mention shared project files?");
  await page.getByTestId("composer").fill("Which steps do not mention the same words as a deletion?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("There is no handoff rule for a deletion");
  await expect(reply()).toContainText("named no other step");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("the same words as the deletion");
  await expect(reply()).not.toContainText("These steps do mention the same words");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which steps do not mention the same words as a note?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does not name a send, a payment, a deletion, or a public post");
  await expect(reply()).toContainText("did not open a card");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which steps do not mention the same words as a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("There is no handoff rule for a send");
  await expect(reply()).not.toContainText("the same words as the send");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("composer").fill("Which steps do not mention the same words as a deletion?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("names no words and is the whole deletion");
  await expect(reply()).toContainText("did not treat this question as a comparison with the other steps");
  await expect(reply()).not.toContainText("the same words as the deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await narrow("send", "Shared Project Files");
  await expect(page.getByTestId("rule-phrase-send")).toContainText("Shared Project Files");
  await narrow("delete", "shared project files");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await narrow("pay", "unshared project files");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("unshared project files");
  await narrow("post", "shared project files");
  await expect(page.getByTestId("rule-phrase-post")).toContainText("shared project files");
  await chooseAction("pay");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("unshared project files");
  await page.getByTestId("rule-phrase").fill("notes I just typed");
  await page.getByTestId("rule-phrase-action").dispatchEvent("change");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("notes I just typed");
  await chooseAction("delete");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("shared project files");
  await page.getByTestId("composer").fill("Please, which steps do not mention the same words as a deletion?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps do mention the same words as the deletion");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).toContainText("The send and The public post use them");
  await expect(reply()).not.toContainText("These steps mention the same words");
  await expect(reply()).not.toContainText("The payment");
  await expect(reply()).not.toContainText("unshared project files");
  await expect(reply()).not.toContainText("The deletion");
  await expect(reply()).not.toContainText("the whole");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await page.getByTestId("composer").fill("Which steps do not mention the same words as a deletion handed over to you?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await expect(reply()).toContainText("These steps do mention the same words as the deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which steps do not mention the same words as a payment to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("No other step mentions the same words as the payment");
  await expect(reply()).toContainText("unshared project files");
  await expect(reply()).not.toContainText("No other step does mention");
  await expect(reply()).not.toContainText("These steps do mention the same words");
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which steps do not mention the same words as a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps do mention the same words as the send");
  await expect(reply()).toContainText("Shared Project Files");
  await expect(reply()).toContainText("The deletion and The public post use them");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which steps mention the same words as a deletion?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps mention the same words as the deletion");
  await expect(reply()).not.toContainText("These steps do mention the same words");

  await page.getByTestId("composer").fill("Which steps do not mention shared project files?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does not mention those words");
  await expect(reply()).not.toContainText("the same words as the deletion");
  await expect(reply()).not.toContainText("does mention the same words");

  await page.getByTestId("composer").fill("Does a deletion mention the same words as a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion mentions the same words as the send");
  await expect(reply()).not.toContainText("These steps do mention the same words");

  await page.getByTestId("composer").fill("Does a deletion not mention the same words as a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does mention the same words as the send");
  await expect(reply()).not.toContainText("These steps do mention the same words");
  await expect(reply()).not.toContainText("The deletion mentions the same words as the send.");

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which steps do not mention the same words as a deletion and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval")).toContainText("Release a deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(reply()).not.toContainText("These steps do mention the same words");
  await expect(reply()).not.toContainText("No other step mentions the same words");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-phrase-delete")).toHaveCount(0);
  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which steps do not mention the same words as a deletion and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toContainText("Hand off to you");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(reply()).not.toContainText("These steps do mention the same words");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("composer").fill("Hand deletions to me");
  await page.getByTestId("send").click();
  await expect(reply()).not.toContainText("These steps do mention the same words");
  await expect(reply()).not.toContainText("No other step mentions the same words");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("unshared project files");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByTestId("away-handoff")).toBeVisible();
  await page.screenshot({ path: "test-results/oriel-steps-not-mention-same.png" });
});

test("ORIEL-F58 a sentence asks which words one step mentions and does not act", async ({ page }) => {
  async function chooseAction(action: string) {
    const picker = page.getByTestId("rule-phrase-action");
    await expect(async () => {
      await picker.selectOption(action);
      await expect(picker).toHaveValue(action, { timeout: 500 });
    }).toPass();
  }

  async function narrow(action: string, phrase: string) {
    await chooseAction(action);
    const input = page.getByTestId("rule-phrase");
    await input.click();
    await input.fill(phrase);
    await expect(input).toHaveValue(phrase);
    await expect(page.getByTestId("rule-phrase-action")).toHaveValue(action);
    const saved = page.waitForResponse(
      (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
    );
    await page.getByTestId("rule-phrase-save").click();
    await saved;
  }

  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Which words does a deletion mention?");
  await expect(page.locator(".rule-note")).toContainText("Which words does a deletion share?");
  await expect(page.locator(".rule-note")).toContainText("Which steps do not mention the same words as a deletion?");
  await page.getByTestId("composer").fill("Which words does a deletion mention?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("There is no handoff rule for a deletion");
  await expect(reply()).toContainText("named no other step");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("mentions these words");
  await expect(reply()).not.toContainText("with the deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a note mention?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does not name a send, a payment, a deletion, or a public post");
  await expect(reply()).toContainText("did not open a card");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a send mention?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("There is no handoff rule for a send");
  await expect(reply()).not.toContainText("mentions these words");
  await expect(reply()).not.toContainText("with the send");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("composer").fill("Which words does a deletion mention?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("names no words and is the whole deletion");
  await expect(reply()).toContainText("did not treat this question as a mention and did not quote a phrase");
  await expect(reply()).not.toContainText("mentions these words");
  await expect(reply()).not.toContainText("with the deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await narrow("send", "Shared Project Files");
  await expect(page.getByTestId("rule-phrase-send")).toContainText("Shared Project Files");
  await narrow("delete", "shared project files");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await narrow("pay", "unshared project files");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("unshared project files");
  await narrow("post", "shared project files");
  await expect(page.getByTestId("rule-phrase-post")).toContainText("shared project files");
  await chooseAction("pay");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("unshared project files");
  await page.getByTestId("rule-phrase").fill("notes I just typed");
  await page.getByTestId("rule-phrase-action").dispatchEvent("change");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("notes I just typed");
  await chooseAction("delete");
  await expect(page.getByTestId("rule-phrase")).toHaveValue("shared project files");
  await page.getByTestId("composer").fill("Please, which words does a deletion mention?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion mentions these words");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).toContainText("named no other step");
  await expect(reply()).not.toContainText("The send");
  await expect(reply()).not.toContainText("The public post");
  await expect(reply()).not.toContainText("use them");
  await expect(reply()).not.toContainText("with the deletion");
  await expect(reply()).not.toContainText("These steps mention the same words");
  await expect(reply()).not.toContainText("The payment");
  await expect(reply()).not.toContainText("unshared project files");
  await expect(reply()).not.toContainText("the whole");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await page.getByTestId("composer").fill("Which words does a deletion mention handed over to you?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toContainText("Wakes paused");
  await expect(reply()).toContainText("The deletion mentions these words");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a payment mention to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The payment mentions these words");
  await expect(reply()).toContainText("unshared project files");
  await expect(reply()).not.toContainText("The deletion");
  await expect(reply()).not.toContainText("use them");
  await expect(reply()).not.toContainText("with the payment");
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a send mention?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The send mentions these words");
  await expect(reply()).toContainText("Shared Project Files");
  await expect(reply()).toContainText("named no other step");
  await expect(reply()).not.toContainText("The deletion");
  await expect(reply()).not.toContainText("The public post");
  await expect(reply()).not.toContainText("use them");
  await expect(reply()).not.toContainText("with the send");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a deletion hand to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("mentions these words");

  await page.getByTestId("composer").fill("Which words does a deletion share?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion shares these words");
  await expect(reply()).not.toContainText("mentions these words");

  await page.getByTestId("composer").fill("Which steps do not mention the same words as a deletion?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("do mention the same words as the deletion");
  await expect(reply()).not.toContainText("mentions these words");

  await page.getByTestId("composer").fill("Does a deletion mention shared project files?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("mentions those words");
  await expect(reply()).not.toContainText("mentions these words");

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which words does a deletion mention and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval")).toContainText("Release a deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(reply()).not.toContainText("mentions these words");
  await expect(reply()).not.toContainText("These words are mentioned once");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-phrase-delete")).toHaveCount(0);
  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which words does a deletion mention and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("handoff")).toContainText("Hand off to you");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(reply()).not.toContainText("mentions these words");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("thread")).not.toContainText("I deleted");

  await page.getByTestId("composer").fill("Hand deletions to me");
  await page.getByTestId("send").click();
  await expect(reply()).not.toContainText("mentions these words");
  await expect(reply()).not.toContainText("These words are mentioned once");
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await expect(page.getByTestId("rule-phrase-pay")).toContainText("unshared project files");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByTestId("away-handoff")).toBeVisible();
  await page.screenshot({ path: "test-results/oriel-words-one-step-mentions.png" });
});

test("ORIEL-F59 a sentence asks which words one step does not mention and does not act", async ({ page }) => {
  async function chooseAction(action: string) {
    const picker = page.getByTestId("rule-phrase-action");
    await expect(async () => {
      await picker.selectOption(action);
      await expect(picker).toHaveValue(action, { timeout: 500 });
    }).toPass();
  }

  async function narrow(action: string, phrase: string) {
    await chooseAction(action);
    const input = page.getByTestId("rule-phrase");
    await input.click();
    await input.fill(phrase);
    await expect(input).toHaveValue(phrase);
    await expect(page.getByTestId("rule-phrase-action")).toHaveValue(action);
    const saved = page.waitForResponse(
      (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
    );
    await page.getByTestId("rule-phrase-save").click();
    await saved;
  }

  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Which words does a deletion not mention?");
  await expect(page.locator(".rule-note")).toContainText("Which words does a deletion mention?");
  await page.getByTestId("composer").fill("Which words does a deletion not mention?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("There is no handoff rule for a deletion");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("does mention these words");
  await expect(reply()).not.toContainText("mentions these words");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a note not mention?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does not name a send, a payment, a deletion, or a public post");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a send not mention?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("There is no handoff rule for a send");
  await expect(reply()).not.toContainText("does mention these words");
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("composer").fill("Which words does a deletion not mention?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("names no words and is the whole deletion");
  await expect(reply()).toContainText("did not treat this question as a mention");
  await expect(reply()).not.toContainText("does mention these words");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await narrow("send", "Shared Project Files");
  await narrow("delete", "shared project files");
  await narrow("pay", "unshared project files");
  await narrow("post", "shared project files");
  await page.getByTestId("composer").fill("Please, which words does a deletion not mention?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion does mention these words");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("The deletion mentions these words");
  await expect(reply()).not.toContainText("The send");
  await expect(reply()).not.toContainText("The payment");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a deletion mention?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion mentions these words");
  await expect(reply()).not.toContainText("does mention these words");

  await page.getByTestId("composer").fill("Which words does a payment not mention to me?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The payment does mention these words");
  await expect(reply()).toContainText("unshared project files");
  await expect(reply()).not.toContainText("The deletion");
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a send not mention?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The send does mention these words");
  await expect(reply()).toContainText("Shared Project Files");
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a deletion share?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("shares these words");
  await expect(reply()).not.toContainText("does mention these words");

  await page.getByTestId("composer").fill("Does a deletion not mention shared project files?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does mention those words");
  await expect(reply()).not.toContainText("does mention these words");

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which words does a deletion not mention and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval")).toContainText("Release a deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(reply()).not.toContainText("does mention these words");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-words-one-step-does-not-mention.png" });
});

test("ORIEL-F60 a sentence asks which words one step mentions with one other step and does not act", async ({ page }) => {
  async function chooseAction(action: string) {
    const picker = page.getByTestId("rule-phrase-action");
    await expect(async () => {
      await picker.selectOption(action);
      await expect(picker).toHaveValue(action, { timeout: 500 });
    }).toPass();
  }

  async function narrow(action: string, phrase: string) {
    await chooseAction(action);
    const input = page.getByTestId("rule-phrase");
    await input.click();
    await input.fill(phrase);
    await expect(input).toHaveValue(phrase);
    await expect(page.getByTestId("rule-phrase-action")).toHaveValue(action);
    const saved = page.waitForResponse(
      (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
    );
    await page.getByTestId("rule-phrase-save").click();
    await saved;
  }

  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Which words does a deletion mention with a send?");
  await expect(page.locator(".rule-note")).toContainText("Which words does a deletion not mention?");
  await page.getByTestId("composer").fill("Which words does a deletion mention with a send?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("There is no handoff rule for a deletion");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("mentions these words with the send");
  await expect(reply()).not.toContainText("does not mention these words with the send");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a note mention with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does not name two different steps");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a send mention with a deletion?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("There is no handoff rule for a send");
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("composer").fill("Which words does a deletion mention with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("names no words and is the whole deletion");
  await expect(reply()).toContainText("did not treat this question as a mention with the other step");
  await expect(reply()).not.toContainText("with the send");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await narrow("send", "Shared Project Files");
  await narrow("delete", "shared project files");
  await narrow("pay", "unshared project files");
  await page.getByTestId("composer").fill("Please, which words does a deletion mention with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion mentions these words with the send");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("The deletion mentions these words.");
  await expect(reply()).not.toContainText("The send");
  await expect(reply()).not.toContainText("The payment");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a deletion mention?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion mentions these words");
  await expect(reply()).not.toContainText("with the send");

  await page.getByTestId("composer").fill("Which words does a deletion not mention?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion does mention these words");
  await expect(reply()).not.toContainText("with the send");

  await chooseAction("send");
  const input = page.getByTestId("rule-phrase");
  await input.click();
  await input.fill("unshared project files");
  const saved = page.waitForResponse(
    (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
  );
  await page.getByTestId("rule-phrase-save").click();
  await saved;
  await page.getByTestId("composer").fill("Which words does a deletion mention with a send to you?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion does not mention these words with the send");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("unshared project files");
  await expect(reply()).not.toContainText("Those words are used once");
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which words does a deletion mention with a send and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval").filter({ hasText: "Release a deletion" })).toHaveCount(1);
  await expect(page.getByTestId("approval").filter({ hasText: "Release a send" })).toHaveCount(1);
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(reply()).not.toContainText("mentions these words with the send");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-words-one-step-mentions-with.png" });
});

test("ORIEL-F61 a sentence asks which words one step does not mention with one other step and does not act", async ({ page }) => {
  async function chooseAction(action: string) {
    const picker = page.getByTestId("rule-phrase-action");
    await expect(async () => {
      await picker.selectOption(action);
      await expect(picker).toHaveValue(action, { timeout: 500 });
    }).toPass();
  }

  async function narrow(action: string, phrase: string) {
    await chooseAction(action);
    const input = page.getByTestId("rule-phrase");
    await input.click();
    await input.fill(phrase);
    await expect(input).toHaveValue(phrase);
    await expect(page.getByTestId("rule-phrase-action")).toHaveValue(action);
    const saved = page.waitForResponse(
      (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
    );
    await page.getByTestId("rule-phrase-save").click();
    await saved;
  }

  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Which words does a deletion not mention with a send?");
  await expect(page.locator(".rule-note")).toContainText("Which words does a deletion mention with a send?");
  await page.getByTestId("composer").fill("Which words does a deletion not mention with a send?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("There is no handoff rule for a deletion");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("does mention these words with the send");
  await expect(reply()).not.toContainText("does not mention these words with the send");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a note not mention with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does not name two different steps");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a send not mention with a deletion?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("There is no handoff rule for a send");
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("composer").fill("Which words does a deletion not mention with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("names no words and is the whole deletion");
  await expect(reply()).toContainText("did not treat this question as a mention with the other step");
  await expect(reply()).not.toContainText("with the send");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await narrow("send", "Shared Project Files");
  await narrow("delete", "shared project files");
  await narrow("pay", "unshared project files");
  await page.getByTestId("composer").fill("Please, which words does a deletion not mention with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion does mention these words with the send");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("The deletion mentions these words with the send");
  await expect(reply()).not.toContainText("The send");
  await expect(reply()).not.toContainText("The payment");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words does a deletion mention with a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion mentions these words with the send");
  await expect(reply()).not.toContainText("The deletion does mention these words with the send");

  await page.getByTestId("composer").fill("Which words does a deletion not mention?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion does mention these words");
  await expect(reply()).not.toContainText("with the send");

  await chooseAction("send");
  const input = page.getByTestId("rule-phrase");
  await input.click();
  await input.fill("unshared project files");
  const saved = page.waitForResponse(
    (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
  );
  await page.getByTestId("rule-phrase-save").click();
  await saved;
  await page.getByTestId("composer").fill("Which words does a deletion not mention with a send to you?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion does not mention these words with the send");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("unshared project files");
  await expect(reply()).not.toContainText("Those words are used once");
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which words does a deletion not mention with a send and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval").filter({ hasText: "Release a deletion" })).toHaveCount(1);
  await expect(page.getByTestId("approval").filter({ hasText: "Release a send" })).toHaveCount(1);
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(reply()).not.toContainText("does mention these words with the send");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-words-one-step-does-not-mention-with.png" });
});

test("ORIEL-F62 a sentence asks whether one step mentions the same words and does not act", async ({ page }) => {
  async function chooseAction(action: string) {
    const picker = page.getByTestId("rule-phrase-action");
    await expect(async () => {
      await picker.selectOption(action);
      await expect(picker).toHaveValue(action, { timeout: 500 });
    }).toPass();
  }

  async function narrow(action: string, phrase: string) {
    await chooseAction(action);
    const input = page.getByTestId("rule-phrase");
    await input.click();
    await input.fill(phrase);
    await expect(input).toHaveValue(phrase);
    await expect(page.getByTestId("rule-phrase-action")).toHaveValue(action);
    const saved = page.waitForResponse(
      (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
    );
    await page.getByTestId("rule-phrase-save").click();
    await saved;
  }

  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Does a deletion mention the same words?");
  await expect(page.locator(".rule-note")).toContainText("Which words does a deletion not mention with a send?");
  await page.getByTestId("composer").fill("Does a deletion mention the same words?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("There is no handoff rule for a deletion");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("mentions the same words.");
  await expect(reply()).not.toContainText("does not mention the same words");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Does a note mention the same words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does not name a send, a payment, a deletion, or a public post");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("composer").fill("Does a deletion mention the same words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("names no words and is the whole deletion");
  await expect(reply()).toContainText("did not treat this question as the same words");
  await expect(reply()).not.toContainText("mentions the same words.");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await narrow("send", "Shared Project Files");
  await narrow("delete", "shared project files");
  await narrow("pay", "unshared project files");
  await page.getByTestId("composer").fill("Please, does a deletion mention the same words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion mentions the same words.");
  await expect(reply()).toContainText("The send uses them.");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("The deletion mentions the same words as the send");
  await expect(reply()).not.toContainText("The payment");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Does a deletion mention the same words as a send?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion mentions the same words as the send");
  await expect(reply()).not.toContainText("The deletion mentions the same words.");

  await chooseAction("send");
  const input = page.getByTestId("rule-phrase");
  await input.click();
  await input.fill("unshared project files");
  const saved = page.waitForResponse(
    (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
  );
  await page.getByTestId("rule-phrase-save").click();
  await saved;
  await page.getByTestId("composer").fill("Does a deletion mention the same words to you?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion does not mention the same words.");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("unshared project files");
  await expect(reply()).not.toContainText("Those words are used once");
  await expect(reply()).not.toContainText("The send");
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Does a deletion mention the same words and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval").filter({ hasText: "Release a deletion" })).toHaveCount(1);
  await expect(page.getByTestId("approval").filter({ hasText: "Release a send" })).toHaveCount(0);
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(reply()).not.toContainText("mentions the same words.");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-same-words.png" });
});

test("ORIEL-F63 a sentence asks whether one step does not mention the same words and does not act", async ({ page }) => {
  async function chooseAction(action: string) {
    const picker = page.getByTestId("rule-phrase-action");
    await expect(async () => {
      await picker.selectOption(action);
      await expect(picker).toHaveValue(action, { timeout: 500 });
    }).toPass();
  }

  async function narrow(action: string, phrase: string) {
    await chooseAction(action);
    const input = page.getByTestId("rule-phrase");
    await input.click();
    await input.fill(phrase);
    await expect(input).toHaveValue(phrase);
    await expect(page.getByTestId("rule-phrase-action")).toHaveValue(action);
    const saved = page.waitForResponse(
      (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
    );
    await page.getByTestId("rule-phrase-save").click();
    await saved;
  }

  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Does a deletion not mention the same words?");
  await expect(page.locator(".rule-note")).toContainText("Does a deletion mention the same words?");
  await page.getByTestId("composer").fill("Does a deletion not mention the same words?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("There is no handoff rule for a deletion");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("does mention the same words");
  await expect(reply()).not.toContainText("does not mention the same words");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Does a note not mention the same words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("does not name a send, a payment, a deletion, or a public post");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await page.getByTestId("composer").fill("Does a deletion not mention the same words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("names no words and is the whole deletion");
  await expect(reply()).toContainText("did not treat this question as the same words");
  await expect(reply()).not.toContainText("does mention the same words");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await narrow("send", "Shared Project Files");
  await narrow("delete", "shared project files");
  await narrow("pay", "unshared project files");
  await page.getByTestId("composer").fill("Please, does a deletion not mention the same words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion does mention the same words.");
  await expect(reply()).toContainText("The send uses them.");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("The deletion mentions the same words");
  await expect(reply()).not.toContainText("The payment");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Does a deletion mention the same words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion mentions the same words.");
  await expect(reply()).not.toContainText("The deletion does mention the same words");

  await chooseAction("send");
  const input = page.getByTestId("rule-phrase");
  await input.click();
  await input.fill("unshared project files");
  const saved = page.waitForResponse(
    (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
  );
  await page.getByTestId("rule-phrase-save").click();
  await saved;
  await page.getByTestId("composer").fill("Does a deletion not mention the same words to you?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion does not mention the same words.");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("The deletion does mention the same words.");
  await expect(reply()).not.toContainText("unshared project files");
  await expect(reply()).not.toContainText("Those words are used once");
  await expect(reply()).not.toContainText("The send");
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Does a deletion not mention the same words and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval").filter({ hasText: "Release a deletion" })).toHaveCount(1);
  await expect(page.getByTestId("approval").filter({ hasText: "Release a send" })).toHaveCount(0);
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(reply()).not.toContainText("does mention the same words");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-not-same-words.png" });
});

test("ORIEL-F64 a sentence asks which steps mention the same words and does not act", async ({ page }) => {
  async function chooseAction(action: string) {
    const picker = page.getByTestId("rule-phrase-action");
    await expect(async () => {
      await picker.selectOption(action);
      await expect(picker).toHaveValue(action, { timeout: 500 });
    }).toPass();
  }

  async function narrow(action: string, phrase: string) {
    await chooseAction(action);
    const input = page.getByTestId("rule-phrase");
    await input.click();
    await input.fill(phrase);
    await expect(input).toHaveValue(phrase);
    await expect(page.getByTestId("rule-phrase-action")).toHaveValue(action);
    const saved = page.waitForResponse(
      (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
    );
    await page.getByTestId("rule-phrase-save").click();
    await saved;
  }

  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Which steps mention the same words?");
  await expect(page.locator(".rule-note")).toContainText("Does a deletion not mention the same words?");
  await page.getByTestId("composer").fill("Which steps mention the same words?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("No steps mention the same words");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("These steps mention the same words");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which steps mention the same words as a deletion?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("There is no handoff rule for a deletion");
  await expect(reply()).not.toContainText("No steps mention the same words");
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which steps do not mention the same words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("No step mentions words only once");
  await expect(reply()).not.toContainText("No step does not mention");
  await expect(reply()).not.toContainText("No steps mention the same words");
  await expect(page.locator(".goal")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await narrow("send", "the vendor files");
  await page.getByTestId("composer").fill("Which steps mention the same words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("No steps mention the same words");
  await expect(reply()).not.toContainText("the whole");
  await expect(reply()).not.toContainText("the vendor files");
  await expect(reply()).not.toContainText("The deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await narrow("delete", "shared project files");
  await chooseAction("send");
  const input = page.getByTestId("rule-phrase");
  await input.click();
  await input.fill("Shared Project Files");
  const saved = page.waitForResponse(
    (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
  );
  await page.getByTestId("rule-phrase-save").click();
  await saved;
  await narrow("pay", "unshared project files");
  await page.getByTestId("composer").fill("Please, which steps mention the same words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps mention the same words.");
  await expect(reply()).toContainText("The send is handed to you");
  await expect(reply()).toContainText("The deletion is handed to you");
  await expect(reply()).toContainText("shared project files");
  await expect(reply()).not.toContainText("The payment");
  await expect(reply()).not.toContainText("unshared project files");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which steps mention the same words as a deletion?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The send mentions the same words as the deletion");
  await expect(reply()).not.toContainText("These steps mention the same words.");

  await page.getByTestId("composer").fill("Which steps share words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps share words");
  await expect(reply()).not.toContainText("These steps mention the same words.");

  await page.getByTestId("composer").fill("Does a deletion not mention the same words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion does mention the same words.");
  await expect(reply()).not.toContainText("These steps mention the same words.");

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which steps mention the same words and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval").filter({ hasText: "Release a deletion" })).toHaveCount(1);
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(reply()).not.toContainText("These steps mention the same words.");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-mention-same-steps.png" });
});

test("ORIEL-F65 a sentence asks which steps do not mention the same words and does not act", async ({ page }) => {
  async function chooseAction(action: string) {
    const picker = page.getByTestId("rule-phrase-action");
    await expect(async () => {
      await picker.selectOption(action);
      await expect(picker).toHaveValue(action, { timeout: 500 });
    }).toPass();
  }

  async function narrow(action: string, phrase: string) {
    await chooseAction(action);
    const input = page.getByTestId("rule-phrase");
    await input.click();
    await input.fill(phrase);
    await expect(input).toHaveValue(phrase);
    await expect(page.getByTestId("rule-phrase-action")).toHaveValue(action);
    const saved = page.waitForResponse(
      (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
    );
    await page.getByTestId("rule-phrase-save").click();
    await saved;
  }

  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Which steps do not mention the same words?");
  await expect(page.locator(".rule-note")).toContainText("Which steps mention the same words?");
  await page.getByTestId("composer").fill("Which steps do not mention the same words?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("No step mentions words only once");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("These steps do not mention the same words");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which steps do not mention the same words as a deletion?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("There is no handoff rule for a deletion");
  await expect(reply()).not.toContainText("No step mentions words only once");
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which steps mention the same words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("No steps mention the same words");
  await expect(reply()).not.toContainText("No step mentions words only once");
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await narrow("send", "the vendor files");
  await page.getByTestId("composer").fill("Which steps do not mention the same words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps do not mention the same words.");
  await expect(reply()).toContainText("The send is handed to you");
  await expect(reply()).toContainText("the vendor files");
  await expect(reply()).not.toContainText("the whole");
  await expect(reply()).not.toContainText("The deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await narrow("delete", "shared project files");
  await chooseAction("send");
  const input = page.getByTestId("rule-phrase");
  await input.click();
  await input.fill("Shared Project Files");
  const saved = page.waitForResponse(
    (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
  );
  await page.getByTestId("rule-phrase-save").click();
  await saved;
  await narrow("pay", "unshared project files");
  await page.getByTestId("composer").fill("Please, which steps do not mention the same words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps do not mention the same words.");
  await expect(reply()).toContainText("The payment is handed to you");
  await expect(reply()).toContainText("unshared project files");
  await expect(reply()).not.toContainText("The send is handed to you");
  await expect(reply()).not.toContainText("The deletion is handed to you");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which steps mention the same words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps mention the same words.");
  await expect(reply()).toContainText("The send is handed to you");
  await expect(reply()).not.toContainText("These steps do not mention the same words");

  await page.getByTestId("composer").fill("Which steps do not mention the same words as a deletion?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The send does mention the same words as the deletion");
  await expect(reply()).not.toContainText("No step mentions words only once");

  await page.getByTestId("composer").fill("Does a deletion not mention the same words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("The deletion does mention the same words.");
  await expect(reply()).not.toContainText("No step mentions words only once");

  await page.getByTestId("composer").fill("Which steps do not share words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps use words once");
  await expect(reply()).not.toContainText("These steps do not mention the same words");

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which steps do not mention the same words on this saved desk and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval").filter({ hasText: "Release a deletion" })).toHaveCount(1);
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(reply()).not.toContainText("These steps do not mention the same words.");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-not-mention-same-steps.png" });
});

test("ORIEL-F66 a sentence asks which words are not mentioned and does not act", async ({ page }) => {
  async function chooseAction(action: string) {
    const picker = page.getByTestId("rule-phrase-action");
    await expect(async () => {
      await picker.selectOption(action);
      await expect(picker).toHaveValue(action, { timeout: 500 });
    }).toPass();
  }

  async function narrow(action: string, phrase: string) {
    await chooseAction(action);
    const input = page.getByTestId("rule-phrase");
    await input.click();
    await input.fill(phrase);
    await expect(input).toHaveValue(phrase);
    await expect(page.getByTestId("rule-phrase-action")).toHaveValue(action);
    const saved = page.waitForResponse(
      (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
    );
    await page.getByTestId("rule-phrase-save").click();
    await saved;
  }

  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Which words are not mentioned?");
  await expect(page.locator(".rule-note")).toContainText("Which steps do not mention the same words?");
  await page.getByTestId("composer").fill("Which words are not mentioned?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("No words are mentioned only once");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("These words are not mentioned");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words are mentioned?");
  await page.getByTestId("send").click();
  await expect(page.locator(".goal")).toHaveCount(0);
  await expect(reply()).toContainText("No words are mentioned.");
  await expect(reply()).not.toContainText("No words are mentioned only once");
  await expect(reply()).not.toContainText("These words are not mentioned");
  await expect(reply()).not.toContainText("These words are mentioned");

  await page.getByTestId("composer").fill("Which words are not shared?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("No words are used once");
  await expect(reply()).not.toContainText("No words are mentioned only once");

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await narrow("send", "the vendor files");
  await page.getByTestId("composer").fill("Which words are not mentioned?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These words are not mentioned.");
  await expect(reply()).toContainText("the vendor files");
  await expect(reply()).toContainText("The send");
  await expect(reply()).not.toContainText("the whole");
  await expect(reply()).not.toContainText("The deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await narrow("delete", "shared project files");
  await chooseAction("send");
  const input = page.getByTestId("rule-phrase");
  await input.click();
  await input.fill("Shared Project Files");
  const saved = page.waitForResponse(
    (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
  );
  await page.getByTestId("rule-phrase-save").click();
  await saved;
  await narrow("pay", "unshared project files");
  await page.getByTestId("composer").fill("Please, which words are not mentioned?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These words are not mentioned.");
  await expect(reply()).toContainText("unshared project files");
  await expect(reply()).toContainText("The payment");
  await expect(reply()).not.toContainText("The send is handed to you");
  await expect(reply()).not.toContainText("The deletion is handed to you");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words are not shared?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These words are used once");
  await expect(reply()).toContainText("The payment");
  await expect(reply()).not.toContainText("These words are not mentioned");

  await page.getByTestId("composer").fill("Which steps do not mention the same words?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These steps do not mention the same words.");
  await expect(reply()).toContainText("The payment is handed to you");
  await expect(reply()).not.toContainText("These words are not mentioned.");

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which words are not mentioned and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval").filter({ hasText: "Release a deletion" })).toHaveCount(1);
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(reply()).not.toContainText("These words are not mentioned.");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-unmentioned-words.png" });
});

test("ORIEL-F67 a sentence asks which words are mentioned and does not act", async ({ page }) => {
  async function chooseAction(action: string) {
    const picker = page.getByTestId("rule-phrase-action");
    await expect(async () => {
      await picker.selectOption(action);
      await expect(picker).toHaveValue(action, { timeout: 500 });
    }).toPass();
  }

  async function narrow(action: string, phrase: string) {
    await chooseAction(action);
    const input = page.getByTestId("rule-phrase");
    await input.click();
    await input.fill(phrase);
    await expect(input).toHaveValue(phrase);
    await expect(page.getByTestId("rule-phrase-action")).toHaveValue(action);
    const saved = page.waitForResponse(
      (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
    );
    await page.getByTestId("rule-phrase-save").click();
    await saved;
  }

  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Which words are mentioned?");
  await expect(page.locator(".rule-note")).toContainText("Which words are not mentioned?");
  await page.getByTestId("composer").fill("Which words are mentioned?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("No words are mentioned.");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("These words are mentioned");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words are mentioned once?");
  await page.getByTestId("send").click();
  await expect(page.locator(".goal")).toHaveCount(0);
  await expect(reply()).toContainText("No words are mentioned once.");
  await expect(reply()).not.toContainText("No words are mentioned.");
  await expect(reply()).not.toContainText("These words are mentioned.");

  await page.getByTestId("composer").fill("Which words are not mentioned?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("No words are mentioned only once");
  await expect(reply()).not.toContainText("No words are mentioned.");

  await page.getByTestId("composer").fill("Which words are shared?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("No words are shared");
  await expect(reply()).not.toContainText("No words are mentioned.");

  await page.getByTestId("composer").fill("Which words are not shared?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("No words are used once");
  await expect(reply()).not.toContainText("No words are mentioned.");

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await narrow("send", "the vendor files");
  await page.getByTestId("composer").fill("Which words are mentioned?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("No words are mentioned.");
  await expect(reply()).not.toContainText("the vendor files");
  await expect(reply()).not.toContainText("the whole");
  await expect(reply()).not.toContainText("The send");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await narrow("delete", "shared project files");
  await chooseAction("send");
  const input = page.getByTestId("rule-phrase");
  await input.click();
  await input.fill("Shared Project Files");
  const saved = page.waitForResponse(
    (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
  );
  await page.getByTestId("rule-phrase-save").click();
  await saved;
  await narrow("pay", "unshared project files");
  await page.getByTestId("composer").fill("Please, which words are mentioned?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These words are mentioned.");
  await expect(reply()).toContainText("Shared Project Files");
  await expect(reply()).toContainText("The send and The deletion");
  await expect(reply()).not.toContainText("unshared project files");
  await expect(reply()).not.toContainText("The payment is handed to you");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words are not mentioned?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These words are not mentioned.");
  await expect(reply()).toContainText("unshared project files");
  await expect(reply()).toContainText("The payment");
  await expect(reply()).not.toContainText("These words are mentioned.");

  await page.getByTestId("composer").fill("Which words are shared?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These words are shared");
  await expect(reply()).toContainText("The send and The deletion");
  await expect(reply()).not.toContainText("These words are mentioned");

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which words are mentioned and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval").filter({ hasText: "Release a deletion" })).toHaveCount(1);
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(reply()).not.toContainText("These words are mentioned.");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-mentioned-words.png" });
});

test("ORIEL-F68 a sentence asks which words are mentioned once and does not act", async ({ page }) => {
  async function chooseAction(action: string) {
    const picker = page.getByTestId("rule-phrase-action");
    await expect(async () => {
      await picker.selectOption(action);
      await expect(picker).toHaveValue(action, { timeout: 500 });
    }).toPass();
  }

  async function narrow(action: string, phrase: string) {
    await chooseAction(action);
    const input = page.getByTestId("rule-phrase");
    await input.click();
    await input.fill(phrase);
    await expect(input).toHaveValue(phrase);
    await expect(page.getByTestId("rule-phrase-action")).toHaveValue(action);
    const saved = page.waitForResponse(
      (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
    );
    await page.getByTestId("rule-phrase-save").click();
    await saved;
  }

  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Which words are mentioned once?");
  await expect(page.locator(".rule-note")).toContainText("Which words are mentioned?");
  await page.getByTestId("composer").fill("Which words are mentioned once?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("No words are mentioned once.");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("These words are mentioned once.");
  await expect(reply()).not.toContainText("No words are mentioned.");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words are mentioned?");
  await page.getByTestId("send").click();
  await expect(page.locator(".goal")).toHaveCount(0);
  await expect(reply()).toContainText("No words are mentioned.");
  await expect(reply()).not.toContainText("No words are mentioned once");

  await page.getByTestId("composer").fill("Which words are mentioned more than once?");
  await page.getByTestId("send").click();
  await expect(page.locator(".goal")).toHaveCount(0);
  await expect(reply()).toContainText("No words are mentioned more than once.");
  await expect(reply()).not.toContainText("These words are mentioned more than once");
  await expect(reply()).not.toContainText("No words are mentioned once.");
  await expect(reply()).not.toContainText("No words are mentioned.");

  await page.getByTestId("composer").fill("Which words are not mentioned?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("No words are mentioned only once");
  await expect(reply()).not.toContainText("No words are mentioned once.");

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await narrow("send", "the vendor files");
  await page.getByTestId("composer").fill("Which words are mentioned once?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These words are mentioned once.");
  await expect(reply()).toContainText("the vendor files");
  await expect(reply()).toContainText("The send");
  await expect(reply()).not.toContainText("the whole");
  await expect(reply()).not.toContainText("The deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);

  await narrow("delete", "shared project files");
  await chooseAction("send");
  const input = page.getByTestId("rule-phrase");
  await input.click();
  await input.fill("Shared Project Files");
  const saved = page.waitForResponse(
    (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
  );
  await page.getByTestId("rule-phrase-save").click();
  await saved;
  await narrow("pay", "unshared project files");
  await page.getByTestId("composer").fill("Please, which words are mentioned once?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These words are mentioned once.");
  await expect(reply()).toContainText("unshared project files");
  await expect(reply()).toContainText("The payment");
  await expect(reply()).not.toContainText("Shared Project Files");
  await expect(reply()).not.toContainText("The send and The deletion");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words are mentioned?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These words are mentioned.");
  await expect(reply()).toContainText("The send and The deletion");
  await expect(reply()).not.toContainText("These words are mentioned once");

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which words are mentioned once and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval").filter({ hasText: "Release a deletion" })).toHaveCount(1);
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(reply()).not.toContainText("These words are mentioned once.");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-mentioned-once.png" });
});

test("ORIEL-F69 a sentence asks which words are mentioned more than once and does not act", async ({ page }) => {
  async function chooseAction(action: string) {
    const picker = page.getByTestId("rule-phrase-action");
    await expect(async () => {
      await picker.selectOption(action);
      await expect(picker).toHaveValue(action, { timeout: 500 });
    }).toPass();
  }

  async function narrow(action: string, phrase: string) {
    await chooseAction(action);
    const input = page.getByTestId("rule-phrase");
    await input.click();
    await input.fill(phrase);
    await expect(input).toHaveValue(phrase);
    await expect(page.getByTestId("rule-phrase-action")).toHaveValue(action);
    const saved = page.waitForResponse(
      (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
    );
    await page.getByTestId("rule-phrase-save").click();
    await saved;
  }

  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Which words are mentioned more than once?");
  await expect(page.locator(".rule-note")).toContainText("Which words are mentioned once?");
  await expect(page.locator(".rule-note")).toContainText("Which words are mentioned?");
  await page.getByTestId("composer").fill("Which words are mentioned more than once?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("No words are mentioned more than once.");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("These words are mentioned more than once.");
  await expect(reply()).not.toContainText("No words are mentioned.");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words are mentioned?");
  await page.getByTestId("send").click();
  await expect(page.locator(".goal")).toHaveCount(0);
  await expect(reply()).toContainText("No words are mentioned.");
  await expect(reply()).not.toContainText("No words are mentioned more than once");

  await page.getByTestId("composer").fill("Which words are mentioned once?");
  await page.getByTestId("send").click();
  await expect(page.locator(".goal")).toHaveCount(0);
  await expect(reply()).toContainText("No words are mentioned once.");
  await expect(reply()).not.toContainText("No words are mentioned more than once");

  await page.getByTestId("composer").fill("Which words are mentioned only once?");
  await page.getByTestId("send").click();
  await expect(page.locator(".goal")).toHaveCount(0);
  await expect(reply()).toContainText("No saved words are mentioned only once.");
  await expect(reply()).not.toContainText("These words are mentioned more than once");

  await page.getByTestId("rule-delete").click();
  await expect(page.getByTestId("rule-whole-delete")).toContainText("the whole deletion");
  await narrow("send", "Shared Project Files");
  await narrow("delete", "shared project files");
  await narrow("pay", "the vendor invoice");
  await page.getByTestId("composer").fill("Please, which words are mentioned more than once?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These words are mentioned more than once.");
  await expect(reply()).toContainText("Shared Project Files");
  await expect(reply()).toContainText("The send and The deletion");
  await expect(reply()).not.toContainText("the vendor invoice");
  await expect(reply()).not.toContainText("The payment");
  await expect(reply()).not.toContainText("the whole");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words are mentioned?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These words are mentioned.");
  await expect(reply()).toContainText("The send and The deletion");
  await expect(reply()).not.toContainText("These words are mentioned more than once");

  await page.getByTestId("composer").fill("Which words are mentioned once?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These words are mentioned once.");
  await expect(reply()).toContainText("the vendor invoice");
  await expect(reply()).not.toContainText("These words are mentioned more than once");

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which words are mentioned more than once and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval").filter({ hasText: "Release a deletion" })).toHaveCount(1);
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(reply()).not.toContainText("These words are mentioned more than once.");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-mentioned-more.png" });
});

test("ORIEL-F70 a sentence asks which words are mentioned only once and does not act", async ({ page }) => {
  async function chooseAction(action: string) {
    const picker = page.getByTestId("rule-phrase-action");
    await expect(async () => {
      await picker.selectOption(action);
      await expect(picker).toHaveValue(action, { timeout: 500 });
    }).toPass();
  }

  async function narrow(action: string, phrase: string) {
    await chooseAction(action);
    const input = page.getByTestId("rule-phrase");
    await input.click();
    await input.fill(phrase);
    await expect(input).toHaveValue(phrase);
    await expect(page.getByTestId("rule-phrase-action")).toHaveValue(action);
    const saved = page.waitForResponse(
      (res) => res.url().includes("/api/handoff-rules") && res.request().method() === "POST" && res.ok(),
    );
    await page.getByTestId("rule-phrase-save").click();
    await saved;
  }

  await page.goto("/");
  await expect(page.locator(".rule-note")).toContainText("Which words are mentioned only once?");
  await expect(page.locator(".rule-note")).toContainText("Which words are mentioned once?");
  await expect(page.locator(".rule-note")).toContainText("Which words are mentioned more than once?");
  await page.getByTestId("composer").fill("Which words are mentioned only once?");
  await page.getByTestId("send").click();
  const reply = () => page.locator(".turn.oriel").last();
  await expect(reply()).toContainText("No saved words are mentioned only once.");
  await expect(reply()).toContainText("did not open a card");
  await expect(reply()).not.toContainText("These words are mentioned only once.");
  await expect(reply()).not.toContainText("No words are mentioned only once");
  await expect(reply()).not.toContainText("No words are mentioned.");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator(".goal")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words are mentioned once?");
  await page.getByTestId("send").click();
  await expect(page.locator(".goal")).toHaveCount(0);
  await expect(reply()).toContainText("No words are mentioned once.");
  await expect(reply()).not.toContainText("No saved words are mentioned only once");

  await page.getByTestId("composer").fill("Which words are mentioned more than once?");
  await page.getByTestId("send").click();
  await expect(page.locator(".goal")).toHaveCount(0);
  await expect(reply()).toContainText("No words are mentioned more than once.");
  await expect(reply()).not.toContainText("No saved words are mentioned only once");

  await page.getByTestId("composer").fill("Which words are not mentioned?");
  await page.getByTestId("send").click();
  await expect(page.locator(".goal")).toHaveCount(0);
  await expect(reply()).toContainText("No words are mentioned only once");
  await expect(reply()).not.toContainText("No saved words are mentioned only once");

  await narrow("send", "Shared Project Files");
  await narrow("delete", "shared project files");
  await narrow("pay", "the vendor invoice");
  await page.getByTestId("composer").fill("Please, which words are mentioned only once?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These words are mentioned only once.");
  await expect(reply()).toContainText("the vendor invoice");
  await expect(reply()).toContainText("The payment");
  await expect(reply()).not.toContainText("Shared Project Files");
  await expect(reply()).not.toContainText("The send");
  await expect(reply()).not.toContainText("The deletion");
  await expect(reply()).not.toContainText("the whole");
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which words are mentioned once?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These words are mentioned once.");
  await expect(reply()).toContainText("the vendor invoice");
  await expect(reply()).not.toContainText("These words are mentioned only once");

  await page.getByTestId("composer").fill("Which words are mentioned more than once?");
  await page.getByTestId("send").click();
  await expect(reply()).toContainText("These words are mentioned more than once.");
  await expect(reply()).toContainText("The send and The deletion");
  await expect(reply()).not.toContainText("These words are mentioned only once");

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Which words are mentioned only once and delete the archive");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approval").filter({ hasText: "Release a deletion" })).toHaveCount(1);
  await expect(page.getByTestId("handoff")).toHaveCount(0);
  await expect(reply()).not.toContainText("These words are mentioned only once.");
  await expect(page.getByTestId("rule-phrase-delete")).toContainText("shared project files");

  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /without asking/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "rule-phrase");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-mentioned-only-once.png" });
});

test("ORIEL-F71 a denied wake stays held back until you send a message", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Email Maya the launch update");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approve")).toBeVisible();
  await page.getByTestId("deny").click();
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await page.getByTestId("save-routine").click();
  const cadence = page.locator("[data-testid^='cadence-']");
  await cadence.click();
  await expect(cadence).toHaveText("Daily");
  await cadence.click();
  await expect(cadence).toHaveText("Hourly");
  const first = await page.request.post("/api/tick", { data: { force: true } });
  expect(first.ok()).toBeTruthy();
  await page.reload();
  await expect(page.getByText("Routine", { exact: true })).toBeVisible();
  await expect(page.getByTestId("hold-expiry")).toBeVisible();
  await page.getByTestId("deny").click();
  await expect(page.locator("[data-testid^='held-back-']")).toContainText("The send stays held back until you send a message.");
  const second = await page.request.post("/api/tick", { data: { force: true } });
  expect(second.ok()).toBeTruthy();
  await page.reload();
  await expect(page.getByTestId("synthesis")).toContainText("The send stays held back until you send a message.");
  await expect(page.getByTestId("synthesis")).toContainText("Nothing was sent or spent.");
  await expect(page.getByTestId("synthesis")).not.toContainText("I held the send for your approval.");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator("[data-testid^='held-back-']")).toBeVisible();
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await page.getByTestId("composer").fill("What is handed to me?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("thread")).toContainText("Nothing is handed to you");
  await expect(page.locator("[data-testid^='held-back-']")).toHaveCount(0);
  const third = await page.request.post("/api/tick", { data: { force: true } });
  expect(third.ok()).toBeTruthy();
  await page.reload();
  await expect(page.getByTestId("approve")).toBeVisible();
  await expect(page.getByTestId("hold-expiry")).toBeVisible();
  await expect(page.getByTestId("synthesis")).toContainText("I held the send for your approval.");
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await page.screenshot({ path: "test-results/oriel-held-back.png" });
});

test("ORIEL-F72 a drafted email stays a draft and a send still waits", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Draft an email to Maya about the launch");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("synthesis")).toContainText("This stays a draft. Nothing was sent.");
  await expect(page.getByTestId("synthesis")).not.toContainText("I held the send for your approval.");
  await expect(page.getByTestId("draft-note")).toContainText("Keep the note as a draft");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await page.getByTestId("composer").fill("Draft an email to Maya and send it");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approve")).toBeVisible();
  await expect(page.getByTestId("synthesis")).toContainText("I held the send for your approval.");
  await expect(page.getByTestId("synthesis")).not.toContainText("This stays a draft. Nothing was sent.");
  await page.getByTestId("approve").click();
  await expect(page.getByTestId("thread")).toContainText("Nothing left this computer");
  await expect(page.getByTestId("thread")).not.toContainText("I sent");
  await page.getByTestId("save-routine").click();
  const cadence = page.locator("[data-testid^='cadence-']");
  await cadence.click();
  await expect(cadence).toHaveText("Daily");
  await cadence.click();
  await expect(cadence).toHaveText("Hourly");
  const woke = await page.request.post("/api/tick", { data: { force: true } });
  expect(woke.ok()).toBeTruthy();
  await page.reload();
  await expect(page.getByText("Routine", { exact: true })).toBeVisible();
  await expect(page.getByTestId("approve")).toBeVisible();
  await expect(page.getByTestId("synthesis")).toContainText("I held the send for your approval.");
  await expect(page.getByTestId("synthesis")).not.toContainText("This stays a draft.");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await page.screenshot({ path: "test-results/oriel-draft-only.png" });
});

test("ORIEL-F73 a forward stays held and the Slack record says who asked", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Forward the vendor email to Maya");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("synthesis")).toContainText(
    "This is a forward. Oriel did not pull the original message or its attachments. Nothing was sent.",
  );
  await expect(page.getByTestId("synthesis")).not.toContainText("This stays a draft.");
  await expect(page.getByTestId("forward-note")).toContainText("Note the forward");
  await expect(page.getByTestId("approve")).toBeVisible();
  await page.getByTestId("approve").click();
  await expect(page.getByTestId("thread")).toContainText("Nothing left this computer");
  await expect(page.getByTestId("thread")).not.toContainText("I sent");
  await page.getByTestId("composer").fill("Forward the Slack note to Maya");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approve")).toBeVisible();
  await page.getByTestId("composer").fill("Who asked for the Slack note?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("thread")).toContainText("You asked Oriel to forward that Slack note. Nothing was sent from here.");
  await expect(page.getByTestId("approve")).toBeVisible();
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-forward.png" });
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
