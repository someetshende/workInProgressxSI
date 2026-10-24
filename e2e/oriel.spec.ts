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

test("ORIEL-F74 allow for this task covers this goal and a new goal still asks", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Email Maya the launch update");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approve")).toBeVisible();
  await expect(page.getByTestId("allow-task")).toBeVisible();
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await page.getByTestId("allow-task").click();
  await expect(page.getByTestId("thread")).toContainText("The send stays allowed for the rest of this goal. Nothing was sent. A later goal still asks.");
  await expect(page.getByTestId("thread")).toContainText("Nothing left this computer");
  await expect(page.getByTestId("thread")).not.toContainText("I sent");
  const goal = page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])");
  await goal.click();
  await expect(page.getByTestId("composer-context")).toContainText("Continuing");
  await page.getByTestId("composer").fill("Email Maya the follow-up");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("synthesis")).toContainText("The send stays allowed for the rest of this goal.");
  await expect(page.getByTestId("synthesis")).not.toContainText("I held the send for your approval.");
  await expect(page.getByTestId("task-cover-send")).toContainText("Covered for this goal");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await page.getByTestId("goal-all").click();
  await expect(page.getByTestId("composer-context")).toHaveText("This starts a new goal");
  await page.getByTestId("composer").fill("Email Maya from a new goal");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approve")).toBeVisible();
  await expect(page.getByTestId("allow-task")).toBeVisible();
  await expect(page.getByTestId("synthesis")).toContainText("I held the send for your approval.");
  await expect(page.getByTestId("synthesis")).not.toContainText("stays allowed");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "allow-task");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await page.screenshot({ path: "test-results/oriel-task-allow.png" });
});

test("ORIEL-F75 stop this task asks again and does not reverse a send", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Email Maya the launch update");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("allow-task")).toBeVisible();
  await page.getByTestId("allow-task").click();
  await expect(page.getByTestId("thread")).toContainText("The send stays allowed for the rest of this goal.");
  await expect(page.getByTestId("stop-task")).toBeVisible();
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await page.getByTestId("stop-task").click();
  await expect(page.getByTestId("thread")).toContainText(
    "Stopped. The send is no longer allowed for the rest of this goal. The next send on this goal asks again.",
  );
  await expect(page.getByTestId("thread")).toContainText("A sent email cannot be reversed from here. Nothing was sent or spent.");
  await expect(page.getByTestId("thread")).not.toContainText("I sent");
  await expect(page.getByTestId("stop-task")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  const goal = page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])");
  await goal.click();
  await expect(page.getByTestId("composer-context")).toContainText("Continuing");
  await page.getByTestId("composer").fill("Email Maya the follow-up");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("approve")).toBeVisible();
  await expect(page.getByTestId("synthesis")).toContainText("I held the send for your approval.");
  await expect(page.getByTestId("synthesis")).not.toContainText("stays allowed");
  await page.getByTestId("composer").fill("Please stop this task?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("thread")).toContainText("This goal has no allowance to stop.");
  await expect(page.getByTestId("approve")).toBeVisible();
  await page.getByTestId("allow-task").click();
  await expect(page.getByTestId("stop-task")).toBeVisible();
  await page.getByTestId("composer").fill("Stop this task");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("thread")).toContainText("The send is no longer allowed for the rest of this goal.");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await page.screenshot({ path: "test-results/oriel-stop-task.png" });
});

test("ORIEL-F76 stop one named routine leaves the other manual control", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Daily");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Please stop the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("thread")).toContainText(
    "Stopped. “Draft the weekly close but do not send it” wakes only when you run it.",
  );
  await expect(page.getByTestId("thread")).toContainText("The instruction stays in the record.");
  await expect(page.getByTestId("thread")).toContainText("Another routine is unchanged.");
  await expect(page.getByTestId("thread")).toContainText("A completed action was not undone. Nothing was sent or spent.");
  await expect(page.getByTestId("thread")).not.toContainText("I sent");
  await expect(firstCadence).toHaveText("Manual");
  await expect(secondCadence).toHaveText("Daily");
  await page.locator("[data-testid^='run-routine-']").nth(0).click();
  await expect(page.getByTestId("thread")).toContainText("weekly close");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(firstCadence).toHaveText("Manual");
  await expect(secondCadence).toHaveText("Daily");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await page.screenshot({ path: "test-results/oriel-stop-routine.png" });
});

test("ORIEL-F77 what is scheduled names each routine and runs none", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("schedule-hint")).toHaveCount(0);
  await page.getByTestId("composer").fill("What is scheduled?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("thread")).toContainText(
    "Nothing is scheduled. Nothing was run and nothing was changed. A completed action stays completed. Nothing was sent or spent.",
  );
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Ask what is scheduled, when one routine wakes, what one routine does, or when one routine last ran. Asking does not run a routine.",
  );
  const goal = page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])").nth(0);
  await goal.click();
  await expect(page.getByTestId("composer-context")).toContainText("Continuing");
  await page.getByTestId("composer").fill("Please what's scheduled?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("thread")).toContainText(
    "Scheduled. “Draft the weekly close but do not send it” is daily. “Summarize the launch risks” is hourly. Nothing was run and nothing was changed. A completed action stays completed. Nothing was sent or spent.",
  );
  await expect(page.getByTestId("thread")).not.toContainText("I sent");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await expect(firstCadence).toHaveText("Daily");
  await expect(secondCadence).toHaveText("Hourly");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await page.screenshot({ path: "test-results/oriel-schedule.png" });
});

test("ORIEL-F78 when one routine wakes names that time and runs none", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("When does the Launch note routine wake?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("thread")).toContainText(
    "There is no such routine as “Launch note”. Nothing was run and nothing was changed. A completed action stays completed. Nothing was sent or spent.",
  );
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Ask what is scheduled, when one routine wakes, what one routine does, or when one routine last ran. Asking does not run a routine.",
  );
  const nextTitle = await firstCadence.getAttribute("title");
  const nextAt = nextTitle?.replace(/^Next wake\s+/, "") ?? "";
  expect(nextAt).toContain("T");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("When does the Draft the weekly close but do not send it routine wake?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("thread")).toContainText(
    `“Draft the weekly close but do not send it” is daily. It next wakes at ${nextAt}. Another routine is unchanged.`,
  );
  await expect(page.getByTestId("thread")).toContainText(
    "Nothing was run and nothing was changed. A completed action stays completed. Nothing was sent or spent.",
  );
  await expect(page.getByTestId("thread")).not.toContainText("I sent");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await expect(firstCadence).toHaveText("Daily");
  await expect(secondCadence).toHaveText("Hourly");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  const secondTitle = await secondCadence.getAttribute("title");
  expect(secondTitle).not.toBe(nextTitle);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await page.screenshot({ path: "test-results/oriel-routine-when.png" });
});

test("ORIEL-F79 what one routine does names that instruction and runs none", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("What does the Launch note routine do?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("thread")).toContainText(
    "There is no such routine as “Launch note”. Nothing was run and nothing was changed. A completed action stays completed. Nothing was sent or spent.",
  );
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Ask what is scheduled, when one routine wakes, what one routine does, or when one routine last ran. Asking does not run a routine.",
  );
  const nextTitle = await firstCadence.getAttribute("title");
  expect(nextTitle).toContain("Next wake");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("What does the Draft the weekly close but do not send it routine do?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("thread")).toContainText(
    "“Draft the weekly close but do not send it” does this: “Draft the weekly close but do not send it”. Another routine is unchanged.",
  );
  await expect(page.getByTestId("thread")).toContainText(
    "Nothing was run and nothing was changed. A completed action stays completed. Nothing was sent or spent.",
  );
  await expect(page.getByTestId("thread")).not.toContainText("It next wakes");
  await expect(page.getByTestId("thread")).not.toContainText("I sent");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await expect(firstCadence).toHaveText("Daily");
  await expect(secondCadence).toHaveText("Hourly");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  const secondTitle = await secondCadence.getAttribute("title");
  expect(secondTitle).not.toBe(nextTitle);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await page.screenshot({ path: "test-results/oriel-routine-do.png" });
});

test("ORIEL-F80 when one routine last ran names that time and runs none", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("When did the Launch note routine last run?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("thread")).toContainText(
    "There is no such routine as “Launch note”. Nothing was run and nothing was changed. A completed action stays completed. Nothing was sent or spent.",
  );
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  const firstLast = page.locator("[data-testid^='last-run-']").nth(0);
  await expect(firstLast).toHaveText("Has not run");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  const secondLast = page.locator("[data-testid^='last-run-']").nth(1);
  await expect(secondLast).toHaveText("Has not run");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Ask what is scheduled, when one routine wakes, what one routine does, or when one routine last ran. Asking does not run a routine.",
  );
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("When did the Draft the weekly close but do not send it routine last run?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("thread")).toContainText(
    "“Draft the weekly close but do not send it” has no last run in the record. Another routine is unchanged.",
  );
  await expect(page.getByTestId("thread")).toContainText(
    "Nothing was run and nothing was changed. A completed action stays completed. Nothing was sent or spent.",
  );
  await expect(page.getByTestId("thread")).not.toContainText("It next wakes");
  await expect(page.getByTestId("thread")).not.toContainText("does this");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await page.locator("[data-testid^='run-routine-']").nth(0).click();
  await expect(firstLast).not.toHaveText("Has not run");
  const shown = await firstLast.innerText();
  const ranAt = shown.replace(/^Last ran\s+/, "");
  expect(ranAt).toContain("T");
  await expect(secondLast).toHaveText("Has not run");
  await page.getByTestId("composer").fill("When did the Draft the weekly close but do not send it routine last run?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("thread")).toContainText(
    `“Draft the weekly close but do not send it” last ran at ${ranAt}. Another routine is unchanged.`,
  );
  await expect(page.getByTestId("thread")).not.toContainText("I sent");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(3);
  await expect(firstCadence).toHaveText("Daily");
  await expect(secondCadence).toHaveText("Hourly");
  await expect(firstLast).toHaveText(`Last ran ${ranAt}`);
  await expect(secondLast).toHaveText("Has not run");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await page.screenshot({ path: "test-results/oriel-routine-last.png" });
});

test("ORIEL-F81 what one routine delivered says there is no delivery and runs none", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("What did the Launch note routine deliver?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("thread")).toContainText(
    "There is no such routine as “Launch note”. Nothing was run and nothing was changed. A completed action stays completed. Nothing was sent or spent.",
  );
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  const firstLast = page.locator("[data-testid^='last-run-']").nth(0);
  const firstDelivery = page.locator("[data-testid^='delivery-']").nth(0);
  await expect(firstLast).toHaveText("Has not run");
  await expect(firstDelivery).toHaveText("No delivery");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  const secondLast = page.locator("[data-testid^='last-run-']").nth(1);
  const secondDelivery = page.locator("[data-testid^='delivery-']").nth(1);
  await expect(secondLast).toHaveText("Has not run");
  await expect(secondDelivery).toHaveText("No delivery");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Ask what is scheduled, when one routine wakes, what one routine does, or when one routine last ran. Asking does not run a routine. A completed run is not a delivery.",
  );
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("What did the Draft the weekly close but do not send it routine deliver?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("thread")).toContainText(
    "“Draft the weekly close but do not send it” has no delivery in the record. A last run does not confirm the result. Another routine is unchanged.",
  );
  await expect(page.getByTestId("thread")).toContainText(
    "Nothing was run and nothing was changed. A completed action stays completed. Nothing was sent or spent.",
  );
  await expect(page.getByTestId("thread")).not.toContainText("last ran at");
  await expect(page.getByTestId("thread")).not.toContainText("does this");
  await expect(page.getByTestId("thread")).not.toContainText("It next wakes");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await page.locator("[data-testid^='run-routine-']").nth(0).click();
  await expect(firstLast).not.toHaveText("Has not run");
  await expect(firstDelivery).toHaveText("No delivery");
  await expect(secondDelivery).toHaveText("No delivery");
  await expect(secondLast).toHaveText("Has not run");
  await page.getByTestId("composer").fill("What did the Draft the weekly close but do not send it routine deliver?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("thread")).toContainText(
    "“Draft the weekly close but do not send it” has no delivery in the record. A last run does not confirm the result. Another routine is unchanged.",
  );
  await expect(page.getByTestId("thread")).not.toContainText("last ran at");
  await expect(page.getByTestId("thread")).not.toContainText("I sent");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(3);
  await expect(firstCadence).toHaveText("Daily");
  await expect(secondCadence).toHaveText("Hourly");
  await expect(firstDelivery).toHaveText("No delivery");
  await expect(secondDelivery).toHaveText("No delivery");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await page.screenshot({ path: "test-results/oriel-routine-deliver.png" });
});

test("ORIEL-F82 run one named routine leaves the schedule and is not a delivery", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Run the Launch note routine?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("thread")).toContainText(
    "There is no such routine as “Launch note”. Nothing was run and nothing was changed. A completed action stays completed. Nothing was sent or spent.",
  );
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  const firstLast = page.locator("[data-testid^='last-run-']").nth(0);
  const firstDelivery = page.locator("[data-testid^='delivery-']").nth(0);
  await expect(firstLast).toHaveText("Has not run");
  await expect(firstDelivery).toHaveText("No delivery");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  const secondLast = page.locator("[data-testid^='last-run-']").nth(1);
  const secondDelivery = page.locator("[data-testid^='delivery-']").nth(1);
  await expect(secondLast).toHaveText("Has not run");
  await expect(secondDelivery).toHaveText("No delivery");
  await expect(page.getByTestId("schedule-hint")).toContainText("Say run and the routine's name to run that one.");
  const nextTitle = await secondCadence.getAttribute("title");
  expect(nextTitle).toContain("Next wake");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Run the Draft the weekly close but do not send it routine");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("thread")).toContainText(
    "Ran “Draft the weekly close but do not send it”. The instruction stays in the record. The cadence and the next time stay. Another routine keeps its instruction, its cadence, and its next time.",
  );
  await expect(page.getByTestId("thread")).toContainText("A last run is not a delivery. Nothing was sent or spent.");
  await expect(page.getByTestId("thread")).not.toContainText("I sent");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(3);
  await expect(firstLast).not.toHaveText("Has not run");
  const shown = await firstLast.innerText();
  await expect(secondLast).toHaveText("Has not run");
  await expect(firstDelivery).toHaveText("No delivery");
  await expect(secondDelivery).toHaveText("No delivery");
  await expect(firstCadence).toHaveText("Daily");
  await expect(secondCadence).toHaveText("Hourly");
  expect(await secondCadence.getAttribute("title")).toBe(nextTitle);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await page.getByTestId("composer").fill("What did the Draft the weekly close but do not send it routine deliver?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("thread")).toContainText(
    "“Draft the weekly close but do not send it” has no delivery in the record. A last run does not confirm the result. Another routine is unchanged.",
  );
  await expect(firstLast).toHaveText(shown);
  await expect(secondLast).toHaveText("Has not run");
  await expect(firstDelivery).toHaveText("No delivery");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await page.screenshot({ path: "test-results/oriel-routine-run.png" });
});

test("ORIEL-F83 a proposed routine change is quoted and not saved", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Change the Launch note routine to Summarize the launch risks?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText(
    "There is no such routine as “Launch note”. Nothing was run and nothing was changed. A completed action stays completed. Nothing was sent or spent.",
  );
  await expect(page.locator("#thread .turn").last()).not.toContainText("Summarize the launch risks");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  const firstLast = page.locator("[data-testid^='last-run-']").nth(0);
  const firstDelivery = page.locator("[data-testid^='delivery-']").nth(0);
  await expect(firstLast).toHaveText("Has not run");
  await expect(firstDelivery).toHaveText("No delivery");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  const secondLast = page.locator("[data-testid^='last-run-']").nth(1);
  const secondDelivery = page.locator("[data-testid^='delivery-']").nth(1);
  await expect(secondLast).toHaveText("Has not run");
  await expect(secondDelivery).toHaveText("No delivery");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Saying change and the routine's name quotes the stored instruction and the proposed words, and does not save the change.",
  );
  const nextTitle = await secondCadence.getAttribute("title");
  expect(nextTitle).toContain("Next wake");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Change the Draft the weekly close but do not send it routine to Note the open risks");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("thread")).toContainText(
    "“Draft the weekly close but do not send it” does this: “Draft the weekly close but do not send it”. The proposed instruction is “Note the open risks”. The change is not saved. Another routine is unchanged.",
  );
  await expect(page.getByTestId("thread")).not.toContainText("I sent");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await expect(firstLast).toHaveText("Has not run");
  await expect(secondLast).toHaveText("Has not run");
  await expect(firstDelivery).toHaveText("No delivery");
  await expect(secondDelivery).toHaveText("No delivery");
  await expect(firstCadence).toHaveText("Daily");
  await expect(secondCadence).toHaveText("Hourly");
  expect(await secondCadence.getAttribute("title")).toBe(nextTitle);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await page.getByTestId("composer").fill("What does the Draft the weekly close but do not send it routine do?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText(
    "“Draft the weekly close but do not send it” does this: “Draft the weekly close but do not send it”. Another routine is unchanged.",
  );
  await expect(page.locator("#thread .turn").last()).not.toContainText("The change is not saved");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await expect(firstDelivery).toHaveText("No delivery");
  await expect(secondDelivery).toHaveText("No delivery");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await page.screenshot({ path: "test-results/oriel-routine-change.png" });
});

test("ORIEL-F84 saving a routine instruction writes it and does not run it", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Save the Launch note routine as Summarize the launch risks?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText(
    "There is no such routine as “Launch note”. Nothing was run and nothing was changed. A completed action stays completed. Nothing was sent or spent.",
  );
  await expect(page.locator("#thread .turn").last()).not.toContainText("Summarize the launch risks");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  const firstInstruction = page.locator("[data-testid^='instruction-']").nth(0);
  const firstLast = page.locator("[data-testid^='last-run-']").nth(0);
  const firstDelivery = page.locator("[data-testid^='delivery-']").nth(0);
  await expect(firstInstruction).toHaveText("Draft the weekly close but do not send it");
  await expect(firstLast).toHaveText("Has not run");
  await expect(firstDelivery).toHaveText("No delivery");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  const secondInstruction = page.locator("[data-testid^='instruction-']").nth(1);
  const secondLast = page.locator("[data-testid^='last-run-']").nth(1);
  const secondDelivery = page.locator("[data-testid^='delivery-']").nth(1);
  await expect(secondInstruction).toHaveText("Summarize the launch risks");
  await expect(secondLast).toHaveText("Has not run");
  await expect(secondDelivery).toHaveText("No delivery");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Saying save and the routine's name writes that instruction and does not run it.",
  );
  const nextTitle = await secondCadence.getAttribute("title");
  expect(nextTitle).toContain("Next wake");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Save the Draft the weekly close but do not send it routine as Note the open risks");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("thread")).toContainText(
    "Saved. “Draft the weekly close but do not send it” now does this: “Note the open risks”. The cadence and the next time stay. Another routine is unchanged.",
  );
  await expect(page.getByTestId("thread")).toContainText("Nothing was run. A last run stays. Nothing was sent or spent.");
  await expect(page.getByTestId("thread")).not.toContainText("I sent");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await expect(firstInstruction).toHaveText("Note the open risks");
  await expect(secondInstruction).toHaveText("Summarize the launch risks");
  await expect(firstLast).toHaveText("Has not run");
  await expect(secondLast).toHaveText("Has not run");
  await expect(firstDelivery).toHaveText("No delivery");
  await expect(secondDelivery).toHaveText("No delivery");
  await expect(firstCadence).toHaveText("Daily");
  await expect(secondCadence).toHaveText("Hourly");
  expect(await secondCadence.getAttribute("title")).toBe(nextTitle);
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await page.getByTestId("composer").fill("Save the Draft the weekly close but do not send it routine as note the open risks");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText(
    "“Draft the weekly close but do not send it” already does that: “Note the open risks”. The instruction was not rewritten.",
  );
  await expect(firstInstruction).toHaveText("Note the open risks");
  await page.getByTestId("composer").fill("What does the Draft the weekly close but do not send it routine do?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText(
    "“Draft the weekly close but do not send it” does this: “Note the open risks”. Another routine is unchanged.",
  );
  await expect(page.locator("#thread .turn").last()).not.toContainText("now does this");
  await page.getByTestId("composer").fill("Change the Draft the weekly close but do not send it routine to Summarize the launch risks");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("The change is not saved");
  await expect(firstInstruction).toHaveText("Note the open risks");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await page.screenshot({ path: "test-results/oriel-routine-save.png" });
});

test("ORIEL-F85 setting a routine cadence writes it and does not run it", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Wake the Launch note routine daily?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText(
    "There is no such routine as “Launch note”. Nothing was run and nothing was changed. A completed action stays completed. Nothing was sent or spent.",
  );
  await expect(page.locator("#thread .turn").last()).not.toContainText("now wakes");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  const firstInstruction = page.locator("[data-testid^='instruction-']").nth(0);
  const firstLast = page.locator("[data-testid^='last-run-']").nth(0);
  const firstDelivery = page.locator("[data-testid^='delivery-']").nth(0);
  await expect(firstInstruction).toHaveText("Draft the weekly close but do not send it");
  await expect(firstLast).toHaveText("Has not run");
  await expect(firstDelivery).toHaveText("No delivery");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  const secondTitle = await secondCadence.getAttribute("title");
  expect(secondTitle).toContain("Next wake");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Saying wake, the routine's name, and daily, hourly, or manual sets that cadence and does not run it.",
  );
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Wake the Draft the weekly close but do not send it routine manual");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("thread")).toContainText(
    "Set. “Draft the weekly close but do not send it” now wakes only when you run it. The next time is cleared. Another routine is unchanged.",
  );
  await expect(page.getByTestId("thread")).toContainText(
    "The instruction stays in the record. The last run stays. Nothing was run. Nothing was sent or spent.",
  );
  await expect(page.getByTestId("thread")).not.toContainText("I sent");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await expect(firstCadence).toHaveText("Manual");
  await expect(secondCadence).toHaveText("Hourly");
  expect(await secondCadence.getAttribute("title")).toBe(secondTitle);
  await expect(firstInstruction).toHaveText("Draft the weekly close but do not send it");
  await expect(firstLast).toHaveText("Has not run");
  await expect(firstDelivery).toHaveText("No delivery");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await page.getByTestId("composer").fill("Wake the Summarize the launch risks routine daily");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText(
    "Set. “Summarize the launch risks” now wakes daily.",
  );
  await expect(page.locator("#thread .turn").last()).toContainText("It next wakes at");
  await expect(secondCadence).toHaveText("Daily");
  await expect(firstCadence).toHaveText("Manual");
  const dailyTitle = await secondCadence.getAttribute("title");
  expect(dailyTitle).toContain("Next wake");
  expect(dailyTitle).not.toBe(secondTitle);
  await page.getByTestId("composer").fill("Wake the Summarize the launch risks routine daily.");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("already wakes that way");
  await expect(page.locator("#thread .turn").last()).toContainText("The next time was not moved.");
  expect(await secondCadence.getAttribute("title")).toBe(dailyTitle);
  await expect(secondCadence).toHaveText("Daily");
  await page.getByTestId("composer").fill("What is scheduled?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("is manual and wakes only when you run it");
  await expect(page.locator("#thread .turn").last()).toContainText("is daily.");
  await expect(firstCadence).toHaveText("Manual");
  await expect(secondCadence).toHaveText("Daily");
  await page.getByTestId("composer").fill("When does the Summarize the launch risks routine wake?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("“Summarize the launch risks” is daily.");
  await expect(page.locator("#thread .turn").last()).toContainText("It next wakes at");
  expect(await secondCadence.getAttribute("title")).toBe(dailyTitle);
  await page.getByTestId("composer").fill("Save the Summarize the launch risks routine as Note the open risks");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("The cadence and the next time stay.");
  await expect(page.locator("[data-testid^='instruction-']").nth(1)).toHaveText("Note the open risks");
  await expect(secondCadence).toHaveText("Daily");
  expect(await secondCadence.getAttribute("title")).toBe(dailyTitle);
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await page.screenshot({ path: "test-results/oriel-routine-cadence.png" });
});

