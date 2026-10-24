const rail = document.querySelector("#rail");
const thread = document.querySelector("#thread");
const form = document.querySelector("#composer");
const input = document.querySelector("#input");
const send = document.querySelector("[data-testid='send']");
const error = document.querySelector("#error");
const context = document.querySelector("#context");

const PROMPTS = [
  {
    id: "prompt-compare",
    label: "Compare the three agents for a client team",
    text: "Compare Grok Bot, Dots, and Muse for a client-facing team. Do not email anyone.",
  },
  {
    id: "prompt-dinner",
    label: "Plan a family dinner under $80",
    text: "Plan a family dinner under $80 and hold any purchase.",
  },
  {
    id: "prompt-watch",
    label: "Watch the launch checklist",
    text: "Keep an eye on the launch checklist.",
  },
];

let state = null;
let selected = null;
let armedSkill = null;
let busy = false;
let openBridge = null;
let phraseAction = "delete";
let phraseDraft = "";
let phraseDirty = false;

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = String(value);
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
    else if (value === true) node.setAttribute(key, "");
    else node.setAttribute(key, String(value));
  }
  for (const child of children) node.append(child);
  return node;
}

function windowMark() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M4 8 L12 4 L20 8 V18 H4 Z M12 4 V18 M4 12 H20");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.4");
  svg.append(path);
  return svg;
}

function bridgeHint(url) {
  if (!url) return "https://bridge.example/tasks";
  try {
    return new URL(url).host;
  } catch {
    return "Bridge saved";
  }
}

function statusOf(connector) {
  if (!connector.enabled) return { label: "Off", className: "agent-status" };
  if (connector.lastResult === "live") return { label: "Live", className: "agent-status live" };
  if (connector.lastResult === "fallback") return { label: "Fell back", className: "agent-status bad" };
  if (connector.bridgeUrl) return { label: "Bridged", className: "agent-status" };
  return { label: "Reference", className: "agent-status" };
}

