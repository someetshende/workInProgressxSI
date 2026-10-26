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

test("ORIEL-F198 whether one routine says that select the member from any team they belong to does not choose that person from every group they sit in", async ({
  page,
}) => {
  const question = "that select the member from any team they belong to";
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
    "Asking whether one routine says that Select the member from any team they belong to says that routine has no circle door in the record.",
  );
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking whether one routine says that Bots, files, and logins that had synced come back; a turn that was running is lost says that routine has no sync forfeit in the record.",
  );
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking whether one routine says that The reconnect can take a few minutes says that routine has no reconnect lag in the record.",
  );
  const doorBeforeForfeit = await page.getByTestId("schedule-hint").evaluate((node) => {
    const text = node.textContent ?? "";
    const door = text.indexOf(
      "says that Select the member from any team they belong to says that routine has no circle door",
    );
    const forfeit = text.indexOf(
      "says that Bots, files, and logins that had synced come back; a turn that was running is lost says that routine has no sync forfeit",
    );
    const reconnect = text.indexOf(
      "says that The reconnect can take a few minutes says that routine has no reconnect lag",
    );
    return (
      door >= 0 &&
      forfeit > door &&
      reconnect > forfeit &&
      !text.slice(door, forfeit).includes("says that routine has no sync forfeit")
    );
  });
  expect(doorBeforeForfeit).toBe(true);

  await expect(page.locator("[data-testid^='circle-door-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='circle-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='door-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='sync-forfeit-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='sync-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='forfeit-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='circle-door-']").nth(0)).toHaveText("No circle door");
  await expect(page.locator("[data-testid^='sync-forfeit-']").nth(0)).toHaveText("No sync forfeit");
  const followsForfeit = await page.evaluate(() => {
    const prior = document.querySelector("[data-testid^='sync-forfeit-']");
    const row = document.querySelector("[data-testid^='circle-door-']");
    if (!prior || !row || prior.parentElement !== row.parentElement) return false;
    return prior.compareDocumentPosition(row) === Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(followsForfeit).toBe(true);
  const noteIds = await page.locator("[data-testid^='circle-door-']").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-testid") ?? ""),
  );
  expect(noteIds.every((id) => id.startsWith("circle-door-"))).toBe(true);
  for (const prefix of ["sync-forfeit-", "sync-", "forfeit-", "door-", "team-", "member-", "pick-"]) {
    expect(noteIds.some((id) => id.startsWith(prefix))).toBe(false);
  }

  await page.getByTestId("composer").fill(`Does the Draft the weekly close but do not send it routine say ${question}?`);
  await page.getByTestId("send").click();
  const clear = page.locator("#thread .turn").last();
  await expect(clear).toContainText("“Draft the weekly close but do not send it” has no circle door in the record.");
  await expect(clear).toContainText("Asking does not choose that person from every group they sit in.");
  await expect(clear).not.toContainText("Asking does not select that person from every circle they join.");
  await expect(clear).not.toContainText("Asking does not name that person from every circle they join.");
  await expect(clear).not.toContainText("has no sync forfeit");
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
  await expect(duringDesk).toContainText("“Draft the weekly close but do not send it” has no circle door in the record.");
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
  await expect(pausedAsk).toContainText("“Draft the weekly close but do not send it” has no circle door in the record.");
  await expect(pausedAsk).toContainText("Asking does not choose that person from every group they sit in.");
  await expect(pausedAsk).not.toContainText("Asking does not select that person from every circle they join.");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");

  await page.getByTestId("composer").fill(
    "does the draft the weekly close but do not send it routine say that select the member from any team they belong to",
  );
  await page.getByTestId("send").click();
  const lower = page.locator("#thread .turn").last();
  await expect(lower).toContainText("has no circle door in the record.");
  await expect(lower).toContainText("Asking does not choose that person from every group they sit in.");
  await expect(lower).not.toContainText("has no sync forfeit");

  await page.getByTestId("composer").fill(
    "does the draft the weekly close but do not send it routine say that bots, files, and logins that had synced come back; a turn that was running is lost",
  );
  await page.getByTestId("send").click();
  const forfeitKept = page.locator("#thread .turn").last();
  await expect(forfeitKept).toContainText("has no sync forfeit in the record.");
  await expect(forfeitKept).toContainText("Asking does not bring those synced bots and logins back or drop a turn already underway.");
  await expect(forfeitKept).not.toContainText("has no circle door");
  await expect(forfeitKept).not.toContainText("Asking does not choose that person from every group they sit in.");

  await page.getByTestId("composer").fill(
    "does the draft the weekly close but do not send it routine say that the reconnect can take a few minutes",
  );
  await page.getByTestId("send").click();
  const reconnectKept = page.locator("#thread .turn").last();
  await expect(reconnectKept).toContainText("has no reconnect lag in the record.");
  await expect(reconnectKept).toContainText("Asking does not make that return wait several minutes.");
  await expect(reconnectKept).not.toContainText("has no circle door");

  await page.getByTestId("composer").fill("Why hasn't the Draft the weekly close but do not send it routine run?");
  await page.getByTestId("send").click();
  const why = page.locator("#thread .turn").last();
  await expect(why).toContainText("A wake does not run it.");
  await expect(why).not.toContainText("circle door");
  await expect(why).not.toContainText("sync forfeit");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='circle-door-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='circle-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='door-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='sync-forfeit-']")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-routine-circle-door.png" });
});