test("ORIEL-F86 pausing one routine leaves its cadence and shows Paused", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Pause the Launch note routine?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText(
    "There is no such routine as “Launch note”. Nothing was run and nothing was changed. A completed action stays completed. Nothing was sent or spent.",
  );
  await expect(page.locator("#thread .turn").last()).not.toContainText("Paused.");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  const firstTitle = await firstCadence.getAttribute("title");
  const firstInstruction = page.locator("[data-testid^='instruction-']").nth(0);
  const firstLast = page.locator("[data-testid^='last-run-']").nth(0);
  await expect(firstInstruction).toHaveText("Draft the weekly close but do not send it");
  await expect(firstLast).toHaveText("Has not run");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  const secondTitle = await secondCadence.getAttribute("title");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Saying pause or resume and the routine's name pauses or resumes that one wake and does not change its cadence.",
  );
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Pause the Draft the weekly close but do not send it routine");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("thread")).toContainText(
    "Paused. “Draft the weekly close but do not send it” stays daily. The next time stays. Another routine is unchanged.",
  );
  await expect(page.getByTestId("thread")).toContainText(
    "The instruction stays. The last run stays. Nothing was run. Nothing was sent or spent.",
  );
  await expect(page.getByTestId("thread")).not.toContainText("I sent");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await expect(firstCadence).toHaveText("Daily");
  await expect(secondCadence).toHaveText("Hourly");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  expect(await secondCadence.getAttribute("title")).toBe(secondTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(firstInstruction).toHaveText("Draft the weekly close but do not send it");
  await expect(firstLast).toHaveText("Has not run");
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Pause the Draft the weekly close but do not send it routine.");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("is already paused");
  await expect(page.locator("#thread .turn").last()).toContainText("The next time was not moved.");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);

  await firstCadence.click();
  await expect(firstCadence).toHaveText("Hourly");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);
  await expect(secondCadence).toHaveText("Hourly");

  await page.getByTestId("composer").fill("What is scheduled?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("is hourly.");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);

  await page.getByTestId("composer").fill("When does the Draft the weekly close but do not send it routine wake?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("is hourly.");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);

  await page.getByTestId("composer").fill("Resume the Draft the weekly close but do not send it routine");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("Resumed. “Draft the weekly close but do not send it” can wake again.");
  await expect(page.locator("#thread .turn").last()).toContainText("The cadence stays hourly.");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);
  await expect(firstCadence).toHaveText("Hourly");
  await expect(secondCadence).toHaveText("Hourly");

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Wakes paused");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);
  await page.getByTestId("composer").fill("Resume wakes");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Pause wakes");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await page.screenshot({ path: "test-results/oriel-routine-pause.png" });
});

test("ORIEL-F87 deleting one routine removes it from the rail and runs none", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Delete the Launch note routine?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText(
    "There is no such routine as “Launch note”. Nothing was run and nothing was changed. A completed action stays completed. Nothing was sent or spent.",
  );
  await expect(page.locator("#thread .turn").last()).not.toContainText("is deleted");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  const firstTitle = await firstCadence.getAttribute("title");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Saying delete and the routine's name removes that one routine from the record and does not run it.",
  );
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Saying pause or resume and the routine's name pauses or resumes that one wake and does not change its cadence.",
  );
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Pause the Draft the weekly close but do not send it routine");
  await page.getByTestId("send").click();
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);
  await page.getByTestId("composer").fill("Delete the Summarize the launch risks routine");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("thread")).toContainText(
    "Deleted. “Summarize the launch risks” is deleted. The deletion cannot be undone from here. Another routine is unchanged.",
  );
  await expect(page.getByTestId("thread")).toContainText(
    "Nothing was run. A completed action was not undone. Nothing was sent or spent.",
  );
  await expect(page.getByTestId("thread")).not.toContainText("I sent");
  await expect(page.locator("[data-testid^='cadence-']")).toHaveCount(1);
  await expect(page.locator("[data-testid^='cadence-']")).toHaveText("Daily");
  expect(await page.locator("[data-testid^='cadence-']").getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);
  await expect(page.locator("[data-testid^='instruction-']")).toHaveText("Draft the weekly close but do not send it");
  await expect(page.locator("[data-testid^='run-routine-']")).toContainText("Draft the weekly close but do not send it");
  await expect(page.getByTestId("approve")).toHaveCount(0);
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);

  await page.getByTestId("composer").fill("What is scheduled?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("Draft the weekly close but do not send it");
  await expect(page.locator("#thread .turn").last()).not.toContainText("Summarize the launch risks");
  await expect(page.locator("[data-testid^='cadence-']")).toHaveCount(1);

  await page.getByTestId("composer").fill("Stop the Draft the weekly close but do not send it routine");
  await page.getByTestId("send").click();
  await expect(page.locator("[data-testid^='cadence-']")).toHaveText("Manual");
  await expect(page.locator("#thread .turn").last()).not.toContainText("is deleted");
  await expect(page.locator("[data-testid^='cadence-']")).toHaveCount(1);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await page.screenshot({ path: "test-results/oriel-routine-delete.png" });
});

test("ORIEL-F88 a spoken cadence stays put when another routine is within five minutes", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Wake the Launch note routine daily?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText(
    "There is no such routine as “Launch note”. Nothing was run and nothing was changed. A completed action stays completed. Nothing was sent or spent.",
  );
  await expect(page.locator("#thread .turn").last()).not.toContainText("five minutes");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Hourly");
  const firstTitle = await firstCadence.getAttribute("title");
  expect(firstTitle).toContain("Next wake");

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await expect(secondCadence).toHaveText("Manual");
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  const secondTitle = await secondCadence.getAttribute("title");
  expect(secondTitle).toContain("Next wake");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Saying wake with daily or hourly leaves that cadence unchanged when the next time would be less than five minutes from another routine.",
  );

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Wake the Draft the weekly close but do not send it routine hourly");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("already wakes that way");
  await expect(page.locator("#thread .turn").last()).toContainText("The next time was not moved.");
  await expect(page.locator("#thread .turn").last()).not.toContainText("five minutes");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(firstCadence).toHaveText("Hourly");
  await expect(secondCadence).toHaveText("Hourly");

  await page.getByTestId("composer").fill("Wake the Summarize the launch risks routine manual");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("now wakes only when you run it");
  await expect(page.locator("#thread .turn").last()).not.toContainText("five minutes");
  await expect(secondCadence).toHaveText("Manual");
  await expect(firstCadence).toHaveText("Hourly");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);

  await page.getByTestId("composer").fill("Wake the Summarize the launch risks routine hourly");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("“Summarize the launch risks” stays.");
  await expect(page.locator("#thread .turn").last()).toContainText(
    "“Draft the weekly close but do not send it” is within five minutes.",
  );
  await expect(page.locator("#thread .turn").last()).toContainText(
    "Routine schedules must be at least five minutes apart.",
  );
  await expect(page.locator("#thread .turn").last()).toContainText(
    "Nothing was run. Nothing was deleted. Nothing was sent or spent.",
  );
  await expect(page.locator("#thread .turn").last()).not.toContainText("now wakes");
  await expect(page.locator("#thread .turn").last()).not.toContainText("I sent");
  await expect(secondCadence).toHaveText("Manual");
  await expect(firstCadence).toHaveText("Hourly");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  await page.getByTestId("composer").fill("Delete the Summarize the launch risks routine");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("“Summarize the launch risks” is deleted.");
  await expect(page.locator("#thread .turn").last()).not.toContainText("five minutes");
  await expect(page.locator("[data-testid^='cadence-']")).toHaveCount(1);
  await expect(firstCadence).toHaveText("Hourly");

  await page.getByTestId("composer").fill("What is scheduled?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("Draft the weekly close but do not send it");
  await expect(page.locator("#thread .turn").last()).toContainText("is hourly.");
  await expect(page.locator("#thread .turn").last()).not.toContainText("Summarize the launch risks");

  await page.getByTestId("composer").fill("Wake the Draft the weekly close but do not send it routine daily");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("now wakes daily");
  await expect(page.locator("#thread .turn").last()).not.toContainText("five minutes");
  await expect(firstCadence).toHaveText("Daily");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await page.screenshot({ path: "test-results/oriel-routine-gap.png" });
});

test("ORIEL-F89 Save as routine stops at fifty and leaves the rest in place", async ({ page, request }) => {
  test.setTimeout(120_000);
  for (let i = 0; i < 49; i += 1) {
    const noted = await request.post("/api/turn", { data: { text: `Note the lane ${i}` } });
    expect(noted.ok()).toBeTruthy();
    const body = await noted.json();
    const goalId = body.goals.at(-1).id as string;
    const saved = await request.post("/api/routines", { data: { goalId } });
    expect(saved.ok()).toBeTruthy();
  }

  await page.goto("/");
  await expect(page.locator("[data-testid^='cadence-']")).toHaveCount(49);
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Saving a routine when 50 are already saved does not add another, and the reply says a bot can own up to 50 routines.",
  );
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Saying wake with daily or hourly leaves that cadence unchanged when the next time would be less than five minutes from another routine.",
  );

  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  await expect(page.locator("[data-testid^='cadence-']")).toHaveCount(50);
  await expect(page.locator("[data-testid^='run-routine-']").last()).toContainText("Summarize the launch risks");
  await expect(page.locator("#thread .turn").last()).not.toContainText("50 routines");

  const firstCadence = page.locator("[data-testid^='cadence-']").first();
  await firstCadence.click();
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Hourly");
  const summarize = page.locator("[data-testid^='cadence-']").last();
  await expect(summarize).toHaveText("Manual");
  await page.getByTestId("composer").fill("Wake the Summarize the launch risks routine hourly");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("Routine schedules must be at least five minutes apart.");
  await expect(page.locator("#thread .turn").last()).not.toContainText("50 routines");
  await expect(summarize).toHaveText("Manual");
  await expect(firstCadence).toHaveText("Hourly");
  await summarize.click();
  await summarize.click();
  await expect(summarize).toHaveText("Hourly");

  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Note the open risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  await expect(page.locator("#thread .turn").last()).toContainText("A bot can own up to 50 routines.");
  await expect(page.locator("#thread .turn").last()).toContainText("Nothing was added. Nothing was deleted. Nothing was run.");
  await expect(page.locator("#thread .turn").last()).toContainText("Nothing was sent or spent.");
  await expect(page.locator("#thread .turn").last()).not.toContainText("I sent");
  await expect(page.locator("[data-testid^='cadence-']")).toHaveCount(50);
  await expect(page.locator("[data-testid^='run-routine-']", { hasText: "Note the open risks" })).toHaveCount(0);
  await expect(page.getByTestId("approve")).toHaveCount(0);

  await page.getByTestId("composer").fill("Save the Summarize the launch risks routine as Keep the launch risks");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("now does this");
  await expect(page.locator("#thread .turn").last()).not.toContainText("50 routines");
  await expect(page.locator("[data-testid^='instruction-']").last()).toHaveText("Keep the launch risks");
  await expect(page.locator("[data-testid^='cadence-']")).toHaveCount(50);

  const missing = await request.post("/api/routines", { data: { goalId: "goal_missing" } });
  expect(missing.status()).toBe(404);
  await expect(page.locator("[data-testid^='cadence-']")).toHaveCount(50);

  await page.getByTestId("composer").fill("Delete the Note the lane 0 routine");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("“Note the lane 0” is deleted.");
  await expect(page.locator("[data-testid^='cadence-']")).toHaveCount(49);
  await page.getByTestId("save-routine").click();
  await expect(page.locator("[data-testid^='cadence-']")).toHaveCount(50);
  await expect(page.locator("[data-testid^='run-routine-']", { hasText: "Note the open risks" })).toHaveCount(1);
  await expect(page.locator("#thread .turn").last()).not.toContainText("50 routines");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);
  await page.screenshot({ path: "test-results/oriel-routine-cap.png" });
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

test("ORIEL-F90 a routine stops after two hundred runs this hour", async ({ page, request }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  await expect(page.locator("[data-testid^='run-routine-']")).toHaveCount(1);
  await expect(page.locator("[data-testid^='last-run-']")).toHaveText("Has not run");
  await expect(page.locator("[data-testid^='delivery-']")).toHaveText("No delivery");
  const state = await (await request.get("/api/state")).json();
  const id = state.routines[0].id as string;
  const stamped = await request.post(`/api/routines/${id}/stamp`, { data: { count: 199 } });
  expect(stamped.ok()).toBeTruthy();

  await page.getByTestId("composer").fill("Run the Summarize the launch risks routine");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("Ran “Summarize the launch risks”.");
  await expect(page.locator("#thread .turn").last()).not.toContainText("200 times");
  await expect(page.locator("#thread .turn").last()).not.toContainText("I sent");
  await expect(page.locator("[data-testid^='delivery-']")).toHaveText("No delivery");
  const lastRun = page.locator("[data-testid^='last-run-']");
  await expect(lastRun).not.toHaveText("Has not run");
  const ranAt = (await lastRun.textContent()) ?? "";

  await page.getByTestId("composer").fill("Run the Summarize the launch risks routine");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("has already run 200 times this hour");
  await expect(page.locator("#thread .turn").last()).toContainText("Each routine can run up to 200 times an hour.");
  await expect(page.locator("#thread .turn").last()).toContainText("This run did not start.");
  await expect(page.locator("#thread .turn").last()).toContainText("Nothing was sent or spent.");
  await expect(page.locator("#thread .turn").last()).not.toContainText("I sent");
  await expect(lastRun).toHaveText(ranAt);
  await expect(page.locator("[data-testid^='delivery-']")).toHaveText("No delivery");

  await page.locator("[data-testid^='run-routine-']").click();
  await expect(page.locator("#thread .turn").last()).toContainText("has already run 200 times this hour");
  await expect(lastRun).toHaveText(ranAt);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-routine-hour.png" });
});

test("ORIEL-F91 asking what runs a routine has names twenty times and the rail does not", async ({ page, request }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  await expect(page.locator("[data-testid^='run-routine-']")).toHaveCount(1);
  await expect(page.locator("[data-testid^='last-run-']")).toHaveText("Has not run");
  await expect(page.locator("[data-testid^='delivery-']")).toHaveText("No delivery");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking what runs one routine has names up to the twenty newest stored times. The rail does not list those times.",
  );
  const state = await (await request.get("/api/state")).json();
  const id = state.routines[0].id as string;
  const stamped = await request.post(`/api/routines/${id}/stamp`, { data: { count: 21 } });
  expect(stamped.ok()).toBeTruthy();
  const stampedBody = await stamped.json();
  const runs = stampedBody.routines[0].recentRuns as string[];
  expect(runs).toHaveLength(21);
  const oldest = runs[0] ?? "";
  const newest = runs.at(-1) ?? "";

  await page.getByTestId("composer").fill("What runs does the Summarize the launch risks routine have?");
  await page.getByTestId("send").click();
  const turn = page.locator("#thread .turn").last();
  await expect(turn).toContainText("newest first");
  await expect(turn).toContainText(newest);
  await expect(turn).toContainText("The older runs stay in the record.");
  await expect(turn).toContainText("A last run is not a delivery.");
  await expect(turn).not.toContainText(oldest);
  await expect(turn).not.toContainText("no last run");
  await expect(turn).not.toContainText("I sent");
  const times = ((await turn.innerText()).match(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g) ?? []).length;
  expect(times).toBe(20);
  await expect(page.locator("#rail")).not.toContainText(newest);
  await expect(page.locator("#rail")).not.toContainText(oldest);
  const railTimes = ((await page.locator("#rail").innerText()).match(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g) ?? []).length;
  expect(railTimes).toBe(0);
  await expect(page.locator("[data-testid^='last-run-']")).toHaveText("Has not run");
  await expect(page.locator("[data-testid^='delivery-']")).toHaveText("No delivery");
  await expect(page.locator("[data-testid^='last-run-']")).toHaveCount(1);

  await page.getByTestId("composer").fill("When did the Summarize the launch risks routine last run?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("has no last run in the record");
  await expect(page.locator("#thread .turn").last()).not.toContainText("has these runs");
  await page.getByTestId("composer").fill("What did the Summarize the launch risks routine deliver?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("has no delivery in the record");
  await expect(page.locator("[data-testid^='delivery-']")).toHaveText("No delivery");
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-routine-runs.png" });
});

test("ORIEL-F92 asking why a routine has not run does not start it", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  await expect(page.locator("[data-testid^='run-routine-']")).toHaveCount(1);
  await expect(page.locator("[data-testid^='last-run-']")).toHaveText("Has not run");
  await expect(page.locator("[data-testid^='delivery-']")).toHaveText("No delivery");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking why one routine has not run says whether it is paused, whether a new schedule is still waiting, or that the hour stopped it. It does not start a run.",
  );

  await page.getByTestId("composer").fill("Why hasn't the Summarize the launch risks routine run?");
  await page.getByTestId("send").click();
  const first = page.locator("#thread .turn").last();
  await expect(first).toContainText("has not started from this question");
  await expect(first).toContainText("It wakes only when you run it.");
  await expect(first).toContainText("A schedule has not started it.");
  await expect(first).toContainText("Use Run to try it now.");
  await expect(first).toContainText("No runs yet means nothing has started the routine yet.");
  await expect(first).not.toContainText("I sent");
  await expect(page.locator("[data-testid^='last-run-']")).toHaveText("Has not run");
  await expect(page.locator("[data-testid^='delivery-']")).toHaveText("No delivery");
  await expect(page.getByTestId("schedule-hint")).not.toContainText("No runs yet");
  await expect(page.locator("[data-testid^='instruction-']")).not.toContainText("No runs yet");

  await page.getByTestId("composer").fill("Wake the Summarize the launch risks routine hourly");
  await page.getByTestId("send").click();
  await expect(page.locator("[data-testid^='cadence-']")).toHaveText("Hourly");
  await page.getByTestId("composer").fill("Why hasn't the Summarize the launch risks routine run?");
  await page.getByTestId("send").click();
  const waiting = page.locator("#thread .turn").last();
  await expect(waiting).toContainText("A new schedule waits for its next time.");
  await expect(waiting).toContainText("It wakes hourly.");
  await expect(waiting).toContainText("Use Run to try it now.");
  await expect(waiting).not.toContainText("I sent");
  await expect(page.locator("[data-testid^='last-run-']")).toHaveText("Has not run");
  await expect(page.locator("[data-testid^='delivery-']")).toHaveText("No delivery");

  await page.getByTestId("composer").fill("Pause the Summarize the launch risks routine");
  await page.getByTestId("send").click();
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='cadence-']")).toHaveText("Hourly");
  await page.getByTestId("composer").fill("Why hasn't the Summarize the launch risks routine run?");
  await page.getByTestId("send").click();
  const paused = page.locator("#thread .turn").last();
  await expect(paused).toContainText("It is paused.");
  await expect(paused).toContainText("A wake does not run it.");
  await expect(paused).toContainText("It wakes hourly.");
  await expect(paused).not.toContainText("I sent");
  await expect(page.locator("[data-testid^='last-run-']")).toHaveText("Has not run");
  await expect(page.locator("[data-testid^='cadence-']")).toHaveText("Hourly");
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-routine-quiet.png" });
});

test("ORIEL-F93 asking where a routine delivers does not store a place", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  await expect(page.locator("[data-testid^='run-routine-']")).toHaveCount(1);
  await expect(page.locator("[data-testid^='last-run-']")).toHaveText("Has not run");
  await expect(page.locator("[data-testid^='delivery-']")).toHaveText("No delivery");
  await expect(page.locator("[data-testid^='destination-']")).toHaveText("No destination");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking where one routine delivers says there is no destination in the record. It does not store a place and it does not run the routine.",
  );

  await page.getByTestId("composer").fill("Where does the Summarize the launch risks routine deliver?");
  await page.getByTestId("send").click();
  const first = page.locator("#thread .turn").last();
  await expect(first).toContainText("has no destination in the record");
  await expect(first).toContainText("Where results go is not stored.");
  await expect(first).toContainText("A last run is not a delivery.");
  await expect(first).not.toContainText("has no delivery in the record");
  await expect(first).not.toContainText("I sent");
  await expect(first).not.toContainText("ChatGPT");
  await expect(page.locator("[data-testid^='last-run-']")).toHaveText("Has not run");
  await expect(page.locator("[data-testid^='delivery-']")).toHaveText("No delivery");
  await expect(page.locator("[data-testid^='destination-']")).toHaveText("No destination");
  await expect(page.locator("[data-testid^='instruction-']")).toHaveText("Summarize the launch risks");

  await page.locator("[data-testid^='run-routine-']").click();
  await expect(page.locator("[data-testid^='last-run-']")).toContainText("Last ran");
  await expect(page.locator("[data-testid^='delivery-']")).toHaveText("No delivery");
  await expect(page.locator("[data-testid^='destination-']")).toHaveText("No destination");
  await page.getByTestId("composer").fill("Where does the Summarize the launch risks routine deliver?");
  await page.getByTestId("send").click();
  const after = page.locator("#thread .turn").last();
  await expect(after).toContainText("has no destination in the record");
  await expect(after).toContainText("A last run is not a delivery.");
  await expect(after).not.toContainText("I sent");
  await expect(page.locator("[data-testid^='destination-']")).toHaveText("No destination");
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.getByTestId("composer").fill("What did the Summarize the launch risks routine deliver?");
  await page.getByTestId("send").click();
  const delivered = page.locator("#thread .turn").last();
  await expect(delivered).toContainText("has no delivery in the record");
  await expect(delivered).not.toContainText("Where results go is not stored");
  await expect(page.locator("[data-testid^='destination-']")).toHaveText("No destination");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-routine-place.png" });
});

test("ORIEL-F94 which routines are paused names only the paused ones", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Which routines are paused?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("No routine is paused.");
  await expect(page.locator("#thread .turn").last()).toContainText("A wake does not run a paused routine.");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  const firstTitle = await firstCadence.getAttribute("title");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  const secondTitle = await secondCadence.getAttribute("title");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking which routines are paused names each paused routine, in the order it was saved, and says a wake does not run it.",
  );

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Wakes paused");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);
  await page.getByTestId("composer").fill("Which routines are paused?");
  await page.getByTestId("send").click();
  const duringDesk = page.locator("#thread .turn").last();
  await expect(duringDesk).toContainText("No routine is paused.");
  await expect(duringDesk).not.toContainText("Draft the weekly close");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);
  await page.getByTestId("composer").fill("Resume wakes");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Pause wakes");

  await page.getByTestId("composer").fill("Pause the Draft the weekly close but do not send it routine");
  await page.getByTestId("send").click();
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);
  await page.getByTestId("composer").fill("Which routines are paused?");
  await page.getByTestId("send").click();
  const one = page.locator("#thread .turn").last();
  await expect(one).toContainText("“Draft the weekly close but do not send it” is paused. A wake does not run it.");
  await expect(one).not.toContainText("Summarize the launch risks");
  await expect(one).not.toContainText("I sent");
  await expect(firstCadence).toHaveText("Daily");
  await expect(secondCadence).toHaveText("Hourly");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  expect(await secondCadence.getAttribute("title")).toBe(secondTitle);
  await expect(page.locator("[data-testid^='last-run-']").nth(0)).toHaveText("Has not run");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);

  await page.getByTestId("composer").fill("Pause the Summarize the launch risks routine");
  await page.getByTestId("send").click();
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(2);
  await page.getByTestId("composer").fill("Which routines are paused?");
  await page.getByTestId("send").click();
  const both = page.locator("#thread .turn").last();
  await expect(both).toContainText(
    "“Draft the weekly close but do not send it” is paused. A wake does not run it. “Summarize the launch risks” is paused. A wake does not run it.",
  );
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-paused-routines.png" });
});