function goalWord(status) {
  if (status === "waiting") return "Waiting";
  if (status === "active") return "Open";
  return "Done";
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { accept: "application/json", ...(options.body ? { "content-type": "application/json" } : {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Oriel could not do that.");
  return data;
}

function fail(err) {
  error.hidden = false;
  error.textContent = err instanceof Error ? err.message : "Oriel could not do that.";
}

async function post(path, body) {
  if (busy) return false;
  busy = true;
  error.hidden = true;
  send.disabled = true;
  const previous = send.textContent;
  if (path === "/api/turn") send.textContent = "Convening";
  try {
    state = await api(path, { method: "POST", body: JSON.stringify(body) });
    if (path === "/api/turn") armedSkill = null;
    render();
    reveal();
    return true;
  } catch (err) {
    fail(err);
    return false;
  } finally {
    busy = false;
    send.textContent = previous || "Send";
    send.disabled = input.value.trim().length === 0;
  }
}

function reveal() {
  const approve = thread.querySelector("[data-testid='approve'], [data-testid='did-this']");
  if (approve instanceof HTMLElement) {
    approve.scrollIntoView({ block: "center" });
    return;
  }
  const last = thread.querySelector(".column > .turn:last-child");
  const synthesis = last instanceof HTMLElement ? last.querySelector("[data-testid='synthesis']") : null;
  if (synthesis instanceof HTMLElement) {
    const delta = synthesis.getBoundingClientRect().top - thread.getBoundingClientRect().top;
    thread.scrollTop += delta - 28;
    return;
  }
  thread.scrollTop = thread.scrollHeight;
}

function goalHasTask(goalId) {
  return (state?.approvals || []).some(
    (approval) => approval.goalId === goalId && approval.status === "approved" && approval.scope === "task",
  );
}

function stopTarget() {
  if (!state) return null;
  if (selected) return goalHasTask(selected) ? selected : null;
  for (let index = state.goals.length - 1; index >= 0; index -= 1) {
    const goal = state.goals[index];
    if (goal && goalHasTask(goal.id)) return goal.id;
  }
  return null;
}

function renderContext() {
  const goal = state?.goals?.find((item) => item.id === selected);
  const skill = state?.skills?.find((item) => item.id === armedSkill);
  const parts = [];
  if (goal) parts.push(`Continuing · ${goal.title}`);
  if (skill) parts.push(`Using · ${skill.name}`);
  context.textContent = parts.length ? parts.join(" · ") : "This starts a new goal";
}

function renderRail() {
  rail.replaceChildren();
  const brand = el("div", { class: "brand" }, [
    windowMark(),
    el("div", { class: "word", text: "Oriel" }),
  ]);
  rail.append(brand);
  rail.append(el("p", { class: "tag", text: "One window for the agents you already run." }));
  rail.append(el("p", { class: "label", text: "Hand off to you" }));
  rail.append(
    el("p", {
      class: "rule-note",
      text: "When a request would do one of these, that step is yours. Say it: Hand deletions that mention shared project files to me. To clear those words, say: Stop handing deletions that mention shared project files to me. To clear a rule with no words, say: Stop handing deletions to me. To read them, say: What is handed to me? To ask about one, say: Is a deletion handed to me? To ask whether the words are those, say: Is a deletion that mentions shared project files handed to me? To ask which words a step uses, say: Which words does a deletion hand to me? To ask which step uses certain words, say: Which step mentions shared project files? To ask which steps do not mention certain words, say: Which steps do not mention shared project files? To ask whether one step does not mention certain words, say: Does a deletion not mention shared project files? To ask whether one step mentions certain words, say: Does a deletion mention shared project files? To ask whether one step mentions the same words as one other step, say: Does a deletion mention the same words as a send? To ask whether one step does not mention the same words as one other step, say: Does a deletion not mention the same words as a send? To ask which steps mention the same words as one step, say: Which steps mention the same words as a deletion? To ask which steps do not mention the same words as one step, say: Which steps do not mention the same words as a deletion? To ask which steps name no words, say: Which steps name no words? To ask which steps name words, say: Which steps name words? To ask which steps share words, say: Which steps share words? To ask which words are shared, say: Which words are shared? To ask which words are not shared, say: Which words are not shared? To ask which steps do not share words, say: Which steps do not share words? To ask whether one step shares words, say: Does a deletion share words? To ask whether one step does not share words, say: Does a deletion not share words? To ask whether one step shares words with another, say: Does a deletion share words with a send? To ask whether one step does not share words with another, say: Does a deletion not share words with a send? To ask which steps share words with one step, say: Which steps share words with a deletion? To ask which steps do not share words with one step, say: Which steps do not share words with a deletion? To ask which words one step shares, say: Which words does a deletion share? To ask which words one step does not share, say: Which words does a deletion not share? To ask which words one step shares with one other step, say: Which words does a deletion share with a send? To ask which words one step does not share with one other step, say: Which words does a deletion not share with a send? To ask which words one step mentions, say: Which words does a deletion mention? To ask which words one step does not mention, say: Which words does a deletion not mention? To ask which words one step mentions with one other step, say: Which words does a deletion mention with a send? To ask which words one step does not mention with one other step, say: Which words does a deletion not mention with a send? To ask whether one step mentions the same words, say: Does a deletion mention the same words? To ask whether one step does not mention the same words, say: Does a deletion not mention the same words? To ask which steps mention the same words, say: Which steps mention the same words? To ask which steps do not mention the same words, say: Which steps do not mention the same words? To ask which words are not mentioned, say: Which words are not mentioned? To ask which words are mentioned, say: Which words are mentioned? To ask which words are mentioned once, say: Which words are mentioned once? To ask which words are mentioned more than once, say: Which words are mentioned more than once? To ask which words are mentioned only once, say: Which words are mentioned only once?",
    }),
  );
  const rules = el("div", { class: "rules", "data-testid": "handoff-rules" });
  for (const [action, label] of [
    ["send", "Send"],
    ["pay", "Pay"],
    ["delete", "Delete"],
    ["post", "Post"],
  ]) {
    const savedRule = state.handoffRules?.find((rule) => rule.action === action);
    const saved = Boolean(savedRule);
    const phrase = savedRule?.phrase;
    let title = `Save a handoff rule for ${action}. A later request that would do it is yours. This does not run the step.`;
    if (phrase) {
      title = `A request that would ${action} and mentions “${phrase}” is yours. Clearing this does not run it or approve a hold.`;
    } else if (saved) {
      title = `A request that would ${action} is yours. Clearing this does not run it or approve a hold.`;
    }
    rules.append(
      el("button", {
        type: "button",
        class: "rule",
        "data-testid": `rule-${action}`,
        "aria-pressed": saved ? "true" : "false",
        title,
        text: label,
        onclick: () => post("/api/handoff-rules", { action, enabled: !saved }),
      }),
    );
  }
  rail.append(rules);
  const phraseForm = el("form", { class: "rule-phrase", "data-testid": "rule-phrase-form" });
  const actionPick = el("select", {
    "data-testid": "rule-phrase-action",
    "aria-label": "Action to describe",
    name: "action",
  });
  for (const [value, label] of [
    ["send", "Send"],
    ["pay", "Pay"],
    ["delete", "Delete"],
    ["post", "Post"],
  ]) {
    actionPick.append(el("option", { value, text: label }));
  }
  actionPick.value = phraseAction;
  const phraseInput = el("input", {
    name: "phrase",
    type: "text",
    maxlength: "80",
    placeholder: "shared project files",
    "data-testid": "rule-phrase",
    "aria-label": "Words that narrow the step",
    autocomplete: "off",
  });
  const savedForAction = state.handoffRules?.find((rule) => rule.action === phraseAction);
  phraseInput.value = phraseDirty ? phraseDraft : savedForAction?.phrase || "";
  let loadedAction = actionPick.value;
  const showAction = () => {
    if (actionPick.value === loadedAction) return;
    loadedAction = actionPick.value;
    phraseAction = actionPick.value;
    phraseDirty = false;
    const rule = state.handoffRules?.find((item) => item.action === actionPick.value);
    phraseInput.value = rule?.phrase || "";
  };
  actionPick.addEventListener("input", showAction);
  actionPick.addEventListener("change", showAction);
  phraseInput.addEventListener("input", () => {
    phraseAction = actionPick.value;
    phraseDraft = phraseInput.value;
    phraseDirty = true;
  });
  phraseForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const words = phraseInput.value.trim().replace(/\s+/g, " ");
    if (words.length < 3) {
      error.hidden = false;
      error.textContent = "Name the words that narrow this step.";
      return;
    }
    post("/api/handoff-rules", { action: actionPick.value, enabled: true, phrase: words });
  });
  phraseForm.append(
    actionPick,
    phraseInput,
    el("button", {
      type: "submit",
      "data-testid": "rule-phrase-save",
      text: "Narrow",
      title: "Save these words on the chosen step. This does not run the step.",
    }),
  );
  rail.append(phraseForm);
  const whole = {
    send: "the whole send",
    pay: "the whole payment",
    delete: "the whole deletion",
    post: "the whole public post",
  };
  const noun = {
    send: "The send",
    pay: "The payment",
    delete: "The deletion",
    post: "The public post",
  };
  for (const action of ["send", "pay", "delete", "post"]) {
    const rule = state.handoffRules?.find((item) => item.action === action);
    if (!rule) continue;
    const phrase = rule.phrase;
    rail.append(
      el("p", {
        class: "rule-saved",
        "data-testid": phrase ? `rule-phrase-${action}` : `rule-whole-${action}`,
        text: phrase ? `${noun[action]} is only “${phrase}”.` : `${noun[action]} is ${whole[action]}.`,
      }),
    );
  }
  rail.append(
    el("button", {
      type: "button",
      class: "pause",
      "data-testid": "pause-wakes",
      "aria-pressed": state.paused ? "true" : "false",
      text: state.paused ? "Wakes paused" : "Pause wakes",
      title: state.paused
        ? "Scheduled wakes are off. Run still works. Pausing does not release a hold."
        : "Stop scheduled wakes. Pausing does not release a hold, and nothing is sent or spent.",
      onclick: () => post("/api/pause", { paused: !state.paused }),
    }),
  );
  const stopId = stopTarget();
  if (stopId) {
    rail.append(
      el("button", {
        type: "button",
        class: "stop-task",
        "data-testid": "stop-task",
        text: "Stop this task",
        title: "Clears the allowance on this goal only. The next step asks again. A sent email cannot be reversed. Nothing is sent or spent.",
        onclick: () => post("/api/turn", { text: "Stop this task", goalId: stopId }),
      }),
    );
  }
  rail.append(el("p", { class: "label", text: "Seats" }));

  for (const connector of state.connectors) {
    const status = statusOf(connector);
    const mark = connector.displayName.slice(0, 1);
    const button = el(
      "button",
      {
        type: "button",
        class: "agent",
        "data-testid": `agent-${connector.id}`,
        "aria-pressed": connector.enabled ? "true" : "false",
        onclick: () => post(`/api/connectors/${connector.id}`, { enabled: !connector.enabled }),
      },
      [
        el("span", { class: "mono", text: mark }),
        el("span", {}, [el("span", { class: "agent-name", text: connector.displayName })]),
        el("span", { class: status.className, text: status.label }),
      ],
    );
    rail.append(button);
    rail.append(
      el("button", {
        type: "button",
        class: "bridge-open",
        "data-testid": `bridge-open-${connector.id}`,
        text: openBridge === connector.id ? "Close bridge" : "Bridge",
        onclick: () => {
          openBridge = openBridge === connector.id ? null : connector.id;
          renderRail();
        },
      }),
    );
    if (connector.lastError) {
      rail.append(el("p", { class: "bridge-error", text: connector.lastError }));
    }
    if (openBridge === connector.id) {
      const url = el("input", {
        name: "url",
        type: "url",
        placeholder: bridgeHint(connector.bridgeUrl),
        title: connector.bridgeUrl || "Bridge URL",
        "aria-label": `${connector.displayName} bridge URL`,
      });
      const token = el("input", {
        name: "token",
        type: "password",
        autocomplete: "off",
        placeholder: connector.hasToken ? "Token saved" : "Token, optional",
        "data-testid": `token-${connector.id}`,
        "aria-label": `${connector.displayName} bridge token`,
      });
      const formBridge = el("form", { class: "bridge", "data-testid": `bridge-${connector.id}` }, [url, token]);
      const actions = el("div", { class: "bridge-actions" }, [
        el("button", { type: "submit", text: "Save bridge" }),
      ]);
      if (connector.bridgeUrl) {
        actions.append(
          el("button", {
            type: "button",
            "data-testid": `probe-${connector.id}`,
            text: "Check bridge",
            onclick: () => post(`/api/connectors/${connector.id}/probe`, {}),
          }),
        );
      }
      formBridge.append(actions);
      formBridge.addEventListener("submit", (event) => {
        event.preventDefault();
        const body = { bridgeUrl: url.value.trim() ? url.value.trim() : null };
        if (token.value) body.token = token.value;
        token.value = "";
        post(`/api/connectors/${connector.id}`, body);
      });
      rail.append(formBridge);
    }
  }

  rail.append(el("p", { class: "label", text: "Goals" }));
  rail.append(
    el("button", {
      type: "button",
      class: "all",
      "data-testid": "goal-all",
      "aria-pressed": selected ? "false" : "true",
      text: "New goal",
      onclick: () => {
        selected = null;
        renderContext();
        renderRail();
      },
    }),
  );
  for (const goal of state.goals) {
    rail.append(
      el(
        "button",
        {
          type: "button",
          class: "goal",
          "data-testid": `goal-${goal.id}`,
          "aria-current": selected === goal.id ? "true" : "false",
          onclick: () => {
            selected = goal.id;
            renderContext();
            renderRail();
          },
        },
        [el("span", { text: goal.title }), el("span", { class: "goal-status", text: goalWord(goal.status) })],
      ),
    );
  }

  if (state.skills?.length) {
    rail.append(el("p", { class: "label", text: "Skills" }));
    for (const skill of state.skills) {
      const armed = armedSkill === skill.id;
      rail.append(
        el(
          "button",
          {
            type: "button",
            class: "skill",
            "data-testid": `skill-${skill.id}`,
            "aria-pressed": armed ? "true" : "false",
            title: "Apply this method on the next turn. A skill does not wake, and it does not approve a hold.",
            onclick: () => {
              armedSkill = armed ? null : skill.id;
              renderRail();
            },
          },
          [el("span", { text: skill.name }), el("span", { class: "quiet", text: armed ? "Using" : "Use" })],
        ),
      );
    }
  }

  if (state.routines.length) {
    rail.append(el("p", { class: "label", text: "Routines" }));
    rail.append(
      el("p", {
        class: "rule-note",
        "data-testid": "schedule-hint",
        text: "Ask what is scheduled, when one routine wakes, what one routine does, or when one routine last ran. Asking does not run a routine. A completed run is not a delivery. Say run and the routine's name to run that one. Saying change and the routine's name quotes the stored instruction and the proposed words, and does not save the change. Saying save and the routine's name writes that instruction and does not run it. Saying wake, the routine's name, and daily, hourly, or manual sets that cadence and does not run it. Saying pause or resume and the routine's name pauses or resumes that one wake and does not change its cadence. Saying delete and the routine's name removes that one routine from the record and does not run it. The deletion cannot be undone from here. Saying wake with daily or hourly leaves that cadence unchanged when the next time would be less than five minutes from another routine. Saving a routine when 50 are already saved does not add another, and the reply says a bot can own up to 50 routines. A routine that has already run 200 times this hour does not run again, and the desk stops at 300 runs this hour. A run an hour old does not count. Asking what runs one routine has names up to the twenty newest stored times. The rail does not list those times. Asking why one routine has not run says whether it is paused, whether a new schedule is still waiting, or that the hour stopped it. It does not start a run. Asking where one routine delivers says there is no destination in the record. It does not store a place and it does not run the routine. Asking which routines are paused names each paused routine, in the order it was saved, and says a wake does not run it. A routine that is not paused is left out. It does not pause or resume one. Asking whether one routine is paused names that pause, or says it is not paused. A desk pause does not count. It does not pause or resume that one. Asking whether one routine is active names that it is active, or says it is not active and a wake does not run it. Active means that routine is not paused. A desk pause does not count. The row says Active when it is not paused, and Paused when it is. Asking whether one routine is enabled names that it is enabled, or says it is not enabled and a wake does not run it. Enabled means that routine is not paused. A desk pause does not count. Asking which routines are enabled names each routine that is not paused, in the order it was saved, and says it is enabled. A paused routine is left out. If none are enabled, it says no routine is enabled. A desk pause does not count as disabled. The row still says Active or Paused. Asking which routines are active names each routine that is not paused, in the order it was saved, and says it is active. A paused routine is left out. If none are active, it says no routine is active. A desk pause does not count as inactive. The row still says Active or Paused. Asking which routines are disabled names each routine that is paused, in the order it was saved, and says it is disabled. A routine that is not paused is left out. If none are disabled, it says no routine is disabled. A desk pause does not count as disabled. The row still says Active or Paused. Asking whether one routine is disabled names that it is disabled and a wake does not run it, or says it is not disabled. A desk pause does not count as that one routine being disabled. The row still says Active or Paused. Asking what time zone one routine is using says that routine has no time zone in the record. The next time stays the instant already stored. Asking does not set a zone and does not run the routine. A desk pause does not invent a zone. The row says No time zone. Asking which bot owns one routine says that routine has no owning bot in the record. Asking does not assign one and does not run the routine. A desk pause does not invent an owner. The row says No owning bot. Asking which plugins one routine needs says that routine has no required plugin in the record. Asking does not connect one and does not run the routine. A desk pause does not invent a plugin. The row says No required plugin. Asking whether one routine can reach its source says that routine has no source system in the record. Asking does not connect a computer and does not run the routine. A desk pause does not invent a source. The row says No source system. Asking whether usage is paused for one routine says that routine has no usage pause in the record. Asking does not pause account access and does not pause the routine. A desk pause does not count as a usage pause. The row says No usage pause. Asking whether one routine failed says that routine has no failure in the record. Asking does not start a test run. A stored run is not a failure. A desk pause does not invent a failure. The row says No failure. Asking which channel starts one routine says that routine has no source channel in the record. Asking does not connect a channel. A stored run is not a channel. A recorded failure is not a channel. A desk pause does not invent a channel. The row says No source channel. Asking which repository starts one routine says that routine has no source repository in the record. Asking does not confirm a repository. A stored run is not a repository. A recorded failure is not a repository. A source channel is not a repository. A desk pause does not invent a repository. The row says No source repository. Asking which matching rule starts one routine says that routine has no matching rule in the record. Asking does not confirm a matching rule. A stored run is not a matching rule. A recorded failure is not a matching rule. A source channel is not a matching rule. A source repository is not a matching rule. A desk pause does not invent a matching rule. The row says No matching rule. Asking which ask-first rule blocks one routine says that routine has no ask-first rule in the record. Asking does not save an ask-first rule. It does not turn on allow automatically. A stored run is not an ask-first rule. A recorded failure is not an ask-first rule. A source channel is not an ask-first rule. A source repository is not an ask-first rule. A matching rule is not an ask-first rule. A desk pause does not invent an ask-first rule. The row says No ask-first rule. Asking which allow-automatically rule covers one routine says that routine has no allow-automatically rule in the record. Asking does not turn one on. It does not save an ask-first rule. It does not turn on allow automatically. A stored run is not an allow-automatically rule. A recorded failure is not an allow-automatically rule. A source channel is not an allow-automatically rule. A source repository is not an allow-automatically rule. A matching rule is not an allow-automatically rule. An ask-first rule is not an allow-automatically rule. A desk pause does not invent an allow-automatically rule. The row says No allow-automatically rule. Asking which team rule blocks one routine says that routine has no team rule in the record. Asking does not lock a team rule. It does not save an ask-first rule. It does not turn on allow automatically. It does not turn on an allow-automatically rule. A stored run is not a team rule. A recorded failure is not a team rule. A source channel is not a team rule. A source repository is not a team rule. A matching rule is not a team rule. An ask-first rule is not a team rule. An allow-automatically rule is not a team rule. A desk pause does not invent a team rule. The row says No team rule. Asking whether the team rule for one routine is locked says that routine has no locked team rule in the record. Asking does not lock a team rule. It does not edit a team rule. It does not delete a team rule. A stored run is not a locked team rule. A recorded failure is not a locked team rule. A source channel is not a locked team rule. A source repository is not a locked team rule. A matching rule is not a locked team rule. An ask-first rule is not a locked team rule. An allow-automatically rule is not a locked team rule. A team rule is not a locked team rule. A desk pause does not invent a locked team rule. The row says No locked team rule. Asking whether the team rule for one routine can be edited says that routine has no team rule to edit in the record. Asking does not edit a team rule. It does not delete a team rule. It does not lock a team rule. A stored run is not a team rule to edit. A recorded failure is not a team rule to edit. A source channel is not a team rule to edit. A source repository is not a team rule to edit. A matching rule is not a team rule to edit. An ask-first rule is not a team rule to edit. An allow-automatically rule is not a team rule to edit. A team rule is not a team rule to edit. A locked team rule is not a team rule to edit. A desk pause does not invent a team rule to edit. The row says No team rule to edit. Asking whether the team rule for one routine can be deleted says that routine has no team rule to delete in the record. Asking does not delete a team rule. It does not edit a team rule. It does not lock a team rule. A stored run is not a team rule to delete. A recorded failure is not a team rule to delete. A source channel is not a team rule to delete. A source repository is not a team rule to delete. A matching rule is not a team rule to delete. An ask-first rule is not a team rule to delete. An allow-automatically rule is not a team rule to delete. A team rule is not a team rule to delete. A locked team rule is not a team rule to delete. A team rule to edit is not a team rule to delete. A desk pause does not invent a team rule to delete. The row says No team rule to delete.",
      }),
    );
    for (const routine of state.routines) {
      const cadence = routine.cadence === "daily" || routine.cadence === "hourly" ? routine.cadence : "manual";
      const label = cadence === "daily" ? "Daily" : cadence === "hourly" ? "Hourly" : "Manual";
      const next = cadence === "manual" ? "daily" : cadence === "daily" ? "hourly" : "manual";
      rail.append(
        el("div", { class: "routine-row" }, [
          el(
            "button",
            {
              type: "button",
              class: "routine",
              "data-testid": `run-routine-${routine.id}`,
              onclick: () => post(`/api/routines/${routine.id}/run`, {}),
            },
            [el("span", { text: routine.name }), el("span", { class: "quiet", text: "Run" })],
          ),
          el("button", {
            type: "button",
            class: "cadence",
            "data-testid": `cadence-${routine.id}`,
            "aria-label": `${routine.name} wakes ${label}. Change when it wakes.`,
            title: routine.nextRunAt ? `Next wake ${routine.nextRunAt}` : "Wakes only when you run it",
            text: label,
            onclick: () => post(`/api/routines/${routine.id}`, { cadence: next }),
          }),
        ]),
      );
      if (routine.paused === true) {
        rail.append(
          el("p", {
            class: "rule-note",
            "data-testid": `routine-paused-${routine.id}`,
            text: "Paused",
          }),
        );
      } else {
        rail.append(
          el("p", {
            class: "rule-note active",
            "data-testid": `routine-active-${routine.id}`,
            text: "Active",
          }),
        );
      }
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `instruction-${routine.id}`,
          text: routine.instruction.trim() ? routine.instruction.trim() : "No instruction",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `last-run-${routine.id}`,
          text: routine.lastRunAt ? `Last ran ${routine.lastRunAt}` : "Has not run",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `delivery-${routine.id}`,
          title: "A last run does not confirm the result.",
          text: "No delivery",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `destination-${routine.id}`,
          title: "Where results go is not stored.",
          text: "No destination",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `zone-${routine.id}`,
          title: "A time zone is not stored. The next time stays the instant already stored.",
          text: "No time zone",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `owner-${routine.id}`,
          title: "An owning bot is not stored. Asking does not assign one.",
          text: "No owning bot",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `plugin-${routine.id}`,
          title: "A required plugin is not stored. Asking does not connect one.",
          text: "No required plugin",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `source-${routine.id}`,
          title: "A source system is not stored. Asking does not connect a computer.",
          text: "No source system",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `usage-${routine.id}`,
          title: "A usage pause is not stored. Asking does not pause account access.",
          text: "No usage pause",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `failure-${routine.id}`,
          title: "A failure is not stored. A stored run is not a failure. Asking does not start a test run.",
          text: "No failure",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `channel-${routine.id}`,
          title: "A source channel is not stored. Asking does not connect a channel.",
          text: "No source channel",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `repository-${routine.id}`,
          title: "A source repository is not stored. Asking does not confirm a repository.",
          text: "No source repository",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `matching-${routine.id}`,
          title: "A matching rule is not stored. Asking does not confirm a matching rule.",
          text: "No matching rule",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `ask-first-${routine.id}`,
          title: "An ask-first rule is not stored. Asking does not save an ask-first rule.",
          text: "No ask-first rule",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `allow-automatically-${routine.id}`,
          title: "An allow-automatically rule is not stored. Asking does not turn one on.",
          text: "No allow-automatically rule",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `team-rule-${routine.id}`,
          title: "A team rule is not stored. Asking does not lock a team rule.",
          text: "No team rule",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `locked-team-rule-${routine.id}`,
          title: "A locked team rule is not stored. Asking does not lock, edit, or delete one.",
          text: "No locked team rule",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `editable-team-rule-${routine.id}`,
          title: "A team rule to edit is not stored. Asking does not edit, delete, or lock one.",
          text: "No team rule to edit",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `deletable-team-rule-${routine.id}`,
          title: "A team rule to delete is not stored. Asking does not delete, edit, or lock one.",
          text: "No team rule to delete",
        }),
      );
      const heldBack = heldBackLine(routine.heldBack);
      if (heldBack) {
        rail.append(
          el("p", {
            class: "rule-note",
            "data-testid": `held-back-${routine.id}`,
            text: heldBack,
          }),
        );
      }
    }
  }

  rail.append(el("p", { class: "trust", "data-testid": "trust", text: state.trust }));
  const atlas = el("a", { class: "atlas-link", href: "/atlas", text: `${state.atlas.count.toLocaleString()} stories` });
  rail.append(atlas);
  renderContext();
}

