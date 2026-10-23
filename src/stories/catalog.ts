import { INSIGHTS } from "./insights.js";
import { flagshipStories } from "./flagship.js";
import type { Story } from "./types.js";

type Persona = {
  id: string;
  role: string;
  name: string;
  short: string;
  soThat: string;
};

type Job = {
  id: string;
  surface: string;
  capability: string;
  short: string;
  want: string;
  proof: string;
};

type Constraint = {
  id: string;
  short: string;
  text: string;
  proof: string;
};

export const personas: Persona[] = [
  {
    id: "founder",
    role: "founder",
    name: "a solo founder",
    short: "Founder",
    soThat: "the company can move without me becoming the router between agents",
  },
  {
    id: "partner",
    role: "security",
    name: "a law-firm partner",
    short: "Law partner",
    soThat: "a client matter never becomes a consumer-agent memory",
  },
  {
    id: "support",
    role: "operator",
    name: "a support lead",
    short: "Support lead",
    soThat: "the queue keeps moving and the reply still sounds like us",
  },
  {
    id: "recruiter",
    role: "operator",
    name: "a recruiter",
    short: "Recruiter",
    soThat: "candidates hear from me only after I have seen the note",
  },
  {
    id: "researcher",
    role: "individual",
    name: "an independent researcher",
    short: "Researcher",
    soThat: "a claim is separated from the recommendation",
  },
  {
    id: "chief",
    role: "executive",
    name: "a chief of staff",
    short: "Chief of staff",
    soThat: "the executive gets one recommendation instead of three transcripts",
  },
  {
    id: "parent",
    role: "individual",
    name: "a parent",
    short: "Parent",
    soThat: "household logistics stay light and nothing is bought by surprise",
  },
  {
    id: "finance",
    role: "finance",
    name: "a finance lead",
    short: "Finance lead",
    soThat: "money moves only after a recorded decision, and never from Oriel itself",
  },
  {
    id: "security",
    role: "security",
    name: "a security admin",
    short: "Security admin",
    soThat: "every seat, token, and hold can be reviewed after the fact",
  },
  {
    id: "engineer",
    role: "developer",
    name: "an engineer",
    short: "Engineer",
    soThat: "a failing test is named before anyone trusts the fix",
  },
  {
    id: "marketer",
    role: "operator",
    name: "a marketer",
    short: "Marketer",
    soThat: "a draft can exist without becoming a public post",
  },
  {
    id: "sales",
    role: "operator",
    name: "a sales lead",
    short: "Sales lead",
    soThat: "follow-ups wait for me instead of sending themselves",
  },
  {
    id: "student",
    role: "individual",
    name: "a graduate student",
    short: "Graduate student",
    soThat: "the defense plan stays a plan until I accept the next step",
  },
  {
    id: "clinic",
    role: "security",
    name: "a clinic administrator",
    short: "Clinic admin",
    soThat: "appointments can be coordinated without patient detail sitting on a consumer seat",
  },
  {
    id: "designer",
    role: "individual",
    name: "a product designer",
    short: "Designer",
    soThat: "I can see the disagreement before I pick a direction",
  },
  {
    id: "ops",
    role: "operator",
    name: "an operations manager",
    short: "Ops manager",
    soThat: "the weekly close can run again without skipping its holds",
  },
  {
    id: "reporter",
    role: "individual",
    name: "a reporter",
    short: "Reporter",
    soThat: "nothing is published until the wording is approved",
  },
  {
    id: "traveler",
    role: "individual",
    name: "a traveler",
    short: "Traveler",
    soThat: "I get an itinerary without a booking I did not confirm",
  },
];

