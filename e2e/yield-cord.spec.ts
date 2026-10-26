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

test("ORIEL-F223 whether one routine says that the server permits or refuses the request before the model runs does not let that host do it", async ({
  page,
}) => {
  const question = "that Your server allows or denies the request before the model runs";
  const short = "Asking does not let that host permit or refuse the request before the model runs.";
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
    "Asking whether one routine says that Your server allows or denies the request before the model runs says that routine has no yield cord in the record.",
  );
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking whether one routine says that See approvals and Auto Review says that routine has no cite slip in the record.",
  );
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking whether one routine says that Members see the team rules under Settings → General → Auto-review but cannot edit or delete them, and Ask first wins when rules conflict says that routine has no sight glass in the record.",
  );
  const douseBeforeSight = await page.getByTestId("schedule-hint").evaluate((node) => {
    const text = node.textContent ?? "";
    const douse = text.indexOf(
      "says that See approvals and Auto Review says that routine has no cite slip",
    );
    const sight = text.indexOf(
      "says that Members see the team rules under Settings → General → Auto-review but cannot edit or delete them, and Ask first wins when rules conflict says that routine has no sight glass",
    );
    return douse >= 0 && sight > douse && !text.slice(douse, sight).includes("says that routine has no sight glass");
  });
  expect(douseBeforeSight).toBe(true);
  const citeBeforeDouse = await page.getByTestId("schedule-hint").evaluate((node) => {
    const text = node.textContent ?? "";
    const cite = text.indexOf(
      "says that See approvals and Auto Review says that routine has no cite slip",
    );
    const douse = text.indexOf(
      "says that Turning enforcement off stops applying the team rules says that routine has no douse mark",
    );
    return cite >= 0 && douse > cite && !text.slice(cite, douse).includes("says that routine has no douse mark");
  });
  expect(citeBeforeDouse).toBe(true);
  const quillBeforeCite = await page.getByTestId("schedule-hint").evaluate((node) => {
    const text = node.textContent ?? "";
    const quill = text.indexOf(
      "says that Your server allows or denies the request before the model runs says that routine has no yield cord",
    );
    const cite = text.indexOf(
      "says that See approvals and Auto Review says that routine has no cite slip",
    );
    return quill >= 0 && cite > quill && !text.slice(quill, cite).includes("says that routine has no cite slip");
  });
    expect(quillBeforeCite).toBe(true);
  const yieldBeforeQuill = await page.getByTestId("schedule-hint").evaluate((node) => {
    const text = node.textContent ?? "";
    const yieldAt = text.indexOf("says that Your server allows or denies the request before the model runs says that routine has no yield cord");
    const quill = text.indexOf("says that Sends each Grok Bot model request, signed, to an AI security server your organization runs or uses through a security vendor says that routine has no quill bond");
    return yieldAt >= 0 && quill > yieldAt && !text.slice(yieldAt, quill).includes("says that routine has no quill bond");
  });
  expect(yieldBeforeQuill).toBe(true);

  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking whether one routine says that Team-wide Ask first and Allow automatically rules that apply to every member's Bots on top of their own rules says that routine has no cap layer in the record.",
  );
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking whether one routine says that A group can lift the lock for its own members with Don't enforce for this group; see Group settings says that routine has no waiver lock in the record.",
  );
  await expect(page.getByTestId("schedule-hint")).toContainText(
    "Asking whether one routine says that Turn it on before you rely on team Auto-review rules says that routine has no prior arm in the record.",
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
      "says that Turn it on before you rely on team Auto-review rules says that routine has no prior arm",
    );
    const risk = text.indexOf(
      "says that When it is on, Bots always check risky actions before running them and ask for approval when needed says that routine has no risk gate",
    );
    return vacant >= 0 && risk > vacant && !text.slice(vacant, risk).includes("says that routine has no risk gate");
  });
  expect(vacantBeforeRisk).toBe(true);

  const inkBeforeCap = await page.getByTestId("schedule-hint").evaluate((node) => {
    const text = node.textContent ?? "";
    const sight = text.indexOf(
      "says that Members see the team rules under Settings → General → Auto-review but cannot edit or delete them, and Ask first wins when rules conflict says that routine has no sight glass",
    );
    const ink = text.indexOf(
      "says that Add them with Configure Rules on the Grok Bot page; changes save automatically says that routine has no ink latch",
    );
    return sight >= 0 && ink > sight && !text.slice(sight, ink).includes("says that routine has no ink latch");
  });
  expect(inkBeforeCap).toBe(true);

  const capBeforeWaiver = await page.getByTestId("schedule-hint").evaluate((node) => {
    const text = node.textContent ?? "";
    const cap = text.indexOf(
      "says that Team-wide Ask first and Allow automatically rules that apply to every member's Bots on top of their own rules says that routine has no cap layer",
    );
    const waiver = text.indexOf(
      "says that A group can lift the lock for its own members with Don't enforce for this group; see Group settings says that routine has no waiver lock",
    );
    return cap >= 0 && waiver > cap && !text.slice(cap, waiver).includes("says that routine has no waiver lock");
  });
  expect(capBeforeWaiver).toBe(true);

  const waiverBeforePrior = await page.getByTestId("schedule-hint").evaluate((node) => {
    const text = node.textContent ?? "";
    const waiver = text.indexOf(
      "says that A group can lift the lock for its own members with Don't enforce for this group; see Group settings says that routine has no waiver lock",
    );
    const prior = text.indexOf(
      "says that Turn it on before you rely on team Auto-review rules says that routine has no prior arm",
    );
    return waiver >= 0 && prior > waiver && !text.slice(waiver, prior).includes("says that routine has no prior arm");
  });
  expect(waiverBeforePrior).toBe(true);

  const priorBeforeVacant = await page.getByTestId("schedule-hint").evaluate((node) => {
    const text = node.textContent ?? "";
    const prior = text.indexOf(
      "says that Turn it on before you rely on team Auto-review rules says that routine has no prior arm",
    );
    const vacant = text.indexOf(
      "says that This includes Team Bots in chats where nobody can answer an approval, which otherwise run without Auto-review says that routine has no vacant quorum",
    );
    return prior >= 0 && vacant > prior && !text.slice(prior, vacant).includes("says that routine has no vacant quorum");
  });
  expect(priorBeforeVacant).toBe(true);

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

  await expect(page.locator("[data-testid^='yield-cord-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='yield-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='cord-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='quill-bond-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='quill-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='bond-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='quill-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='bond-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='cite-slip-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='cite-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='slip-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='sight-glass-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='sight-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='glass-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='ink-latch-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='ink-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='latch-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='cap-layer-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='cap-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='layer-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='waiver-lock-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='waiver-']")).toHaveCount(2);
  await expect(page.locator("[data-testid^='lock-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='prior-arm-']")).toHaveCount(2);
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
  await expect(page.locator("[data-testid^='prior-arm-']").nth(0)).toHaveText("No prior arm");
  await expect(page.locator("[data-testid^='vacant-quorum-']").nth(0)).toHaveText("No vacant quorum");
  await expect(page.locator("[data-testid^='risk-gate-']").nth(0)).toHaveText("No risk gate");
  await expect(page.locator("[data-testid^='off-page-']").nth(0)).toHaveText("No start dim");
  await expect(page.locator("[data-testid^='veto-keel-']").nth(0)).toHaveText("No veto keel");
  const followsRisk = await page.evaluate(() => {
    const prior = document.querySelector("[data-testid^='risk-gate-']");
    const row = document.querySelector("[data-testid^='prior-arm-']");
    if (!prior || !row || prior.parentElement !== row.parentElement) return false;
    return prior.compareDocumentPosition(row) === Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(followsRisk).toBe(true);
  const followsPrior = await page.evaluate(() => {
    const prior = document.querySelector("[data-testid^='prior-arm-']");
    const row = document.querySelector("[data-testid^='cap-layer-']");
    if (!prior || !row || prior.parentElement !== row.parentElement) return false;
    return prior.compareDocumentPosition(row) === Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(followsPrior).toBe(true);
  await expect(page.locator("[data-testid^='cite-slip-']").nth(0)).toHaveText("No cite slip");
  await expect(page.locator("[data-testid^='sight-glass-']").nth(0)).toHaveText("No sight glass");
  const followsSight = await page.evaluate(() => {
    const prior = document.querySelector("[data-testid^='sight-glass-']");
    const row = document.querySelector("[data-testid^='cite-slip-']");
    if (!prior || !row || prior.parentElement !== row.parentElement) return false;
    return prior.compareDocumentPosition(row) === Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(followsSight).toBe(true);
  const followsDouse = await page.evaluate(() => {
    const prior = document.querySelector("[data-testid^='douse-mark-']");
    const row = document.querySelector("[data-testid^='cite-slip-']");
    if (!prior || !row || prior.parentElement !== row.parentElement) return false;
    return prior.compareDocumentPosition(row) === Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(followsDouse).toBe(true);
  const followsCite = await page.evaluate(() => {
    const prior = document.querySelector("[data-testid^='cite-slip-']");
    const row = document.querySelector("[data-testid^='yield-cord-']");
    if (!prior || !row || prior.parentElement !== row.parentElement) return false;
    return prior.compareDocumentPosition(row) === Node.DOCUMENT_POSITION_FOLLOWING;
  });
    expect(followsCite).toBe(true);
  const followsQuill = await page.evaluate(() => {
    const prior = document.querySelector("[data-testid^='quill-bond-']");
    const row = document.querySelector("[data-testid^='yield-cord-']");
    if (!prior || !row || prior.parentElement !== row.parentElement) return false;
    return prior.compareDocumentPosition(row) === Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(followsQuill).toBe(true);

  await expect(page.locator("[data-testid^='cap-layer-']").nth(0)).toHaveText("No cap layer");
  const followsCap = await page.evaluate(() => {
    const prior = document.querySelector("[data-testid^='cap-layer-']");
    const row = document.querySelector("[data-testid^='sight-glass-']");
    if (!prior || !row || prior.parentElement !== row.parentElement) return false;
    return prior.compareDocumentPosition(row) === Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(followsCap).toBe(true);
  const followsInk = await page.evaluate(() => {
    const prior = document.querySelector("[data-testid^='ink-latch-']");
    const row = document.querySelector("[data-testid^='sight-glass-']");
    if (!prior || !row || prior.parentElement !== row.parentElement) return false;
    return prior.compareDocumentPosition(row) === Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(followsInk).toBe(true);
  await expect(page.locator("[data-testid^='waiver-lock-']").nth(0)).toHaveText("No waiver lock");
  const followsWaiver = await page.evaluate(() => {
    const prior = document.querySelector("[data-testid^='waiver-lock-']");
    const row = document.querySelector("[data-testid^='cap-layer-']");
    if (!prior || !row || prior.parentElement !== row.parentElement) return false;
    return prior.compareDocumentPosition(row) === Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(followsWaiver).toBe(true);

  const followsVacant = await page.evaluate(() => {
    const prior = document.querySelector("[data-testid^='vacant-quorum-']");
    const row = document.querySelector("[data-testid^='prior-arm-']");
    if (!prior || !row || prior.parentElement !== row.parentElement) return false;
    return prior.compareDocumentPosition(row) === Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(followsVacant).toBe(true);

  const vacantIds = await page.locator("[data-testid^='prior-arm-']").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-testid") ?? ""),
  );
  expect(vacantIds.every((id) => id.startsWith("prior-arm-"))).toBe(true);
  expect(vacantIds.some((id) => id.startsWith("arm-"))).toBe(false);
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
  await expect(clear).toContainText("“Draft the weekly close but do not send it” has no yield cord in the record.");
  await expect(clear).toContainText(short);
  await expect(clear).not.toContainText("Asking does not set that lock on before you count on the shared review rules.");
  await expect(clear).not.toContainText("Asking does not place that lock on before you count on the shared review rules.");
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
  await expect(duringDesk).toContainText("“Draft the weekly close but do not send it” has no yield cord in the record.");
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
  await expect(pausedAsk).toContainText("“Draft the weekly close but do not send it” has no yield cord in the record.");
  await expect(pausedAsk).toContainText(short);
  await expect(pausedAsk).not.toContainText("Asking does not set that lock on before you count on the shared review rules.");
  await expect(pausedAsk).not.toContainText("has no start dim");
  expect(await firstCadence.getAttribute("title")).toBe(firstTitle);
  await expect(page.locator("[data-testid^='routine-paused-']")).toHaveText("Paused");

  await page.getByTestId("composer").fill(
    "does the draft the weekly close but do not send it routine say that your server allows or denies the request before the model runs",
  );
  await page.getByTestId("send").click();
  const lower = page.locator("#thread .turn").last();
  await expect(lower).toContainText("has no yield cord in the record.");
  await expect(lower).toContainText(short);
  await expect(lower).not.toContainText("has no risk gate");
  await expect(lower).not.toContainText("has no start dim");
  await expect(lower).not.toContainText("has no veto keel");
  await expect(lower).not.toContainText("has no clan charter");


  await page.getByTestId("composer").fill(
    "does the draft the weekly close but do not send it routine say that sends each grok bot model request, signed, to an ai security server your organization runs or uses through a security vendor",
  );
  await page.getByTestId("send").click();
  const quillAnswer = page.locator("#thread .turn").last();
  await expect(quillAnswer).toContainText("has no quill bond in the record.");
  await expect(quillAnswer).toContainText("Asking does not forward each signed model request to a review server the organization runs or reaches through a vendor.");
  await expect(quillAnswer).not.toContainText("has no yield cord");

  await page.getByTestId("composer").fill(
    "does the draft the weekly close but do not send it routine say that see approvals and auto review",
  );
  await page.getByTestId("send").click();
  const citeAnswer = page.locator("#thread .turn").last();
  await expect(citeAnswer).toContainText("has no cite slip in the record.");
  await expect(citeAnswer).toContainText("Asking does not open that review page from the note.");
  await expect(citeAnswer).not.toContainText("has no yield cord");

  await page.getByTestId("composer").fill(
    "does the draft the weekly close but do not send it routine say that turning enforcement off stops applying the team rules",
  );
  await page.getByTestId("send").click();
  const douseAnswer = page.locator("#thread .turn").last();
  await expect(douseAnswer).toContainText("has no douse mark in the record.");
  await expect(douseAnswer).toContainText("Asking does not halt those shared notes once the lock is switched off.");
  await expect(douseAnswer).not.toContainText("has no cite slip");

  await page.getByTestId("composer").fill(
    "does the draft the weekly close but do not send it routine say that members see the team rules under settings → general → auto-review but cannot edit or delete them, and ask first wins when rules conflict",
  );
  await page.getByTestId("send").click();
  const sightAnswer = page.locator("#thread .turn").last();
  await expect(sightAnswer).toContainText("has no sight glass in the record.");
  await expect(sightAnswer).toContainText("Asking does not show those shared notes as a look-only pane where ask-first wins a clash.");
  await expect(sightAnswer).not.toContainText("has no cite slip");

  await page.getByTestId("composer").fill(
    "does the draft the weekly close but do not send it routine say that add them with configure rules on the grok bot page; changes save automatically",
  );
  await page.getByTestId("send").click();
  const inkKept = page.locator("#thread .turn").last();
  await expect(inkKept).toContainText("has no ink latch in the record.");
  await expect(inkKept).toContainText("Asking does not write those notes on that page the moment they change.");
  await expect(inkKept).not.toContainText("has no sight glass");

  await page.getByTestId("composer").fill(
    "does the draft the weekly close but do not send it routine say that turn it on before you rely on team auto-review rules",
  );
  await page.getByTestId("send").click();
  const priorKept = page.locator("#thread .turn").last();
  await expect(priorKept).toContainText("has no prior arm in the record.");
  await expect(priorKept).toContainText("Asking does not turn that lock on before you count on the shared review rules.");
  await expect(priorKept).not.toContainText("has no cap layer");
  await expect(priorKept).not.toContainText("has no waiver lock");

  await page.getByTestId("composer").fill(
    "does the draft the weekly close but do not send it routine say that this includes team bots in chats where nobody can answer an approval, which otherwise run without auto-review",
  );
  await page.getByTestId("send").click();
  const vacantKept = page.locator("#thread .turn").last();
  await expect(vacantKept).toContainText("has no vacant quorum in the record.");
  await expect(vacantKept).toContainText("Asking does not cover a chat where nobody can answer before the work runs.");
  await expect(vacantKept).not.toContainText("has no prior arm");
  await expect(vacantKept).not.toContainText("has no cap layer");

  await page.getByTestId("composer").fill(
    "does the draft the weekly close but do not send it routine say that when it is on, bots always check risky actions before running them and ask for approval when needed",
  );
  await page.getByTestId("send").click();
  const riskKept = page.locator("#thread .turn").last();
  await expect(riskKept).toContainText("has no risk gate in the record.");
  await expect(riskKept).toContainText("Asking does not make those workers check risky steps before they run and ask before they proceed.");
  await expect(riskKept).not.toContainText("has no prior arm");

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
  await expect(why).not.toContainText("prior arm");
  await expect(why).not.toContainText("sight glass");
  await expect(why).not.toContainText("cite slip");
  await expect(why).not.toContainText("quill bond");
  await expect(why).not.toContainText("cap layer");
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
  await page.screenshot({ path: "test-results/oriel-routine-yield-cord.png" });
});
