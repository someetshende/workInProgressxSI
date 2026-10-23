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
let busy = false;
let openBridge = null;

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
  const approve = thread.querySelector("[data-testid='approve']");
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

function renderContext() {
  const goal = state?.goals?.find((item) => item.id === selected);
  context.textContent = goal ? `Continuing · ${goal.title}` : "This starts a new goal";
}

function renderRail() {
  rail.replaceChildren();
  const brand = el("div", { class: "brand" }, [
    windowMark(),
    el("div", { class: "word", text: "Oriel" }),
  ]);
  rail.append(brand);
  rail.append(el("p", { class: "tag", text: "One window for the agents you already run." }));
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

  if (state.routines.length) {
    rail.append(el("p", { class: "label", text: "Routines" }));
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
    }
  }

  rail.append(el("p", { class: "trust", "data-testid": "trust", text: state.trust }));
  const atlas = el("a", { class: "atlas-link", href: "/atlas", text: `${state.atlas.count.toLocaleString()} stories` });
  rail.append(atlas);
  renderContext();
}

function latestSynthesisId() {
  let id = null;
  for (const message of state.messages) {
    if (message.role === "oriel" && typeof message.tight === "boolean") id = message.id;
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
    plan.append(el("li", { text: `${step.title} — ${step.status}` }));
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
    el("button", {
      type: "button",
      class: "textish",
      "data-testid": "save-routine",
      text: "Save as routine",
      onclick: () => post("/api/routines", { goalId: goal.id }),
    }),
  );

  const wrap = el("div");
  wrap.append(details);
  const approvals = state.approvals.filter((approval) => approval.goalId === goal.id);
  for (const approval of approvals) {
    const heading = approval.status === "approved" ? "Released" : approval.status === "denied" ? "Held back" : "Hold for you";
    const card = el("section", { class: "hold", "data-testid": "approval" }, [
      el("h2", { text: heading }),
      el("p", { class: "detail", text: approval.title }),
      el("p", { class: "detail", text: approval.detail }),
    ]);
    if (approval.status === "open") {
      const actions = el("div", { class: "actions" });
      actions.append(
        el("button", {
          type: "button",
          class: "approve",
          "data-testid": "approve",
          text: "Approve",
          onclick: () => post(`/api/approvals/${approval.id}`, { decision: "approve" }),
        }),
      );
      actions.append(
        el("button", {
          type: "button",
          class: "ghost",
          "data-testid": "deny",
          text: "Not now",
          onclick: () => post(`/api/approvals/${approval.id}`, { decision: "deny" }),
        }),
      );
      card.append(actions);
    } else if (approval.resolution) {
      card.append(el("p", { class: "detail", text: approval.resolution }));
    }
    wrap.append(card);
  }
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
  const body = selected ? { text: trimmed, goalId: selected } : { text: trimmed };
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
