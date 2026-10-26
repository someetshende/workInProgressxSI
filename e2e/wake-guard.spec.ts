import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ request }) => {
  const response = await request.post("/api/reset");
  expect(response.ok()).toBeTruthy();
});

async function bringIntoView(page: Page, testId: string) {
  const locator = page.getByTestId(testId);
  await expect(locator).toBeVisible();
  await locator.evaluate((node) => node.scrollIntoView({ block: "center", inline: "nearest" }));
}

test("ORIEL-F204 whether one routine says that an awake computer is never ended does not spare that machine", async ({
  page,
}) => {
  const question =
    "that a computer that is awake, because a Bot is working or the member is using Grok Bot, is never terminated by this setting";
  await page.goto("/");
  await page.getByTestId("composer").fill(`Does the Launch note routine say ${question}?`);
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
    "Asking whether one routine says that A computer that is awake, because a Bot is working or the member is using Grok Bot, is never terminated by this setting says that routine has no wake guard in the record.",
  );
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking whether one routine says that The 30 days count from when the computer went to sleep after its last use says that routine has no doze tally in the record.",
  );
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking whether one routine says that To remove access, remove the member from the team or turn off their access with Manage Group Access, and revoke their sessions in your identity provider says that routine has no access lift in the record.",
  );
  const wakeBeforeDoze = await page.getByTestId("schedule-hint").evaluate((node) => {
    const text = node.textContent ?? "";
    const wake = text.indexOf(
      "says that A computer that is awake, because a Bot is working or the member is using Grok Bot, is never terminated by this setting says that routine has no wake guard",
    );
    const doze = text.indexOf(
      "says that The 30 days count from when the computer went to sleep after its last use says that routine has no doze tally",
    );
    const lift = text.indexOf(
      "says that To remove access, remove the member from the team or turn off their access with Manage Group Access, and revoke their sessions in your identity provider says that routine has no access lift",
    );
    return (
      wake >= 0 &&
      doze > wake &&
      lift > doze &&
      !text.slice(wake, doze).includes("says that routine has no doze tally")
    );
  });
  expect(wakeBeforeDoze).toBe(true);

  await expect(page.locator("[data-testid^='wake-guard-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='wake-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='guard-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='doze-tally-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='doze-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='tally-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='wake-guard-']").nth(0)).toHaveText("No wake guard");
  await expect(page.locator("[data-testid^='doze-tally-']").nth(0)).toHaveText("No doze tally");
  const followsDoze = await page.evaluate(() => {
    const prior = document.querySelector("[data-testid^='doze-tally-']");
    const row = document.querySelector("[data-testid^='wake-guard-']");
    if (!prior || !row || prior.parentElement !== row.parentElement) return false;
    return prior.compareDocumentPosition(row) === Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(followsDoze).toBe(true);
  const noteIds = await page.locator("[data-testid^='wake-guard-']").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-testid") ?? ""),
  );
  expect(noteIds.every((id) => id.startsWith("wake-guard-"))).toBe(true);
  for (const prefix of ["doze-tally-", "doze-", "tally-", "guard-", "access-lift-", "file-"]) {
    expect(noteIds.some((id) => id.startsWith(prefix))).toBe(false);
  }

  await page.getByTestId("composer").fill(`Does the Draft the weekly close but do not send it routine say ${question}?`);
  await page.getByTestId("send").click();
  const clear = page.locator("#thread .turn").last();
  await expect(clear).toContainText("“Draft the weekly close but do not send it” has no wake guard in the record.");
  await expect(clear).toContainText("Asking does not spare a machine that stays awake while work is still going.");
  await expect(clear).not.toContainText("Asking does not keep a machine that stays awake while work is still going.");
  await expect(clear).not.toContainText("Asking does not shield a machine that stays awake while work is still going.");
  await expect(clear).not.toContainText("has no doze tally");
  await expect(clear).not.toContainText("cursor");
  await expect(clear).not.toContainText("credential");
  await expect(clear).not.toContainText("password");
  await expect(clear).not.toContainText("secret");
  await expect(clear).not.toContainText("file");
  await expect(clear).not.toContainText("Grok Bot");
  await expect(clear).not.toContainText(firstNext);
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  expect(await secondCadence.getAttribute("title")).toBe(secondTitle);

  await page.getByTestId("pause-wakes").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Wakes paused");
  await page.getByTestId("composer").fill(`Does the Draft the weekly close but do not send it routine say ${question}?`);
  await page.getByTestId("send").click();
  const duringDesk = page.locator("#thread .turn").last();
  await expect(duringDesk).toContainText("“Draft the weekly close but do not send it” has no wake guard in the record.");
  await expect(duringDesk).not.toContainText("Wakes are paused");
  await page.getByTestId("composer").fill("Resume wakes");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("pause-wakes")).toHaveText("Pause wakes");

  await page.getByTestId("composer").fill("Pause the Draft the weekly close but do not send it routine");
  await page.getByTestId("send").click();
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveCount(1);
  await page.getByTestId("composer").fill(`Does the Draft the weekly close but do not send it routine say ${question}?`);
  await page.getByTestId("send").click();
  const pausedAsk = page.locator("#thread .turn").last();
  await expect(pausedAsk).toContainText("“Draft the weekly close but do not send it” has no wake guard in the record.");
  await expect(pausedAsk).toContainText("Asking does not spare a machine that stays awake while work is still going.");
  await expect(pausedAsk).not.toContainText("Asking does not keep a machine that stays awake while work is still going.");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");

  await page.getByTestId("composer").fill(
    "does the draft the weekly close but do not send it routine say that a computer that is awake, because a bot is working or the member is using grok bot, is never terminated by this setting",
  );
  await page.getByTestId("send").click();
  const lower = page.locator("#thread .turn").last();
  await expect(lower).toContainText("has no wake guard in the record.");
  await expect(lower).toContainText("Asking does not spare a machine that stays awake while work is still going.");
  await expect(lower).not.toContainText("has no doze tally");

  await page.getByTestId("composer").fill(
    "does the draft the weekly close but do not send it routine say that the 30 days count from when the computer went to sleep after its last use",
  );
  await page.getByTestId("send").click();
  const dozeKept = page.locator("#thread .turn").last();
  await expect(dozeKept).toContainText("has no doze tally in the record.");
  await expect(dozeKept).toContainText("Asking does not begin that thirty-day wait when the machine fell asleep after its last use.");
  await expect(dozeKept).not.toContainText("has no wake guard");

  await page.getByTestId("composer").fill(
    "does the draft the weekly close but do not send it routine say that to remove access, remove the member from the team or turn off their access with manage group access, and revoke their sessions in your identity provider",
  );
  await page.getByTestId("send").click();
  const liftKept = page.locator("#thread .turn").last();
  await expect(liftKept).toContainText("has no access lift in the record.");
  await expect(liftKept).toContainText("Asking does not lift that person off the team or end their sessions.");
  await expect(liftKept).not.toContainText("has no wake guard");

  await page.getByTestId("composer").fill("Why hasn't the Draft the weekly close but do not send it routine run?");
  await page.getByTestId("send").click();
  const why = page.locator("#thread .turn").last();
  await expect(why).toContainText("A wake does not run it.");
  await expect(why).not.toContainText("wake guard");
  await expect(why).not.toContainText("doze tally");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='wake-guard-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='wake-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='guard-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='doze-tally-']")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-routine-wake-guard.png" });
});