const EXPIRED_COPY =
  "This hold expired. The action did not run. Ask Oriel to try again. The next hold still asks.";

function shownStatus(approval) {
  if (approval.status === "open" && approval.expiresAt && Date.parse(approval.expiresAt) <= Date.now()) return "expired";
  return approval.status;
}

function heldBackLine(kinds) {
  if (!Array.isArray(kinds) || !kinds.length) return "";
  const names = {
    send: "the send",
    pay: "the payment",
    delete: "the deletion",
    post: "the public post",
    credential: "the credential use",
  };
  const list = kinds.map((kind) => names[kind]).filter(Boolean);
  if (!list.length) return "";
  const phrase = list.length === 1 ? list[0] : `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`;
  const verb = list.length === 1 ? "stays" : "stay";
  return `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)} ${verb} held back until you send a message.`;
}

function renderHold(approval, ids) {
  const status = shownStatus(approval);
  const heading =
    status === "approved" ? "Released" : status === "denied" ? "Held back" : status === "expired" ? "Expired" : "Hold for you";
  const card = el(
    "section",
    { class: status === "expired" ? "hold expired" : "hold", "data-testid": ids.card },
    [
      el("h2", { text: heading }),
      el("p", { class: "detail", text: approval.title }),
      el("p", { class: "detail", text: approval.detail }),
    ],
  );
  if (status === "open") {
    if (approval.expiresAt) {
      card.append(
        el("p", {
          class: "detail",
          "data-testid": "hold-expiry",
          text: "Raised while you were away. If it expires, the action does not run. The next hold still asks.",
        }),
      );
    }
    const actions = el("div", { class: "actions" });
    actions.append(
      el("button", {
        type: "button",
        class: "approve",
        "data-testid": ids.approve,
        text: "Approve",
        onclick: () => post(`/api/approvals/${approval.id}`, { decision: "approve" }),
      }),
    );
    actions.append(
      el("button", {
        type: "button",
        class: "ghost task",
        "data-testid": ids.task,
        text: "Allow for this task",
        onclick: () => post(`/api/approvals/${approval.id}`, { decision: "task" }),
      }),
    );
    actions.append(
      el("button", {
        type: "button",
        class: "ghost",
        "data-testid": ids.deny,
        text: "Not now",
        onclick: () => post(`/api/approvals/${approval.id}`, { decision: "deny" }),
      }),
    );
    card.append(actions);
  } else if (status === "expired") {
    card.append(el("p", { class: "detail", "data-testid": "expired", text: approval.resolution || EXPIRED_COPY }));
    const goal = state.goals.find((item) => item.id === approval.goalId);
    if (goal) {
      card.append(
        el("div", { class: "actions" }, [
          el("button", {
            type: "button",
            class: "ghost",
            "data-testid": "try-again",
            text: "Ask again",
            onclick: () => post("/api/turn", { text: goal.text, goalId: goal.id }),
          }),
        ]),
      );
    }
  } else if (approval.resolution) {
    card.append(el("p", { class: "detail", text: approval.resolution }));
  }
  return card;
}

