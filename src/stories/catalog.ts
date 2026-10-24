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
  {
    id: "pause",
    surface: "routines",
    capability: "Pause wakes",
    short: "Pause",
    want: "pause scheduled wakes without deleting the routine or releasing a hold",
    proof: "While wakes are paused, a due routine does not run, and an open hold stays open.",
  },
  {
    id: "skill",
    surface: "routines",
    capability: "Skills",
    short: "Skill",
    want: "save a demonstrated path as a skill and apply that method to a new request",
    proof: "The skill does not wake on its own, and a prohibition in the method still holds when it is applied.",
  },
  {
    id: "expire",
    surface: "approvals",
    capability: "Expire an unattended hold",
    short: "Expire",
    want: "let a hold raised while I am away expire without running the action",
    proof: "An unattended hold expires, the action does not run, and there is no always-allow.",
  },
  {
    id: "handoff",
    surface: "approvals",
    capability: "Hand off to you",
    short: "Hand off",
    want: "be handed a step only I can do, such as a password change or a sign-in, instead of a seat doing it",
    proof: "The step is handed to the person. Marking it done does not call a bridge, send mail, or move money.",
  },
  {
    id: "rule",
    surface: "approvals",
    capability: "Handoff rule",
    short: "Handoff rule",
    want: "save a handoff rule for a named action so a later request that would do it is mine",
    proof: "The rule does not wake, does not approve a hold, and does not run the action. A request that would not do that action does not open a handoff.",
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
  {
    id: "narrow-phrase",
    short: "Name the phrase",
    text: "a handoff rule can name a phrase, and a request that leaves those words out is not handed over",
    proof: "The phrase is a literal mention. Omitting it does not open a handoff, and the rule does not run the step.",
  },
  {
    id: "spoken-rule",
    short: "Say the words",
    text: "a sentence can name the words on a handoff rule, and saying it does not run the step or open a card",
    proof: "The sentence saves one rule for that action. A sentence that would not do the action does not save a rule and does not open a handoff.",
  },
  {
    id: "clear-whole",
    short: "Clear the whole step",
    text: "a sentence can clear a handoff rule that names no phrase, and it does not clear a rule that names other words",
    proof: "Stop handing deletions to me clears only a deletion rule with no phrase. A phrased rule stays, and the sentence does not run the step.",
  },
  {
    id: "read-rules",
    short: "Read the handoffs",
    text: "a sentence can read which steps are handed over, and reading them does not run a step or open a card",
    proof: "What is handed to me names each saved rule. A deletion with no phrase is the whole deletion, and a phrase is only those words.",
  },
  {
    id: "ask-one",
    short: "Ask about one step",
    text: "a sentence can ask whether one action is handed over, and the answer names only that rule",
    proof: "Is a deletion handed to me names only the deletion. A phrase is only those words, and other rules stay unnamed.",
  },
  {
    id: "no-inbox-pull",
    short: "Do not pull the inbox",
    text: "a forward does not pull the original message, its images, or its attachments, and nothing is sent until I decide",
    proof: "A forward opens a send hold or stays a draft, says the original message stayed put, and approving a hold still does not send mail.",
  },
  {
    id: "stop-task",
    short: "Stop this task",
    text: "saying stop this task clears Allow for this task on the current goal only, and a sent email cannot be reversed",
    proof: "Stop this task clears that goal's allowance so the next same-kind step asks again. Another goal stays allowed. Nothing is sent or spent.",
  },
  {
    id: "stop-routine",
    short: "Stop one routine",
    text: "saying stop the named routine sets that one routine to manual, leaves its instruction, and does not change another routine",
    proof: "Stop the Launch note routine keeps that instruction and stops its wake. Another routine keeps its cadence. Nothing is sent or spent.",
  },
  {
    id: "list-schedule",
    short: "List the schedule",
    text: "saying what is scheduled names each saved routine once, in the order it was saved, with its cadence, and does not run one",
    proof: "What is scheduled names each routine and its cadence. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "when-routine",
    short: "When one wakes",
    text: "saying when one named routine wakes names its cadence and, when it is not manual, its next time, and does not run it or change its timing",
    proof: "When does the Launch note routine wake names that cadence and next time. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "what-routine",
    short: "What one does",
    text: "saying what one named routine does names its instruction and does not run it, change that instruction, or change its timing",
    proof: "What does the Launch note routine do names that instruction. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "when-routine-ran",
    short: "When one last ran",
    text: "saying when one named routine last ran names that stored time, or says there is no last run, and does not run it or change it",
    proof: "When did the Launch note routine last run names that time. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "what-routine-delivered",
    short: "What one delivered",
    text: "saying what one named routine delivered says there is no delivery in the record, and a last run does not confirm the result or change the routine",
    proof: "What did the Launch note routine deliver says there is no delivery. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "run-routine",
    short: "Run one routine",
    text: "saying run and one routine's name runs that saved instruction once, leaves its cadence and next time, and does not treat the run as a delivery",
    proof: "Run the Launch note routine writes a last run and holds a send. Another routine keeps its cadence. Nothing is sent or spent.",
  },
  {
    id: "change-routine",
    short: "Change one routine",
    text: "saying change and one routine's name quotes the stored instruction and the proposed words, and does not save the change or run the routine",
    proof: "Change the Launch note routine to Summarize the launch risks quotes both and leaves the instruction. Nothing is run, saved, sent, or spent.",
  },
  {
    id: "save-routine",
    short: "Save one routine",
    text: "saying save and one routine's name writes that instruction, leaves the cadence and the next time, and does not run the routine",
    proof: "Save the Launch note routine as Summarize the launch risks writes that instruction. A change sentence does not. Nothing is run, sent, or spent.",
  },
  {
    id: "wake-cadence",
    short: "Set one cadence",
    text: "saying wake and one routine's name with daily, hourly, or manual sets that cadence, writes or clears the next time, and does not run the routine",
    proof: "Wake the Launch note routine daily sets that cadence and the next time. A save sentence does not. Nothing is run, sent, or spent.",
  },
  {
    id: "pause-routine",
    short: "Pause one routine",
    text: "saying pause or resume and one routine's name pauses or resumes that one wake, leaves the cadence and the next time, and does not run the routine",
    proof: "Pause the Launch note routine leaves that cadence and the next time. Resume clears only that pause. A desk pause does not mark the routine. Nothing is run, sent, or spent.",
  },
  {
    id: "delete-routine",
    short: "Delete one routine",
    text: "saying delete and one routine's name removes that one routine from the record, leaves every other routine, and does not run it or undo a completed action",
    proof: "Delete the Launch note routine removes that routine and says the deletion cannot be undone. Stop, pause, and resume do not delete it. Nothing is run, sent, or spent.",
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
