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

test("ORIEL-F197 whether one routine says that bots, files, and logins that had synced come back does not bring those synced bots and logins back", async ({
  page,
}) => {
  const question = "that bots, files, and logins that had synced come back; a turn that was running is lost";
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
    "Asking whether one routine says that Bots, files, and logins that had synced come back; a turn that was running is lost says that routine has no sync forfeit in the record.",
  );
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking whether one routine says that The reconnect can take a few minutes says that routine has no reconnect lag in the record.",
  );
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking whether one routine says that After a terminate, manual or automatic, the member's next message starts a fresh computer on their durable disk says that routine has no fresh boot in the record.",
  );
  const forfeitBeforeReconnect = await page.getByTestId("schedule-hint").evaluate((node) => {
    const text = node.textContent ?? "";
    const forfeit = text.indexOf(
      "says that Bots, files, and logins that had synced come back; a turn that was running is lost says that routine has no sync forfeit",
    );
    const reconnect = text.indexOf(
      "says that The reconnect can take a few minutes says that routine has no reconnect lag",
    );
    const fresh = text.indexOf(
      "says that After a terminate, manual or automatic, the member's next message starts a fresh computer on their durable disk says that routine has no fresh boot",
    );
    return (
      forfeit >= 0 &&
      reconnect > forfeit &&
      fresh > reconnect &&
      !text.slice(forfeit, reconnect).includes("says that routine has no reconnect lag")
    );
  });
  expect(forfeitBeforeReconnect).toBe(true);

  await expect(page.locator("[data-testid^='sync-forfeit-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='sync-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='forfeit-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='reconnect-lag-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='reconnect-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='lag-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='sync-forfeit-']").nth(0)).toHaveText("No sync forfeit");
  await expect(page.locator("[data-testid^='reconnect-lag-']").nth(0)).toHaveText("No reconnect lag");
  const followsReconnect = await page.evaluate(() => {
    const prior = document.querySelector("[data-testid^='reconnect-lag-']");
    const row = document.querySelector("[data-testid^='sync-forfeit-']");
    if (!prior || !row || prior.parentElement !== row.parentElement) return false;
    return prior.compareDocumentPosition(row) === Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(followsReconnect).toBe(true);
  const noteIds = await page.locator("[data-testid^='sync-forfeit-']").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-testid") ?? ""),
  );
  expect(noteIds.every((id) => id.startsWith("sync-forfeit-"))).toBe(true);
  for (const prefix of ["reconnect-lag-", "reconnect-", "lag-", "forfeit-", "fresh-boot-", "file-", "login-"]) {
    expect(noteIds.some((id) => id.startsWith(prefix))).toBe(false);
  }

  await page.getByTestId("composer").fill(`Does the Draft the weekly close but do not send it routine say ${question}?`);
  await page.getByTestId("send").click();
  const clear = page.locator("#thread .turn").last();
  await expect(clear).toContainText("“Draft the weekly close but do not send it” has no sync forfeit in the record.");
  await expect(clear).toContainText("Asking does not bring those synced bots and logins back or drop a turn already underway.");
  await expect(clear).not.toContainText("Asking does not return those synced bots and logins or drop a turn already underway.");
  await expect(clear).not.toContainText("Asking does not recover those synced bots and logins or drop a turn already underway.");
  await expect(clear).not.toContainText("has no reconnect lag");
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
  await expect(duringDesk).toContainText("“Draft the weekly close but do not send it” has no sync forfeit in the record.");
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
  await expect(pausedAsk).toContainText("“Draft the weekly close but do not send it” has no sync forfeit in the record.");
  await expect(pausedAsk).toContainText("Asking does not bring those synced bots and logins back or drop a turn already underway.");
  await expect(pausedAsk).not.toContainText("Asking does not return those synced bots and logins or drop a turn already underway.");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");

  await page.getByTestId("composer").fill(
    "does the draft the weekly close but do not send it routine say that bots, files, and logins that had synced come back; a turn that was running is lost",
  );
  await page.getByTestId("send").click();
  const lower = page.locator("#thread .turn").last();
  await expect(lower).toContainText("has no sync forfeit in the record.");
  await expect(lower).toContainText("Asking does not bring those synced bots and logins back or drop a turn already underway.");
  await expect(lower).not.toContainText("has no reconnect lag");

  await page.getByTestId("composer").fill(
    "does the draft the weekly close but do not send it routine say that the reconnect can take a few minutes",
  );
  await page.getByTestId("send").click();
  const reconnectKept = page.locator("#thread .turn").last();
  await expect(reconnectKept).toContainText("has no reconnect lag in the record.");
  await expect(reconnectKept).toContainText("Asking does not make that return wait several minutes.");
  await expect(reconnectKept).not.toContainText("has no sync forfeit");
  await expect(reconnectKept).not.toContainText("Asking does not bring those synced bots and logins back or drop a turn already underway.");

  await page.getByTestId("composer").fill(
    "does the draft the weekly close but do not send it routine say that after a terminate, manual or automatic, the member's next message starts a fresh computer on their durable disk",
  );
  await page.getByTestId("send").click();
  const freshKept = page.locator("#thread .turn").last();
  await expect(freshKept).toContainText("has no fresh boot in the record.");
  await expect(freshKept).toContainText("Asking does not open a new machine on that disk after an ending.");
  await expect(freshKept).not.toContainText("has no sync forfeit");

  await page.getByTestId("composer").fill("Why hasn't the Draft the weekly close but do not send it routine run?");
  await page.getByTestId("send").click();
  const why = page.locator("#thread .turn").last();
  await expect(why).toContainText("A wake does not run it.");
  await expect(why).not.toContainText("sync forfeit");
  await expect(why).not.toContainText("reconnect lag");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='sync-forfeit-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='sync-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='forfeit-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='reconnect-lag-']")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-routine-sync-forfeit.png" });
});