test("ORIEL-F95 is the routine paused names that one pause", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Is the Launch note routine paused?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("There is no such routine as “Launch note”.");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  const firstTitle = await firstCadence.getAttribute("title");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  const secondTitle = await secondCadence.getAttribute("title");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking whether one routine is paused names that pause, or says it is not paused. A desk pause does not count.",
  );

  await page.getByTestId("composer").fill("Is the Draft the weekly close but do not send it routine paused?");
  await page.getByTestId("send").click();
  const clear = page.locator("#thread .turn").last();
  await expect(clear).toContainText("“Draft the weekly close but do not send it” is not paused.");
  await expect(clear).not.toContainText("A wake does not run it.");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Wakes paused");
  await page.getByTestId("composer").fill("Is the Draft the weekly close but do not send it routine paused?");
  await page.getByTestId("send").click();
  const duringDesk = page.locator("#thread .turn").last();
  await expect(duringDesk).toContainText("“Draft the weekly close but do not send it” is not paused.");
  await expect(duringDesk).not.toContainText("Wakes are paused");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);
  await page.getByTestId("composer").fill("Resume wakes");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Pause wakes");

  await page.getByTestId("composer").fill("Pause the Draft the weekly close but do not send it routine");
  await page.getByTestId("send").click();
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);
  await page.getByTestId("composer").fill("Is the Draft the weekly close but do not send it routine paused?");
  await page.getByTestId("send").click();
  const one = page.locator("#thread .turn").last();
  await expect(one).toContainText("“Draft the weekly close but do not send it” is paused. A wake does not run it.");
  await expect(one).not.toContainText("Summarize the launch risks");
  await expect(one).not.toContainText("I sent");
  await expect(firstCadence).toHaveText("Daily");
  await expect(secondCadence).toHaveText("Hourly");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  expect(await secondCadence.getAttribute("title")).toBe(secondTitle);
  await expect(page.locator("[data-testid^='last-run-']").nth(0)).toHaveText("Has not run");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);

  await page.getByTestId("composer").fill("Is the Summarize the launch risks routine paused?");
  await page.getByTestId("send").click();
  const other = page.locator("#thread .turn").last();
  await expect(other).toContainText("“Summarize the launch risks” is not paused.");
  await expect(other).not.toContainText("A wake does not run it.");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-routine-paused-ask.png" });
});

test("ORIEL-F96 is the routine active names that one switch", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Is the Launch note routine active?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("There is no such routine as “Launch note”.");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  const firstTitle = await firstCadence.getAttribute("title");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  const secondTitle = await secondCadence.getAttribute("title");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking whether one routine is active names that it is active, or says it is not active and a wake does not run it.",
  );
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);

  await page.getByTestId("composer").fill("Is the Draft the weekly close but do not send it routine active?");
  await page.getByTestId("send").click();
  const clear = page.locator("#thread .turn").last();
  await expect(clear).toContainText("“Draft the weekly close but do not send it” is active.");
  await expect(clear).not.toContainText("is not active");
  await expect(clear).not.toContainText("A wake does not run it.");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Wakes paused");
  await page.getByTestId("composer").fill("Is the Draft the weekly close but do not send it routine active?");
  await page.getByTestId("send").click();
  const duringDesk = page.locator("#thread .turn").last();
  await expect(duringDesk).toContainText("“Draft the weekly close but do not send it” is active.");
  await expect(duringDesk).not.toContainText("Wakes are paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);
  await page.getByTestId("composer").fill("Resume wakes");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Pause wakes");

  await page.getByTestId("composer").fill("Pause the Draft the weekly close but do not send it routine");
  await page.getByTestId("send").click();
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(1);
  await page.getByTestId("composer").fill("Is the Draft the weekly close but do not send it routine active?");
  await page.getByTestId("send").click();
  const one = page.locator("#thread .turn").last();
  await expect(one).toContainText("“Draft the weekly close but do not send it” is not active. A wake does not run it.");
  await expect(one).not.toContainText("Summarize the launch risks");
  await expect(one).not.toContainText("I sent");
  await expect(firstCadence).toHaveText("Daily");
  await expect(secondCadence).toHaveText("Hourly");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  expect(await secondCadence.getAttribute("title")).toBe(secondTitle);
  await expect(page.locator("[data-testid^='last-run-']").nth(0)).toHaveText("Has not run");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveText("Active");

  await page.getByTestId("composer").fill("Is the Summarize the launch risks routine active?");
  await page.getByTestId("send").click();
  const other = page.locator("#thread .turn").last();
  await expect(other).toContainText("“Summarize the launch risks” is active.");
  await expect(other).not.toContainText("is not active");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(1);
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-routine-active-ask.png" });
});

test("ORIEL-F97 is the routine enabled names that one switch", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Is the Launch note routine enabled?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("There is no such routine as “Launch note”.");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  const firstTitle = await firstCadence.getAttribute("title");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  const secondTitle = await secondCadence.getAttribute("title");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking whether one routine is enabled names that it is enabled, or says it is not enabled and a wake does not run it.",
  );
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);

  await page.getByTestId("composer").fill("Is the Draft the weekly close but do not send it routine enabled?");
  await page.getByTestId("send").click();
  const clear = page.locator("#thread .turn").last();
  await expect(clear).toContainText("“Draft the weekly close but do not send it” is enabled.");
  await expect(clear).not.toContainText("is not enabled");
  await expect(clear).not.toContainText("A wake does not run it.");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Wakes paused");
  await page.getByTestId("composer").fill("Is the Draft the weekly close but do not send it routine enabled?");
  await page.getByTestId("send").click();
  const duringDesk = page.locator("#thread .turn").last();
  await expect(duringDesk).toContainText("“Draft the weekly close but do not send it” is enabled.");
  await expect(duringDesk).not.toContainText("Wakes are paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);
  await page.getByTestId("composer").fill("Resume wakes");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Pause wakes");

  await page.getByTestId("composer").fill("Pause the Draft the weekly close but do not send it routine");
  await page.getByTestId("send").click();
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(1);
  await page.getByTestId("composer").fill("Is the Draft the weekly close but do not send it routine enabled?");
  await page.getByTestId("send").click();
  const one = page.locator("#thread .turn").last();
  await expect(one).toContainText("“Draft the weekly close but do not send it” is not enabled. A wake does not run it.");
  await expect(one).not.toContainText("Summarize the launch risks");
  await expect(one).not.toContainText("I sent");
  await expect(firstCadence).toHaveText("Daily");
  await expect(secondCadence).toHaveText("Hourly");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  expect(await secondCadence.getAttribute("title")).toBe(secondTitle);
  await expect(page.locator("[data-testid^='last-run-']").nth(0)).toHaveText("Has not run");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveText("Active");

  await page.getByTestId("composer").fill("Is the Summarize the launch risks routine enabled?");
  await page.getByTestId("send").click();
  const other = page.locator("#thread .turn").last();
  await expect(other).toContainText("“Summarize the launch risks” is enabled.");
  await expect(other).not.toContainText("is not enabled");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(1);
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.getByTestId("composer").fill("Is the Draft the weekly close but do not send it routine active?");
  await page.getByTestId("send").click();
  const stillActive = page.locator("#thread .turn").last();
  await expect(stillActive).toContainText("“Draft the weekly close but do not send it” is not active. A wake does not run it.");
  await expect(stillActive).not.toContainText("is enabled");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveText("Active");

  await page.getByTestId("composer").fill("Is the Draft the weekly close but do not send it routine paused?");
  await page.getByTestId("send").click();
  const stillPaused = page.locator("#thread .turn").last();
  await expect(stillPaused).toContainText("“Draft the weekly close but do not send it” is paused. A wake does not run it.");
  await expect(stillPaused).not.toContainText("is enabled");
  await expect(stillPaused).not.toContainText("is not active");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveText("Active");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-routine-enabled-ask.png" });
});

test("ORIEL-F98 which routines are enabled names only the ones that are not paused", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Which routines are enabled?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("No routine is enabled.");
  await expect(page.locator("#thread .turn").last()).toContainText("A wake does not run a routine that is not enabled.");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  const firstTitle = await firstCadence.getAttribute("title");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  const secondTitle = await secondCadence.getAttribute("title");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking which routines are enabled names each routine that is not paused, in the order it was saved, and says it is enabled.",
  );
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Wakes paused");
  await page.getByTestId("composer").fill("Which routines are enabled?");
  await page.getByTestId("send").click();
  const duringDesk = page.locator("#thread .turn").last();
  await expect(duringDesk).toContainText(
    "“Draft the weekly close but do not send it” is enabled. “Summarize the launch risks” is enabled.",
  );
  await expect(duringDesk).not.toContainText("No routine is enabled.");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await page.getByTestId("composer").fill("Resume wakes");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Pause wakes");

  await page.getByTestId("composer").fill("Pause the Draft the weekly close but do not send it routine");
  await page.getByTestId("send").click();
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(1);
  await page.getByTestId("composer").fill("Which routines are enabled?");
  await page.getByTestId("send").click();
  const one = page.locator("#thread .turn").last();
  await expect(one).toContainText("“Summarize the launch risks” is enabled.");
  await expect(one).not.toContainText("Draft the weekly close");
  await expect(one).not.toContainText("I sent");
  await expect(firstCadence).toHaveText("Daily");
  await expect(secondCadence).toHaveText("Hourly");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  expect(await secondCadence.getAttribute("title")).toBe(secondTitle);
  await expect(page.locator("[data-testid^='last-run-']").nth(0)).toHaveText("Has not run");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveText("Active");

  await page.getByTestId("composer").fill("Is the Draft the weekly close but do not send it routine enabled?");
  await page.getByTestId("send").click();
  const stillOff = page.locator("#thread .turn").last();
  await expect(stillOff).toContainText("“Draft the weekly close but do not send it” is not enabled. A wake does not run it.");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");

  await page.getByTestId("composer").fill("Which routines are paused?");
  await page.getByTestId("send").click();
  const paused = page.locator("#thread .turn").last();
  await expect(paused).toContainText("“Draft the weekly close but do not send it” is paused. A wake does not run it.");
  await expect(paused).not.toContainText("Summarize the launch risks");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-enabled-routines.png" });
});

test("ORIEL-F99 which routines are active names only the ones that are not paused", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Which routines are active?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("No routine is active.");
  await expect(page.locator("#thread .turn").last()).toContainText("A wake does not run a routine that is not active.");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  const firstTitle = await firstCadence.getAttribute("title");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  const secondTitle = await secondCadence.getAttribute("title");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking which routines are active names each routine that is not paused, in the order it was saved, and says it is active.",
  );
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Wakes paused");
  await page.getByTestId("composer").fill("Which routines are active?");
  await page.getByTestId("send").click();
  const duringDesk = page.locator("#thread .turn").last();
  await expect(duringDesk).toContainText(
    "“Draft the weekly close but do not send it” is active. “Summarize the launch risks” is active.",
  );
  await expect(duringDesk).not.toContainText("No routine is active.");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await page.getByTestId("composer").fill("Resume wakes");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Pause wakes");

  await page.getByTestId("composer").fill("Pause the Draft the weekly close but do not send it routine");
  await page.getByTestId("send").click();
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(1);
  await page.getByTestId("composer").fill("Which routines are active?");
  await page.getByTestId("send").click();
  const one = page.locator("#thread .turn").last();
  await expect(one).toContainText("“Summarize the launch risks” is active.");
  await expect(one).not.toContainText("Draft the weekly close");
  await expect(one).not.toContainText("I sent");
  await expect(firstCadence).toHaveText("Daily");
  await expect(secondCadence).toHaveText("Hourly");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  expect(await secondCadence.getAttribute("title")).toBe(secondTitle);
  await expect(page.locator("[data-testid^='last-run-']").nth(0)).toHaveText("Has not run");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveText("Active");

  await page.getByTestId("composer").fill("Is the Draft the weekly close but do not send it routine active?");
  await page.getByTestId("send").click();
  const stillOff = page.locator("#thread .turn").last();
  await expect(stillOff).toContainText("“Draft the weekly close but do not send it” is not active. A wake does not run it.");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");

  await page.getByTestId("composer").fill("Which routines are enabled?");
  await page.getByTestId("send").click();
  const enabled = page.locator("#thread .turn").last();
  await expect(enabled).toContainText("“Summarize the launch risks” is enabled.");
  await expect(enabled).not.toContainText("Draft the weekly close");

  await page.getByTestId("composer").fill("Which routines are paused?");
  await page.getByTestId("send").click();
  const paused = page.locator("#thread .turn").last();
  await expect(paused).toContainText("“Draft the weekly close but do not send it” is paused. A wake does not run it.");
  await expect(paused).not.toContainText("Summarize the launch risks");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-active-routines.png" });
});

test("ORIEL-F100 which routines are disabled names only the paused ones", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Which routines are disabled?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("No routine is disabled.");
  await expect(page.locator("#thread .turn").last()).toContainText("A wake does not run a routine that is disabled.");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  const firstTitle = await firstCadence.getAttribute("title");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  const secondTitle = await secondCadence.getAttribute("title");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking which routines are disabled names each routine that is paused, in the order it was saved, and says it is disabled.",
  );
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which routines are disabled?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("No routine is disabled.");
  await expect(page.locator("#thread .turn").last()).not.toContainText("Draft the weekly close");

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Wakes paused");
  await page.getByTestId("composer").fill("Which routines are disabled?");
  await page.getByTestId("send").click();
  const duringDesk = page.locator("#thread .turn").last();
  await expect(duringDesk).toContainText("No routine is disabled.");
  await expect(duringDesk).not.toContainText("Draft the weekly close");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await page.getByTestId("composer").fill("Resume wakes");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Pause wakes");

  await page.getByTestId("composer").fill("Pause the Draft the weekly close but do not send it routine");
  await page.getByTestId("send").click();
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(1);
  await page.getByTestId("composer").fill("Which routines are disabled?");
  await page.getByTestId("send").click();
  const one = page.locator("#thread .turn").last();
  await expect(one).toContainText("“Draft the weekly close but do not send it” is disabled.");
  await expect(one).not.toContainText("Summarize the launch risks");
  await expect(one).not.toContainText("is paused");
  await expect(one).not.toContainText("I sent");
  await expect(firstCadence).toHaveText("Daily");
  await expect(secondCadence).toHaveText("Hourly");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  expect(await secondCadence.getAttribute("title")).toBe(secondTitle);
  await expect(page.locator("[data-testid^='last-run-']").nth(0)).toHaveText("Has not run");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveText("Active");

  await page.getByTestId("composer").fill("Is the Draft the weekly close but do not send it routine enabled?");
  await page.getByTestId("send").click();
  const stillOff = page.locator("#thread .turn").last();
  await expect(stillOff).toContainText("“Draft the weekly close but do not send it” is not enabled. A wake does not run it.");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");

  await page.getByTestId("composer").fill("Is the Draft the weekly close but do not send it routine active?");
  await page.getByTestId("send").click();
  const stillActive = page.locator("#thread .turn").last();
  await expect(stillActive).toContainText("“Draft the weekly close but do not send it” is not active. A wake does not run it.");

  await page.getByTestId("composer").fill("Is the Draft the weekly close but do not send it routine paused?");
  await page.getByTestId("send").click();
  const stillPaused = page.locator("#thread .turn").last();
  await expect(stillPaused).toContainText("“Draft the weekly close but do not send it” is paused. A wake does not run it.");

  await page.getByTestId("composer").fill("Which routines are active?");
  await page.getByTestId("send").click();
  const active = page.locator("#thread .turn").last();
  await expect(active).toContainText("“Summarize the launch risks” is active.");
  await expect(active).not.toContainText("Draft the weekly close");

  await page.getByTestId("composer").fill("Which routines are enabled?");
  await page.getByTestId("send").click();
  const enabled = page.locator("#thread .turn").last();
  await expect(enabled).toContainText("“Summarize the launch risks” is enabled.");
  await expect(enabled).not.toContainText("Draft the weekly close");

  await page.getByTestId("composer").fill("Which routines are paused?");
  await page.getByTestId("send").click();
  const paused = page.locator("#thread .turn").last();
  await expect(paused).toContainText("“Draft the weekly close but do not send it” is paused. A wake does not run it.");
  await expect(paused).not.toContainText("Summarize the launch risks");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-disabled-routines.png" });
});

test("ORIEL-F101 is the routine disabled names that one pause", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Is the Launch note routine disabled?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("There is no such routine as “Launch note”.");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  const firstTitle = await firstCadence.getAttribute("title");
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  const secondTitle = await secondCadence.getAttribute("title");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking whether one routine is disabled names that it is disabled and a wake does not run it, or says it is not disabled.",
  );
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);

  await page.getByTestId("composer").fill("Is the Draft the weekly close but do not send it routine disabled?");
  await page.getByTestId("send").click();
  const clear = page.locator("#thread .turn").last();
  await expect(clear).toContainText("“Draft the weekly close but do not send it” is not disabled.");
  await expect(clear).not.toContainText("“Draft the weekly close but do not send it” is disabled.");
  await expect(clear).not.toContainText("A wake does not run it.");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Wakes paused");
  await page.getByTestId("composer").fill("Is the Draft the weekly close but do not send it routine disabled?");
  await page.getByTestId("send").click();
  const duringDesk = page.locator("#thread .turn").last();
  await expect(duringDesk).toContainText("“Draft the weekly close but do not send it” is not disabled.");
  await expect(duringDesk).not.toContainText("Wakes are paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);
  await page.getByTestId("composer").fill("Resume wakes");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Pause wakes");

  await page.getByTestId("composer").fill("Pause the Draft the weekly close but do not send it routine");
  await page.getByTestId("send").click();
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(1);
  await page.getByTestId("composer").fill("Is the Draft the weekly close but do not send it routine disabled?");
  await page.getByTestId("send").click();
  const one = page.locator("#thread .turn").last();
  await expect(one).toContainText("“Draft the weekly close but do not send it” is disabled. A wake does not run it.");
  await expect(one).not.toContainText("Summarize the launch risks");
  await expect(one).not.toContainText("I sent");
  await expect(firstCadence).toHaveText("Daily");
  await expect(secondCadence).toHaveText("Hourly");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  expect(await secondCadence.getAttribute("title")).toBe(secondTitle);
  await expect(page.locator("[data-testid^='last-run-']").nth(0)).toHaveText("Has not run");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveText("Active");

  await page.getByTestId("composer").fill("Is the Summarize the launch risks routine disabled?");
  await page.getByTestId("send").click();
  const other = page.locator("#thread .turn").last();
  await expect(other).toContainText("“Summarize the launch risks” is not disabled.");
  await expect(other).not.toContainText("“Summarize the launch risks” is disabled.");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(1);
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.getByTestId("composer").fill("Which routines are disabled?");
  await page.getByTestId("send").click();
  const listed = page.locator("#thread .turn").last();
  await expect(listed).toContainText("“Draft the weekly close but do not send it” is disabled.");
  await expect(listed).not.toContainText("Summarize the launch risks");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");

  await page.getByTestId("composer").fill("Is the Draft the weekly close but do not send it routine enabled?");
  await page.getByTestId("send").click();
  const stillEnabled = page.locator("#thread .turn").last();
  await expect(stillEnabled).toContainText("“Draft the weekly close but do not send it” is not enabled. A wake does not run it.");
  await expect(stillEnabled).not.toContainText("is disabled");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");

  await page.getByTestId("composer").fill("Is the Draft the weekly close but do not send it routine active?");
  await page.getByTestId("send").click();
  const stillActive = page.locator("#thread .turn").last();
  await expect(stillActive).toContainText("“Draft the weekly close but do not send it” is not active. A wake does not run it.");
  await expect(stillActive).not.toContainText("is disabled");

  await page.getByTestId("composer").fill("Is the Draft the weekly close but do not send it routine paused?");
  await page.getByTestId("send").click();
  const stillPaused = page.locator("#thread .turn").last();
  await expect(stillPaused).toContainText("“Draft the weekly close but do not send it” is paused. A wake does not run it.");
  await expect(stillPaused).not.toContainText("is disabled");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveText("Active");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-routine-disabled-ask.png" });
});

test("ORIEL-F102 what time zone is the routine using leaves the next time", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("What time zone is the Launch note routine using?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("There is no such routine as “Launch note”.");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  const firstTitle = await firstCadence.getAttribute("title");
  const firstNext = firstTitle?.replace(/^Next wake /, "") ?? "";
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  const secondTitle = await secondCadence.getAttribute("title");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking what time zone one routine is using says that routine has no time zone in the record.",
  );
  await expect(page.locator("[data-testid^='zone-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='zone-']").nth(0)).toHaveText("No time zone");
  await expect(page.locator("[data-testid^='destination-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='delivery-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);

  await page.getByTestId("composer").fill("What time zone is the Draft the weekly close but do not send it routine using?");
  await page.getByTestId("send").click();
  const clear = page.locator("#thread .turn").last();
  await expect(clear).toContainText("“Draft the weekly close but do not send it” has no time zone in the record.");
  await expect(clear).toContainText("The next time stays the instant already stored.");
  await expect(clear).not.toContainText(firstNext);
  await expect(clear).not.toContainText("Summarize the launch risks");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  expect(await secondCadence.getAttribute("title")).toBe(secondTitle);
  await expect(page.locator("[data-testid^='zone-']").nth(0)).toHaveText("No time zone");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Wakes paused");
  await page.getByTestId("composer").fill("What time zone is the Draft the weekly close but do not send it routine using?");
  await page.getByTestId("send").click();
  const duringDesk = page.locator("#thread .turn").last();
  await expect(duringDesk).toContainText("“Draft the weekly close but do not send it” has no time zone in the record.");
  await expect(duringDesk).not.toContainText("Wakes are paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='zone-']")).toHaveCount(2);
  await page.getByTestId("composer").fill("Resume wakes");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Pause wakes");

  await page.getByTestId("composer").fill("Pause the Draft the weekly close but do not send it routine");
  await page.getByTestId("send").click();
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);
  await page.getByTestId("composer").fill("What time zone is the Draft the weekly close but do not send it routine using?");
  await page.getByTestId("send").click();
  const pausedAsk = page.locator("#thread .turn").last();
  await expect(pausedAsk).toContainText("“Draft the weekly close but do not send it” has no time zone in the record.");
  await expect(pausedAsk).not.toContainText(firstNext);
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='zone-']").nth(0)).toHaveText("No time zone");

  await page.getByTestId("composer").fill("When does the Draft the weekly close but do not send it routine wake?");
  await page.getByTestId("send").click();
  const wake = page.locator("#thread .turn").last();
  await expect(wake).toContainText(firstNext);
  await expect(wake).not.toContainText("has no time zone");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);

  await page.getByTestId("composer").fill("Is the Draft the weekly close but do not send it routine disabled?");
  await page.getByTestId("send").click();
  const disabled = page.locator("#thread .turn").last();
  await expect(disabled).toContainText("“Draft the weekly close but do not send it” is disabled. A wake does not run it.");
  await expect(disabled).not.toContainText("time zone");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveText("Active");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-routine-zone.png" });
});

test("ORIEL-F103 which bot owns the routine does not assign one", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Which bot owns the Launch note routine?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("There is no such routine as “Launch note”.");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  const firstTitle = await firstCadence.getAttribute("title");
  const firstNext = firstTitle?.replace(/^Next wake /, "") ?? "";
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  const secondTitle = await secondCadence.getAttribute("title");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking which bot owns one routine says that routine has no owning bot in the record.",
  );
  await expect(page.locator("[data-testid^='owner-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='owner-']").nth(0)).toHaveText("No owning bot");
  await expect(page.locator("[data-testid^='zone-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='zone-']").nth(0)).toHaveText("No time zone");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);

  await page.getByTestId("composer").fill("Which bot owns the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const clear = page.locator("#thread .turn").last();
  await expect(clear).toContainText("“Draft the weekly close but do not send it” has no owning bot in the record.");
  await expect(clear).toContainText("Asking does not assign one.");
  await expect(clear).not.toContainText("Grok Bot");
  await expect(clear).not.toContainText(firstNext);
  await expect(clear).not.toContainText("Summarize the launch risks");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  expect(await secondCadence.getAttribute("title")).toBe(secondTitle);
  await expect(page.locator("[data-testid^='owner-']").nth(0)).toHaveText("No owning bot");
  await expect(page.locator("[data-testid^='zone-']").nth(0)).toHaveText("No time zone");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Wakes paused");
  await page.getByTestId("composer").fill("Which bot owns the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const duringDesk = page.locator("#thread .turn").last();
  await expect(duringDesk).toContainText("“Draft the weekly close but do not send it” has no owning bot in the record.");
  await expect(duringDesk).not.toContainText("Wakes are paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='owner-']")).toHaveCount(2);
  await page.getByTestId("composer").fill("Resume wakes");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Pause wakes");

  await page.getByTestId("composer").fill("Pause the Draft the weekly close but do not send it routine");
  await page.getByTestId("send").click();
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);
  await page.getByTestId("composer").fill("Which bot owns the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const pausedAsk = page.locator("#thread .turn").last();
  await expect(pausedAsk).toContainText("“Draft the weekly close but do not send it” has no owning bot in the record.");
  await expect(pausedAsk).not.toContainText(firstNext);
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='owner-']").nth(0)).toHaveText("No owning bot");

  await page.getByTestId("composer").fill("What time zone is the Draft the weekly close but do not send it routine using?");
  await page.getByTestId("send").click();
  const zone = page.locator("#thread .turn").last();
  await expect(zone).toContainText("“Draft the weekly close but do not send it” has no time zone in the record.");
  await expect(zone).not.toContainText("owning bot");
  await expect(page.locator("[data-testid^='zone-']").nth(0)).toHaveText("No time zone");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);

  await page.getByTestId("composer").fill("Is the Draft the weekly close but do not send it routine disabled?");
  await page.getByTestId("send").click();
  const disabled = page.locator("#thread .turn").last();
  await expect(disabled).toContainText("“Draft the weekly close but do not send it” is disabled. A wake does not run it.");
  await expect(disabled).not.toContainText("owning bot");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveText("Active");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-routine-owner.png" });
});

