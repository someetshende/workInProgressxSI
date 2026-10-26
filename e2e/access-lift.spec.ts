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

test("ORIEL-F202 whether one routine says that removing access takes the member off the team does not lift that person off", async ({
  page,
}) => {
  const question =
    "that to remove access, remove the member from the team or turn off their access with Manage Group Access, and revoke their sessions in your identity provider";
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
    "Asking whether one routine says that To remove access, remove the member from the team or turn off their access with Manage Group Access, and revoke their sessions in your identity provider says that routine has no access lift in the record.",
  );
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking whether one routine says that Their next message starts a fresh computer on the same durable disk, with their Bots, files, and logins says that routine has no folio return in the record.",
  );
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking whether one routine says that Terminating a computer, by hand or automatically, ends the member's current work says that routine has no labor close in the record.",
  );
  const liftBeforeFolio = await page.getByTestId("schedule-hint").evaluate((node) => {
    const text = node.textContent ?? "";
    const lift = text.indexOf(
      "says that To remove access, remove the member from the team or turn off their access with Manage Group Access, and revoke their sessions in your identity provider says that routine has no access lift",
    );
    const folio = text.indexOf(
      "says that Their next message starts a fresh computer on the same durable disk, with their Bots, files, and logins says that routine has no folio return",
    );
    const close = text.indexOf(
      "says that Terminating a computer, by hand or automatically, ends the member's current work says that routine has no labor close",
    );
    return (
      lift >= 0 &&
      folio > lift &&
      close > folio &&
      !text.slice(lift, folio).includes("says that routine has no folio return")
    );
  });
  expect(liftBeforeFolio).toBe(true);

  await expect(page.locator("[data-testid^='access-lift-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='access-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='lift-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='folio-return-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='folio-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='return-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='access-lift-']").nth(0)).toHaveText("No access lift");
  await expect(page.locator("[data-testid^='folio-return-']").nth(0)).toHaveText("No folio return");
  const followsFolio = await page.evaluate(() => {
    const prior = document.querySelector("[data-testid^='folio-return-']");
    const row = document.querySelector("[data-testid^='access-lift-']");
    if (!prior || !row || prior.parentElement !== row.parentElement) return false;
    return prior.compareDocumentPosition(row) === Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(followsFolio).toBe(true);
  const noteIds = await page.locator("[data-testid^='access-lift-']").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-testid") ?? ""),
  );
  expect(noteIds.every((id) => id.startsWith("access-lift-"))).toBe(true);
  for (const prefix of ["folio-return-", "folio-", "return-", "lift-", "labor-close-", "file-"]) {
    expect(noteIds.some((id) => id.startsWith(prefix))).toBe(false);
  }

  await page.getByTestId("composer").fill(`Does the Draft the weekly close but do not send it routine say ${question}?`);
  await page.getByTestId("send").click();
  const clear = page.locator("#thread .turn").last();
  await expect(clear).toContainText("“Draft the weekly close but do not send it” has no access lift in the record.");
  await expect(clear).toContainText("Asking does not lift that person off the team or end their sessions.");
  await expect(clear).not.toContainText("Asking does not lift that person from the roster or end their sessions.");
  await expect(clear).not.toContainText("Asking does not lift that person out of the roster or end their sessions.");
  await expect(clear).not.toContainText("has no folio return");
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
  await expect(duringDesk).toContainText("“Draft the weekly close but do not send it” has no access lift in the record.");
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
  await expect(pausedAsk).toContainText("“Draft the weekly close but do not send it” has no access lift in the record.");
  await expect(pausedAsk).toContainText("Asking does not lift that person off the team or end their sessions.");
  await expect(pausedAsk).not.toContainText("Asking does not lift that person from the roster or end their sessions.");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");

  await page.getByTestId("composer").fill(
    "does the draft the weekly close but do not send it routine say that to remove access, remove the member from the team or turn off their access with manage group access, and revoke their sessions in your identity provider",
  );
  await page.getByTestId("send").click();
  const lower = page.locator("#thread .turn").last();
  await expect(lower).toContainText("has no access lift in the record.");
  await expect(lower).toContainText("Asking does not lift that person off the team or end their sessions.");
  await expect(lower).not.toContainText("has no folio return");

  await page.getByTestId("composer").fill(
    "does the draft the weekly close but do not send it routine say that their next message starts a fresh computer on the same durable disk, with their bots, files, and logins",
  );
  await page.getByTestId("send").click();
  const folioKept = page.locator("#thread .turn").last();
  await expect(folioKept).toContainText("has no folio return in the record.");
  await expect(folioKept).toContainText("Asking does not seat the next note on that same lasting disk with the bots and sign-ins kept.");
  await expect(folioKept).not.toContainText("has no access lift");

  await page.getByTestId("composer").fill(
    "does the draft the weekly close but do not send it routine say that terminating a computer, by hand or automatically, ends the member's current work",
  );
  await page.getByTestId("send").click();
  const closeKept = page.locator("#thread .turn").last();
  await expect(closeKept).toContainText("has no labor close in the record.");
  await expect(closeKept).toContainText("Asking does not close the work that is underway by ending the machine.");
  await expect(closeKept).not.toContainText("has no access lift");

  await page.getByTestId("composer").fill("Why hasn't the Draft the weekly close but do not send it routine run?");
  await page.getByTestId("send").click();
  const why = page.locator("#thread .turn").last();
  await expect(why).toContainText("A wake does not run it.");
  await expect(why).not.toContainText("access lift");
  await expect(why).not.toContainText("folio return");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='access-lift-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='access-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='lift-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='folio-return-']")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-routine-access-lift.png" });
});