function renderHandoff(handoff, ids) {
  const heading = handoff.status === "done" ? "You did this" : handoff.status === "left" ? "Left with you" : "Hand off to you";
  const card = el("section", { class: "handoff", "data-testid": ids.card }, [
    el("h2", { text: heading }),
    el("p", { class: "detail", text: handoff.title }),
    el("p", { class: "detail", text: handoff.detail }),
  ]);
  if (handoff.status === "open") {
    const actions = el("div", { class: "actions" });
    actions.append(
      el("button", {
        type: "button",
        class: "approve",
        "data-testid": ids.done,
        text: "I did this",
        onclick: () => post(`/api/handoffs/${handoff.id}`, { decision: "done" }),
      }),
    );
    actions.append(
      el("button", {
        type: "button",
        class: "ghost",
        "data-testid": ids.leave,
        text: "Leave it",
        onclick: () => post(`/api/handoffs/${handoff.id}`, { decision: "leave" }),
      }),
    );
    card.append(actions);
  } else if (handoff.resolution) {
    card.append(el("p", { class: "detail", text: handoff.resolution }));
  }
  return card;
}

function latestSynthesisId() {
  let id = null;
  for (const message of state.messages) {
    if (message.role === "oriel" && typeof message.tight === "boolean") id = message.id;
  }
  return id;
}

