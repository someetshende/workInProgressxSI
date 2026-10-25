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
        text: "Ask what is scheduled, when one routine wakes, what one routine does, or when one routine last ran. Asking does not run a routine. A completed run is not a delivery. Say run and the routine's name to run that one. Saying change and the routine's name quotes the stored instruction and the proposed words, and does not save the change. Saying save and the routine's name writes that instruction and does not run it. Saying wake, the routine's name, and daily, hourly, or manual sets that cadence and does not run it. Saying pause or resume and the routine's name pauses or resumes that one wake and does not change its cadence. Saying delete and the routine's name removes that one routine from the record and does not run it. The deletion cannot be undone from here. Saying wake with daily or hourly leaves that cadence unchanged when the next time would be less than five minutes from another routine. Saving a routine when 50 are already saved does not add another, and the reply says a bot can own up to 50 routines. A routine that has already run 200 times this hour does not run again, and the desk stops at 300 runs this hour. A run an hour old does not count. Asking what runs one routine has names up to the twenty newest stored times. The rail does not list those times. Asking why one routine has not run says whether it is paused, whether a new schedule is still waiting, or that the hour stopped it. It does not start a run. Asking where one routine delivers says there is no destination in the record. It does not store a place and it does not run the routine. Asking which routines are paused names each paused routine, in the order it was saved, and says a wake does not run it. A routine that is not paused is left out. It does not pause or resume one. Asking whether one routine is paused names that pause, or says it is not paused. A desk pause does not count. It does not pause or resume that one. Asking whether one routine is active names that it is active, or says it is not active and a wake does not run it. Active means that routine is not paused. A desk pause does not count. The row says Active when it is not paused, and Paused when it is. Asking whether one routine is enabled names that it is enabled, or says it is not enabled and a wake does not run it. Enabled means that routine is not paused. A desk pause does not count. Asking which routines are enabled names each routine that is not paused, in the order it was saved, and says it is enabled. A paused routine is left out. If none are enabled, it says no routine is enabled. A desk pause does not count as disabled. The row still says Active or Paused. Asking which routines are active names each routine that is not paused, in the order it was saved, and says it is active. A paused routine is left out. If none are active, it says no routine is active. A desk pause does not count as inactive. The row still says Active or Paused. Asking which routines are disabled names each routine that is paused, in the order it was saved, and says it is disabled. A routine that is not paused is left out. If none are disabled, it says no routine is disabled. A desk pause does not count as disabled. The row still says Active or Paused. Asking whether one routine is disabled names that it is disabled and a wake does not run it, or says it is not disabled. A desk pause does not count as that one routine being disabled. The row still says Active or Paused. Asking what time zone one routine is using says that routine has no time zone in the record. The next time stays the instant already stored. Asking does not set a zone and does not run the routine. A desk pause does not invent a zone. The row says No time zone. Asking which bot owns one routine says that routine has no owning bot in the record. Asking does not assign one and does not run the routine. A desk pause does not invent an owner. The row says No owning bot. Asking which plugins one routine needs says that routine has no required plugin in the record. Asking does not connect one and does not run the routine. A desk pause does not invent a plugin. The row says No required plugin. Asking whether one routine can reach its source says that routine has no source system in the record. Asking does not connect a computer and does not run the routine. A desk pause does not invent a source. The row says No source system. Asking whether usage has been paused for one routine says that routine has no usage pause in the record. Asking does not pause account access and does not run the routine. A desk pause does not invent a usage pause. The row says No usage pause. Asking what failure one routine shows says that routine has no failure in the record. Asking does not start a test run and does not run the routine. A stored run is not a failure. A desk pause does not invent a failure. A usage pause is not a failure. The row says No failure. Asking which channel starts one routine says that routine has no source channel in the record. Asking does not connect a channel and does not start a test run. A stored run is not a channel. A desk pause does not invent a channel. A failure is not a channel. A usage pause is not a channel. The row says No source channel. Asking which repository starts one routine says that routine has no source repository in the record. Asking does not confirm a repository and does not confirm a matching rule. It does not connect a channel. A stored run is not a repository. A desk pause does not invent a repository. A failure is not a repository. A usage pause is not a repository. A source channel is not a repository. The row says No source repository. Asking which matching rule starts one routine says that routine has no matching rule in the record. Asking does not confirm a matching rule and does not confirm a repository. It does not connect a channel. A stored run is not a matching rule. A desk pause does not invent a matching rule. A failure is not a matching rule. A usage pause is not a matching rule. A source channel is not a matching rule. A source repository is not a matching rule. The row says No matching rule. Asking which ask-first rule blocks one routine says that routine has no ask-first rule in the record. Asking does not save an ask-first rule and does not turn on allow automatically. It does not confirm a matching rule. A stored run is not an ask-first rule. A desk pause does not invent an ask-first rule. A failure is not an ask-first rule. A usage pause is not an ask-first rule. A source channel is not an ask-first rule. A source repository is not an ask-first rule. A matching rule is not an ask-first rule. The row says No ask-first rule. Asking which allow-automatically rule covers one routine says that routine has no allow-automatically rule in the record. Asking does not turn one on and does not save an ask-first rule. It does not turn on allow automatically. A stored run is not an allow-automatically rule. An ask-first rule is not an allow-automatically rule. A matching rule is not an allow-automatically rule. The row says No allow-automatically rule. Asking which team rule blocks one routine says that routine has no team rule in the record. Asking does not lock a team rule and does not turn on an allow-automatically rule. It does not save an ask-first rule. A stored run is not a team rule. An allow-automatically rule is not a team rule. An ask-first rule is not a team rule. The row says No team rule. Asking whether the team rule for one routine is locked says that routine has no locked team rule in the record. Asking does not lock a team rule and does not edit a team rule. It does not delete a team rule. A stored run is not a locked team rule. A team rule is not a locked team rule. An allow-automatically rule is not a locked team rule. The row says No locked team rule. Asking whether local computer work is refused for one routine says that routine has no local-computer refusal in the record. Asking does not turn local access on and does not connect a computer. It does not connect a plugin. A stored run is not a local-computer refusal. A source system is not a local-computer refusal. A locked team rule is not a local-computer refusal. The row says No local-computer refusal. Asking whether cloud computer work is refused for one routine says that routine has no cloud-computer refusal in the record. Asking does not turn cloud access on and does not turn local access on. It does not connect a computer. A stored run is not a cloud-computer refusal. A local-computer refusal is not a cloud-computer refusal. A source system is not a cloud-computer refusal. The row says No cloud-computer refusal. Asking whether one routine can reach its computer says that routine has no reachable computer in the record. Asking does not recover a computer and does not update the computer. It does not reset the computer. A stored run is not a reachable computer. A cloud-computer refusal is not a reachable computer. A source system is not a reachable computer. The row says No reachable computer. Asking whether one routine is stuck says that routine has no stuck state in the record. Asking does not open the computer and does not send a redirect. It does not stop the routine. A stored run is not a stuck state. A reachable computer is not a stuck state. A cloud-computer refusal is not a stuck state. The row says No stuck state. Asking whether one routine is waiting on a login says that routine has no login wait in the record. Asking does not take over the computer. It does not type a password. It does not paste a code. A stored run is not a login wait. A stuck state is not a login wait. A reachable computer is not a login wait. The row says No login wait. Asking whether the plugin for one routine is authenticated says that routine has no plugin authentication in the record. Asking does not authenticate a plugin. It does not install a plugin. It does not reconnect a plugin. A stored run is not a plugin authentication. A login wait is not a plugin authentication. A required plugin is not a plugin authentication. The row says No plugin authentication. Asking whether one routine can read its attachment says that routine has no readable attachment in the record. Asking does not read an attachment. It does not remove document protection. It does not export a file. A stored run is not a readable attachment. A plugin authentication is not a readable attachment. A required plugin is not a readable attachment. The row says No readable attachment. Asking whether the approval for one routine is blocked says that routine has no blocked approval in the record. Asking does not reject an approval. It does not cancel an approval. It does not send a replacement instruction. A stored run is not a blocked approval. A readable attachment is not a blocked approval. A plugin authentication is not a blocked approval. The row says No blocked approval. Asking whether the computer for one routine is still setting up says that routine has no computer setup in the record. Asking does not restart the app. It does not check for an app update. It does not update the computer. A stored run is not a computer setup. A blocked approval is not a computer setup. A readable attachment is not a computer setup. The row says No computer setup. Asking whether an app update is waiting for one routine says that routine has no app update in the record. Asking does not check for an app update. It does not restart the app. It does not restart to update. A stored run is not an app update. A computer setup is not an app update. A blocked approval is not an app update. The row says No app update. Asking whether sign-in is still open for one routine says that routine has no open sign-in in the record. Asking does not finish the sign-in. It does not choose Sign in. It does not return to the app. A stored run is not an open sign-in. An app update is not an open sign-in. A login wait is not an open sign-in. The row says No open sign-in. Asking whether @bot is quiet for one routine says that routine has no quiet bot in the record. Asking does not post on X. It does not tag @bot. It does not tag @grok. A stored run is not a quiet bot. An open sign-in is not a quiet bot. An app update is not a quiet bot. A login wait is not a quiet bot. The row says No quiet bot. Asking whether a support note is ready for one routine says that routine has no support note in the record. Asking does not contact support. It does not send a version. It does not send an operating system. A stored run is not a support note. A quiet bot is not a support note. An open sign-in is not a support note. An app update is not a support note. The row says No support note. Asking whether a retry changed the result for one routine says that routine has no retry result in the record. Asking does not retry. It does not restart the app. It does not update the computer. It does not contact support. A stored run is not a retry result. A support note is not a retry result. A quiet bot is not a retry result. An app update is not a retry result. A computer setup is not a retry result. The row says No retry result. Asking whether the app is disconnected for one routine says that routine has no disconnected app in the record. Asking does not disconnect the app. It does not retry. It does not restart the app. It does not update the computer. It does not contact support. A stored run is not a disconnected app. A retry result is not a disconnected app. A support note is not a disconnected app. An app update is not a disconnected app. A computer setup is not a disconnected app. The row says No disconnected app. Asking whether one routine started with the least destructive step says that routine has no least-destructive step in the record. Asking does not take a destructive step. It does not disconnect the app. It does not retry. It does not restart the app. It does not update the computer. It does not contact support. A stored run is not a least-destructive step. A disconnected app is not a least-destructive step. A retry result is not a least-destructive step. A support note is not a least-destructive step. The row says No least-destructive step. Asking whether a computer-use task is already active for one routine says that routine has no active screen task in the record. Asking does not redirect the screen. It does not start another screen task. It does not finish the current screen task. It does not send a redirect. It does not open the computer. It does not stop the routine. It does not take a destructive step. A stored run is not an active screen task. A least-destructive step is not an active screen task. A stuck state is not an active screen task. A disconnected app is not an active screen task. The row says No active screen task. Asking whether recovery should wait until one routine finishes computer work says that routine has no finish-before-rebuild in the record. Asking does not rebuild the computer. It does not recover a computer. It does not reset the computer. It does not redirect the screen. It does not open the computer. It does not take a destructive step. A stored run is not a finish-before-rebuild. An active screen task is not a finish-before-rebuild. A least-destructive step is not a finish-before-rebuild. A stuck state is not a finish-before-rebuild. The row says No finish-before-rebuild. Asking whether conversations for one routine survive a reset says that routine has no kept conversation in the record. Asking leaves the saved chat in place. It does not reset the computer. It does not rebuild the computer. It does not recover a computer. It does not redirect the screen. It does not open the computer. It does not take a destructive step. A stored run is not a kept conversation. A finish-before-rebuild is not a kept conversation. An active screen task is not a kept conversation. A least-destructive step is not a kept conversation. The row says No kept conversation. Asking whether the computer image for one routine keeps logins says that routine has no kept-file in the record. Asking leaves the saved files in place. It does not update the computer. It does not remove an installed app. It does not remove a package. It does not move the saved chat. It does not rebuild the computer. It does not recover a computer. It does not reset the computer. It does not redirect the screen. It does not open the computer. It does not take a destructive step. A stored run is not a kept-file. A kept conversation is not a kept-file. A finish-before-rebuild is not a kept-file. An active screen task is not a kept-file. The row says No kept-file. Asking whether a software update for one routine keeps installed apps says that routine has no software refresh in the record. Asking does not refresh the software. It does not install an app. It does not update the computer. It does not remove an installed app. It does not remove a package. It does not move the saved files. It does not move the saved chat. It does not rebuild the computer. It does not recover a computer. It does not reset the computer. It does not redirect the screen. It does not open the computer. It does not take a destructive step. A stored run is not a software refresh. A kept-file is not a software refresh. A kept conversation is not a software refresh. A finish-before-rebuild is not a software refresh. The row says No software refresh. Asking whether a normal recovery for one routine replaces uncommitted state says that routine has no scratch folder in the record. Asking does not delete a temporary directory. It does not recover a computer. It does not refresh the software. It does not install an app. It does not update the computer. It does not remove an installed app. It does not remove a package. It does not move the saved files. It does not move the saved chat. It does not rebuild the computer. It does not reset the computer. It does not redirect the screen. It does not open the computer. It does not take a destructive step. A stored run is not a scratch folder. A software refresh is not a scratch folder. A kept-file is not a scratch folder. A kept conversation is not a scratch folder. A finish-before-rebuild is not a scratch folder. The row says No scratch folder. Asking whether a screen for one routine is a separate security boundary says that routine has no work surface in the record. Asking does not merge the screens. It does not change a security boundary. It does not delete a temporary directory. It does not recover a computer. It does not refresh the software. It does not install an app. It does not update the computer. It does not remove an installed app. It does not remove a package. It does not move the saved files. It does not move the saved chat. It does not rebuild the computer. It does not reset the computer. It does not redirect the screen. It does not open the computer. It does not take a destructive step. A stored run is not a work surface. A scratch folder is not a work surface. A software refresh is not a work surface. A kept-file is not a work surface. A kept conversation is not a work surface. A finish-before-rebuild is not a work surface. The row says No work surface. Asking whether isolation between users is strict for one routine says that routine has no private host in the record. Asking does not share one computer across users. It does not merge the screens. It does not change a security boundary. It does not delete a temporary directory. It does not recover a computer. It does not refresh the software. It does not install an app. It does not update the computer. It does not remove an installed app. It does not remove a package. It does not move the saved files. It does not move the saved chat. It does not rebuild the computer. It does not reset the computer. It does not redirect the screen. It does not open the computer. It does not take a destructive step. A stored run is not a private host. A work surface is not a private host. A scratch folder is not a private host. A software refresh is not a private host. A kept-file is not a private host. A kept conversation is not a private host. A finish-before-rebuild is not a private host. The row says No private host. Asking whether one routine keeps its own kernel says that routine has no guest slice in the record. Asking does not boot a microVM. It does not share one computer across users. It does not merge the screens. It does not change a security boundary. It does not delete a temporary directory. It does not recover a computer. It does not refresh the software. It does not install an app. It does not update the computer. It does not remove an installed app. It does not remove a package. It does not move the saved files. It does not move the saved chat. It does not rebuild the computer. It does not reset the computer. It does not redirect the screen. It does not open the computer. It does not take a destructive step. A stored run is not a guest slice. A private host is not a guest slice. A work surface is not a guest slice. A scratch folder is not a guest slice. A software refresh is not a guest slice. A kept-file is not a guest slice. A kept conversation is not a guest slice. A finish-before-rebuild is not a guest slice. The row says No guest slice. Asking whether one routine isolates workspaces, not compute says that routine has no persona ledger in the record. Asking does not merge personalities. It does not split compute. It does not boot a microVM. It does not share one computer across users. It does not merge the screens. It does not change a security boundary. It does not delete a temporary directory. It does not recover a computer. It does not refresh the software. It does not install an app. It does not update the computer. It does not remove an installed app. It does not remove a package. It does not move the saved files. It does not move the saved chat. It does not rebuild the computer. It does not reset the computer. It does not redirect the screen. It does not open the computer. It does not take a destructive step. A stored run is not a persona ledger. A guest slice is not a persona ledger. A private host is not a persona ledger. A work surface is not a persona ledger. A scratch folder is not a persona ledger. The row says No persona ledger. Asking whether a login or file for one routine is available to every bot says that routine has no common tray in the record. Asking does not sign the browser out. It does not share a login across bots. It does not remove a temporary file. It does not merge personalities. It does not split compute. It does not boot a microVM. A stored run is not a common tray. A persona ledger is not a common tray. A guest slice is not a common tray. The row says No common tray. Asking whether one routine needs its own Cursor user for a separate computer and credential set says that routine has no solo roster in the record. Asking does not give a workload its own user. It does not create a Cursor user. It does not sign the browser out. It does not share a login across bots. It does not remove a temporary file. It does not merge personalities. A stored run is not a solo roster. A common tray is not a solo roster. A persona ledger is not a solo roster. The row says No solo roster. Asking whether one routine shares a cloud-hosted bot with everyone on the team says that routine has no team bench in the record. Asking does not share a team bot. It does not invite a member. It does not open someone else's chat. It does not give a workload its own user. A stored run is not a team bench. A solo roster is not a team bench. A common tray is not a team bench. The row says No team bench. Asking whether one routine uses one computer of its own in Slack channels, threads, group DMs, and group chats says that routine has no group computer in the record. Asking does not give the group its own computer. It does not assign a channel computer. It does not lend the group a machine. It does not share a team bot. A stored run is not a group computer. A team bench is not a group computer. A solo roster is not a group computer. The row says No group computer. Asking whether one routine works on that member's computer in that member's own chat or Slack DM says that routine has no direct desk in the record. Asking does not put the work on that member's computer. It does not borrow that member's computer. It does not seat the work on that member's machine. It does not give the group its own computer. A stored run is not a direct desk. A group computer is not a direct desk. A team bench is not a direct desk. The row says No direct desk. Asking whether one routine uses that member's connected accounts after asking and that member's Grok Bot usage says that routine has no asked meter in the record. Asking does not use that member's connected accounts. It does not use that member's Grok Bot usage. It does not bill that member's quota. It does not put the work on that member's computer. A stored run is not an asked meter. A direct desk is not an asked meter. A group computer is not an asked meter. The row says No asked meter. Asking whether one routine makes secrets, apps, and files the owner or a Manager adds to a Team Bot available in every teammate's chat says that routine has no shared kit in the record. Asking does not spread that kit across teammate chats. It does not add a secret. It does not share a file. It does not use that member's connected accounts. A stored run is not a shared kit. An asked meter is not a shared kit. A direct desk is not a shared kit. The row says No shared kit. Asking whether one routine keeps each member's chat private, including from the owner and the Bot's Managers says that routine has no sealed chat in the record. Asking does not reveal that member's chat to the owner or a Manager. It does not display that member's chat to the owner. It does not display that member's chat to a Manager. It does not spread that kit across teammate chats. A stored run is not a sealed chat. A shared kit is not a sealed chat. An asked meter is not a sealed chat. The row says No sealed chat. Asking whether one routine runs delegated work on separate computers under your existing Cloud Agent controls says that routine has no delegated lane in the record. Asking does not hand the coding work off. It does not start a separate computer. It does not change Cloud Agent controls. It does not reveal that member's chat to the owner or a Manager. A stored run is not a delegated lane. A sealed chat is not a delegated lane. A shared kit is not a delegated lane. The row says No delegated lane. Asking whether one routine keeps the Cloud Agents switch on the Grok Bot page for the whole team and on by default says that routine has no default switch in the record. Asking does not flip that switch. It does not hand the coding work off. It does not start a separate computer. It does not change Cloud Agent controls. A stored run is not a default switch. A delegated lane is not a default switch. A sealed chat is not a default switch. The row says No default switch. Asking whether one routine turns it off when your team does not need delegation says that routine has no rest latch in the record. Asking does not turn delegation off. It does not flip that switch. It does not hand the coding work off. A stored run is not a rest latch. A default switch is not a rest latch. A delegated lane is not a rest latch. The row says No rest latch. Asking whether one routine says admins can disable spawning says that routine has no spawn hatch in the record. Asking does not disable spawning. It does not turn delegation off. It does not flip that switch. A stored run is not a spawn hatch. A rest latch is not a spawn hatch. A default switch is not a spawn hatch. The row says No spawn hatch. Asking whether one routine says to disable Cloud Agent spawning if you do not need delegation says that routine has no quiet gate in the record. Asking does not quiet Cloud Agent spawning. It does not disable spawning. It does not turn delegation off. A stored run is not a quiet gate. A spawn hatch is not a quiet gate. A rest latch is not a quiet gate. The row says No quiet gate. Asking whether one routine says to keep public template sharing off unless members should publish Bot templates outside the team says that routine has no public veil in the record. Asking does not keep public template sharing off. It does not publish a Bot template. It does not quiet Cloud Agent spawning. A stored run is not a public veil. A quiet gate is not a public veil. A spawn hatch is not a public veil. The row says No public veil. Asking whether one routine says that off keeps sharing team-only, including for templates that are already public says that routine has no server ring in the record. Asking does not keep sharing team-only. It does not keep public template sharing off. It does not publish a Bot template. A stored run is not a server ring. A public veil is not a server ring. A quiet gate is not a server ring. The row says No server ring. Asking whether one routine says that enterprise teams start with public sharing off and other teams start with it allowed says that routine has no plan notch in the record. Asking does not start enterprise teams closed. It does not leave other teams allowed. It does not keep sharing team-only. A stored run is not a plan notch. A server ring is not a plan notch. A public veil is not a plan notch. The row says No plan notch.",
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
          "data-testid": `usage-pause-${routine.id}`,
          title: "A usage pause is not stored. Asking does not pause account access.",
          text: "No usage pause",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `run-failure-${routine.id}`,
          title: "A failure is not stored. Asking does not start a test run. A stored run is not a failure.",
          text: "No failure",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `source-channel-${routine.id}`,
          title: "A source channel is not stored. Asking does not connect a channel. A stored run is not a channel.",
          text: "No source channel",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `source-repository-${routine.id}`,
          title: "A source repository is not stored. Asking does not confirm a repository. A stored run is not a repository. A source channel is not a repository.",
          text: "No source repository",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `matching-rule-${routine.id}`,
          title: "A matching rule is not stored. Asking does not confirm a matching rule. A stored run is not a matching rule. A source repository is not a matching rule.",
          text: "No matching rule",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `ask-first-${routine.id}`,
          title: "An ask-first rule is not stored. Asking does not save an ask-first rule. A stored run is not an ask-first rule. A matching rule is not an ask-first rule.",
          text: "No ask-first rule",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `allow-automatically-${routine.id}`,
          title: "An allow-automatically rule is not stored. Asking does not turn one on. A stored run is not an allow-automatically rule. An ask-first rule is not an allow-automatically rule.",
          text: "No allow-automatically rule",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `team-rule-${routine.id}`,
          title: "A team rule is not stored. Asking does not lock a team rule. A stored run is not a team rule. An allow-automatically rule is not a team rule.",
          text: "No team rule",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `locked-team-rule-${routine.id}`,
          title: "A locked team rule is not stored. Asking does not lock a team rule. A stored run is not a locked team rule. A team rule is not a locked team rule.",
          text: "No locked team rule",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `local-computer-${routine.id}`,
          title: "A local-computer refusal is not stored. Asking does not turn local access on. A stored run is not a local-computer refusal. A source system is not a local-computer refusal. A locked team rule is not a local-computer refusal.",
          text: "No local-computer refusal",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `cloud-computer-${routine.id}`,
          title: "A cloud-computer refusal is not stored. Asking does not turn cloud access on. A stored run is not a cloud-computer refusal. A local-computer refusal is not a cloud-computer refusal. A source system is not a cloud-computer refusal.",
          text: "No cloud-computer refusal",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `reachable-computer-${routine.id}`,
          title: "A reachable computer is not stored. Asking does not recover a computer. A stored run is not a reachable computer. A cloud-computer refusal is not a reachable computer. A source system is not a reachable computer.",
          text: "No reachable computer",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `stuck-state-${routine.id}`,
          title: "A stuck state is not stored. Asking does not open the computer. A stored run is not a stuck state. A reachable computer is not a stuck state. A cloud-computer refusal is not a stuck state.",
          text: "No stuck state",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `login-wait-${routine.id}`,
          title: "A login wait is not stored. Asking does not take over the computer. A stored run is not a login wait. A stuck state is not a login wait. A reachable computer is not a login wait.",
          text: "No login wait",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `auth-plugin-${routine.id}`,
          title: "A plugin authentication is not stored. Asking does not authenticate a plugin. A stored run is not a plugin authentication. A login wait is not a plugin authentication. A required plugin is not a plugin authentication.",
          text: "No plugin authentication",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `readable-attachment-${routine.id}`,
          title: "A readable attachment is not stored. Asking does not read an attachment. A stored run is not a readable attachment. A plugin authentication is not a readable attachment. A required plugin is not a readable attachment.",
          text: "No readable attachment",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `blocked-approval-${routine.id}`,
          title: "A blocked approval is not stored. Asking does not reject an approval. A stored run is not a blocked approval. A readable attachment is not a blocked approval. A plugin authentication is not a blocked approval.",
          text: "No blocked approval",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `setup-computer-${routine.id}`,
          title: "A computer setup is not stored. Asking does not restart the app. A stored run is not a computer setup. A blocked approval is not a computer setup. A readable attachment is not a computer setup.",
          text: "No computer setup",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `app-update-${routine.id}`,
          title: "An app update is not stored. Asking does not check for an app update. A stored run is not an app update. A computer setup is not an app update. A blocked approval is not an app update.",
          text: "No app update",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `signin-open-${routine.id}`,
          title: "An open sign-in is not stored. Asking does not finish the sign-in. A stored run is not an open sign-in. An app update is not an open sign-in. A computer setup is not an open sign-in.",
          text: "No open sign-in",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `bot-quiet-${routine.id}`,
          title: "A quiet bot is not stored. Asking does not post on X. A stored run is not a quiet bot. An open sign-in is not a quiet bot. An app update is not a quiet bot.",
          text: "No quiet bot",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `support-note-${routine.id}`,
          title: "A support note is not stored. Asking does not contact support. A stored run is not a support note. A quiet bot is not a support note. An open sign-in is not a support note.",
          text: "No support note",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `retry-result-${routine.id}`,
          title: "A retry result is not stored. Asking does not retry. A stored run is not a retry result. A support note is not a retry result. A quiet bot is not a retry result.",
          text: "No retry result",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `disconnected-app-${routine.id}`,
          title: "A disconnected app is not stored. Asking does not disconnect the app. A stored run is not a disconnected app. A retry result is not a disconnected app. A support note is not a disconnected app.",
          text: "No disconnected app",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `least-destructive-${routine.id}`,
          title: "A least-destructive step is not stored. Asking does not take a destructive step. A stored run is not a least-destructive step. A disconnected app is not a least-destructive step. A retry result is not a least-destructive step.",
          text: "No least-destructive step",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `screen-task-${routine.id}`,
          title: "An active screen task is not stored. Asking does not redirect the screen. A stored run is not an active screen task. A least-destructive step is not an active screen task. A stuck state is not an active screen task.",
          text: "No active screen task",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `finish-before-rebuild-${routine.id}`,
          title: "A finish-before-rebuild is not stored. Asking does not rebuild the computer. A stored run is not a finish-before-rebuild. An active screen task is not a finish-before-rebuild. A least-destructive step is not a finish-before-rebuild.",
          text: "No finish-before-rebuild",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `kept-chat-${routine.id}`,
          title: "A kept conversation is not stored. Asking leaves the saved chat in place. A stored run is not a kept conversation. A finish-before-rebuild is not a kept conversation. An active screen task is not a kept conversation.",
          text: "No kept conversation",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `kept-file-${routine.id}`,
          title: "A kept-file is not stored. Asking leaves the saved files in place. A stored run is not a kept-file. A kept conversation is not a kept-file. A finish-before-rebuild is not a kept-file.",
          text: "No kept-file",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `software-refresh-${routine.id}`,
          title: "A software refresh is not stored. Asking does not refresh the software. A stored run is not a software refresh. A kept-file is not a software refresh. A kept conversation is not a software refresh.",
          text: "No software refresh",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `scratch-folder-${routine.id}`,
          title: "A scratch folder is not stored. Asking does not delete a temporary directory. A stored run is not a scratch folder. A software refresh is not a scratch folder. A kept-file is not a scratch folder.",
          text: "No scratch folder",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `work-surface-${routine.id}`,
          title: "A work surface is not stored. Asking does not merge the screens. A stored run is not a work surface. A scratch folder is not a work surface. A software refresh is not a work surface.",
          text: "No work surface",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `private-host-${routine.id}`,
          title: "A private host is not stored. Asking does not share one computer across users. A stored run is not a private host. A work surface is not a private host. A scratch folder is not a private host.",
          text: "No private host",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `guest-slice-${routine.id}`,
          title: "A guest slice is not stored. Asking does not boot a microVM. A stored run is not a guest slice. A private host is not a guest slice. A work surface is not a guest slice.",
          text: "No guest slice",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `persona-ledger-${routine.id}`,
          title: "A persona ledger is not stored. Asking does not merge personalities. A stored run is not a persona ledger. A guest slice is not a persona ledger. A private host is not a persona ledger.",
          text: "No persona ledger",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `common-tray-${routine.id}`,
          title: "A common tray is not stored. Asking does not sign the browser out. A stored run is not a common tray. A persona ledger is not a common tray. A guest slice is not a common tray.",
          text: "No common tray",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `solo-roster-${routine.id}`,
          title: "A solo roster is not stored. Asking does not give a workload its own user. A stored run is not a solo roster. A common tray is not a solo roster. A persona ledger is not a solo roster.",
          text: "No solo roster",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `team-bench-${routine.id}`,
          title: "A team bench is not stored. Asking does not share a team bot. A stored run is not a team bench. A solo roster is not a team bench. A common tray is not a team bench.",
          text: "No team bench",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `group-computer-${routine.id}`,
          title: "A group computer is not stored. Asking does not give the group its own computer. A stored run is not a group computer. A team bench is not a group computer. A solo roster is not a group computer.",
          text: "No group computer",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `direct-desk-${routine.id}`,
          title: "A direct desk is not stored. Asking does not put the work on that member's computer. A stored run is not a direct desk. A group computer is not a direct desk. A team bench is not a direct desk.",
          text: "No direct desk",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `asked-meter-${routine.id}`,
          title: "An asked meter is not stored. Asking does not use that member's connected accounts. A stored run is not an asked meter. A direct desk is not an asked meter. A group computer is not an asked meter.",
          text: "No asked meter",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `shared-kit-${routine.id}`,
          title: "A shared kit is not stored. Asking does not spread that kit across teammate chats. A stored run is not a shared kit. An asked meter is not a shared kit. A direct desk is not a shared kit.",
          text: "No shared kit",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `sealed-chat-${routine.id}`,
          title: "A sealed chat is not stored. Asking does not reveal that member's chat to the owner or a Manager. A stored run is not a sealed chat. A shared kit is not a sealed chat. An asked meter is not a sealed chat.",
          text: "No sealed chat",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `delegated-lane-${routine.id}`,
          title: "A delegated lane is not stored. Asking does not hand the coding work off. A stored run is not a delegated lane. A sealed chat is not a delegated lane. A shared kit is not a delegated lane.",
          text: "No delegated lane",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `default-switch-${routine.id}`,
          title: "A default switch is not stored. Asking does not flip that switch. A stored run is not a default switch. A delegated lane is not a default switch. A sealed chat is not a default switch.",
          text: "No default switch",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `rest-latch-${routine.id}`,
          title: "A rest latch is not stored. Asking does not turn delegation off. A stored run is not a rest latch. A default switch is not a rest latch. A delegated lane is not a rest latch.",
          text: "No rest latch",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `spawn-hatch-${routine.id}`,
          title: "A spawn hatch is not stored. Asking does not disable spawning. A stored run is not a spawn hatch. A rest latch is not a spawn hatch. A default switch is not a spawn hatch.",
          text: "No spawn hatch",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `hush-mark-${routine.id}`,
          title: "A quiet gate is not stored. Asking does not quiet Cloud Agent spawning. A stored run is not a quiet gate. A spawn hatch is not a quiet gate. A rest latch is not a quiet gate.",
          text: "No quiet gate",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `veil-band-${routine.id}`,
          title: "A public veil is not stored. Asking does not keep public template sharing off. A stored run is not a public veil. A quiet gate is not a public veil. A spawn hatch is not a public veil.",
          text: "No public veil",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `ring-clasp-${routine.id}`,
          title: "A server ring is not stored. Asking does not keep sharing team-only. A stored run is not a server ring. A public veil is not a server ring. A quiet gate is not a server ring.",
          text: "No server ring",
        }),
      );
      rail.append(
        el("p", {
          class: "rule-note",
          "data-testid": `plan-notch-${routine.id}`,
          title: "A plan notch is not stored. Asking does not start enterprise teams closed. A stored run is not a plan notch. A server ring is not a plan notch. A public veil is not a plan notch.",
          text: "No plan notch",
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
