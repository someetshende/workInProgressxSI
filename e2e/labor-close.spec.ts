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

test("ORIEL-F200 whether one routine says that terminating a computer ends the member's current work does not close the work that is underway by ending the machine", async ({
  page,
}) => {
  const question = "that terminating a computer, by hand or automatically, ends the member's current work";
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
    "Asking whether one routine says that Terminating a computer, by hand or automatically, ends the member's current work says that routine has no labor close in the record.",
  );
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking whether one routine says that One computer serves every team the member is in, so recreating or terminating it from one team affects the same computer everywhere says that routine has no serve wide in the record.",
  );
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking whether one routine says that Select the member from any team they belong to says that routine has no circle door in the record.",
  );
  const closeBeforeWide = await page.getByTestId("schedule-hint").evaluate((node) => {
    const text = node.textContent ?? "";
    const close = text.indexOf(
      "says that Terminating a computer, by hand or automatically, ends the member's current work says that routine has no labor close",
    );
    const wide = text.indexOf(
      "says that One computer serves every team the member is in, so recreating or terminating it from one team affects the same computer everywhere says that routine has no serve wide",
    );
    const door = text.indexOf(
      "says that Select the member from any team they belong to says that routine has no circle door",
    );
    return (
      close >= 0 &&
      wide > close &&
      door > wide &&
      !text.slice(close, wide).includes("says that routine has no serve wide")
    );
  });
  expect(closeBeforeWide).toBe(true);

  await expect(page.locator("[data-testid^='labor-close-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='labor-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='close-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='serve-wide-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='serve-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='wide-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='labor-close-']").nth(0)).toHaveText("No labor close");
  await expect(page.locator("[data-testid^='serve-wide-']").nth(0)).toHaveText("No serve wide");
  const followsWide = await page.evaluate(() => {
    const prior = document.querySelector("[data-testid^='serve-wide-']");
    const row = document.querySelector("[data-testid^='labor-close-']");
    if (!prior || !row || prior.parentElement !== row.parentElement) return false;
    return prior.compareDocumentPosition(row) === Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(followsWide).toBe(true);
  const noteIds = await page.locator("[data-testid^='labor-close-']").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-testid") ?? ""),
  );
  expect(noteIds.every((id) => id.startsWith("labor-close-"))).toBe(true);
  for (const prefix of ["serve-wide-", "serve-", "wide-", "close-", "circle-door-", "work-", "task-", "file-"]) {
    expect(noteIds.some((id) => id.startsWith(prefix))).toBe(false);
  }

  await page.getByTestId("composer").fill(`Does the Draft the weekly close but do not send it routine say ${question}?`);
  await page.getByTestId("send").click();
  const clear = page.locator("#thread .turn").last();
  await expect(clear).toContainText("“Draft the weekly close but do not send it” has no labor close in the record.");
  await expect(clear).toContainText("Asking does not close the work that is underway by ending the machine.");
  await expect(clear).not.toContainText("Asking does not finish the work that is underway by ending the machine.");
  await expect(clear).not.toContainText("Asking does not cut the work that is underway by ending the machine.");
  await expect(clear).not.toContainText("has no serve wide");
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
  await expect(duringDesk).toContainText("“Draft the weekly close but do not send it” has no labor close in the record.");
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
  await expect(pausedAsk).toContainText("“Draft the weekly close but do not send it” has no labor close in the record.");
  await expect(pausedAsk).toContainText("Asking does not close the work that is underway by ending the machine.");
  await expect(pausedAsk).not.toContainText("Asking does not finish the work that is underway by ending the machine.");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");

  await page.getByTestId("composer").fill(
    "does the draft the weekly close but do not send it routine say that terminating a computer, by hand or automatically, ends the member's current work",
  );
  await page.getByTestId("send").click();
  const lower = page.locator("#thread .turn").last();
  await expect(lower).toContainText("has no labor close in the record.");
  await expect(lower).toContainText("Asking does not close the work that is underway by ending the machine.");
  await expect(lower).not.toContainText("has no serve wide");

  await page.getByTestId("composer").fill(
    "does the draft the weekly close but do not send it routine say that one computer serves every team the member is in, so recreating or terminating it from one team affects the same computer everywhere",
  );
  await page.getByTestId("send").click();
  const wideKept = page.locator("#thread .turn").last();
  await expect(wideKept).toContainText("has no serve wide in the record.");
  await expect(wideKept).toContainText("Asking does not ripple that same machine out from one group.");
  await expect(wideKept).not.toContainText("has no labor close");
  await expect(wideKept).not.toContainText("Asking does not close the work that is underway by ending the machine.");

  await page.getByTestId("composer").fill(
    "does the draft the weekly close but do not send it routine say that select the member from any team they belong to",
  );
  await page.getByTestId("send").click();
  const doorKept = page.locator("#thread .turn").last();
  await expect(doorKept).toContainText("has no circle door in the record.");
  await expect(doorKept).toContainText("Asking does not choose that person from every group they sit in.");
  await expect(doorKept).not.toContainText("has no labor close");

  await page.getByTestId("composer").fill("Why hasn't the Draft the weekly close but do not send it routine run?");
  await page.getByTestId("send").click();
  const why = page.locator("#thread .turn").last();
  await expect(why).toContainText("A wake does not run it.");
  await expect(why).not.toContainText("labor close");
  await expect(why).not.toContainText("serve wide");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='labor-close-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='labor-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='close-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='serve-wide-']")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-routine-labor-close.png" });
});