export const jobs: Job[] = [
  {
    id: "brief",
    surface: "goals",
    capability: "Competitive brief",
    short: "Competitive brief",
    want: "turn a comparison of Grok Bot, Dots, and Muse into one brief with a single lead",
    proof: "The brief names one lead and keeps the other reads inspectable.",
  },
  {
    id: "plan",
    surface: "goals",
    capability: "Plan a goal",
    short: "Plan",
    want: "turn one stated goal into a plan with owners and one recommendation",
    proof: "The plan has a framing step and a read for each convened seat.",
  },
  {
    id: "draft",
    surface: "approvals",
    capability: "Hold outbound",
    short: "Hold the send",
    want: "draft an outbound note and hold it before anything is sent",
    proof: "The outbound step is either held or explicitly skipped.",
  },
  {
    id: "choose",
    surface: "agents",
    capability: "Choose a lead",
    short: "Choose the lead",
    want: "be told which connected seat should lead, and why",
    proof: "The why names the lead and the reason it was chosen.",
  },
  {
    id: "watch",
    surface: "goals",
    capability: "Open loops",
    short: "Watch",
    want: "keep an open loop and see it again when I come back",
    proof: "A watch line survives on the away brief until the loop is gone.",
  },
  {
    id: "routine",
    surface: "routines",
    capability: "Routines",
    short: "Routine",
    want: "save the workflow as a routine that still obeys every hold",
    proof: "Running the routine creates a new goal and does not bypass holds.",
  },
  {
    id: "reroute",
    surface: "agents",
    capability: "Reroute",
    short: "Reroute",
    want: "reroute the work when my preferred seat is switched off",
    proof: "A switched-off seat is named and is not given a read.",
  },
  {
    id: "metric",
    surface: "thread",
    capability: "One next move",
    short: "One move",
    want: "read a metric and come back with one next move rather than a dashboard",
    proof: "The voice contains one recommendation, not a list of equal options.",
  },
  {
    id: "errand",
    surface: "approvals",
    capability: "Personal errand",
    short: "Errand",
    want: "plan a personal errand without spending money on my behalf",
    proof: "Any payment in the errand is held, and releasing it does not move money.",
  },
  {
    id: "code",
    surface: "thread",
    capability: "Name the test",
    short: "Name the test",
    want: "outline a code fix and the test that would prove it",
    proof: "Code work says the proving test has to be named before the work is trusted.",
  },
  {
    id: "dissent",
    surface: "thread",
    capability: "Show disagreement",
    short: "Disagreement",
    want: "see disagreement between seats instead of a blended non-answer",
    proof: "When the seats would diverge, the dissent is present and one lead remains.",
  },
  {
    id: "bridge",
    surface: "connectors",
    capability: "Bridge an endpoint",
    short: "Bridge",
    want: "attach a live bridge I control and keep its token out of the thread",
    proof: "The token is absent from public state, the ledger, and the thread.",
  },
];

export const constraints: Constraint[] = [
  {
    id: "approve-send",
    short: "Approve the draft",
    text: "nothing is sent until I approve the exact draft",
    proof: "A send cannot leave the record as delivered.",
  },
  {
    id: "no-pay",
    short: "Do not pay",
    text: "no payment, purchase, or transfer is made",
    proof: "Oriel records payment consent and does not charge anything.",
  },
  {
    id: "no-client-data",
    short: "No consumer matter",
    text: "client, patient, and confidential data never goes to a consumer seat",
    proof: "Muse receives no read when the request is client, patient, or confidential work.",
  },
  {
    id: "short",
    short: "Keep it short",
    text: "the reply stays short unless I ask for the long version",
    proof: "A short preference marks the brief tight and leaves the long read inside the card.",
  },
  {
    id: "no-public",
    short: "Nothing public",
    text: "nothing public is posted",
    proof: "A public post is held or skipped, and Oriel does not publish it.",
  },
  {
    id: "name-failure",
    short: "Name a failed bridge",
    text: "a failed live bridge is named, and the reference seat continues",
    proof: "Bridge failure is written on the seat read and the mode falls back to reference.",
  },
];

let cache: Story[] | null = null;

export function atlasStories(): Story[] {
  const stories: Story[] = [];
  let n = 0;
  for (const persona of personas) {
    for (const job of jobs) {
      for (const constraint of constraints) {
        n += 1;
        const priority: Story["priority"] =
          constraint.id === "short" ? "p2" : constraint.id === "name-failure" ? "p1" : "p0";
        stories.push({
          id: `ORIEL-${String(1000 + n).padStart(4, "0")}`,
          persona: persona.name,
          role: persona.role,
          surface: job.surface,
          capability: job.capability,
          title: `${persona.short}: ${job.short} — ${constraint.short}`,
          story: `As ${persona.name}, I want to ${job.want}. Oriel must make sure that ${constraint.text}, so that ${persona.soThat}.`,
          acceptance: [
            `Given ${persona.name}, when they ask Oriel to ${job.want}, the record names every seat that was convened.`,
            `The constraint holds for this story: ${constraint.text}.`,
            job.proof,
            constraint.proof,
          ],
          priority,
          kind: "atlas",
          sourceInsight: INSIGHTS[(n - 1) % INSIGHTS.length] ?? INSIGHTS[0],
        });
      }
    }
  }
  return stories;
}

export function getCatalog(): Story[] {
  if (!cache) cache = [...flagshipStories(), ...atlasStories()];
  return cache;
}

export function queryStories(query: string, offset: number, limit: number) {
  const all = getCatalog();
  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? all.filter((story) =>
        `${story.title}\n${story.story}\n${story.persona}\n${story.capability}\n${story.acceptance.join("\n")}`
          .toLowerCase()
          .includes(needle),
      )
    : all;
  const start = Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0;
  const take = Math.min(100, Math.max(1, Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 20));
  return {
    total: all.length,
    matched: filtered.length,
    offset: start,
    limit: take,
    stories: filtered.slice(start, start + take),
  };
}