function synthesisGoalId() {
  let id = "";
  for (const message of state.messages) {
    if (message.role === "oriel" && typeof message.tight === "boolean" && message.goalId) id = message.goalId;
  }
  return id;
}

function renderThread() {
  const column = el("div", { class: "column" });
  if (state.away) {
    const away = el("section", { class: "away", "data-testid": "away-card" }, [
      el("h2", { text: state.away.title }),
    ]);
    const list = el("ul", { class: "why" });
    for (const line of state.away.lines) list.append(el("li", { text: line }));
    away.append(list);
    away.append(
      el("button", {
        type: "button",
        class: "ghost",
        "data-testid": "review-watches",
        text: "Check what's open",
        onclick: () => post("/api/watches", {}),
      }),
    );
    const current = synthesisGoalId();
    for (const approval of state.approvals) {
      if (approval.goalId === current) continue;
      const status = shownStatus(approval);
      if (status !== "open" && status !== "expired") continue;
      away.append(
        renderHold(approval, {
          card: "away-hold",
          approve: `away-approve-${approval.id}`,
          task: `away-task-${approval.id}`,
          deny: `away-deny-${approval.id}`,
        }),
      );
    }
    for (const handoff of state.handoffs || []) {
      if (handoff.goalId === current || handoff.status !== "open") continue;
      away.append(
        renderHandoff(handoff, {
          card: "away-handoff",
          done: `away-did-${handoff.id}`,
          leave: `away-leave-${handoff.id}`,
        }),
      );
    }
    column.append(away);
  }
  if (!state.messages.length) {
    const empty = el("section", { class: "empty" }, [
      el("h1", { text: "Tell Oriel what to finish." }),
      el("p", {
        class: "lede",
        text: "Grok Bot, Dots, and Muse stay who they are. Oriel convenes them, holds anything risky, and answers in one voice.",
      }),
    ]);
    const prompts = el("div", { class: "prompts" });
    for (const prompt of PROMPTS) {
      prompts.append(
        el("button", {
          type: "button",
          "data-testid": prompt.id,
          text: prompt.label,
          onclick: () => {
            input.value = prompt.text;
            grow();
            send.disabled = false;
            input.focus();
          },
        }),
      );
    }
    empty.append(prompts);
    column.append(empty);
  }

  const synthesisId = latestSynthesisId();
  for (const message of state.messages) {
    const woken = message.via === "wake";
    const article = el("article", {
      class: `turn ${woken ? "wake" : message.role}`,
      "data-goal-id": message.goalId || "",
    });
    article.append(el("p", { class: "who", text: woken ? "Routine" : message.role === "you" ? "You" : "Oriel" }));
    const body = el("p", {
      class: message.role === "oriel" ? "voice" : "body",
      text: message.text,
    });
    if (message.id === synthesisId) body.setAttribute("data-testid", "synthesis");
    article.append(body);
    if (message.id === synthesisId && message.goalId) {
      const goal = state.goals.find((item) => item.id === message.goalId);
      if (goal) article.append(renderBrief(goal));
    }
    column.append(article);
  }
  thread.replaceChildren(column);
}