test("ORIEL-F104 which plugins the routine needs does not connect one", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Which plugins does the Launch note routine need?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("There is no such routine as “Launch note”.");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  const firstTitle = await firstCadence.getAttribute("title");
  const firstNext = firstTitle?.replace(/^Next wake /, "") ?? "";
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  const secondTitle = await secondCadence.getAttribute("title");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking which plugins one routine needs says that routine has no required plugin in the record.",
  );
  await expect(page.locator("[data-testid^='plugin-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='plugin-']").nth(0)).toHaveText("No required plugin");
  await expect(page.locator("[data-testid^='owner-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='owner-']").nth(0)).toHaveText("No owning bot");
  await expect(page.locator("[data-testid^='zone-']").nth(0)).toHaveText("No time zone");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);

  await page.getByTestId("composer").fill("Which plugins does the Draft the weekly close but do not send it routine need?");
  await page.getByTestId("send").click();
  const clear = page.locator("#thread .turn").last();
  await expect(clear).toContainText("“Draft the weekly close but do not send it” has no required plugin in the record.");
  await expect(clear).toContainText("Asking does not connect one.");
  await expect(clear).not.toContainText("Grok Bot");
  await expect(clear).not.toContainText(firstNext);
  await expect(clear).not.toContainText("Summarize the launch risks");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  expect(await secondCadence.getAttribute("title")).toBe(secondTitle);
  await expect(page.locator("[data-testid^='plugin-']").nth(0)).toHaveText("No required plugin");
  await expect(page.locator("[data-testid^='owner-']").nth(0)).toHaveText("No owning bot");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Wakes paused");
  await page.getByTestId("composer").fill("Which plugins does the Draft the weekly close but do not send it routine need?");
  await page.getByTestId("send").click();
  const duringDesk = page.locator("#thread .turn").last();
  await expect(duringDesk).toContainText("“Draft the weekly close but do not send it” has no required plugin in the record.");
  await expect(duringDesk).not.toContainText("Wakes are paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='plugin-']")).toHaveCount(2);
  await page.getByTestId("composer").fill("Resume wakes");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Pause wakes");

  await page.getByTestId("composer").fill("Pause the Draft the weekly close but do not send it routine");
  await page.getByTestId("send").click();
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);
  await page.getByTestId("composer").fill("Which plugins does the Draft the weekly close but do not send it routine need?");
  await page.getByTestId("send").click();
  const pausedAsk = page.locator("#thread .turn").last();
  await expect(pausedAsk).toContainText("“Draft the weekly close but do not send it” has no required plugin in the record.");
  await expect(pausedAsk).not.toContainText(firstNext);
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='plugin-']").nth(0)).toHaveText("No required plugin");

  await page.getByTestId("composer").fill("Which bot owns the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const owner = page.locator("#thread .turn").last();
  await expect(owner).toContainText("“Draft the weekly close but do not send it” has no owning bot in the record.");
  await expect(owner).not.toContainText("required plugin");
  await expect(page.locator("[data-testid^='owner-']").nth(0)).toHaveText("No owning bot");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);

  await page.getByTestId("composer").fill("What time zone is the Draft the weekly close but do not send it routine using?");
  await page.getByTestId("send").click();
  const zone = page.locator("#thread .turn").last();
  await expect(zone).toContainText("“Draft the weekly close but do not send it” has no time zone in the record.");
  await expect(zone).not.toContainText("required plugin");
  await expect(page.locator("[data-testid^='zone-']").nth(0)).toHaveText("No time zone");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveText("Active");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-routine-plugin.png" });
});

test("ORIEL-F105 whether the routine can reach its source does not connect a computer", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Can the Launch note routine reach its source?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("There is no such routine as “Launch note”.");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  const firstTitle = await firstCadence.getAttribute("title");
  const firstNext = firstTitle?.replace(/^Next wake /, "") ?? "";
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  const secondTitle = await secondCadence.getAttribute("title");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking whether one routine can reach its source says that routine has no source system in the record.",
  );
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");
  await expect(page.locator("[data-testid^='plugin-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='plugin-']").nth(0)).toHaveText("No required plugin");
  await expect(page.locator("[data-testid^='owner-']").nth(0)).toHaveText("No owning bot");
  await expect(page.locator("[data-testid^='zone-']").nth(0)).toHaveText("No time zone");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);

  await page.getByTestId("composer").fill("Can the Draft the weekly close but do not send it routine reach its source?");
  await page.getByTestId("send").click();
  const clear = page.locator("#thread .turn").last();
  await expect(clear).toContainText("“Draft the weekly close but do not send it” has no source system in the record.");
  await expect(clear).toContainText("Asking does not connect a computer.");
  await expect(clear).not.toContainText("Grok Bot");
  await expect(clear).not.toContainText(firstNext);
  await expect(clear).not.toContainText("Summarize the launch risks");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  expect(await secondCadence.getAttribute("title")).toBe(secondTitle);
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");
  await expect(page.locator("[data-testid^='plugin-']").nth(0)).toHaveText("No required plugin");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Wakes paused");
  await page.getByTestId("composer").fill("Can the Draft the weekly close but do not send it routine reach its source?");
  await page.getByTestId("send").click();
  const duringDesk = page.locator("#thread .turn").last();
  await expect(duringDesk).toContainText("“Draft the weekly close but do not send it” has no source system in the record.");
  await expect(duringDesk).not.toContainText("Wakes are paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await page.getByTestId("composer").fill("Resume wakes");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Pause wakes");

  await page.getByTestId("composer").fill("Pause the Draft the weekly close but do not send it routine");
  await page.getByTestId("send").click();
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);
  await page.getByTestId("composer").fill("Can the Draft the weekly close but do not send it routine reach its source?");
  await page.getByTestId("send").click();
  const pausedAsk = page.locator("#thread .turn").last();
  await expect(pausedAsk).toContainText("“Draft the weekly close but do not send it” has no source system in the record.");
  await expect(pausedAsk).not.toContainText(firstNext);
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");

  await page.getByTestId("composer").fill("Which plugins does the Draft the weekly close but do not send it routine need?");
  await page.getByTestId("send").click();
  const plugin = page.locator("#thread .turn").last();
  await expect(plugin).toContainText("“Draft the weekly close but do not send it” has no required plugin in the record.");
  await expect(plugin).not.toContainText("source system");
  await expect(page.locator("[data-testid^='plugin-']").nth(0)).toHaveText("No required plugin");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);

  await page.getByTestId("composer").fill("Which bot owns the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const owner = page.locator("#thread .turn").last();
  await expect(owner).toContainText("“Draft the weekly close but do not send it” has no owning bot in the record.");
  await expect(owner).not.toContainText("source system");
  await expect(page.locator("[data-testid^='owner-']").nth(0)).toHaveText("No owning bot");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveText("Active");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-routine-source.png" });
});

test("ORIEL-F106 whether usage has been paused does not pause account access", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Has usage been paused for the Launch note routine?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("There is no such routine as “Launch note”.");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  const firstTitle = await firstCadence.getAttribute("title");
  const firstNext = firstTitle?.replace(/^Next wake /, "") ?? "";
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  const secondTitle = await secondCadence.getAttribute("title");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking whether usage has been paused for one routine says that routine has no usage pause in the record.",
  );
  await expect(page.locator("[data-testid^='usage-pause-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='usage-pause-']").nth(0)).toHaveText("No usage pause");
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");
  await expect(page.locator("[data-testid^='plugin-']").nth(0)).toHaveText("No required plugin");
  await expect(page.locator("[data-testid^='owner-']").nth(0)).toHaveText("No owning bot");
  await expect(page.locator("[data-testid^='zone-']").nth(0)).toHaveText("No time zone");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);

  await page.getByTestId("composer").fill("Has usage been paused for the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const clear = page.locator("#thread .turn").last();
  await expect(clear).toContainText("“Draft the weekly close but do not send it” has no usage pause in the record.");
  await expect(clear).toContainText("Asking does not pause account access.");
  await expect(clear).not.toContainText("Grok Bot");
  await expect(clear).not.toContainText(firstNext);
  await expect(clear).not.toContainText("Summarize the launch risks");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  expect(await secondCadence.getAttribute("title")).toBe(secondTitle);
  await expect(page.locator("[data-testid^='usage-pause-']").nth(0)).toHaveText("No usage pause");
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Wakes paused");
  await page.getByTestId("composer").fill("Has usage been paused for the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const duringDesk = page.locator("#thread .turn").last();
  await expect(duringDesk).toContainText("“Draft the weekly close but do not send it” has no usage pause in the record.");
  await expect(duringDesk).not.toContainText("Wakes are paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='usage-pause-']")).toHaveCount(2);
  await page.getByTestId("composer").fill("Resume wakes");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Pause wakes");

  await page.getByTestId("composer").fill("Pause the Draft the weekly close but do not send it routine");
  await page.getByTestId("send").click();
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);
  await page.getByTestId("composer").fill("Has usage been paused for the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const pausedAsk = page.locator("#thread .turn").last();
  await expect(pausedAsk).toContainText("“Draft the weekly close but do not send it” has no usage pause in the record.");
  await expect(pausedAsk).not.toContainText(firstNext);
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='usage-pause-']").nth(0)).toHaveText("No usage pause");

  await page.getByTestId("composer").fill("Can the Draft the weekly close but do not send it routine reach its source?");
  await page.getByTestId("send").click();
  const source = page.locator("#thread .turn").last();
  await expect(source).toContainText("“Draft the weekly close but do not send it” has no source system in the record.");
  await expect(source).not.toContainText("usage pause");
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);

  await page.getByTestId("composer").fill("Which plugins does the Draft the weekly close but do not send it routine need?");
  await page.getByTestId("send").click();
  const plugin = page.locator("#thread .turn").last();
  await expect(plugin).toContainText("“Draft the weekly close but do not send it” has no required plugin in the record.");
  await expect(plugin).not.toContainText("usage pause");
  await expect(page.locator("[data-testid^='plugin-']").nth(0)).toHaveText("No required plugin");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveText("Active");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-routine-usage.png" });
});

test("ORIEL-F107 what failure one routine shows does not start a test run", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("What failure does the Launch note routine show?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("There is no such routine as “Launch note”.");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  const firstTitle = await firstCadence.getAttribute("title");
  const firstNext = firstTitle?.replace(/^Next wake /, "") ?? "";
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  const secondTitle = await secondCadence.getAttribute("title");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking what failure one routine shows says that routine has no failure in the record.",
  );
  await expect(page.locator("[data-testid^='run-failure-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='failure-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='run-failure-']").nth(0)).toHaveText("No failure");
  await expect(page.locator("[data-testid^='usage-pause-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='usage-pause-']").nth(0)).toHaveText("No usage pause");
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");
  await expect(page.locator("[data-testid^='plugin-']").nth(0)).toHaveText("No required plugin");
  await expect(page.locator("[data-testid^='owner-']").nth(0)).toHaveText("No owning bot");
  await expect(page.locator("[data-testid^='zone-']").nth(0)).toHaveText("No time zone");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);

  await page.getByTestId("composer").fill("What failure does the Draft the weekly close but do not send it routine show?");
  await page.getByTestId("send").click();
  const clear = page.locator("#thread .turn").last();
  await expect(clear).toContainText("“Draft the weekly close but do not send it” has no failure in the record.");
  await expect(clear).toContainText("Asking does not start a test run.");
  await expect(clear).not.toContainText("Grok Bot");
  await expect(clear).not.toContainText(firstNext);
  await expect(clear).not.toContainText("Summarize the launch risks");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  expect(await secondCadence.getAttribute("title")).toBe(secondTitle);
  await expect(page.locator("[data-testid^='run-failure-']").nth(0)).toHaveText("No failure");
  await expect(page.locator("[data-testid^='failure-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='usage-pause-']").nth(0)).toHaveText("No usage pause");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Wakes paused");
  await page.getByTestId("composer").fill("What failure does the Draft the weekly close but do not send it routine show?");
  await page.getByTestId("send").click();
  const duringDesk = page.locator("#thread .turn").last();
  await expect(duringDesk).toContainText("“Draft the weekly close but do not send it” has no failure in the record.");
  await expect(duringDesk).not.toContainText("Wakes are paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='run-failure-']")).toHaveCount(2);
  await page.getByTestId("composer").fill("Resume wakes");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Pause wakes");

  await page.getByTestId("composer").fill("Pause the Draft the weekly close but do not send it routine");
  await page.getByTestId("send").click();
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);
  await page.getByTestId("composer").fill("What failure does the Draft the weekly close but do not send it routine show?");
  await page.getByTestId("send").click();
  const pausedAsk = page.locator("#thread .turn").last();
  await expect(pausedAsk).toContainText("“Draft the weekly close but do not send it” has no failure in the record.");
  await expect(pausedAsk).not.toContainText(firstNext);
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='run-failure-']").nth(0)).toHaveText("No failure");

  await page.getByTestId("composer").fill("Why hasn't the Draft the weekly close but do not send it routine run?");
  await page.getByTestId("send").click();
  const quiet = page.locator("#thread .turn").last();
  await expect(quiet).toContainText("A wake does not run it.");
  await expect(quiet).not.toContainText("has no failure");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);

  await page.getByTestId("composer").fill("Has usage been paused for the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const usage = page.locator("#thread .turn").last();
  await expect(usage).toContainText("“Draft the weekly close but do not send it” has no usage pause in the record.");
  await expect(usage).not.toContainText("has no failure");
  await expect(page.locator("[data-testid^='usage-pause-']").nth(0)).toHaveText("No usage pause");
  await expect(page.locator("[data-testid^='run-failure-']").nth(0)).toHaveText("No failure");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveText("Active");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-routine-failure.png" });
});

test("ORIEL-F108 which channel starts one routine does not connect a channel", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Which channel starts the Launch note routine?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("There is no such routine as “Launch note”.");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  const firstTitle = await firstCadence.getAttribute("title");
  const firstNext = firstTitle?.replace(/^Next wake /, "") ?? "";
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  const secondTitle = await secondCadence.getAttribute("title");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking which channel starts one routine says that routine has no source channel in the record.",
  );
  await expect(page.locator("[data-testid^='source-channel-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='channel-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='source-channel-']").nth(0)).toHaveText("No source channel");
  await expect(page.locator("[data-testid^='run-failure-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='run-failure-']").nth(0)).toHaveText("No failure");
  await expect(page.locator("[data-testid^='usage-pause-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='usage-pause-']").nth(0)).toHaveText("No usage pause");
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");
  await expect(page.locator("[data-testid^='plugin-']").nth(0)).toHaveText("No required plugin");
  await expect(page.locator("[data-testid^='owner-']").nth(0)).toHaveText("No owning bot");
  await expect(page.locator("[data-testid^='zone-']").nth(0)).toHaveText("No time zone");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which channel starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const clear = page.locator("#thread .turn").last();
  await expect(clear).toContainText("“Draft the weekly close but do not send it” has no source channel in the record.");
  await expect(clear).toContainText("Asking does not connect a channel.");
  await expect(clear).not.toContainText("Grok Bot");
  await expect(clear).not.toContainText(firstNext);
  await expect(clear).not.toContainText("Summarize the launch risks");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  expect(await secondCadence.getAttribute("title")).toBe(secondTitle);
  await expect(page.locator("[data-testid^='source-channel-']").nth(0)).toHaveText("No source channel");
  await expect(page.locator("[data-testid^='channel-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='run-failure-']").nth(0)).toHaveText("No failure");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Wakes paused");
  await page.getByTestId("composer").fill("Which channel starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const duringDesk = page.locator("#thread .turn").last();
  await expect(duringDesk).toContainText("“Draft the weekly close but do not send it” has no source channel in the record.");
  await expect(duringDesk).not.toContainText("Wakes are paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='source-channel-']")).toHaveCount(2);
  await page.getByTestId("composer").fill("Resume wakes");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Pause wakes");

  await page.getByTestId("composer").fill("Pause the Draft the weekly close but do not send it routine");
  await page.getByTestId("send").click();
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);
  await page.getByTestId("composer").fill("Which channel starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const pausedAsk = page.locator("#thread .turn").last();
  await expect(pausedAsk).toContainText("“Draft the weekly close but do not send it” has no source channel in the record.");
  await expect(pausedAsk).not.toContainText(firstNext);
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='source-channel-']").nth(0)).toHaveText("No source channel");

  await page.getByTestId("composer").fill("Why hasn't the Draft the weekly close but do not send it routine run?");
  await page.getByTestId("send").click();
  const quiet = page.locator("#thread .turn").last();
  await expect(quiet).toContainText("A wake does not run it.");
  await expect(quiet).not.toContainText("source channel");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);

  await page.getByTestId("composer").fill("What failure does the Draft the weekly close but do not send it routine show?");
  await page.getByTestId("send").click();
  const failure = page.locator("#thread .turn").last();
  await expect(failure).toContainText("“Draft the weekly close but do not send it” has no failure in the record.");
  await expect(failure).not.toContainText("source channel");
  await expect(page.locator("[data-testid^='run-failure-']").nth(0)).toHaveText("No failure");
  await expect(page.locator("[data-testid^='source-channel-']").nth(0)).toHaveText("No source channel");

  await page.getByTestId("composer").fill("Has usage been paused for the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const usage = page.locator("#thread .turn").last();
  await expect(usage).toContainText("“Draft the weekly close but do not send it” has no usage pause in the record.");
  await expect(usage).not.toContainText("source channel");
  await expect(page.locator("[data-testid^='usage-pause-']").nth(0)).toHaveText("No usage pause");
  await expect(page.locator("[data-testid^='source-channel-']").nth(0)).toHaveText("No source channel");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveText("Active");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-routine-channel.png" });
});

test("ORIEL-F109 which repository starts one routine does not confirm a repository", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Which repository starts the Launch note routine?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("There is no such routine as “Launch note”.");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  const firstTitle = await firstCadence.getAttribute("title");
  const firstNext = firstTitle?.replace(/^Next wake /, "") ?? "";
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  const secondTitle = await secondCadence.getAttribute("title");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking which repository starts one routine says that routine has no source repository in the record.",
  );
  await expect(page.locator("[data-testid^='source-repository-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");
  await expect(page.locator("[data-testid^='repository-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='source-repository-']").nth(0)).toHaveText("No source repository");
  await expect(page.locator("[data-testid^='run-failure-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='run-failure-']").nth(0)).toHaveText("No failure");
  await expect(page.locator("[data-testid^='usage-pause-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='usage-pause-']").nth(0)).toHaveText("No usage pause");
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");
  await expect(page.locator("[data-testid^='plugin-']").nth(0)).toHaveText("No required plugin");
  await expect(page.locator("[data-testid^='owner-']").nth(0)).toHaveText("No owning bot");
  await expect(page.locator("[data-testid^='zone-']").nth(0)).toHaveText("No time zone");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which repository starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const clear = page.locator("#thread .turn").last();
  await expect(clear).toContainText("“Draft the weekly close but do not send it” has no source repository in the record.");
  await expect(clear).toContainText("Asking does not confirm a repository.");
  await expect(clear).not.toContainText("Grok Bot");
  await expect(clear).not.toContainText(firstNext);
  await expect(clear).not.toContainText("Summarize the launch risks");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  expect(await secondCadence.getAttribute("title")).toBe(secondTitle);
  await expect(page.locator("[data-testid^='source-repository-']").nth(0)).toHaveText("No source repository");
  await expect(page.locator("[data-testid^='repository-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='run-failure-']").nth(0)).toHaveText("No failure");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Wakes paused");
  await page.getByTestId("composer").fill("Which repository starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const duringDesk = page.locator("#thread .turn").last();
  await expect(duringDesk).toContainText("“Draft the weekly close but do not send it” has no source repository in the record.");
  await expect(duringDesk).not.toContainText("Wakes are paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='source-repository-']")).toHaveCount(2);
  await page.getByTestId("composer").fill("Resume wakes");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Pause wakes");

  await page.getByTestId("composer").fill("Pause the Draft the weekly close but do not send it routine");
  await page.getByTestId("send").click();
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);
  await page.getByTestId("composer").fill("Which repository starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const pausedAsk = page.locator("#thread .turn").last();
  await expect(pausedAsk).toContainText("“Draft the weekly close but do not send it” has no source repository in the record.");
  await expect(pausedAsk).not.toContainText(firstNext);
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='source-repository-']").nth(0)).toHaveText("No source repository");

  await page.getByTestId("composer").fill("Why hasn't the Draft the weekly close but do not send it routine run?");
  await page.getByTestId("send").click();
  const quiet = page.locator("#thread .turn").last();
  await expect(quiet).toContainText("A wake does not run it.");
  await expect(quiet).not.toContainText("repository");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);

  await page.getByTestId("composer").fill("Which channel starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const channel = page.locator("#thread .turn").last();
  await expect(channel).toContainText("“Draft the weekly close but do not send it” has no source channel in the record.");
  await expect(channel).not.toContainText("repository");
  await expect(page.locator("[data-testid^='source-channel-']").nth(0)).toHaveText("No source channel");
  await expect(page.locator("[data-testid^='source-repository-']").nth(0)).toHaveText("No source repository");

  await page.getByTestId("composer").fill("What failure does the Draft the weekly close but do not send it routine show?");
  await page.getByTestId("send").click();
  const failure = page.locator("#thread .turn").last();
  await expect(failure).toContainText("“Draft the weekly close but do not send it” has no failure in the record.");
  await expect(failure).not.toContainText("repository");
  await expect(page.locator("[data-testid^='run-failure-']").nth(0)).toHaveText("No failure");
  await expect(page.locator("[data-testid^='source-repository-']").nth(0)).toHaveText("No source repository");

  await page.getByTestId("composer").fill("Has usage been paused for the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const usage = page.locator("#thread .turn").last();
  await expect(usage).toContainText("“Draft the weekly close but do not send it” has no usage pause in the record.");
  await expect(usage).not.toContainText("repository");
  await expect(page.locator("[data-testid^='usage-pause-']").nth(0)).toHaveText("No usage pause");
  await expect(page.locator("[data-testid^='source-repository-']").nth(0)).toHaveText("No source repository");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveText("Active");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-routine-repository.png" });
});

