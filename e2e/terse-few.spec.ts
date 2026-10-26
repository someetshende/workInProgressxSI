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

test("ORIEL-F208 whether one routine says to keep them short and few does not keep those guides short and few", async ({
  page,
}) => {
  const question = 'that keep them short and few, like "never move company data to personal accounts."';
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
    'Asking whether one routine says that Keep them short and few, like "never move company data to personal accounts." says that routine has no terse few in the record.',
  );
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking whether one routine says that Rules applied to Grok Bot are always required, so members cannot turn them off says that routine has no firm yoke in the record.",
  );
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking whether one routine says that Add them from the Grok Bot page and scope each rule to Cursor, Grok Bot, or both says that routine has no scope split in the record.",
  );
  const terseBeforeFirm = await page.getByTestId("schedule-hint").evaluate((node) => {
    const text = node.textContent ?? "";
    const terse = text.indexOf(
      'says that Keep them short and few, like "never move company data to personal accounts." says that routine has no terse few',
    );
    const firm = text.indexOf(
      "says that Rules applied to Grok Bot are always required, so members cannot turn them off says that routine has no firm yoke",
    );
    const scope = text.indexOf(
      "says that Add them from the Grok Bot page and scope each rule to Cursor, Grok Bot, or both says that routine has no scope split",
    );
    return (
      terse >= 0 &&
      firm > terse &&
      scope > firm &&
      !text.slice(terse, firm).includes("says that routine has no firm yoke")
    );
  });
  expect(terseBeforeFirm).toBe(true);

  await expect(page.locator("[data-testid^='terse-few-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='terse-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='few-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='firm-yoke-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='firm-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='yoke-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='scope-split-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='terse-few-']").nth(0)).toHaveText("No terse few");
  await expect(page.locator("[data-testid^='firm-yoke-']").nth(0)).toHaveText("No firm yoke");
  const followsFirm = await page.evaluate(() => {
    const prior = document.querySelector("[data-testid^='firm-yoke-']");
    const row = document.querySelector("[data-testid^='terse-few-']");
    if (!prior || !row || prior.parentElement !== row.parentElement) return false;
    return prior.compareDocumentPosition(row) === Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(followsFirm).toBe(true);
  const noteIds = await page.locator("[data-testid^='terse-few-']").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-testid") ?? ""),
  );
  expect(noteIds.every((id) => id.startsWith("terse-few-"))).toBe(true);
  for (const prefix of ["firm-yoke-", "firm-", "yoke-", "few-", "scope-split-", "scope-", "split-", "file-"]) {
    expect(noteIds.some((id) => id.startsWith(prefix))).toBe(false);
  }

  await page.getByTestId("composer").fill(`Does the Draft the weekly close but do not send it routine say ${question}?`);
  await page.getByTestId("send").click();
  const clear = page.locator("#thread .turn").last();
  await expect(clear).toContainText("“Draft the weekly close but do not send it” has no terse few in the record.");
  await expect(clear).toContainText("Asking does not keep those guides short and few.");
  await expect(clear).not.toContainText("Asking does not hold those guides short and few.");
  await expect(clear).not.toContainText("Asking does not leave those guides short and few.");
  await expect(clear).not.toContainText("has no firm yoke");
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
  await expect(duringDesk).toContainText("“Draft the weekly close but do not send it” has no terse few in the record.");
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
  await expect(pausedAsk).toContainText("“Draft the weekly close but do not send it” has no terse few in the record.");
  await expect(pausedAsk).toContainText("Asking does not keep those guides short and few.");
  await expect(pausedAsk).not.toContainText("Asking does not hold those guides short and few.");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");

  await page.getByTestId("composer").fill(
    'does the draft the weekly close but do not send it routine say that keep them short and few, like "never move company data to personal accounts."',
  );
  await page.getByTestId("send").click();
  const lower = page.locator("#thread .turn").last();
  await expect(lower).toContainText("has no terse few in the record.");
  await expect(lower).toContainText("Asking does not keep those guides short and few.");
  await expect(lower).not.toContainText("has no firm yoke");
  await expect(lower).not.toContainText("has no scope split");

  await page.getByTestId("composer").fill(
    "does the draft the weekly close but do not send it routine say that rules applied to grok bot are always required, so members cannot turn them off",
  );
  await page.getByTestId("send").click();
  const firmKept = page.locator("#thread .turn").last();
  await expect(firmKept).toContainText("has no firm yoke in the record.");
  await expect(firmKept).toContainText("Asking does not lock those rules on so people cannot switch them off.");
  await expect(firmKept).not.toContainText("has no terse few");

  await page.getByTestId("composer").fill(
    "does the draft the weekly close but do not send it routine say that add them from the grok bot page and scope each rule to cursor, grok bot, or both",
  );
  await page.getByTestId("send").click();
  const scopeKept = page.locator("#thread .turn").last();
  await expect(scopeKept).toContainText("has no scope split in the record.");
  await expect(scopeKept).toContainText("Asking does not add those rules from that page or limit each one to one seat, the other, or both.");
  await expect(scopeKept).not.toContainText("has no terse few");

  await page.getByTestId("composer").fill(
    "does the draft the weekly close but do not send it routine say that rules that every member's bots follow",
  );
  await page.getByTestId("send").click();
  const canonKept = page.locator("#thread .turn").last();
  await expect(canonKept).toContainText("has no canon bind in the record.");
  await expect(canonKept).toContainText("Asking does not make every member's bots follow those rules.");
  await expect(canonKept).not.toContainText("has no terse few");

  await page.getByTestId("composer").fill("Why hasn't the Draft the weekly close but do not send it routine run?");
  await page.getByTestId("send").click();
  const why = page.locator("#thread .turn").last();
  await expect(why).toContainText("A wake does not run it.");
  await expect(why).not.toContainText("terse few");
  await expect(why).not.toContainText("firm yoke");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='terse-few-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='terse-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='few-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='firm-yoke-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='firm-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='yoke-']")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-routine-terse-few.png" });
});
