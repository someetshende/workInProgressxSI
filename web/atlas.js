const list = document.querySelector("#atlas-list");
const count = document.querySelector("[data-testid='atlas-count']");
const lead = document.querySelector("#atlas-lead");
const form = document.querySelector("#atlas-form");
const input = document.querySelector("#atlas-q");

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = String(value);
    else node.setAttribute(key, String(value));
  }
  for (const child of children) node.append(child);
  return node;
}

async function load(query) {
  const params = new URLSearchParams({ limit: "20", q: query });
  const response = await fetch(`/api/stories?${params.toString()}`);
  const data = await response.json();
  count.textContent = String(query ? data.matched : data.total);
  lead.textContent = query
    ? `${data.matched.toLocaleString()} match this search. The full atlas is ${data.total.toLocaleString()}.`
    : "Flagship stories are the spec. The rest expand every person, job, and constraint Oriel is meant to hold.";
  list.replaceChildren();
  for (const story of data.stories) {
    const acceptance = el("ol");
    for (const line of story.acceptance) acceptance.append(el("li", { text: line }));
    list.append(
      el("article", { class: "story" }, [
        el("p", { class: "quiet", text: `${story.id} · ${story.priority} · ${story.kind}` }),
        el("h2", { text: story.title }),
        el("p", { text: story.story }),
        acceptance,
      ]),
    );
  }
  if (!data.stories.length) list.append(el("p", { text: "Nothing in the atlas matches that." }));
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  load(input.value.trim()).catch(() => {
    lead.textContent = "The atlas could not be read.";
  });
});

load("").catch(() => {
  lead.textContent = "The atlas could not be read.";
});