test("ORIEL-F110 which matching rule starts one routine does not confirm a repository", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Which matching rule starts the Launch note routine?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("There is no such routine as “Launch note”.");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  const firstTitle = await firstCadence.getAttribute("title");
  const firstNext = firstTitle?.replace(/^Next wake /, "") ?? "";
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  const secondTitle = await secondCadence.getAttribute("title");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking which matching rule starts one routine says that routine has no matching rule in the record.",
  );
  await expect(page.locator("[data-testid^='matching-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='matching-rule-']").nth(0)).toHaveText("No matching rule");
  await expect(page.locator("[data-testid^='matching-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='matching-rule-']").nth(0)).toHaveText("No matching rule");
  await expect(page.locator("[data-testid^='source-repository-']").nth(0)).toHaveText("No source repository");
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");
  await expect(page.locator("[data-testid^='repository-']")).toHaveCount(0);
  await expect(page.getByTestId("rule-send")).toHaveCount(1);
  await expect(page.getByTestId("rule-pay")).toHaveCount(1);
  await expect(page.getByTestId("rule-delete")).toHaveCount(1);
  await expect(page.getByTestId("rule-post")).toHaveCount(1);
  await expect(page.locator("[data-testid^='run-failure-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='run-failure-']").nth(0)).toHaveText("No failure");
  await expect(page.locator("[data-testid^='usage-pause-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='usage-pause-']").nth(0)).toHaveText("No usage pause");
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");
  await expect(page.locator("[data-testid^='plugin-']").nth(0)).toHaveText("No required plugin");
  await expect(page.locator("[data-testid^='owner-']").nth(0)).toHaveText("No owning bot");
  await expect(page.locator("[data-testid^='zone-']").nth(0)).toHaveText("No time zone");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which matching rule starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const clear = page.locator("#thread .turn").last();
  await expect(clear).toContainText("“Draft the weekly close but do not send it” has no matching rule in the record.");
  await expect(clear).toContainText("Asking does not confirm a matching rule.");
  await expect(clear).not.toContainText("Grok Bot");
  await expect(clear).not.toContainText(firstNext);
  await expect(clear).not.toContainText("Summarize the launch risks");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  expect(await secondCadence.getAttribute("title")).toBe(secondTitle);
  await expect(page.locator("[data-testid^='matching-rule-']").nth(0)).toHaveText("No matching rule");
  await expect(page.locator("[data-testid^='matching-rule-']").nth(0)).toHaveText("No matching rule");
  await expect(page.locator("[data-testid^='source-repository-']").nth(0)).toHaveText("No source repository");
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='run-failure-']").nth(0)).toHaveText("No failure");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Wakes paused");
  await page.getByTestId("composer").fill("Which matching rule starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const duringDesk = page.locator("#thread .turn").last();
  await expect(duringDesk).toContainText("“Draft the weekly close but do not send it” has no matching rule in the record.");
  await expect(duringDesk).not.toContainText("Wakes are paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='matching-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await page.getByTestId("composer").fill("Resume wakes");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Pause wakes");

  await page.getByTestId("composer").fill("Pause the Draft the weekly close but do not send it routine");
  await page.getByTestId("send").click();
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);
  await page.getByTestId("composer").fill("Which matching rule starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const pausedAsk = page.locator("#thread .turn").last();
  await expect(pausedAsk).toContainText("“Draft the weekly close but do not send it” has no matching rule in the record.");
  await expect(pausedAsk).not.toContainText(firstNext);
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='matching-rule-']").nth(0)).toHaveText("No matching rule");
  await expect(page.locator("[data-testid^='source-repository-']").nth(0)).toHaveText("No source repository");

  await page.getByTestId("composer").fill("Why hasn't the Draft the weekly close but do not send it routine run?");
  await page.getByTestId("send").click();
  const quiet = page.locator("#thread .turn").last();
  await expect(quiet).toContainText("A wake does not run it.");
  await expect(quiet).not.toContainText("matching rule");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);

  await page.getByTestId("composer").fill("Which repository starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const repository = page.locator("#thread .turn").last();
  await expect(repository).toContainText("“Draft the weekly close but do not send it” has no source repository in the record.");
  await expect(repository).not.toContainText("matching rule");
  await expect(page.locator("[data-testid^='source-repository-']").nth(0)).toHaveText("No source repository");
  await expect(page.locator("[data-testid^='matching-rule-']").nth(0)).toHaveText("No matching rule");
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");

  await page.getByTestId("composer").fill("Which channel starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const channel = page.locator("#thread .turn").last();
  await expect(channel).toContainText("“Draft the weekly close but do not send it” has no source channel in the record.");
  await expect(channel).not.toContainText("matching rule");
  await expect(page.locator("[data-testid^='source-channel-']").nth(0)).toHaveText("No source channel");
  await expect(page.locator("[data-testid^='matching-rule-']").nth(0)).toHaveText("No matching rule");
  await expect(page.locator("[data-testid^='source-repository-']").nth(0)).toHaveText("No source repository");

  await page.getByTestId("composer").fill("What failure does the Draft the weekly close but do not send it routine show?");
  await page.getByTestId("send").click();
  const failure = page.locator("#thread .turn").last();
  await expect(failure).toContainText("“Draft the weekly close but do not send it” has no failure in the record.");
  await expect(failure).not.toContainText("matching rule");
  await expect(page.locator("[data-testid^='run-failure-']").nth(0)).toHaveText("No failure");
  await expect(page.locator("[data-testid^='matching-rule-']").nth(0)).toHaveText("No matching rule");
  await expect(page.locator("[data-testid^='source-repository-']").nth(0)).toHaveText("No source repository");

  await page.getByTestId("composer").fill("Has usage been paused for the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const usage = page.locator("#thread .turn").last();
  await expect(usage).toContainText("“Draft the weekly close but do not send it” has no usage pause in the record.");
  await expect(usage).not.toContainText("matching rule");
  await expect(page.locator("[data-testid^='usage-pause-']").nth(0)).toHaveText("No usage pause");
  await expect(page.locator("[data-testid^='matching-rule-']").nth(0)).toHaveText("No matching rule");
  await expect(page.locator("[data-testid^='source-repository-']").nth(0)).toHaveText("No source repository");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveText("Active");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-routine-matching.png" });
});

test("ORIEL-F111 which ask-first rule blocks one routine does not save one", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Which ask-first rule blocks the Launch note routine?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("There is no such routine as “Launch note”.");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  const firstTitle = await firstCadence.getAttribute("title");
  const firstNext = firstTitle?.replace(/^Next wake /, "") ?? "";
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  const secondTitle = await secondCadence.getAttribute("title");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking which ask-first rule blocks one routine says that routine has no ask-first rule in the record.",
  );
  await expect(page.locator("[data-testid^='ask-first-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='ask-first-']").nth(0)).toHaveText("No ask-first rule");
  await expect(page.locator("[data-testid^='matching-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='matching-rule-']").nth(0)).toHaveText("No matching rule");
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");
  const askFollowsMatching = await page.evaluate(() => {
    const matching = document.querySelector("[data-testid^='matching-rule-']");
    const ask = document.querySelector("[data-testid^='ask-first-']");
    if (!matching || !ask || matching.parentElement !== ask.parentElement) return false;
    return matching.compareDocumentPosition(ask) === Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(askFollowsMatching).toBe(true);
  const ruleIds = await page.locator("[data-testid^='rule-']").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-testid") ?? ""),
  );
  expect(ruleIds).toEqual(expect.arrayContaining(["rule-send", "rule-pay", "rule-delete", "rule-post"]));
  expect(ruleIds.some((id) => id.startsWith("ask-first"))).toBe(false);
  await expect(page.locator("[data-testid^='run-failure-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='run-failure-']").nth(0)).toHaveText("No failure");
  await expect(page.locator("[data-testid^='usage-pause-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='usage-pause-']").nth(0)).toHaveText("No usage pause");
  await expect(page.locator("[data-testid^='plugin-']").nth(0)).toHaveText("No required plugin");
  await expect(page.locator("[data-testid^='owner-']").nth(0)).toHaveText("No owning bot");
  await expect(page.locator("[data-testid^='zone-']").nth(0)).toHaveText("No time zone");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which ask-first rule blocks the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const clear = page.locator("#thread .turn").last();
  await expect(clear).toContainText("“Draft the weekly close but do not send it” has no ask-first rule in the record.");
  await expect(clear).toContainText("Asking does not save an ask-first rule.");
  await expect(clear).not.toContainText("Grok Bot");
  await expect(clear).not.toContainText(firstNext);
  await expect(clear).not.toContainText("Summarize the launch risks");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  expect(await secondCadence.getAttribute("title")).toBe(secondTitle);
  await expect(page.locator("[data-testid^='ask-first-']").nth(0)).toHaveText("No ask-first rule");
  await expect(page.locator("[data-testid^='matching-rule-']").nth(0)).toHaveText("No matching rule");
  await expect(page.locator("[data-testid^='source-repository-']").nth(0)).toHaveText("No source repository");
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");
  await expect(page.locator("[data-testid^='run-failure-']").nth(0)).toHaveText("No failure");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Wakes paused");
  await page.getByTestId("composer").fill("Which ask-first rule blocks the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const duringDesk = page.locator("#thread .turn").last();
  await expect(duringDesk).toContainText("“Draft the weekly close but do not send it” has no ask-first rule in the record.");
  await expect(duringDesk).not.toContainText("Wakes are paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='ask-first-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='matching-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await page.getByTestId("composer").fill("Resume wakes");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Pause wakes");

  await page.getByTestId("composer").fill("Pause the Draft the weekly close but do not send it routine");
  await page.getByTestId("send").click();
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);
  await page.getByTestId("composer").fill("Which ask-first rule blocks the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const pausedAsk = page.locator("#thread .turn").last();
  await expect(pausedAsk).toContainText("“Draft the weekly close but do not send it” has no ask-first rule in the record.");
  await expect(pausedAsk).not.toContainText(firstNext);
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='ask-first-']").nth(0)).toHaveText("No ask-first rule");
  await expect(page.locator("[data-testid^='matching-rule-']").nth(0)).toHaveText("No matching rule");

  await page.getByTestId("composer").fill("Why hasn't the Draft the weekly close but do not send it routine run?");
  await page.getByTestId("send").click();
  const quiet = page.locator("#thread .turn").last();
  await expect(quiet).toContainText("A wake does not run it.");
  await expect(quiet).not.toContainText("ask-first");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);

  await page.getByTestId("composer").fill("Which matching rule starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const matching = page.locator("#thread .turn").last();
  await expect(matching).toContainText("“Draft the weekly close but do not send it” has no matching rule in the record.");
  await expect(matching).not.toContainText("ask-first");
  await expect(page.locator("[data-testid^='matching-rule-']").nth(0)).toHaveText("No matching rule");
  await expect(page.locator("[data-testid^='ask-first-']").nth(0)).toHaveText("No ask-first rule");

  await page.getByTestId("composer").fill("Which repository starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const repository = page.locator("#thread .turn").last();
  await expect(repository).toContainText("“Draft the weekly close but do not send it” has no source repository in the record.");
  await expect(repository).not.toContainText("ask-first");
  await expect(page.locator("[data-testid^='source-repository-']").nth(0)).toHaveText("No source repository");
  await expect(page.locator("[data-testid^='ask-first-']").nth(0)).toHaveText("No ask-first rule");
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");

  await page.getByTestId("composer").fill("Which channel starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const channel = page.locator("#thread .turn").last();
  await expect(channel).toContainText("“Draft the weekly close but do not send it” has no source channel in the record.");
  await expect(channel).not.toContainText("ask-first");
  await expect(page.locator("[data-testid^='source-channel-']").nth(0)).toHaveText("No source channel");
  await expect(page.locator("[data-testid^='ask-first-']").nth(0)).toHaveText("No ask-first rule");

  await page.getByTestId("composer").fill("What failure does the Draft the weekly close but do not send it routine show?");
  await page.getByTestId("send").click();
  const failure = page.locator("#thread .turn").last();
  await expect(failure).toContainText("“Draft the weekly close but do not send it” has no failure in the record.");
  await expect(failure).not.toContainText("ask-first");
  await expect(page.locator("[data-testid^='run-failure-']").nth(0)).toHaveText("No failure");
  await expect(page.locator("[data-testid^='ask-first-']").nth(0)).toHaveText("No ask-first rule");

  await page.getByTestId("composer").fill("Has usage been paused for the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const usage = page.locator("#thread .turn").last();
  await expect(usage).toContainText("“Draft the weekly close but do not send it” has no usage pause in the record.");
  await expect(usage).not.toContainText("ask-first");
  await expect(page.locator("[data-testid^='usage-pause-']").nth(0)).toHaveText("No usage pause");
  await expect(page.locator("[data-testid^='ask-first-']").nth(0)).toHaveText("No ask-first rule");
  await expect(page.locator("[data-testid^='matching-rule-']").nth(0)).toHaveText("No matching rule");
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveText("Active");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-routine-ask-first.png" });
});

test("ORIEL-F112 which allow-automatically rule covers one routine does not turn one on", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Which allow-automatically rule covers the Launch note routine?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("There is no such routine as “Launch note”.");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  const firstTitle = await firstCadence.getAttribute("title");
  const firstNext = firstTitle?.replace(/^Next wake /, "") ?? "";
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  const secondTitle = await secondCadence.getAttribute("title");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking which allow-automatically rule covers one routine says that routine has no allow-automatically rule in the record.",
  );
  await expect(page.locator("[data-testid^='allow-automatically-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='allow-automatically-']").nth(0)).toHaveText("No allow-automatically rule");
  await expect(page.locator("[data-testid^='ask-first-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='ask-first-']").nth(0)).toHaveText("No ask-first rule");
  await expect(page.locator("[data-testid^='matching-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='matching-rule-']").nth(0)).toHaveText("No matching rule");
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");
  const allowFollowsAsk = await page.evaluate(() => {
    const ask = document.querySelector("[data-testid^='ask-first-']");
    const allow = document.querySelector("[data-testid^='allow-automatically-']");
    if (!ask || !allow || ask.parentElement !== allow.parentElement) return false;
    return ask.compareDocumentPosition(allow) === Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(allowFollowsAsk).toBe(true);
  const ruleIds = await page.locator("[data-testid^='rule-']").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-testid") ?? ""),
  );
  expect(ruleIds).toEqual(expect.arrayContaining(["rule-send", "rule-pay", "rule-delete", "rule-post"]));
  expect(ruleIds.some((id) => id.startsWith("allow-automatically"))).toBe(false);
  await expect(page.locator("[data-testid^='run-failure-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='run-failure-']").nth(0)).toHaveText("No failure");
  await expect(page.locator("[data-testid^='usage-pause-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='usage-pause-']").nth(0)).toHaveText("No usage pause");
  await expect(page.locator("[data-testid^='plugin-']").nth(0)).toHaveText("No required plugin");
  await expect(page.locator("[data-testid^='owner-']").nth(0)).toHaveText("No owning bot");
  await expect(page.locator("[data-testid^='zone-']").nth(0)).toHaveText("No time zone");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which allow-automatically rule covers the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const clear = page.locator("#thread .turn").last();
  await expect(clear).toContainText("“Draft the weekly close but do not send it” has no allow-automatically rule in the record.");
  await expect(clear).toContainText("Asking does not turn one on.");
  await expect(clear).not.toContainText("has no ask-first rule");
  await expect(clear).not.toContainText("source repository");
  await expect(clear).not.toContainText("source channel");
  await expect(clear).not.toContainText("Grok Bot");
  await expect(clear).not.toContainText(firstNext);
  await expect(clear).not.toContainText("Summarize the launch risks");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  expect(await secondCadence.getAttribute("title")).toBe(secondTitle);
  await expect(page.locator("[data-testid^='allow-automatically-']").nth(0)).toHaveText("No allow-automatically rule");
  await expect(page.locator("[data-testid^='ask-first-']").nth(0)).toHaveText("No ask-first rule");
  await expect(page.locator("[data-testid^='matching-rule-']").nth(0)).toHaveText("No matching rule");
  await expect(page.locator("[data-testid^='source-repository-']").nth(0)).toHaveText("No source repository");
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");
  await expect(page.locator("[data-testid^='run-failure-']").nth(0)).toHaveText("No failure");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Wakes paused");
  await page.getByTestId("composer").fill("Which allow-automatically rule covers the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const duringDesk = page.locator("#thread .turn").last();
  await expect(duringDesk).toContainText("“Draft the weekly close but do not send it” has no allow-automatically rule in the record.");
  await expect(duringDesk).not.toContainText("Wakes are paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='allow-automatically-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='ask-first-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='matching-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await page.getByTestId("composer").fill("Resume wakes");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Pause wakes");

  await page.getByTestId("composer").fill("Pause the Draft the weekly close but do not send it routine");
  await page.getByTestId("send").click();
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);
  await page.getByTestId("composer").fill("Which allow-automatically rule covers the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const pausedAsk = page.locator("#thread .turn").last();
  await expect(pausedAsk).toContainText("“Draft the weekly close but do not send it” has no allow-automatically rule in the record.");
  await expect(pausedAsk).not.toContainText(firstNext);
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='allow-automatically-']").nth(0)).toHaveText("No allow-automatically rule");
  await expect(page.locator("[data-testid^='ask-first-']").nth(0)).toHaveText("No ask-first rule");

  await page.getByTestId("composer").fill("Which ask-first rule blocks the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const askFirst = page.locator("#thread .turn").last();
  await expect(askFirst).toContainText("“Draft the weekly close but do not send it” has no ask-first rule in the record.");
  await expect(askFirst).toContainText("Asking does not save an ask-first rule.");
  await expect(askFirst).not.toContainText("allow-automatically");
  await expect(page.locator("[data-testid^='ask-first-']").nth(0)).toHaveText("No ask-first rule");
  await expect(page.locator("[data-testid^='allow-automatically-']").nth(0)).toHaveText("No allow-automatically rule");

  await page.getByTestId("composer").fill("Which matching rule starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const matching = page.locator("#thread .turn").last();
  await expect(matching).toContainText("“Draft the weekly close but do not send it” has no matching rule in the record.");
  await expect(matching).toContainText("Asking does not confirm a matching rule.");
  await expect(matching).not.toContainText("allow-automatically");
  await expect(page.locator("[data-testid^='matching-rule-']").nth(0)).toHaveText("No matching rule");
  await expect(page.locator("[data-testid^='allow-automatically-']").nth(0)).toHaveText("No allow-automatically rule");

  await page.getByTestId("composer").fill("Which repository starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const repository = page.locator("#thread .turn").last();
  await expect(repository).toContainText("“Draft the weekly close but do not send it” has no source repository in the record.");
  await expect(repository).toContainText("Asking does not confirm a repository.");
  await expect(repository).not.toContainText("has no allow-automatically rule");
  await expect(page.locator("[data-testid^='source-repository-']").nth(0)).toHaveText("No source repository");
  await expect(page.locator("[data-testid^='allow-automatically-']").nth(0)).toHaveText("No allow-automatically rule");
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);

  await page.getByTestId("composer").fill("Which channel starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const channel = page.locator("#thread .turn").last();
  await expect(channel).toContainText("“Draft the weekly close but do not send it” has no source channel in the record.");
  await expect(channel).toContainText("Asking does not connect a channel.");
  await expect(channel).not.toContainText("has no allow-automatically rule");
  await expect(page.locator("[data-testid^='source-channel-']").nth(0)).toHaveText("No source channel");
  await expect(page.locator("[data-testid^='allow-automatically-']").nth(0)).toHaveText("No allow-automatically rule");

  await page.getByTestId("composer").fill("What failure does the Draft the weekly close but do not send it routine show?");
  await page.getByTestId("send").click();
  const failure = page.locator("#thread .turn").last();
  await expect(failure).toContainText("“Draft the weekly close but do not send it” has no failure in the record.");
  await expect(failure).not.toContainText("allow-automatically");
  await expect(page.locator("[data-testid^='run-failure-']").nth(0)).toHaveText("No failure");
  await expect(page.locator("[data-testid^='allow-automatically-']").nth(0)).toHaveText("No allow-automatically rule");

  await page.getByTestId("composer").fill("Has usage been paused for the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const usage = page.locator("#thread .turn").last();
  await expect(usage).toContainText("“Draft the weekly close but do not send it” has no usage pause in the record.");
  await expect(usage).not.toContainText("has no allow-automatically rule");
  await expect(page.locator("[data-testid^='usage-pause-']").nth(0)).toHaveText("No usage pause");
  await expect(page.locator("[data-testid^='allow-automatically-']").nth(0)).toHaveText("No allow-automatically rule");

  await page.getByTestId("composer").fill("Why hasn't the Draft the weekly close but do not send it routine run?");
  await page.getByTestId("send").click();
  const quiet = page.locator("#thread .turn").last();
  await expect(quiet).toContainText("A wake does not run it.");
  await expect(quiet).not.toContainText("allow-automatically");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveText("Active");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-routine-allow-auto.png" });
});

test("ORIEL-F113 which team rule blocks one routine does not lock one", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Which team rule blocks the Launch note routine?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("There is no such routine as “Launch note”.");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  const firstTitle = await firstCadence.getAttribute("title");
  const firstNext = firstTitle?.replace(/^Next wake /, "") ?? "";
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  const secondTitle = await secondCadence.getAttribute("title");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking which team rule blocks one routine says that routine has no team rule in the record.",
  );
  await expect(page.locator("[data-testid^='team-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='team-rule-']").nth(0)).toHaveText("No team rule");
  await expect(page.locator("[data-testid^='allow-automatically-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='allow-automatically-']").nth(0)).toHaveText("No allow-automatically rule");
  await expect(page.locator("[data-testid^='ask-first-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='ask-first-']").nth(0)).toHaveText("No ask-first rule");
  await expect(page.locator("[data-testid^='matching-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='matching-rule-']").nth(0)).toHaveText("No matching rule");
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");
  const teamFollowsAllow = await page.evaluate(() => {
    const allow = document.querySelector("[data-testid^='allow-automatically-']");
    const team = document.querySelector("[data-testid^='team-rule-']");
    if (!allow || !team || allow.parentElement !== team.parentElement) return false;
    return allow.compareDocumentPosition(team) === Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(teamFollowsAllow).toBe(true);
  const ruleIds = await page.locator("[data-testid^='rule-']").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-testid") ?? ""),
  );
  expect(ruleIds).toEqual(expect.arrayContaining(["rule-send", "rule-pay", "rule-delete", "rule-post"]));
  expect(ruleIds.some((id) => id.startsWith("team-rule"))).toBe(false);
  await expect(page.locator("[data-testid^='run-failure-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='run-failure-']").nth(0)).toHaveText("No failure");
  await expect(page.locator("[data-testid^='usage-pause-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='usage-pause-']").nth(0)).toHaveText("No usage pause");
  await expect(page.locator("[data-testid^='plugin-']").nth(0)).toHaveText("No required plugin");
  await expect(page.locator("[data-testid^='owner-']").nth(0)).toHaveText("No owning bot");
  await expect(page.locator("[data-testid^='zone-']").nth(0)).toHaveText("No time zone");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);

  await page.getByTestId("composer").fill("Which team rule blocks the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const clear = page.locator("#thread .turn").last();
  await expect(clear).toContainText("“Draft the weekly close but do not send it” has no team rule in the record.");
  await expect(clear).toContainText("Asking does not lock a team rule.");
  await expect(clear).not.toContainText("has no allow-automatically rule");
  await expect(clear).not.toContainText("source repository");
  await expect(clear).not.toContainText("source channel");
  await expect(clear).not.toContainText("Grok Bot");
  await expect(clear).not.toContainText(firstNext);
  await expect(clear).not.toContainText("Summarize the launch risks");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  expect(await secondCadence.getAttribute("title")).toBe(secondTitle);
  await expect(page.locator("[data-testid^='team-rule-']").nth(0)).toHaveText("No team rule");
  await expect(page.locator("[data-testid^='allow-automatically-']").nth(0)).toHaveText("No allow-automatically rule");
  await expect(page.locator("[data-testid^='ask-first-']").nth(0)).toHaveText("No ask-first rule");
  await expect(page.locator("[data-testid^='matching-rule-']").nth(0)).toHaveText("No matching rule");
  await expect(page.locator("[data-testid^='source-repository-']").nth(0)).toHaveText("No source repository");
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");
  await expect(page.locator("[data-testid^='run-failure-']").nth(0)).toHaveText("No failure");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Wakes paused");
  await page.getByTestId("composer").fill("Which team rule blocks the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const duringDesk = page.locator("#thread .turn").last();
  await expect(duringDesk).toContainText("“Draft the weekly close but do not send it” has no team rule in the record.");
  await expect(duringDesk).not.toContainText("Wakes are paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='team-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='allow-automatically-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='ask-first-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='matching-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await page.getByTestId("composer").fill("Resume wakes");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Pause wakes");

  await page.getByTestId("composer").fill("Pause the Draft the weekly close but do not send it routine");
  await page.getByTestId("send").click();
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);
  await page.getByTestId("composer").fill("Which team rule blocks the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const pausedAsk = page.locator("#thread .turn").last();
  await expect(pausedAsk).toContainText("“Draft the weekly close but do not send it” has no team rule in the record.");
  await expect(pausedAsk).not.toContainText(firstNext);
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='team-rule-']").nth(0)).toHaveText("No team rule");
  await expect(page.locator("[data-testid^='allow-automatically-']").nth(0)).toHaveText("No allow-automatically rule");

  await page.getByTestId("composer").fill("Which allow-automatically rule covers the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const allow = page.locator("#thread .turn").last();
  await expect(allow).toContainText("“Draft the weekly close but do not send it” has no allow-automatically rule in the record.");
  await expect(allow).toContainText("Asking does not turn one on.");
  await expect(allow).not.toContainText("team rule");
  await expect(page.locator("[data-testid^='allow-automatically-']").nth(0)).toHaveText("No allow-automatically rule");
  await expect(page.locator("[data-testid^='team-rule-']").nth(0)).toHaveText("No team rule");

  await page.getByTestId("composer").fill("Which ask-first rule blocks the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const askFirst = page.locator("#thread .turn").last();
  await expect(askFirst).toContainText("“Draft the weekly close but do not send it” has no ask-first rule in the record.");
  await expect(askFirst).toContainText("Asking does not save an ask-first rule.");
  await expect(askFirst).not.toContainText("team rule");
  await expect(page.locator("[data-testid^='ask-first-']").nth(0)).toHaveText("No ask-first rule");
  await expect(page.locator("[data-testid^='team-rule-']").nth(0)).toHaveText("No team rule");

  await page.getByTestId("composer").fill("Which matching rule starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const matching = page.locator("#thread .turn").last();
  await expect(matching).toContainText("“Draft the weekly close but do not send it” has no matching rule in the record.");
  await expect(matching).toContainText("Asking does not confirm a matching rule.");
  await expect(matching).not.toContainText("team rule");
  await expect(page.locator("[data-testid^='matching-rule-']").nth(0)).toHaveText("No matching rule");
  await expect(page.locator("[data-testid^='team-rule-']").nth(0)).toHaveText("No team rule");

  await page.getByTestId("composer").fill("Which repository starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const repository = page.locator("#thread .turn").last();
  await expect(repository).toContainText("“Draft the weekly close but do not send it” has no source repository in the record.");
  await expect(repository).toContainText("Asking does not confirm a repository.");
  await expect(repository).not.toContainText("has no team rule");
  await expect(page.locator("[data-testid^='source-repository-']").nth(0)).toHaveText("No source repository");
  await expect(page.locator("[data-testid^='team-rule-']").nth(0)).toHaveText("No team rule");
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);

  await page.getByTestId("composer").fill("Which channel starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const channel = page.locator("#thread .turn").last();
  await expect(channel).toContainText("“Draft the weekly close but do not send it” has no source channel in the record.");
  await expect(channel).toContainText("Asking does not connect a channel.");
  await expect(channel).not.toContainText("has no team rule");
  await expect(page.locator("[data-testid^='source-channel-']").nth(0)).toHaveText("No source channel");
  await expect(page.locator("[data-testid^='team-rule-']").nth(0)).toHaveText("No team rule");

  await page.getByTestId("composer").fill("What failure does the Draft the weekly close but do not send it routine show?");
  await page.getByTestId("send").click();
  const failure = page.locator("#thread .turn").last();
  await expect(failure).toContainText("“Draft the weekly close but do not send it” has no failure in the record.");
  await expect(failure).not.toContainText("team rule");
  await expect(page.locator("[data-testid^='run-failure-']").nth(0)).toHaveText("No failure");
  await expect(page.locator("[data-testid^='team-rule-']").nth(0)).toHaveText("No team rule");

  await page.getByTestId("composer").fill("Has usage been paused for the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const usage = page.locator("#thread .turn").last();
  await expect(usage).toContainText("“Draft the weekly close but do not send it” has no usage pause in the record.");
  await expect(usage).not.toContainText("has no team rule");
  await expect(page.locator("[data-testid^='usage-pause-']").nth(0)).toHaveText("No usage pause");
  await expect(page.locator("[data-testid^='team-rule-']").nth(0)).toHaveText("No team rule");

  await page.getByTestId("composer").fill("Why hasn't the Draft the weekly close but do not send it routine run?");
  await page.getByTestId("send").click();
  const quiet = page.locator("#thread .turn").last();
  await expect(quiet).toContainText("A wake does not run it.");
  await expect(quiet).not.toContainText("team rule");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveText("Active");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-routine-team-rule.png" });
});

test("ORIEL-F114 whether the team rule for one routine is locked does not lock one", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Is the team rule for the Launch note routine locked?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("There is no such routine as “Launch note”.");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  const firstTitle = await firstCadence.getAttribute("title");
  const firstNext = firstTitle?.replace(/^Next wake /, "") ?? "";
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  const secondTitle = await secondCadence.getAttribute("title");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking whether the team rule for one routine is locked says that routine has no locked team rule in the record.",
  );
  await expect(page.locator("[data-testid^='team-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='team-rule-']").nth(0)).toHaveText("No team rule");
  await expect(page.locator("[data-testid^='locked-team-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='locked-team-rule-']").nth(0)).toHaveText("No locked team rule");
  await expect(page.locator("[data-testid^='allow-automatically-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='allow-automatically-']").nth(0)).toHaveText("No allow-automatically rule");
  await expect(page.locator("[data-testid^='ask-first-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='ask-first-']").nth(0)).toHaveText("No ask-first rule");
  await expect(page.locator("[data-testid^='matching-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='matching-rule-']").nth(0)).toHaveText("No matching rule");
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");
  const teamFollowsAllow = await page.evaluate(() => {
    const allow = document.querySelector("[data-testid^='allow-automatically-']");
    const team = document.querySelector("[data-testid^='team-rule-']");
    if (!allow || !team || allow.parentElement !== team.parentElement) return false;
    return allow.compareDocumentPosition(team) === Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(teamFollowsAllow).toBe(true);
  const lockedFollowsTeam = await page.evaluate(() => {
    const team = document.querySelector("[data-testid^='team-rule-']");
    const locked = document.querySelector("[data-testid^='locked-team-rule-']");
    if (!team || !locked || team.parentElement !== locked.parentElement) return false;
    return team.compareDocumentPosition(locked) === Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(lockedFollowsTeam).toBe(true);
  const lockedIds = await page.locator("[data-testid^='locked-team-rule-']").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-testid") ?? ""),
  );
  expect(lockedIds.every((id) => id.startsWith("locked-team-rule-"))).toBe(true);
  expect(lockedIds.some((id) => id.startsWith("team-rule-"))).toBe(false);
  expect(lockedIds.some((id) => id.startsWith("rule-"))).toBe(false);
  const ruleIds = await page.locator("[data-testid^='rule-']").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-testid") ?? ""),
  );
  expect(ruleIds).toEqual(expect.arrayContaining(["rule-send", "rule-pay", "rule-delete", "rule-post"]));
  expect(ruleIds.some((id) => id.startsWith("team-rule"))).toBe(false);
  await expect(page.locator("[data-testid^='run-failure-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='run-failure-']").nth(0)).toHaveText("No failure");
  await expect(page.locator("[data-testid^='usage-pause-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='usage-pause-']").nth(0)).toHaveText("No usage pause");
  await expect(page.locator("[data-testid^='plugin-']").nth(0)).toHaveText("No required plugin");
  await expect(page.locator("[data-testid^='owner-']").nth(0)).toHaveText("No owning bot");
  await expect(page.locator("[data-testid^='zone-']").nth(0)).toHaveText("No time zone");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);

  await page.getByTestId("composer").fill("Is the team rule for the Draft the weekly close but do not send it routine locked?");
  await page.getByTestId("send").click();
  const clear = page.locator("#thread .turn").last();
  await expect(clear).toContainText("“Draft the weekly close but do not send it” has no locked team rule in the record.");
  await expect(clear).not.toContainText("has no team rule");
  await expect(clear).toContainText("Asking does not lock a team rule.");
  await expect(clear).not.toContainText("has no allow-automatically rule");
  await expect(clear).not.toContainText("source repository");
  await expect(clear).not.toContainText("source channel");
  await expect(clear).not.toContainText("Grok Bot");
  await expect(clear).not.toContainText(firstNext);
  await expect(clear).not.toContainText("Summarize the launch risks");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  expect(await secondCadence.getAttribute("title")).toBe(secondTitle);
  await expect(page.locator("[data-testid^='team-rule-']").nth(0)).toHaveText("No team rule");
  await expect(page.locator("[data-testid^='allow-automatically-']").nth(0)).toHaveText("No allow-automatically rule");
  await expect(page.locator("[data-testid^='ask-first-']").nth(0)).toHaveText("No ask-first rule");
  await expect(page.locator("[data-testid^='matching-rule-']").nth(0)).toHaveText("No matching rule");
  await expect(page.locator("[data-testid^='source-repository-']").nth(0)).toHaveText("No source repository");
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");
  await expect(page.locator("[data-testid^='run-failure-']").nth(0)).toHaveText("No failure");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Wakes paused");
  await page.getByTestId("composer").fill("Is the team rule for the Draft the weekly close but do not send it routine locked?");
  await page.getByTestId("send").click();
  const duringDesk = page.locator("#thread .turn").last();
  await expect(duringDesk).toContainText("“Draft the weekly close but do not send it” has no locked team rule in the record.");
  await expect(duringDesk).not.toContainText("Wakes are paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='team-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='allow-automatically-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='ask-first-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='matching-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await page.getByTestId("composer").fill("Resume wakes");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Pause wakes");

  await page.getByTestId("composer").fill("Pause the Draft the weekly close but do not send it routine");
  await page.getByTestId("send").click();
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);
  await page.getByTestId("composer").fill("Is the team rule for the Draft the weekly close but do not send it routine locked?");
  await page.getByTestId("send").click();
  const pausedAsk = page.locator("#thread .turn").last();
  await expect(pausedAsk).toContainText("“Draft the weekly close but do not send it” has no locked team rule in the record.");
  await expect(pausedAsk).not.toContainText(firstNext);
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='team-rule-']").nth(0)).toHaveText("No team rule");
  await expect(page.locator("[data-testid^='allow-automatically-']").nth(0)).toHaveText("No allow-automatically rule");

  await page.getByTestId("composer").fill("Which team rule blocks the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const team = page.locator("#thread .turn").last();
  await expect(team).toContainText("“Draft the weekly close but do not send it” has no team rule in the record.");
  await expect(team).toContainText("Asking does not lock a team rule.");
  await expect(team).not.toContainText("has no locked team rule");
  await expect(team).not.toContainText("locked team rule");
  await expect(page.locator("[data-testid^='team-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='team-rule-']").nth(0)).toHaveText("No team rule");
  await expect(page.locator("[data-testid^='locked-team-rule-']").nth(0)).toHaveText("No locked team rule");

  await page.getByTestId("composer").fill("Which allow-automatically rule covers the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const allow = page.locator("#thread .turn").last();
  await expect(allow).toContainText("“Draft the weekly close but do not send it” has no allow-automatically rule in the record.");
  await expect(allow).toContainText("Asking does not turn one on.");
  await expect(allow).not.toContainText("locked team rule");
  await expect(page.locator("[data-testid^='allow-automatically-']").nth(0)).toHaveText("No allow-automatically rule");
  await expect(page.locator("[data-testid^='team-rule-']").nth(0)).toHaveText("No team rule");

  await page.getByTestId("composer").fill("Which ask-first rule blocks the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const askFirst = page.locator("#thread .turn").last();
  await expect(askFirst).toContainText("“Draft the weekly close but do not send it” has no ask-first rule in the record.");
  await expect(askFirst).toContainText("Asking does not save an ask-first rule.");
  await expect(askFirst).not.toContainText("locked team rule");
  await expect(page.locator("[data-testid^='ask-first-']").nth(0)).toHaveText("No ask-first rule");
  await expect(page.locator("[data-testid^='team-rule-']").nth(0)).toHaveText("No team rule");

  await page.getByTestId("composer").fill("Which matching rule starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const matching = page.locator("#thread .turn").last();
  await expect(matching).toContainText("“Draft the weekly close but do not send it” has no matching rule in the record.");
  await expect(matching).toContainText("Asking does not confirm a matching rule.");
  await expect(matching).not.toContainText("locked team rule");
  await expect(page.locator("[data-testid^='matching-rule-']").nth(0)).toHaveText("No matching rule");
  await expect(page.locator("[data-testid^='team-rule-']").nth(0)).toHaveText("No team rule");

  await page.getByTestId("composer").fill("Which repository starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const repository = page.locator("#thread .turn").last();
  await expect(repository).toContainText("“Draft the weekly close but do not send it” has no source repository in the record.");
  await expect(repository).toContainText("Asking does not confirm a repository.");
  await expect(repository).not.toContainText("has no locked team rule");
  await expect(page.locator("[data-testid^='source-repository-']").nth(0)).toHaveText("No source repository");
  await expect(page.locator("[data-testid^='team-rule-']").nth(0)).toHaveText("No team rule");
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);

  await page.getByTestId("composer").fill("Which channel starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const channel = page.locator("#thread .turn").last();
  await expect(channel).toContainText("“Draft the weekly close but do not send it” has no source channel in the record.");
  await expect(channel).toContainText("Asking does not connect a channel.");
  await expect(channel).not.toContainText("has no locked team rule");
  await expect(page.locator("[data-testid^='source-channel-']").nth(0)).toHaveText("No source channel");
  await expect(page.locator("[data-testid^='team-rule-']").nth(0)).toHaveText("No team rule");

  await page.getByTestId("composer").fill("What failure does the Draft the weekly close but do not send it routine show?");
  await page.getByTestId("send").click();
  const failure = page.locator("#thread .turn").last();
  await expect(failure).toContainText("“Draft the weekly close but do not send it” has no failure in the record.");
  await expect(failure).not.toContainText("locked team rule");
  await expect(page.locator("[data-testid^='run-failure-']").nth(0)).toHaveText("No failure");
  await expect(page.locator("[data-testid^='team-rule-']").nth(0)).toHaveText("No team rule");

  await page.getByTestId("composer").fill("Has usage been paused for the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const usage = page.locator("#thread .turn").last();
  await expect(usage).toContainText("“Draft the weekly close but do not send it” has no usage pause in the record.");
  await expect(usage).not.toContainText("has no locked team rule");
  await expect(page.locator("[data-testid^='usage-pause-']").nth(0)).toHaveText("No usage pause");
  await expect(page.locator("[data-testid^='team-rule-']").nth(0)).toHaveText("No team rule");

  await page.getByTestId("composer").fill("Why hasn't the Draft the weekly close but do not send it routine run?");
  await page.getByTestId("send").click();
  const quiet = page.locator("#thread .turn").last();
  await expect(quiet).toContainText("A wake does not run it.");
  await expect(quiet).not.toContainText("locked team rule");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveText("Active");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-routine-locked-team-rule.png" });
});

test("ORIEL-F115 whether local computer work is refused for one routine does not turn local access on", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Is local computer work refused for the Launch note routine?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("There is no such routine as “Launch note”.");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  const firstTitle = await firstCadence.getAttribute("title");
  const firstNext = firstTitle?.replace(/^Next wake /, "") ?? "";
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  const secondTitle = await secondCadence.getAttribute("title");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking whether local computer work is refused for one routine says that routine has no local-computer refusal in the record.",
  );
  await expect(page.locator("[data-testid^='local-computer-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='local-computer-']").nth(0)).toHaveText("No local-computer refusal");
  await expect(page.locator("[data-testid^='locked-team-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='locked-team-rule-']").nth(0)).toHaveText("No locked team rule");
  await expect(page.locator("[data-testid^='team-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='team-rule-']").nth(0)).toHaveText("No team rule");
  await expect(page.locator("[data-testid^='allow-automatically-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='allow-automatically-']").nth(0)).toHaveText("No allow-automatically rule");
  await expect(page.locator("[data-testid^='ask-first-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='ask-first-']").nth(0)).toHaveText("No ask-first rule");
  await expect(page.locator("[data-testid^='matching-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='matching-rule-']").nth(0)).toHaveText("No matching rule");
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");
  await expect(page.locator("[data-testid^='computer-']")).toHaveCount(0);
  const localFollowsLocked = await page.evaluate(() => {
    const locked = document.querySelector("[data-testid^='locked-team-rule-']");
    const local = document.querySelector("[data-testid^='local-computer-']");
    if (!locked || !local || locked.parentElement !== local.parentElement) return false;
    return locked.compareDocumentPosition(local) === Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(localFollowsLocked).toBe(true);
  const localIds = await page.locator("[data-testid^='local-computer-']").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-testid") ?? ""),
  );
  expect(localIds.every((id) => id.startsWith("local-computer-"))).toBe(true);
  expect(localIds.some((id) => id.startsWith("source-"))).toBe(false);
  expect(localIds.some((id) => id.startsWith("computer-"))).toBe(false);
  expect(localIds.some((id) => id.startsWith("locked-team-rule-"))).toBe(false);
  expect(localIds.some((id) => id.startsWith("team-rule-"))).toBe(false);
  expect(localIds.some((id) => id.startsWith("rule-"))).toBe(false);
  const ruleIds = await page.locator("[data-testid^='rule-']").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-testid") ?? ""),
  );
  expect(ruleIds).toEqual(expect.arrayContaining(["rule-send", "rule-pay", "rule-delete", "rule-post"]));
  expect(ruleIds.some((id) => id.startsWith("local-computer"))).toBe(false);
  await expect(page.locator("[data-testid^='run-failure-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='usage-pause-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='plugin-']").nth(0)).toHaveText("No required plugin");
  await expect(page.locator("[data-testid^='owner-']").nth(0)).toHaveText("No owning bot");
  await expect(page.locator("[data-testid^='zone-']").nth(0)).toHaveText("No time zone");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);

  await page.getByTestId("composer").fill("Is local computer work refused for the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const clear = page.locator("#thread .turn").last();
  await expect(clear).toContainText("“Draft the weekly close but do not send it” has no local-computer refusal in the record.");
  await expect(clear).toContainText("Asking does not turn local access on.");
  await expect(clear).not.toContainText("has no source system");
  await expect(clear).not.toContainText("Asking does not connect a computer.");
  await expect(clear).not.toContainText("has no locked team rule");
  await expect(clear).not.toContainText("Grok Bot");
  await expect(clear).not.toContainText(firstNext);
  await expect(clear).not.toContainText("Summarize the launch risks");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  expect(await secondCadence.getAttribute("title")).toBe(secondTitle);
  await expect(page.locator("[data-testid^='local-computer-']").nth(0)).toHaveText("No local-computer refusal");
  await expect(page.locator("[data-testid^='locked-team-rule-']").nth(0)).toHaveText("No locked team rule");
  await expect(page.locator("[data-testid^='team-rule-']").nth(0)).toHaveText("No team rule");
  await expect(page.locator("[data-testid^='allow-automatically-']").nth(0)).toHaveText("No allow-automatically rule");
  await expect(page.locator("[data-testid^='ask-first-']").nth(0)).toHaveText("No ask-first rule");
  await expect(page.locator("[data-testid^='matching-rule-']").nth(0)).toHaveText("No matching rule");
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Wakes paused");
  await page.getByTestId("composer").fill("Is local computer work refused for the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const duringDesk = page.locator("#thread .turn").last();
  await expect(duringDesk).toContainText("“Draft the weekly close but do not send it” has no local-computer refusal in the record.");
  await expect(duringDesk).not.toContainText("Wakes are paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='local-computer-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='locked-team-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await page.getByTestId("composer").fill("Resume wakes");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Pause wakes");

  await page.getByTestId("composer").fill("Pause the Draft the weekly close but do not send it routine");
  await page.getByTestId("send").click();
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);
  await page.getByTestId("composer").fill("Is local computer work refused for the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const pausedAsk = page.locator("#thread .turn").last();
  await expect(pausedAsk).toContainText("“Draft the weekly close but do not send it” has no local-computer refusal in the record.");
  await expect(pausedAsk).toContainText("Asking does not turn local access on.");
  await expect(pausedAsk).not.toContainText(firstNext);
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='local-computer-']").nth(0)).toHaveText("No local-computer refusal");

  await page.getByTestId("composer").fill("Can the Draft the weekly close but do not send it routine reach its source?");
  await page.getByTestId("send").click();
  const source = page.locator("#thread .turn").last();
  await expect(source).toContainText("“Draft the weekly close but do not send it” has no source system in the record.");
  await expect(source).toContainText("Asking does not connect a computer.");
  await expect(source).not.toContainText("has no local-computer refusal");
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");
  await expect(page.locator("[data-testid^='local-computer-']").nth(0)).toHaveText("No local-computer refusal");

  await page.getByTestId("composer").fill("Is the team rule for the Draft the weekly close but do not send it routine locked?");
  await page.getByTestId("send").click();
  const locked = page.locator("#thread .turn").last();
  await expect(locked).toContainText("“Draft the weekly close but do not send it” has no locked team rule in the record.");
  await expect(locked).toContainText("Asking does not lock a team rule.");
  await expect(locked).not.toContainText("has no local-computer refusal");
  await expect(locked).not.toContainText("local-computer");
  await expect(page.locator("[data-testid^='locked-team-rule-']").nth(0)).toHaveText("No locked team rule");
  await expect(page.locator("[data-testid^='local-computer-']").nth(0)).toHaveText("No local-computer refusal");

  await page.getByTestId("composer").fill("Which team rule blocks the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const team = page.locator("#thread .turn").last();
  await expect(team).toContainText("“Draft the weekly close but do not send it” has no team rule in the record.");
  await expect(team).not.toContainText("has no local-computer refusal");
  await expect(page.locator("[data-testid^='team-rule-']").nth(0)).toHaveText("No team rule");

  await page.getByTestId("composer").fill("Which allow-automatically rule covers the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const allow = page.locator("#thread .turn").last();
  await expect(allow).toContainText("“Draft the weekly close but do not send it” has no allow-automatically rule in the record.");
  await expect(allow).not.toContainText("local-computer");
  await expect(page.locator("[data-testid^='allow-automatically-']").nth(0)).toHaveText("No allow-automatically rule");

  await page.getByTestId("composer").fill("Which ask-first rule blocks the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const askFirst = page.locator("#thread .turn").last();
  await expect(askFirst).toContainText("“Draft the weekly close but do not send it” has no ask-first rule in the record.");
  await expect(askFirst).not.toContainText("local-computer");

  await page.getByTestId("composer").fill("Which matching rule starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const matching = page.locator("#thread .turn").last();
  await expect(matching).toContainText("“Draft the weekly close but do not send it” has no matching rule in the record.");
  await expect(matching).not.toContainText("local-computer");

  await page.getByTestId("composer").fill("Which repository starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const repository = page.locator("#thread .turn").last();
  await expect(repository).toContainText("“Draft the weekly close but do not send it” has no source repository in the record.");
  await expect(repository).not.toContainText("has no local-computer refusal");
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);

  await page.getByTestId("composer").fill("Which channel starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const channel = page.locator("#thread .turn").last();
  await expect(channel).toContainText("“Draft the weekly close but do not send it” has no source channel in the record.");
  await expect(channel).not.toContainText("has no local-computer refusal");

  await page.getByTestId("composer").fill("What failure does the Draft the weekly close but do not send it routine show?");
  await page.getByTestId("send").click();
  const failure = page.locator("#thread .turn").last();
  await expect(failure).toContainText("“Draft the weekly close but do not send it” has no failure in the record.");
  await expect(failure).not.toContainText("local-computer");

  await page.getByTestId("composer").fill("Has usage been paused for the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const usage = page.locator("#thread .turn").last();
  await expect(usage).toContainText("“Draft the weekly close but do not send it” has no usage pause in the record.");
  await expect(usage).not.toContainText("has no local-computer refusal");

  await page.getByTestId("composer").fill("Why hasn't the Draft the weekly close but do not send it routine run?");
  await page.getByTestId("send").click();
  const quiet = page.locator("#thread .turn").last();
  await expect(quiet).toContainText("A wake does not run it.");
  await expect(quiet).not.toContainText("local-computer");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveText("Active");
  await expect(page.locator("[data-testid^='local-computer-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='locked-team-rule-']").nth(0)).toHaveText("No locked team rule");
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-routine-local-computer.png" });
});

test("ORIEL-F116 whether cloud computer work is refused for one routine does not turn cloud access on", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Is cloud computer work refused for the Launch note routine?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("There is no such routine as “Launch note”.");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  const firstTitle = await firstCadence.getAttribute("title");
  const firstNext = firstTitle?.replace(/^Next wake /, "") ?? "";
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  const secondTitle = await secondCadence.getAttribute("title");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking whether cloud computer work is refused for one routine says that routine has no cloud-computer refusal in the record.",
  );
  await expect(page.locator("[data-testid^='cloud-computer-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='cloud-computer-']").nth(0)).toHaveText("No cloud-computer refusal");
  await expect(page.locator("[data-testid^='locked-team-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='locked-team-rule-']").nth(0)).toHaveText("No locked team rule");
  await expect(page.locator("[data-testid^='team-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='team-rule-']").nth(0)).toHaveText("No team rule");
  await expect(page.locator("[data-testid^='allow-automatically-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='allow-automatically-']").nth(0)).toHaveText("No allow-automatically rule");
  await expect(page.locator("[data-testid^='ask-first-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='ask-first-']").nth(0)).toHaveText("No ask-first rule");
  await expect(page.locator("[data-testid^='matching-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='matching-rule-']").nth(0)).toHaveText("No matching rule");
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");
  await expect(page.locator("[data-testid^='computer-']")).toHaveCount(0);
  const localFollowsLocked = await page.evaluate(() => {
    const locked = document.querySelector("[data-testid^='locked-team-rule-']");
    const local = document.querySelector("[data-testid^='cloud-computer-']");
    if (!locked || !local || locked.parentElement !== local.parentElement) return false;
    return locked.compareDocumentPosition(local) === Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(localFollowsLocked).toBe(true);
  const cloudFollowsLocal = await page.evaluate(() => {
    const local = document.querySelector("[data-testid^='local-computer-']");
    const cloud = document.querySelector("[data-testid^='cloud-computer-']");
    if (!local || !cloud || local.parentElement !== cloud.parentElement) return false;
    return local.compareDocumentPosition(cloud) === Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(cloudFollowsLocal).toBe(true);
  await expect(page.locator("[data-testid^='local-computer-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='local-computer-']").nth(0)).toHaveText("No local-computer refusal");
  const localIds = await page.locator("[data-testid^='cloud-computer-']").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-testid") ?? ""),
  );
  expect(localIds.every((id) => id.startsWith("cloud-computer-"))).toBe(true);
  expect(localIds.some((id) => id.startsWith("source-"))).toBe(false);
  expect(localIds.some((id) => id.startsWith("computer-"))).toBe(false);
  expect(localIds.some((id) => id.startsWith("locked-team-rule-"))).toBe(false);
  expect(localIds.some((id) => id.startsWith("team-rule-"))).toBe(false);
  expect(localIds.some((id) => id.startsWith("rule-"))).toBe(false);
  const ruleIds = await page.locator("[data-testid^='rule-']").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-testid") ?? ""),
  );
  expect(ruleIds).toEqual(expect.arrayContaining(["rule-send", "rule-pay", "rule-delete", "rule-post"]));
  expect(ruleIds.some((id) => id.startsWith("cloud-computer"))).toBe(false);
  await expect(page.locator("[data-testid^='run-failure-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='usage-pause-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='plugin-']").nth(0)).toHaveText("No required plugin");
  await expect(page.locator("[data-testid^='owner-']").nth(0)).toHaveText("No owning bot");
  await expect(page.locator("[data-testid^='zone-']").nth(0)).toHaveText("No time zone");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);

  await page.getByTestId("composer").fill("Is cloud computer work refused for the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const clear = page.locator("#thread .turn").last();
  await expect(clear).toContainText("“Draft the weekly close but do not send it” has no cloud-computer refusal in the record.");
  await expect(clear).toContainText("Asking does not turn cloud access on.");
  await expect(clear).not.toContainText("has no source system");
  await expect(clear).not.toContainText("Asking does not connect a computer.");
  await expect(clear).not.toContainText("has no local-computer refusal");
  await expect(clear).not.toContainText("Asking does not turn local access on.");
  await expect(clear).not.toContainText("has no locked team rule");
  await expect(clear).not.toContainText("Grok Bot");
  await expect(clear).not.toContainText(firstNext);
  await expect(clear).not.toContainText("Summarize the launch risks");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  expect(await secondCadence.getAttribute("title")).toBe(secondTitle);
  await expect(page.locator("[data-testid^='cloud-computer-']").nth(0)).toHaveText("No cloud-computer refusal");
  await expect(page.locator("[data-testid^='locked-team-rule-']").nth(0)).toHaveText("No locked team rule");
  await expect(page.locator("[data-testid^='team-rule-']").nth(0)).toHaveText("No team rule");
  await expect(page.locator("[data-testid^='allow-automatically-']").nth(0)).toHaveText("No allow-automatically rule");
  await expect(page.locator("[data-testid^='ask-first-']").nth(0)).toHaveText("No ask-first rule");
  await expect(page.locator("[data-testid^='matching-rule-']").nth(0)).toHaveText("No matching rule");
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Wakes paused");
  await page.getByTestId("composer").fill("Is cloud computer work refused for the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const duringDesk = page.locator("#thread .turn").last();
  await expect(duringDesk).toContainText("“Draft the weekly close but do not send it” has no cloud-computer refusal in the record.");
  await expect(duringDesk).not.toContainText("Wakes are paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='cloud-computer-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='locked-team-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await page.getByTestId("composer").fill("Resume wakes");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Pause wakes");

  await page.getByTestId("composer").fill("Pause the Draft the weekly close but do not send it routine");
  await page.getByTestId("send").click();
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);
  await page.getByTestId("composer").fill("Is cloud computer work refused for the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const pausedAsk = page.locator("#thread .turn").last();
  await expect(pausedAsk).toContainText("“Draft the weekly close but do not send it” has no cloud-computer refusal in the record.");
  await expect(pausedAsk).toContainText("Asking does not turn cloud access on.");
  await expect(pausedAsk).not.toContainText(firstNext);
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='cloud-computer-']").nth(0)).toHaveText("No cloud-computer refusal");

  await page.getByTestId("composer").fill("Is local computer work refused for the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const localReply = page.locator("#thread .turn").last();
  await expect(localReply).toContainText("“Draft the weekly close but do not send it” has no local-computer refusal in the record.");
  await expect(localReply).toContainText("Asking does not turn local access on.");
  await expect(localReply).not.toContainText("has no cloud-computer refusal");
  await expect(localReply).not.toContainText("turn cloud access on");
  await expect(page.locator("[data-testid^='local-computer-']").nth(0)).toHaveText("No local-computer refusal");
  await expect(page.locator("[data-testid^='cloud-computer-']").nth(0)).toHaveText("No cloud-computer refusal");
  await expect(page.locator("[data-testid^='computer-']")).toHaveCount(0);

  await page.getByTestId("composer").fill("Can the Draft the weekly close but do not send it routine reach its source?");
  await page.getByTestId("send").click();
  const source = page.locator("#thread .turn").last();
  await expect(source).toContainText("“Draft the weekly close but do not send it” has no source system in the record.");
  await expect(source).toContainText("Asking does not connect a computer.");
  await expect(source).not.toContainText("has no cloud-computer refusal");
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");
  await expect(page.locator("[data-testid^='cloud-computer-']").nth(0)).toHaveText("No cloud-computer refusal");

  await page.getByTestId("composer").fill("Is the team rule for the Draft the weekly close but do not send it routine locked?");
  await page.getByTestId("send").click();
  const locked = page.locator("#thread .turn").last();
  await expect(locked).toContainText("“Draft the weekly close but do not send it” has no locked team rule in the record.");
  await expect(locked).toContainText("Asking does not lock a team rule.");
  await expect(locked).not.toContainText("has no cloud-computer refusal");
  await expect(locked).not.toContainText("cloud-computer");
  await expect(page.locator("[data-testid^='locked-team-rule-']").nth(0)).toHaveText("No locked team rule");
  await expect(page.locator("[data-testid^='cloud-computer-']").nth(0)).toHaveText("No cloud-computer refusal");

  await page.getByTestId("composer").fill("Which team rule blocks the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const team = page.locator("#thread .turn").last();
  await expect(team).toContainText("“Draft the weekly close but do not send it” has no team rule in the record.");
  await expect(team).not.toContainText("has no cloud-computer refusal");
  await expect(page.locator("[data-testid^='team-rule-']").nth(0)).toHaveText("No team rule");

  await page.getByTestId("composer").fill("Which allow-automatically rule covers the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const allow = page.locator("#thread .turn").last();
  await expect(allow).toContainText("“Draft the weekly close but do not send it” has no allow-automatically rule in the record.");
  await expect(allow).not.toContainText("cloud-computer");
  await expect(page.locator("[data-testid^='allow-automatically-']").nth(0)).toHaveText("No allow-automatically rule");

  await page.getByTestId("composer").fill("Which ask-first rule blocks the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const askFirst = page.locator("#thread .turn").last();
  await expect(askFirst).toContainText("“Draft the weekly close but do not send it” has no ask-first rule in the record.");
  await expect(askFirst).not.toContainText("cloud-computer");

  await page.getByTestId("composer").fill("Which matching rule starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const matching = page.locator("#thread .turn").last();
  await expect(matching).toContainText("“Draft the weekly close but do not send it” has no matching rule in the record.");
  await expect(matching).not.toContainText("cloud-computer");

  await page.getByTestId("composer").fill("Which repository starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const repository = page.locator("#thread .turn").last();
  await expect(repository).toContainText("“Draft the weekly close but do not send it” has no source repository in the record.");
  await expect(repository).not.toContainText("has no cloud-computer refusal");
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);

  await page.getByTestId("composer").fill("Which channel starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const channel = page.locator("#thread .turn").last();
  await expect(channel).toContainText("“Draft the weekly close but do not send it” has no source channel in the record.");
  await expect(channel).not.toContainText("has no cloud-computer refusal");

  await page.getByTestId("composer").fill("What failure does the Draft the weekly close but do not send it routine show?");
  await page.getByTestId("send").click();
  const failure = page.locator("#thread .turn").last();
  await expect(failure).toContainText("“Draft the weekly close but do not send it” has no failure in the record.");
  await expect(failure).not.toContainText("cloud-computer");

  await page.getByTestId("composer").fill("Has usage been paused for the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const usage = page.locator("#thread .turn").last();
  await expect(usage).toContainText("“Draft the weekly close but do not send it” has no usage pause in the record.");
  await expect(usage).not.toContainText("has no cloud-computer refusal");

  await page.getByTestId("composer").fill("Why hasn't the Draft the weekly close but do not send it routine run?");
  await page.getByTestId("send").click();
  const quiet = page.locator("#thread .turn").last();
  await expect(quiet).toContainText("A wake does not run it.");
  await expect(quiet).not.toContainText("cloud-computer");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveText("Active");
  await expect(page.locator("[data-testid^='cloud-computer-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='locked-team-rule-']").nth(0)).toHaveText("No locked team rule");
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await expect(page.locator("[data-testid^='cloud-computer-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='local-computer-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='computer-']")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-routine-cloud-computer.png" });
});

test("ORIEL-F117 whether one routine can reach its computer does not recover a computer", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Can the Launch note routine reach its computer?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("There is no such routine as “Launch note”.");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  const firstTitle = await firstCadence.getAttribute("title");
  const firstNext = firstTitle?.replace(/^Next wake /, "") ?? "";
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  const secondTitle = await secondCadence.getAttribute("title");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking whether one routine can reach its computer says that routine has no reachable computer in the record.",
  );
  await expect(page.locator("[data-testid^='cloud-computer-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='cloud-computer-']").nth(0)).toHaveText("No cloud-computer refusal");
  await expect(page.locator("[data-testid^='locked-team-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='locked-team-rule-']").nth(0)).toHaveText("No locked team rule");
  await expect(page.locator("[data-testid^='team-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='team-rule-']").nth(0)).toHaveText("No team rule");
  await expect(page.locator("[data-testid^='allow-automatically-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='allow-automatically-']").nth(0)).toHaveText("No allow-automatically rule");
  await expect(page.locator("[data-testid^='ask-first-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='ask-first-']").nth(0)).toHaveText("No ask-first rule");
  await expect(page.locator("[data-testid^='matching-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='matching-rule-']").nth(0)).toHaveText("No matching rule");
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");
  await expect(page.locator("[data-testid^='computer-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='reachable-computer-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='reachable-computer-']").nth(0)).toHaveText("No reachable computer");
  const reachableFollowsCloud = await page.evaluate(() => {
    const cloud = document.querySelector("[data-testid^='cloud-computer-']");
    const reachable = document.querySelector("[data-testid^='reachable-computer-']");
    if (!cloud || !reachable || cloud.parentElement !== reachable.parentElement) return false;
    return cloud.compareDocumentPosition(reachable) === Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(reachableFollowsCloud).toBe(true);
  const localFollowsLocked = await page.evaluate(() => {
    const locked = document.querySelector("[data-testid^='locked-team-rule-']");
    const local = document.querySelector("[data-testid^='cloud-computer-']");
    if (!locked || !local || locked.parentElement !== local.parentElement) return false;
    return locked.compareDocumentPosition(local) === Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(localFollowsLocked).toBe(true);
  const cloudFollowsLocal = await page.evaluate(() => {
    const local = document.querySelector("[data-testid^='local-computer-']");
    const cloud = document.querySelector("[data-testid^='cloud-computer-']");
    if (!local || !cloud || local.parentElement !== cloud.parentElement) return false;
    return local.compareDocumentPosition(cloud) === Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(cloudFollowsLocal).toBe(true);
  await expect(page.locator("[data-testid^='local-computer-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='local-computer-']").nth(0)).toHaveText("No local-computer refusal");
  const localIds = await page.locator("[data-testid^='cloud-computer-']").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-testid") ?? ""),
  );
  expect(localIds.every((id) => id.startsWith("cloud-computer-"))).toBe(true);
  expect(localIds.some((id) => id.startsWith("source-"))).toBe(false);
  expect(localIds.some((id) => id.startsWith("computer-"))).toBe(false);
  expect(localIds.some((id) => id.startsWith("locked-team-rule-"))).toBe(false);
  expect(localIds.some((id) => id.startsWith("team-rule-"))).toBe(false);
  expect(localIds.some((id) => id.startsWith("rule-"))).toBe(false);
  const ruleIds = await page.locator("[data-testid^='rule-']").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-testid") ?? ""),
  );
  expect(ruleIds).toEqual(expect.arrayContaining(["rule-send", "rule-pay", "rule-delete", "rule-post"]));
  expect(ruleIds.some((id) => id.startsWith("cloud-computer"))).toBe(false);
  expect(ruleIds.some((id) => id.startsWith("reachable-computer"))).toBe(false);
  const reachableIds = await page.locator("[data-testid^='reachable-computer-']").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-testid") ?? ""),
  );
  expect(reachableIds.every((id) => id.startsWith("reachable-computer-"))).toBe(true);
  expect(reachableIds.some((id) => id.startsWith("computer-"))).toBe(false);
  expect(reachableIds.some((id) => id.startsWith("cloud-computer-"))).toBe(false);
  expect(reachableIds.some((id) => id.startsWith("local-computer-"))).toBe(false);
  expect(reachableIds.some((id) => id.startsWith("source-"))).toBe(false);
  await expect(page.locator("[data-testid^='run-failure-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='usage-pause-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='plugin-']").nth(0)).toHaveText("No required plugin");
  await expect(page.locator("[data-testid^='owner-']").nth(0)).toHaveText("No owning bot");
  await expect(page.locator("[data-testid^='zone-']").nth(0)).toHaveText("No time zone");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(0);

  await page.getByTestId("composer").fill("Can the Draft the weekly close but do not send it routine reach its computer?");
  await page.getByTestId("send").click();
  const clear = page.locator("#thread .turn").last();
  await expect(clear).toContainText("“Draft the weekly close but do not send it” has no reachable computer in the record.");
  await expect(clear).toContainText("Asking does not recover a computer.");
  await expect(clear).not.toContainText("has no cloud-computer refusal");
  await expect(clear).not.toContainText("Asking does not turn cloud access on.");
  await expect(clear).not.toContainText("has no source system");
  await expect(clear).not.toContainText("Asking does not connect a computer.");
  await expect(clear).not.toContainText("has no local-computer refusal");
  await expect(clear).not.toContainText("Asking does not turn local access on.");
  await expect(clear).not.toContainText("has no locked team rule");
  await expect(clear).not.toContainText("Grok Bot");
  await expect(clear).not.toContainText(firstNext);
  await expect(clear).not.toContainText("Summarize the launch risks");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  expect(await secondCadence.getAttribute("title")).toBe(secondTitle);
  await expect(page.locator("[data-testid^='cloud-computer-']").nth(0)).toHaveText("No cloud-computer refusal");
  await expect(page.locator("[data-testid^='locked-team-rule-']").nth(0)).toHaveText("No locked team rule");
  await expect(page.locator("[data-testid^='team-rule-']").nth(0)).toHaveText("No team rule");
  await expect(page.locator("[data-testid^='allow-automatically-']").nth(0)).toHaveText("No allow-automatically rule");
  await expect(page.locator("[data-testid^='ask-first-']").nth(0)).toHaveText("No ask-first rule");
  await expect(page.locator("[data-testid^='matching-rule-']").nth(0)).toHaveText("No matching rule");
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Wakes paused");
  await page.getByTestId("composer").fill("Can the Draft the weekly close but do not send it routine reach its computer?");
  await page.getByTestId("send").click();
  const duringDesk = page.locator("#thread .turn").last();
  await expect(duringDesk).toContainText("“Draft the weekly close but do not send it” has no reachable computer in the record.");
  await expect(duringDesk).not.toContainText("Wakes are paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='cloud-computer-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='locked-team-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await page.getByTestId("composer").fill("Resume wakes");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Pause wakes");

  await page.getByTestId("composer").fill("Pause the Draft the weekly close but do not send it routine");
  await page.getByTestId("send").click();
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);
  await page.getByTestId("composer").fill("Can the Draft the weekly close but do not send it routine reach its computer?");
  await page.getByTestId("send").click();
  const pausedAsk = page.locator("#thread .turn").last();
  await expect(pausedAsk).toContainText("“Draft the weekly close but do not send it” has no reachable computer in the record.");
  await expect(pausedAsk).toContainText("Asking does not recover a computer.");
  await expect(pausedAsk).not.toContainText(firstNext);
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='cloud-computer-']").nth(0)).toHaveText("No cloud-computer refusal");

  await page.getByTestId("composer").fill("Is cloud computer work refused for the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const cloudReply = page.locator("#thread .turn").last();
  await expect(cloudReply).toContainText("“Draft the weekly close but do not send it” has no cloud-computer refusal in the record.");
  await expect(cloudReply).toContainText("Asking does not turn cloud access on.");
  await expect(cloudReply).not.toContainText("has no reachable computer");
  await expect(cloudReply).not.toContainText("recover a computer");
  await expect(page.locator("[data-testid^='cloud-computer-']").nth(0)).toHaveText("No cloud-computer refusal");
  await expect(page.locator("[data-testid^='reachable-computer-']").nth(0)).toHaveText("No reachable computer");
  await expect(page.locator("[data-testid^='computer-']")).toHaveCount(0);

  await page.getByTestId("composer").fill("Is local computer work refused for the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const localReply = page.locator("#thread .turn").last();
  await expect(localReply).toContainText("“Draft the weekly close but do not send it” has no local-computer refusal in the record.");
  await expect(localReply).toContainText("Asking does not turn local access on.");
  await expect(localReply).not.toContainText("has no reachable computer");
  await expect(localReply).not.toContainText("recover a computer");
  await expect(page.locator("[data-testid^='local-computer-']").nth(0)).toHaveText("No local-computer refusal");
  await expect(page.locator("[data-testid^='cloud-computer-']").nth(0)).toHaveText("No cloud-computer refusal");
  await expect(page.locator("[data-testid^='computer-']")).toHaveCount(0);

  await page.getByTestId("composer").fill("Can the Draft the weekly close but do not send it routine reach its source?");
  await page.getByTestId("send").click();
  const source = page.locator("#thread .turn").last();
  await expect(source).toContainText("“Draft the weekly close but do not send it” has no source system in the record.");
  await expect(source).toContainText("Asking does not connect a computer.");
  await expect(source).not.toContainText("has no reachable computer");
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");
  await expect(page.locator("[data-testid^='cloud-computer-']").nth(0)).toHaveText("No cloud-computer refusal");

  await page.getByTestId("composer").fill("Is the team rule for the Draft the weekly close but do not send it routine locked?");
  await page.getByTestId("send").click();
  const locked = page.locator("#thread .turn").last();
  await expect(locked).toContainText("“Draft the weekly close but do not send it” has no locked team rule in the record.");
  await expect(locked).toContainText("Asking does not lock a team rule.");
  await expect(locked).not.toContainText("has no reachable computer");
  await expect(locked).not.toContainText("cloud-computer");
  await expect(page.locator("[data-testid^='locked-team-rule-']").nth(0)).toHaveText("No locked team rule");
  await expect(page.locator("[data-testid^='cloud-computer-']").nth(0)).toHaveText("No cloud-computer refusal");

  await page.getByTestId("composer").fill("Which team rule blocks the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const team = page.locator("#thread .turn").last();
  await expect(team).toContainText("“Draft the weekly close but do not send it” has no team rule in the record.");
  await expect(team).not.toContainText("has no reachable computer");
  await expect(page.locator("[data-testid^='team-rule-']").nth(0)).toHaveText("No team rule");

  await page.getByTestId("composer").fill("Which allow-automatically rule covers the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const allow = page.locator("#thread .turn").last();
  await expect(allow).toContainText("“Draft the weekly close but do not send it” has no allow-automatically rule in the record.");
  await expect(allow).not.toContainText("cloud-computer");
  await expect(page.locator("[data-testid^='allow-automatically-']").nth(0)).toHaveText("No allow-automatically rule");

  await page.getByTestId("composer").fill("Which ask-first rule blocks the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const askFirst = page.locator("#thread .turn").last();
  await expect(askFirst).toContainText("“Draft the weekly close but do not send it” has no ask-first rule in the record.");
  await expect(askFirst).not.toContainText("cloud-computer");

  await page.getByTestId("composer").fill("Which matching rule starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const matching = page.locator("#thread .turn").last();
  await expect(matching).toContainText("“Draft the weekly close but do not send it” has no matching rule in the record.");
  await expect(matching).not.toContainText("cloud-computer");

  await page.getByTestId("composer").fill("Which repository starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const repository = page.locator("#thread .turn").last();
  await expect(repository).toContainText("“Draft the weekly close but do not send it” has no source repository in the record.");
  await expect(repository).not.toContainText("has no reachable computer");
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);

  await page.getByTestId("composer").fill("Which channel starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const channel = page.locator("#thread .turn").last();
  await expect(channel).toContainText("“Draft the weekly close but do not send it” has no source channel in the record.");
  await expect(channel).not.toContainText("has no reachable computer");

  await page.getByTestId("composer").fill("What failure does the Draft the weekly close but do not send it routine show?");
  await page.getByTestId("send").click();
  const failure = page.locator("#thread .turn").last();
  await expect(failure).toContainText("“Draft the weekly close but do not send it” has no failure in the record.");
  await expect(failure).not.toContainText("cloud-computer");

  await page.getByTestId("composer").fill("Has usage been paused for the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const usage = page.locator("#thread .turn").last();
  await expect(usage).toContainText("“Draft the weekly close but do not send it” has no usage pause in the record.");
  await expect(usage).not.toContainText("has no reachable computer");

  await page.getByTestId("composer").fill("Why hasn't the Draft the weekly close but do not send it routine run?");
  await page.getByTestId("send").click();
  const quiet = page.locator("#thread .turn").last();
  await expect(quiet).toContainText("A wake does not run it.");
  await expect(quiet).not.toContainText("cloud-computer");
  await expect(quiet).not.toContainText("reachable computer");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveText("Active");
  await expect(page.locator("[data-testid^='cloud-computer-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='locked-team-rule-']").nth(0)).toHaveText("No locked team rule");
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await expect(page.locator("[data-testid^='cloud-computer-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='local-computer-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='reachable-computer-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='reachable-computer-']").nth(0)).toHaveText("No reachable computer");
  await expect(page.locator("[data-testid^='computer-']")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-routine-reachable-computer.png" });
});


test("ORIEL-F118 whether one routine is stuck does not open the computer", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Is the Launch note routine stuck?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("There is no such routine as “Launch note”.");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  const firstTitle = await firstCadence.getAttribute("title");
  const firstNext = firstTitle?.replace(/^Next wake /, "") ?? "";
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  const secondTitle = await secondCadence.getAttribute("title");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking whether one routine is stuck says that routine has no stuck state in the record.",
  );
  await expect(page.locator("[data-testid^='stuck-state-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='stuck-state-']").nth(0)).toHaveText("No stuck state");
  await expect(page.locator("[data-testid^='reachable-computer-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='reachable-computer-']").nth(0)).toHaveText("No reachable computer");
  await expect(page.locator("[data-testid^='cloud-computer-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='cloud-computer-']").nth(0)).toHaveText("No cloud-computer refusal");
  await expect(page.locator("[data-testid^='local-computer-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='local-computer-']").nth(0)).toHaveText("No local-computer refusal");
  await expect(page.locator("[data-testid^='locked-team-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='locked-team-rule-']").nth(0)).toHaveText("No locked team rule");
  await expect(page.locator("[data-testid^='team-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='team-rule-']").nth(0)).toHaveText("No team rule");
  await expect(page.locator("[data-testid^='allow-automatically-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='allow-automatically-']").nth(0)).toHaveText("No allow-automatically rule");
  await expect(page.locator("[data-testid^='ask-first-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='ask-first-']").nth(0)).toHaveText("No ask-first rule");
  await expect(page.locator("[data-testid^='matching-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='matching-rule-']").nth(0)).toHaveText("No matching rule");
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");
  await expect(page.locator("[data-testid^='computer-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='state-']")).toHaveCount(0);
  const stuckFollowsReachable = await page.evaluate(() => {
    const reachable = document.querySelector("[data-testid^='reachable-computer-']");
    const stuck = document.querySelector("[data-testid^='stuck-state-']");
    if (!reachable || !stuck || reachable.parentElement !== stuck.parentElement) return false;
    return reachable.compareDocumentPosition(stuck) === Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(stuckFollowsReachable).toBe(true);
  const stuckIds = await page.locator("[data-testid^='stuck-state-']").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-testid") ?? ""),
  );
  expect(stuckIds.every((id) => id.startsWith("stuck-state-"))).toBe(true);
  expect(stuckIds.some((id) => id.startsWith("state-"))).toBe(false);
  expect(stuckIds.some((id) => id.startsWith("reachable-computer-"))).toBe(false);
  expect(stuckIds.some((id) => id.startsWith("computer-"))).toBe(false);
  expect(stuckIds.some((id) => id.startsWith("cloud-computer-"))).toBe(false);
  const ruleIds = await page.locator("[data-testid^='rule-']").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-testid") ?? ""),
  );
  expect(ruleIds).toEqual(expect.arrayContaining(["rule-send", "rule-pay", "rule-delete", "rule-post"]));
  expect(ruleIds.some((id) => id.startsWith("stuck-state"))).toBe(false);

  await page.getByTestId("composer").fill("Is the Draft the weekly close but do not send it routine stuck?");
  await page.getByTestId("send").click();
  const clear = page.locator("#thread .turn").last();
  await expect(clear).toContainText("“Draft the weekly close but do not send it” has no stuck state in the record.");
  await expect(clear).toContainText("Asking does not open the computer.");
  await expect(clear).not.toContainText("has no reachable computer");
  await expect(clear).not.toContainText("Asking does not recover a computer.");
  await expect(clear).not.toContainText("has no cloud-computer refusal");
  await expect(clear).not.toContainText("Asking does not turn cloud access on.");
  await expect(clear).not.toContainText("Grok Bot");
  await expect(clear).not.toContainText(firstNext);
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  expect(await secondCadence.getAttribute("title")).toBe(secondTitle);
  await expect(page.locator("[data-testid^='stuck-state-']").nth(0)).toHaveText("No stuck state");
  await expect(page.locator("[data-testid^='reachable-computer-']").nth(0)).toHaveText("No reachable computer");
  await expect(page.locator("[data-testid^='state-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='computer-']")).toHaveCount(0);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Wakes paused");
  await page.getByTestId("composer").fill("Is the Draft the weekly close but do not send it routine stuck?");
  await page.getByTestId("send").click();
  const duringDesk = page.locator("#thread .turn").last();
  await expect(duringDesk).toContainText("“Draft the weekly close but do not send it” has no stuck state in the record.");
  await expect(duringDesk).not.toContainText("Wakes are paused");
  await expect(page.locator("[data-testid^='stuck-state-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='reachable-computer-']")).toHaveCount(2);
  await page.getByTestId("composer").fill("Resume wakes");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Pause wakes");

  await page.getByTestId("composer").fill("Pause the Draft the weekly close but do not send it routine");
  await page.getByTestId("send").click();
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);
  await page.getByTestId("composer").fill("Is the Draft the weekly close but do not send it routine stuck?");
  await page.getByTestId("send").click();
  const pausedAsk = page.locator("#thread .turn").last();
  await expect(pausedAsk).toContainText("“Draft the weekly close but do not send it” has no stuck state in the record.");
  await expect(pausedAsk).toContainText("Asking does not open the computer.");
  await expect(pausedAsk).not.toContainText(firstNext);
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");

  await page.getByTestId("composer").fill("Can the Draft the weekly close but do not send it routine reach its computer?");
  await page.getByTestId("send").click();
  const reachable = page.locator("#thread .turn").last();
  await expect(reachable).toContainText("“Draft the weekly close but do not send it” has no reachable computer in the record.");
  await expect(reachable).toContainText("Asking does not recover a computer.");
  await expect(reachable).not.toContainText("has no stuck state");
  await expect(page.locator("[data-testid^='reachable-computer-']").nth(0)).toHaveText("No reachable computer");
  await expect(page.locator("[data-testid^='stuck-state-']").nth(0)).toHaveText("No stuck state");

  await page.getByTestId("composer").fill("Is cloud computer work refused for the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const cloudReply = page.locator("#thread .turn").last();
  await expect(cloudReply).toContainText("“Draft the weekly close but do not send it” has no cloud-computer refusal in the record.");
  await expect(cloudReply).toContainText("Asking does not turn cloud access on.");
  await expect(cloudReply).not.toContainText("has no stuck state");
  await expect(page.locator("[data-testid^='cloud-computer-']").nth(0)).toHaveText("No cloud-computer refusal");

  await page.getByTestId("composer").fill("Is local computer work refused for the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const localReply = page.locator("#thread .turn").last();
  await expect(localReply).toContainText("“Draft the weekly close but do not send it” has no local-computer refusal in the record.");
  await expect(localReply).not.toContainText("has no stuck state");
  await expect(page.locator("[data-testid^='local-computer-']").nth(0)).toHaveText("No local-computer refusal");

  await page.getByTestId("composer").fill("Can the Draft the weekly close but do not send it routine reach its source?");
  await page.getByTestId("send").click();
  const source = page.locator("#thread .turn").last();
  await expect(source).toContainText("“Draft the weekly close but do not send it” has no source system in the record.");
  await expect(source).not.toContainText("has no stuck state");
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");

  await page.getByTestId("composer").fill("Is the team rule for the Draft the weekly close but do not send it routine locked?");
  await page.getByTestId("send").click();
  const locked = page.locator("#thread .turn").last();
  await expect(locked).toContainText("“Draft the weekly close but do not send it” has no locked team rule in the record.");
  await expect(locked).not.toContainText("has no stuck state");
  await expect(page.locator("[data-testid^='locked-team-rule-']").nth(0)).toHaveText("No locked team rule");

  await page.getByTestId("composer").fill("Which team rule blocks the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const team = page.locator("#thread .turn").last();
  await expect(team).toContainText("“Draft the weekly close but do not send it” has no team rule in the record.");
  await expect(team).not.toContainText("has no stuck state");
  await expect(page.locator("[data-testid^='team-rule-']").nth(0)).toHaveText("No team rule");

  await page.getByTestId("composer").fill("Which allow-automatically rule covers the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const allow = page.locator("#thread .turn").last();
  await expect(allow).toContainText("“Draft the weekly close but do not send it” has no allow-automatically rule in the record.");
  await expect(allow).not.toContainText("stuck state");
  await expect(page.locator("[data-testid^='allow-automatically-']").nth(0)).toHaveText("No allow-automatically rule");

  await page.getByTestId("composer").fill("Which ask-first rule blocks the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const askFirst = page.locator("#thread .turn").last();
  await expect(askFirst).toContainText("“Draft the weekly close but do not send it” has no ask-first rule in the record.");
  await expect(askFirst).not.toContainText("stuck state");

  await page.getByTestId("composer").fill("Which matching rule starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const matching = page.locator("#thread .turn").last();
  await expect(matching).toContainText("“Draft the weekly close but do not send it” has no matching rule in the record.");
  await expect(matching).not.toContainText("stuck state");

  await page.getByTestId("composer").fill("Which repository starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const repository = page.locator("#thread .turn").last();
  await expect(repository).toContainText("“Draft the weekly close but do not send it” has no source repository in the record.");
  await expect(repository).not.toContainText("has no stuck state");

  await page.getByTestId("composer").fill("Which channel starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const channel = page.locator("#thread .turn").last();
  await expect(channel).toContainText("“Draft the weekly close but do not send it” has no source channel in the record.");
  await expect(channel).not.toContainText("has no stuck state");

  await page.getByTestId("composer").fill("What failure does the Draft the weekly close but do not send it routine show?");
  await page.getByTestId("send").click();
  const failure = page.locator("#thread .turn").last();
  await expect(failure).toContainText("“Draft the weekly close but do not send it” has no failure in the record.");
  await expect(failure).not.toContainText("stuck state");

  await page.getByTestId("composer").fill("Has usage been paused for the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const usage = page.locator("#thread .turn").last();
  await expect(usage).toContainText("“Draft the weekly close but do not send it” has no usage pause in the record.");
  await expect(usage).not.toContainText("has no stuck state");

  await page.getByTestId("composer").fill("Why hasn't the Draft the weekly close but do not send it routine run?");
  await page.getByTestId("send").click();
  const quiet = page.locator("#thread .turn").last();
  await expect(quiet).toContainText("A wake does not run it.");
  await expect(quiet).not.toContainText("stuck state");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveText("Active");
  await expect(page.locator("[data-testid^='stuck-state-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='stuck-state-']").nth(0)).toHaveText("No stuck state");
  await expect(page.locator("[data-testid^='reachable-computer-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='reachable-computer-']").nth(0)).toHaveText("No reachable computer");
  await expect(page.locator("[data-testid^='cloud-computer-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='local-computer-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='locked-team-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='team-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='allow-automatically-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='ask-first-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='matching-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");
  await expect(page.locator("[data-testid^='computer-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='state-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-routine-stuck-state.png" });
});

test("ORIEL-F119 whether one routine is waiting on a login does not take over the computer", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Is the Launch note routine waiting on a login?");
  await page.getByTestId("send").click();
  await expect(page.locator("#thread .turn").last()).toContainText("There is no such routine as “Launch note”.");
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(0);

  await page.getByTestId("composer").fill("Draft the weekly close but do not send it");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const firstCadence = page.locator("[data-testid^='cadence-']").nth(0);
  await firstCadence.click();
  await expect(firstCadence).toHaveText("Daily");
  const firstTitle = await firstCadence.getAttribute("title");
  const firstNext = firstTitle?.replace(/^Next wake /, "") ?? "";
  await page.getByTestId("goal-all").click();
  await page.getByTestId("composer").fill("Summarize the launch risks");
  await page.getByTestId("send").click();
  await page.getByTestId("save-routine").click();
  const secondCadence = page.locator("[data-testid^='cadence-']").nth(1);
  await secondCadence.click();
  await secondCadence.click();
  await expect(secondCadence).toHaveText("Hourly");
  const secondTitle = await secondCadence.getAttribute("title");
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking whether one routine is waiting on a login says that routine has no login wait in the record.",
  );
  await expect(page.locator("[data-testid^='stuck-state-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='stuck-state-']").nth(0)).toHaveText("No stuck state");
  await expect(page.locator("[data-testid^='login-wait-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='login-wait-']").nth(0)).toHaveText("No login wait");
  await expect(page.locator("[data-testid^='reachable-computer-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='reachable-computer-']").nth(0)).toHaveText("No reachable computer");
  await expect(page.locator("[data-testid^='cloud-computer-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='cloud-computer-']").nth(0)).toHaveText("No cloud-computer refusal");
  await expect(page.locator("[data-testid^='local-computer-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='local-computer-']").nth(0)).toHaveText("No local-computer refusal");
  await expect(page.locator("[data-testid^='locked-team-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='locked-team-rule-']").nth(0)).toHaveText("No locked team rule");
  await expect(page.locator("[data-testid^='team-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='team-rule-']").nth(0)).toHaveText("No team rule");
  await expect(page.locator("[data-testid^='allow-automatically-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='allow-automatically-']").nth(0)).toHaveText("No allow-automatically rule");
  await expect(page.locator("[data-testid^='ask-first-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='ask-first-']").nth(0)).toHaveText("No ask-first rule");
  await expect(page.locator("[data-testid^='matching-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='matching-rule-']").nth(0)).toHaveText("No matching rule");
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");
  await expect(page.locator("[data-testid^='computer-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='state-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='wait-']")).toHaveCount(0);
  const stuckFollowsReachable = await page.evaluate(() => {
    const reachable = document.querySelector("[data-testid^='reachable-computer-']");
    const stuck = document.querySelector("[data-testid^='stuck-state-']");
    if (!reachable || !stuck || reachable.parentElement !== stuck.parentElement) return false;
    return reachable.compareDocumentPosition(stuck) === Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(stuckFollowsReachable).toBe(true);
  const loginFollowsStuck = await page.evaluate(() => {
    const stuck = document.querySelector("[data-testid^='stuck-state-']");
    const login = document.querySelector("[data-testid^='login-wait-']");
    if (!stuck || !login || stuck.parentElement !== login.parentElement) return false;
    return stuck.compareDocumentPosition(login) === Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(loginFollowsStuck).toBe(true);
  const loginIds = await page.locator("[data-testid^='login-wait-']").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-testid") ?? ""),
  );
  expect(loginIds.every((id) => id.startsWith("login-wait-"))).toBe(true);
  expect(loginIds.some((id) => id.startsWith("wait-"))).toBe(false);
  expect(loginIds.some((id) => id.startsWith("stuck-state-"))).toBe(false);
  expect(loginIds.some((id) => id.startsWith("state-"))).toBe(false);
  expect(loginIds.some((id) => id.startsWith("computer-"))).toBe(false);
  expect(loginIds.some((id) => id.startsWith("reachable-computer-"))).toBe(false);
  const stuckIds = await page.locator("[data-testid^='stuck-state-']").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-testid") ?? ""),
  );
  expect(stuckIds.every((id) => id.startsWith("stuck-state-"))).toBe(true);
  expect(stuckIds.some((id) => id.startsWith("state-"))).toBe(false);
  expect(stuckIds.some((id) => id.startsWith("reachable-computer-"))).toBe(false);
  expect(stuckIds.some((id) => id.startsWith("computer-"))).toBe(false);
  expect(stuckIds.some((id) => id.startsWith("cloud-computer-"))).toBe(false);
  const ruleIds = await page.locator("[data-testid^='rule-']").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-testid") ?? ""),
  );
  expect(ruleIds).toEqual(expect.arrayContaining(["rule-send", "rule-pay", "rule-delete", "rule-post"]));
  expect(ruleIds.some((id) => id.startsWith("stuck-state"))).toBe(false);
  expect(ruleIds.some((id) => id.startsWith("login-wait"))).toBe(false);

  await page.getByTestId("composer").fill("Is the Draft the weekly close but do not send it routine waiting on a login?");
  await page.getByTestId("send").click();
  const clear = page.locator("#thread .turn").last();
  await expect(clear).toContainText("“Draft the weekly close but do not send it” has no login wait in the record.");
  await expect(clear).toContainText("Asking does not take over the computer.");
  await expect(clear).not.toContainText("has no stuck state");
  await expect(clear).not.toContainText("Asking does not open the computer.");
  await expect(clear).not.toContainText("password");
  await expect(clear).not.toContainText("verification code");
  await expect(clear).not.toContainText("has no reachable computer");
  await expect(clear).not.toContainText("Asking does not recover a computer.");
  await expect(clear).not.toContainText("has no cloud-computer refusal");
  await expect(clear).not.toContainText("Asking does not turn cloud access on.");
  await expect(clear).not.toContainText("Grok Bot");
  await expect(clear).not.toContainText(firstNext);
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  expect(await secondCadence.getAttribute("title")).toBe(secondTitle);
  await expect(page.locator("[data-testid^='stuck-state-']").nth(0)).toHaveText("No stuck state");
  await expect(page.locator("[data-testid^='login-wait-']").nth(0)).toHaveText("No login wait");
  await expect(page.locator("[data-testid^='reachable-computer-']").nth(0)).toHaveText("No reachable computer");
  await expect(page.locator("[data-testid^='state-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='wait-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='computer-']")).toHaveCount(0);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Wakes paused");
  await page.getByTestId("composer").fill("Is the Draft the weekly close but do not send it routine waiting on a login?");
  await page.getByTestId("send").click();
  const duringDesk = page.locator("#thread .turn").last();
  await expect(duringDesk).toContainText("“Draft the weekly close but do not send it” has no login wait in the record.");
  await expect(duringDesk).not.toContainText("Wakes are paused");
  await expect(page.locator("[data-testid^='stuck-state-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='reachable-computer-']")).toHaveCount(2);
  await page.getByTestId("composer").fill("Resume wakes");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Pause wakes");

  await page.getByTestId("composer").fill("Pause the Draft the weekly close but do not send it routine");
  await page.getByTestId("send").click();
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);
  await page.getByTestId("composer").fill("Is the Draft the weekly close but do not send it routine waiting on a login?");
  await page.getByTestId("send").click();
  const pausedAsk = page.locator("#thread .turn").last();
  await expect(pausedAsk).toContainText("“Draft the weekly close but do not send it” has no login wait in the record.");
  await expect(pausedAsk).toContainText("Asking does not take over the computer.");
  await expect(pausedAsk).not.toContainText("has no stuck state");
  await expect(pausedAsk).not.toContainText("Asking does not open the computer.");
  await expect(pausedAsk).not.toContainText("password");
  await expect(pausedAsk).not.toContainText("verification code");
  await expect(pausedAsk).not.toContainText(firstNext);
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");

  await page.getByTestId("composer").fill("Can the Draft the weekly close but do not send it routine reach its computer?");
  await page.getByTestId("send").click();
  const reachable = page.locator("#thread .turn").last();
  await expect(reachable).toContainText("“Draft the weekly close but do not send it” has no reachable computer in the record.");
  await expect(reachable).toContainText("Asking does not recover a computer.");
  await expect(reachable).not.toContainText("has no login wait");
  await expect(page.locator("[data-testid^='reachable-computer-']").nth(0)).toHaveText("No reachable computer");
  await expect(page.locator("[data-testid^='stuck-state-']").nth(0)).toHaveText("No stuck state");
  await expect(page.locator("[data-testid^='login-wait-']").nth(0)).toHaveText("No login wait");

  await page.getByTestId("composer").fill("Is the Draft the weekly close but do not send it routine stuck?");
  await page.getByTestId("send").click();
  const stuckReply = page.locator("#thread .turn").last();
  await expect(stuckReply).toContainText("“Draft the weekly close but do not send it” has no stuck state in the record.");
  await expect(stuckReply).toContainText("Asking does not open the computer.");
  await expect(stuckReply).not.toContainText("has no login wait");
  await expect(stuckReply).not.toContainText("Asking does not take over the computer.");
  await expect(page.locator("[data-testid^='stuck-state-']").nth(0)).toHaveText("No stuck state");
  await expect(page.locator("[data-testid^='login-wait-']").nth(0)).toHaveText("No login wait");

  await page.getByTestId("composer").fill("Is cloud computer work refused for the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const cloudReply = page.locator("#thread .turn").last();
  await expect(cloudReply).toContainText("“Draft the weekly close but do not send it” has no cloud-computer refusal in the record.");
  await expect(cloudReply).toContainText("Asking does not turn cloud access on.");
  await expect(cloudReply).not.toContainText("has no login wait");
  await expect(page.locator("[data-testid^='cloud-computer-']").nth(0)).toHaveText("No cloud-computer refusal");

  await page.getByTestId("composer").fill("Is local computer work refused for the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const localReply = page.locator("#thread .turn").last();
  await expect(localReply).toContainText("“Draft the weekly close but do not send it” has no local-computer refusal in the record.");
  await expect(localReply).not.toContainText("has no login wait");
  await expect(page.locator("[data-testid^='local-computer-']").nth(0)).toHaveText("No local-computer refusal");

  await page.getByTestId("composer").fill("Can the Draft the weekly close but do not send it routine reach its source?");
  await page.getByTestId("send").click();
  const source = page.locator("#thread .turn").last();
  await expect(source).toContainText("“Draft the weekly close but do not send it” has no source system in the record.");
  await expect(source).not.toContainText("has no login wait");
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");

  await page.getByTestId("composer").fill("Is the team rule for the Draft the weekly close but do not send it routine locked?");
  await page.getByTestId("send").click();
  const locked = page.locator("#thread .turn").last();
  await expect(locked).toContainText("“Draft the weekly close but do not send it” has no locked team rule in the record.");
  await expect(locked).not.toContainText("has no login wait");
  await expect(page.locator("[data-testid^='locked-team-rule-']").nth(0)).toHaveText("No locked team rule");

  await page.getByTestId("composer").fill("Which team rule blocks the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const team = page.locator("#thread .turn").last();
  await expect(team).toContainText("“Draft the weekly close but do not send it” has no team rule in the record.");
  await expect(team).not.toContainText("has no login wait");
  await expect(page.locator("[data-testid^='team-rule-']").nth(0)).toHaveText("No team rule");

  await page.getByTestId("composer").fill("Which allow-automatically rule covers the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const allow = page.locator("#thread .turn").last();
  await expect(allow).toContainText("“Draft the weekly close but do not send it” has no allow-automatically rule in the record.");
  await expect(allow).not.toContainText("login wait");
  await expect(page.locator("[data-testid^='allow-automatically-']").nth(0)).toHaveText("No allow-automatically rule");

  await page.getByTestId("composer").fill("Which ask-first rule blocks the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const askFirst = page.locator("#thread .turn").last();
  await expect(askFirst).toContainText("“Draft the weekly close but do not send it” has no ask-first rule in the record.");
  await expect(askFirst).not.toContainText("login wait");

  await page.getByTestId("composer").fill("Which matching rule starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const matching = page.locator("#thread .turn").last();
  await expect(matching).toContainText("“Draft the weekly close but do not send it” has no matching rule in the record.");
  await expect(matching).not.toContainText("login wait");

  await page.getByTestId("composer").fill("Which repository starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const repository = page.locator("#thread .turn").last();
  await expect(repository).toContainText("“Draft the weekly close but do not send it” has no source repository in the record.");
  await expect(repository).not.toContainText("has no login wait");

  await page.getByTestId("composer").fill("Which channel starts the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const channel = page.locator("#thread .turn").last();
  await expect(channel).toContainText("“Draft the weekly close but do not send it” has no source channel in the record.");
  await expect(channel).not.toContainText("has no login wait");

  await page.getByTestId("composer").fill("What failure does the Draft the weekly close but do not send it routine show?");
  await page.getByTestId("send").click();
  const failure = page.locator("#thread .turn").last();
  await expect(failure).toContainText("“Draft the weekly close but do not send it” has no failure in the record.");
  await expect(failure).not.toContainText("login wait");

  await page.getByTestId("composer").fill("Has usage been paused for the Draft the weekly close but do not send it routine?");
  await page.getByTestId("send").click();
  const usage = page.locator("#thread .turn").last();
  await expect(usage).toContainText("“Draft the weekly close but do not send it” has no usage pause in the record.");
  await expect(usage).not.toContainText("has no login wait");

  await page.getByTestId("composer").fill("Why hasn't the Draft the weekly close but do not send it routine run?");
  await page.getByTestId("send").click();
  const quiet = page.locator("#thread .turn").last();
  await expect(quiet).toContainText("A wake does not run it.");
  await expect(quiet).not.toContainText("login wait");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");
  await expect(page.locator("[data-testid^='routine-active-']")).toHaveText("Active");
  await expect(page.locator("[data-testid^='stuck-state-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='stuck-state-']").nth(0)).toHaveText("No stuck state");
  await expect(page.locator("[data-testid^='login-wait-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='login-wait-']").nth(0)).toHaveText("No login wait");
  await expect(page.locator("[data-testid^='reachable-computer-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='reachable-computer-']").nth(0)).toHaveText("No reachable computer");
  await expect(page.locator("[data-testid^='cloud-computer-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='local-computer-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='locked-team-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='team-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='allow-automatically-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='ask-first-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='matching-rule-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='source-']")).toHaveCount(6);
  await expect(page.locator("[data-testid^='source-']").nth(0)).toHaveText("No source system");
  await expect(page.locator("[data-testid^='computer-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='state-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='wait-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='goal-']:not([data-testid='goal-all'])")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-routine-login-wait.png" });
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
