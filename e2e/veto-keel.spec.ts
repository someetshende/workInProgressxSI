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

test("ORIEL-F211 whether one routine says that members are prevented from turning auto-review off does not stop people from switching that check off", async ({
  page,
}) => {
  const question = "that prevents members from turning Auto-review off";
  const short = "Asking does not stop people from switching that check off.";
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
    "Asking whether one routine says that Prevents members from turning Auto-review off says that routine has no veto keel in the record.",
  );
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking whether one routine says that For guidance that belongs to one cohort, add Group Rules under Group settings says that routine has no clan charter in the record.",
  );
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking whether one routine says that Rules guide a Bot; for approval behavior, use Auto-review rules. says that routine has no guide lane in the record.",
  );
  await expect(page.getByTestId("schedule-hint")).toContainText(
    'Asking whether one routine says that Keep them short and few, like "never move company data to personal accounts." says that routine has no terse few in the record.',
  );
  const vetoBeforeClan = await page.getByTestId("schedule-hint").evaluate((node) => {
    const text = node.textContent ?? "";
    const veto = text.indexOf(
      "says that Prevents members from turning Auto-review off says that routine has no veto keel",
    );
    const clan = text.indexOf(
      "says that For guidance that belongs to one cohort, add Group Rules under Group settings says that routine has no clan charter",
    );
    const guide = text.indexOf(
      "says that Rules guide a Bot; for approval behavior, use Auto-review rules. says that routine has no guide lane",
    );
    return veto >= 0 && clan > veto && guide > clan && !text.slice(veto, clan).includes("says that routine has no clan charter");
  });
  expect(vetoBeforeClan).toBe(true);

  await expect(page.locator("[data-testid^='veto-keel-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='veto-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='keel-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='clan-charter-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='clan-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='charter-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='guide-lane-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='guide-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='lane-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='veto-keel-']").nth(0)).toHaveText("No veto keel");
  await expect(page.locator("[data-testid^='clan-charter-']").nth(0)).toHaveText("No clan charter");
  const followsClan = await page.evaluate(() => {
    const prior = document.querySelector("[data-testid^='clan-charter-']");
    const row = document.querySelector("[data-testid^='veto-keel-']");
    if (!prior || !row || prior.parentElement !== row.parentElement) return false;
    return prior.compareDocumentPosition(row) === Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(followsClan).toBe(true);
  const noteIds = await page.locator("[data-testid^='veto-keel-']").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-testid") ?? ""),
  );
  expect(noteIds.every((id) => id.startsWith("veto-keel-"))).toBe(true);
  expect(noteIds.some((id) => id.startsWith("keel-"))).toBe(false);
  expect(noteIds.some((id) => id.startsWith("clan-"))).toBe(false);
  expect(noteIds.some((id) => id.startsWith("charter-"))).toBe(false);
  for (const prefix of ["clan-charter-", "clan-", "charter-", "guide-lane-", "guide-", "lane-", "keel-", "file-"]) {
    expect(noteIds.some((id) => id.startsWith(prefix))).toBe(false);
  }

  await page.getByTestId("composer").fill(`Does the Draft the weekly close but do not send it routine say ${question}?`);
  await page.getByTestId("send").click();
  const clear = page.locator("#thread .turn").last();
  await expect(clear).toContainText("“Draft the weekly close but do not send it” has no veto keel in the record.");
  await expect(clear).toContainText(short);
  await expect(clear).not.toContainText("Asking does not block people from switching that check off.");
  await expect(clear).not.toContainText("Asking does not bar people from switching that check off.");
  await expect(clear).not.toContainText("has no clan charter");
  await expect(clear).not.toContainText("has no guide lane");
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
  await expect(duringDesk).toContainText("“Draft the weekly close but do not send it” has no veto keel in the record.");
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
  await expect(pausedAsk).toContainText("“Draft the weekly close but do not send it” has no veto keel in the record.");
  await expect(pausedAsk).toContainText(short);
  await expect(pausedAsk).not.toContainText("Asking does not block people from switching that check off.");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");

  await page.getByTestId("composer").fill(
    "does the draft the weekly close but do not send it routine say that prevents members from turning auto-review off",
  );
  await page.getByTestId("send").click();
  const lower = page.locator("#thread .turn").last();
  await expect(lower).toContainText("has no veto keel in the record.");
  await expect(lower).toContainText(short);
  await expect(lower).not.toContainText("has no clan charter");
  await expect(lower).not.toContainText("has no guide lane");

  await page.getByTestId("composer").fill(
    "does the draft the weekly close but do not send it routine say that for guidance that belongs to one cohort, add group rules under group settings",
  );
  await page.getByTestId("send").click();
  const clanKept = page.locator("#thread .turn").last();
  await expect(clanKept).toContainText("has no clan charter in the record.");
  await expect(clanKept).toContainText("Asking does not place those notes for one set of people under that set's settings.");
  await expect(clanKept).not.toContainText("has no veto keel");

  await page.getByTestId("composer").fill(
    "does the draft the weekly close but do not send it routine say that rules guide a bot; for approval behavior, use auto-review rules",
  );
  await page.getByTestId("send").click();
  const guideKept = page.locator("#thread .turn").last();
  await expect(guideKept).toContainText("has no guide lane in the record.");
  await expect(guideKept).toContainText("Asking does not steer those guides toward approval behavior.");
  await expect(guideKept).not.toContainText("has no veto keel");

  await page.getByTestId("composer").fill("Why hasn't the Draft the weekly close but do not send it routine run?");
  await page.getByTestId("send").click();
  const why = page.locator("#thread .turn").last();
  await expect(why).toContainText("A wake does not run it.");
  await expect(why).not.toContainText("veto keel");
  await expect(why).not.toContainText("clan charter");
  await expect(why).not.toContainText("guide lane");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='veto-keel-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='veto-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='keel-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='clan-charter-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='clan-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='charter-']")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-routine-veto-keel.png" });
});
