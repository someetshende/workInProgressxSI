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

test("ORIEL-F214 whether one routine says that this includes team bots in chats where nobody can answer an approval does not cover a chat where nobody can answer before the work runs", async ({
  page,
}) => {
  const question = "that this includes Team Bots in chats where nobody can answer an approval, which otherwise run without Auto-review";
  const short = "Asking does not cover a chat where nobody can answer before the work runs.";
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
    "Asking whether one routine says that This includes Team Bots in chats where nobody can answer an approval, which otherwise run without Auto-review says that routine has no vacant quorum in the record.",
  );
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking whether one routine says that When it is on, Bots always check risky actions before running them and ask for approval when needed says that routine has no risk gate in the record.",
  );
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking whether one routine says that The switch is on the Grok Bot page and is off by default says that routine has no start dim in the record.",
  );
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking whether one routine says that Prevents members from turning Auto-review off says that routine has no veto keel in the record.",
  );
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking whether one routine says that For guidance that belongs to one cohort, add Group Rules under Group settings says that routine has no clan charter in the record.",
  );
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking whether one routine says that Rules guide a Bot; for approval behavior, use Auto-review rules. says that routine has no guide lane in the record.",
  );
  const vacantBeforeRisk = await page.getByTestId("schedule-hint").evaluate((node) => {
    const text = node.textContent ?? "";
    const vacant = text.indexOf(
      "says that This includes Team Bots in chats where nobody can answer an approval, which otherwise run without Auto-review says that routine has no vacant quorum",
    );
    const risk = text.indexOf(
      "says that When it is on, Bots always check risky actions before running them and ask for approval when needed says that routine has no risk gate",
    );
    return vacant >= 0 && risk > vacant && !text.slice(vacant, risk).includes("says that routine has no risk gate");
  });
  expect(vacantBeforeRisk).toBe(true);

  const riskBeforeStart = await page.getByTestId("schedule-hint").evaluate((node) => {
    const text = node.textContent ?? "";
    const risk = text.indexOf(
      "says that When it is on, Bots always check risky actions before running them and ask for approval when needed says that routine has no risk gate",
    );
    const start = text.indexOf(
      "says that The switch is on the Grok Bot page and is off by default says that routine has no start dim",
    );
    const veto = text.indexOf(
      "says that Prevents members from turning Auto-review off says that routine has no veto keel",
    );
    return risk >= 0 && start > risk && veto > start && !text.slice(risk, start).includes("says that routine has no start dim");
  });
  expect(riskBeforeStart).toBe(true);

  await expect(page.locator("[data-testid^='vacant-quorum-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='vacant-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='quorum-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='risk-gate-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='risk-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='gate-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='off-page-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='off-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='veto-keel-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='veto-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='keel-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='clan-charter-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='clan-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='charter-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='vacant-quorum-']").nth(0)).toHaveText("No vacant quorum");
  await expect(page.locator("[data-testid^='risk-gate-']").nth(0)).toHaveText("No risk gate");
  await expect(page.locator("[data-testid^='off-page-']").nth(0)).toHaveText("No start dim");
  await expect(page.locator("[data-testid^='veto-keel-']").nth(0)).toHaveText("No veto keel");
  const followsRisk = await page.evaluate(() => {
    const prior = document.querySelector("[data-testid^='risk-gate-']");
    const row = document.querySelector("[data-testid^='vacant-quorum-']");
    if (!prior || !row || prior.parentElement !== row.parentElement) return false;
    return prior.compareDocumentPosition(row) === Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(followsRisk).toBe(true);
  const vacantIds = await page.locator("[data-testid^='vacant-quorum-']").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-testid") ?? ""),
  );
  expect(vacantIds.every((id) => id.startsWith("vacant-quorum-"))).toBe(true);
  expect(vacantIds.some((id) => id.startsWith("quorum-"))).toBe(false);
  expect(vacantIds.some((id) => id.startsWith("risk-"))).toBe(false);
  expect(vacantIds.some((id) => id.startsWith("gate-"))).toBe(false);
  for (const prefix of ["risk-gate-", "risk-", "gate-", "off-page-", "off-", "page-", "start-", "veto-keel-", "veto-", "keel-", "file-"]) {
    expect(vacantIds.some((id) => id.startsWith(prefix))).toBe(false);
  }

  const followsStart = await page.evaluate(() => {
    const prior = document.querySelector("[data-testid^='off-page-']");
    const row = document.querySelector("[data-testid^='risk-gate-']");
    if (!prior || !row || prior.parentElement !== row.parentElement) return false;
    return prior.compareDocumentPosition(row) === Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(followsStart).toBe(true);
  const noteIds = await page.locator("[data-testid^='risk-gate-']").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-testid") ?? ""),
  );
  expect(noteIds.every((id) => id.startsWith("risk-gate-"))).toBe(true);
  expect(noteIds.some((id) => id.startsWith("gate-"))).toBe(false);
  expect(noteIds.some((id) => id.startsWith("off-"))).toBe(false);
  expect(noteIds.some((id) => id.startsWith("page-"))).toBe(false);
  expect(noteIds.some((id) => id.startsWith("start-"))).toBe(false);
  expect(noteIds.some((id) => id.startsWith("veto-"))).toBe(false);
  expect(noteIds.some((id) => id.startsWith("keel-"))).toBe(false);
  for (const prefix of ["off-page-", "off-", "page-", "start-", "veto-keel-", "veto-", "keel-", "clan-charter-", "clan-", "charter-", "file-"]) {
    expect(noteIds.some((id) => id.startsWith(prefix))).toBe(false);
  }

  await page.getByTestId("composer").fill(`Does the Draft the weekly close but do not send it routine say ${question}?`);
  await page.getByTestId("send").click();
  const clear = page.locator("#thread .turn").last();
  await expect(clear).toContainText("“Draft the weekly close but do not send it” has no vacant quorum in the record.");
  await expect(clear).toContainText(short);
  await expect(clear).not.toContainText("Asking does not hold a chat where nobody can answer before the work runs.");
  await expect(clear).not.toContainText("Asking does not keep a chat where nobody can answer before the work runs.");
  await expect(clear).not.toContainText("has no start dim");
  await expect(clear).not.toContainText("has no veto keel");
  await expect(clear).not.toContainText("has no clan charter");
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
  await expect(duringDesk).toContainText("“Draft the weekly close but do not send it” has no vacant quorum in the record.");
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
  await expect(pausedAsk).toContainText("“Draft the weekly close but do not send it” has no vacant quorum in the record.");
  await expect(pausedAsk).toContainText(short);
  await expect(pausedAsk).not.toContainText("Asking does not hold a chat where nobody can answer before the work runs.");
  await expect(pausedAsk).not.toContainText("has no start dim");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");

  await page.getByTestId("composer").fill(
    "does the draft the weekly close but do not send it routine say that this includes team bots in chats where nobody can answer an approval, which otherwise run without auto-review",
  );
  await page.getByTestId("send").click();
  const lower = page.locator("#thread .turn").last();
  await expect(lower).toContainText("has no vacant quorum in the record.");
  await expect(lower).toContainText(short);
  await expect(lower).not.toContainText("has no risk gate");
  await expect(lower).not.toContainText("has no start dim");
  await expect(lower).not.toContainText("has no veto keel");
  await expect(lower).not.toContainText("has no clan charter");

  await page.getByTestId("composer").fill(
    "does the draft the weekly close but do not send it routine say that when it is on, bots always check risky actions before running them and ask for approval when needed",
  );
  await page.getByTestId("send").click();
  const riskKept = page.locator("#thread .turn").last();
  await expect(riskKept).toContainText("has no risk gate in the record.");
  await expect(riskKept).toContainText("Asking does not make those workers check risky steps before they run and ask before they proceed.");
  await expect(riskKept).not.toContainText("has no vacant quorum");

  await page.getByTestId("composer").fill(
    "does the draft the weekly close but do not send it routine say that the switch is on the grok bot page and is off by default",
  );
  await page.getByTestId("send").click();
  const startKept = page.locator("#thread .turn").last();
  await expect(startKept).toContainText("has no start dim in the record.");
  await expect(startKept).toContainText("Asking does not leave that control on that page and off at the start.");
  await expect(startKept).not.toContainText("has no risk gate");

  await page.getByTestId("composer").fill(
    "does the draft the weekly close but do not send it routine say that prevents members from turning auto-review off",
  );
  await page.getByTestId("send").click();
  const vetoKept = page.locator("#thread .turn").last();
  await expect(vetoKept).toContainText("has no veto keel in the record.");
  await expect(vetoKept).toContainText("Asking does not stop people from switching that check off.");
  await expect(vetoKept).not.toContainText("has no risk gate");
  await expect(vetoKept).not.toContainText("has no start dim");

  await page.getByTestId("composer").fill(
    "does the draft the weekly close but do not send it routine say that for guidance that belongs to one cohort, add group rules under group settings",
  );
  await page.getByTestId("send").click();
  const clanKept = page.locator("#thread .turn").last();
  await expect(clanKept).toContainText("has no clan charter in the record.");
  await expect(clanKept).toContainText("Asking does not place those notes for one set of people under that set's settings.");
  await expect(clanKept).not.toContainText("has no risk gate");

  await page.getByTestId("composer").fill("Why hasn't the Draft the weekly close but do not send it routine run?");
  await page.getByTestId("send").click();
  const why = page.locator("#thread .turn").last();
  await expect(why).toContainText("A wake does not run it.");
  await expect(why).not.toContainText("vacant quorum");
  await expect(why).not.toContainText("risk gate");
  await expect(why).not.toContainText("start dim");
  await expect(why).not.toContainText("veto keel");
  await expect(why).not.toContainText("clan charter");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='risk-gate-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='risk-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='gate-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='off-page-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='off-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='veto-keel-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='veto-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='keel-']")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /always allow/i })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await bringIntoView(page, "composer");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/oriel-routine-vacant-quorum.png" });
});