function renderBrief(goal) {
  const brief = goal.brief;
  const details = el("details", { class: "card", "data-testid": "brief-rest" });
  if (!brief.tight) details.open = true;
  details.append(el("summary", { text: "The working brief" }));
  const why = el("ul", { class: "why", "data-testid": "why" });
  for (const line of brief.why) why.append(el("li", { text: line }));
  details.append(why);
  const plan = el("ol", { class: "plan" });
  for (const step of goal.plan) {
    const attrs = { text: `${step.title} — ${step.status}` };
    if (step.title === "Keep the note as a draft") attrs["data-testid"] = "draft-note";
    if (step.title === "Note the forward") attrs["data-testid"] = "forward-note";
    if (step.title === "Covered for this goal" && step.kind) attrs["data-testid"] = `task-cover-${step.kind}`;
    plan.append(el("li", attrs));
  }
  details.append(plan);
  const reads = el("div", { class: "reads" });
  for (const note of brief.seatReads) {
    const names = { grok: "Grok Bot", dots: "Dots", muse: "Muse" };
    const read = el("article", { class: "read", "data-testid": `seat-note-${note.seat}` }, [
      el("h3", { text: `${names[note.seat] || note.seat} · ${note.mode}` }),
      el("p", { text: note.summary }),
    ]);
    if (note.stance) read.append(el("p", { text: note.stance }));
    for (const point of note.points || []) read.append(el("p", { text: point }));
    reads.append(read);
  }
  details.append(reads);
  if (brief.dissent) details.append(el("p", { class: "dissent", "data-testid": "dissent", text: brief.dissent }));
  const record = state.events.filter((event) => event.goalId === goal.id).slice(-6);
  if (record.length) {
    const list = el("ul", { class: "record" });
    for (const event of record) list.append(el("li", { text: `${event.type}: ${event.detail}` }));
    details.append(list);
  }
  details.append(
    el("div", { class: "skill-actions" }, [
      el("button", {
        type: "button",
        class: "textish",
        "data-testid": "save-routine",
        text: "Save as routine",
        onclick: () => post("/api/routines", { goalId: goal.id }),
      }),
      el("button", {
        type: "button",
        class: "textish",
        "data-testid": "save-skill",
        text: "Save as skill",
        onclick: () => post("/api/skills", { goalId: goal.id }),
      }),
    ]),
  );

  const wrap = el("div");
  const approvals = state.approvals.filter((approval) => approval.goalId === goal.id);
  for (const approval of approvals) {
    wrap.append(renderHold(approval, { card: "approval", approve: "approve", task: "allow-task", deny: "deny" }));
  }
  for (const handoff of (state.handoffs || []).filter((item) => item.goalId === goal.id)) {
    wrap.append(renderHandoff(handoff, { card: "handoff", done: "did-this", leave: "leave-step" }));
  }
  wrap.append(details);
  return wrap;
}

function render() {
  if (!state) return;
  renderRail();
  renderThread();
}

function grow() {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = input.value;
  const trimmed = text.trim();
  if (!trimmed || busy) return;
  const body = { text: trimmed };
  if (selected) body.goalId = selected;
  if (armedSkill) body.skillId = armedSkill;
  input.value = "";
  grow();
  const ok = await post("/api/turn", body);
  if (!ok) {
    input.value = text;
    grow();
    send.disabled = false;
  }
});

input.addEventListener("input", () => {
  grow();
  send.disabled = input.value.trim().length === 0 || busy;
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

document.addEventListener("keydown", (event) => {
  const tag = document.activeElement?.tagName;
  if (event.key === "/" && tag !== "TEXTAREA" && tag !== "INPUT") {
    event.preventDefault();
    input.focus();
  }
});

send.disabled = true;

api("/api/state")
  .then((next) => {
    state = next;
    render();
  })
  .catch(fail);

setInterval(() => {
  if (!state) return;
  const due = state.approvals.some((approval) => approval.status === "open" && shownStatus(approval) === "expired");
  if (due) render();
}, 15000);
