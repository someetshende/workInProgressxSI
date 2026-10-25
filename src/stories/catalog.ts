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
  {
    id: "space-routines",
    short: "Keep schedules apart",
    text: "saying wake and one routine's name with daily or hourly leaves that cadence unchanged when the next time it would write is less than five minutes from another routine's stored next time",
    proof: "Wake the Launch note routine daily names both routines and says schedules must be at least five minutes apart. A click on the cadence control still cycles. Nothing is run or deleted.",
  },
  {
    id: "cap-routines",
    short: "Stop at fifty",
    text: "saving a routine when 50 routines are already in the record does not add a 51st and says a bot can own up to 50 routines",
    proof: "Save as routine leaves the fiftieth in place. Nothing is deleted or run. A save under the cap still obeys a hold.",
  },
  {
    id: "hour-routines",
    short: "Stop at the hour",
    text: "saying run and one routine's name does not run it when that routine has already run 200 times in the last hour, or when the desk has already run 300, and a run an hour old does not count",
    proof: "Run the Launch note routine names the hour cap and leaves the last run. A wake does not move the next time. Nothing is sent or spent.",
  },
  {
    id: "list-runs",
    short: "Name the runs",
    text: "saying what runs one named routine has names up to the twenty newest stored run instants, newest first, and says a last run is not a delivery, and does not run it or change the stored runs",
    proof: "What runs does the Launch note routine have names those times, or says there are no runs in the record. The rail does not list them. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "why-quiet",
    short: "Why it has not run",
    text: "saying why one named routine has not run explains the pause, the wait, or the hour, and does not start a run or change the stored runs",
    proof: "Why hasn't the Launch note routine run names that reason. No runs yet means nothing has started it. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "where-routine",
    short: "Where it delivers",
    text: "saying where one named routine delivers says there is no destination in the record, that where results go is not stored, and that a last run is not a delivery, and does not run it or invent a place",
    proof: "Where does the Launch note routine deliver says there is no destination. The rail says No destination. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "list-paused",
    short: "Name paused routines",
    text: "saying which routines are paused names each paused routine once, in the order it was saved, says a wake does not run it, and leaves a routine that is not paused out of the answer",
    proof: "Which routines are paused names only the paused ones, or says no routine is paused. A desk pause does not mark one. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-paused",
    short: "Ask if one is paused",
    text: "saying is and one routine's name and paused names whether that one routine is paused, says a wake does not run it when it is, says it is not paused when it is not, and does not treat a desk-wide pause as that routine being paused",
    proof: "Is the Launch note routine paused names that one pause or says it is not paused. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-active",
    short: "Ask if one is active",
    text: "saying is and one routine's name and active names whether that one routine is active, says it is not active and a wake does not run it when it is paused, says it is active when it is not paused, and does not treat a desk-wide pause as that routine being inactive",
    proof: "Is the Launch note routine active names that one as active or says it is not active. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-enabled",
    short: "Ask if one is enabled",
    text: "saying is and one routine's name and enabled names whether that one routine is enabled, says it is not enabled and a wake does not run it when it is paused, says it is enabled when it is not paused, and does not treat a desk-wide pause as that routine being disabled",
    proof: "Is the Launch note routine enabled names that one as enabled or says it is not enabled. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "list-enabled",
    short: "Name enabled routines",
    text: "saying which routines are enabled names each routine that is not paused once, in the order it was saved, says it is enabled, and leaves a paused routine out of the answer",
    proof: "Which routines are enabled names only the ones that are not paused, or says no routine is enabled. A desk pause does not disable one. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "list-active",
    short: "Name active routines",
    text: "saying which routines are active names each routine that is not paused once, in the order it was saved, says it is active, and leaves a paused routine out of the answer",
    proof: "Which routines are active names only the ones that are not paused, or says no routine is active. A desk pause does not inactivate one. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "list-disabled",
    short: "Name disabled routines",
    text: "saying which routines are disabled names each routine that is paused once, in the order it was saved, says it is disabled, and leaves a routine that is not paused out of the answer",
    proof: "Which routines are disabled names only the paused ones, or says no routine is disabled. A desk pause does not disable one. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-disabled",
    short: "Ask if one is disabled",
    text: "saying is and one routine's name and disabled names whether that one routine is disabled, says it is disabled and a wake does not run it when it is paused, says it is not disabled when it is not paused, and does not treat a desk-wide pause as that routine being disabled",
    proof: "Is the Launch note routine disabled names that one as disabled or says it is not disabled. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-zone",
    short: "Ask which time zone",
    text: "saying what time zone one named routine is using says that routine has no time zone in the record, leaves the next time at the instant already stored, and does not set a zone or treat a desk-wide pause as a zone",
    proof: "What time zone is the Launch note routine using says there is no time zone. The next time stays. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-owner",
    short: "Ask which bot owns one",
    text: "saying which bot owns one named routine says that routine has no owning bot in the record and does not assign it to Grok Bot, Dots, or Muse or treat a desk-wide pause as an owner",
    proof: "Which bot owns the Launch note routine says there is no owning bot. Asking does not assign one. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-plugin",
    short: "Ask which plugins one needs",
    text: "saying which plugins one named routine needs says that routine has no required plugin in the record and does not connect a plugin or assign it to Grok Bot, Dots, or Muse or treat a desk-wide pause as a plugin",
    proof: "Which plugins does the Launch note routine need says there is no required plugin. Asking does not connect one. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-source",
    short: "Ask if one can reach its source",
    text: "saying can one named routine reach its source says that routine has no source system in the record and does not connect a computer or a plugin or assign it to Grok Bot, Dots, or Muse or treat a desk-wide pause as a source",
    proof: "Can the Launch note routine reach its source says there is no source system. Asking does not connect a computer. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-usage",
    short: "Ask if usage is paused",
    text: "saying has usage been paused for one named routine says that routine has no usage pause in the record and does not pause account access or the routine or connect a computer or a plugin or assign it to Grok Bot, Dots, or Muse or treat a desk-wide pause as a usage pause",
    proof: "Has usage been paused for the Launch note routine says there is no usage pause. Asking does not pause account access. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-failure",
    short: "Ask what failure one shows",
    text: "saying what failure one named routine shows says that routine has no failure in the record and does not start a test run or treat a stored run, a desk-wide pause, or a usage pause as a failure",
    proof: "What failure does the Launch note routine show says there is no failure. Asking does not start a test run. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-channel",
    short: "Ask which channel starts one",
    text: "saying which channel starts one named routine says that routine has no source channel in the record and does not connect a channel or start a test run or treat a stored run, a desk-wide pause, a failure, or a usage pause as a channel",
    proof: "Which channel starts the Launch note routine says there is no source channel. Asking does not connect a channel. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-repository",
    short: "Ask which repository starts one",
    text: "saying which repository starts one named routine says that routine has no source repository in the record and does not confirm a repository or a matching rule or connect a channel or start a test run or treat a stored run, a desk-wide pause, a failure, a usage pause, or a source channel as a repository",
    proof: "Which repository starts the Launch note routine says there is no source repository. Asking does not confirm a repository. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-matching",
    short: "Ask which matching rule starts one",
    text: "saying which matching rule starts one named routine says that routine has no matching rule in the record and does not confirm a matching rule or a repository or connect a channel or start a test run or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, or a source repository as a matching rule",
    proof: "Which matching rule starts the Launch note routine says there is no matching rule. Asking does not confirm a matching rule. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-ask-first",
    short: "Ask which ask-first rule blocks one",
    text: "saying which ask-first rule blocks one named routine says that routine has no ask-first rule in the record and does not save an ask-first rule or turn on allow automatically or confirm a matching rule or a repository or connect a channel or start a test run or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, or a matching rule as an ask-first rule",
    proof: "Which ask-first rule blocks the Launch note routine says there is no ask-first rule. Asking does not save an ask-first rule. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-allow-auto",
    short: "Ask which allow-automatically rule covers one",
    text: "saying which allow-automatically rule covers one named routine says that routine has no allow-automatically rule in the record and does not turn one on or save an ask-first rule or turn on allow automatically or confirm a matching rule or a repository or connect a channel or start a test run or pause account access or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, or an ask-first rule as an allow-automatically rule",
    proof: "Which allow-automatically rule covers the Launch note routine says there is no allow-automatically rule. Asking does not turn one on. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-team-rule",
    short: "Ask which team rule blocks one",
    text: "saying which team rule blocks one named routine says that routine has no team rule in the record and does not lock a team rule or save an ask-first rule or turn on allow automatically or turn on an allow-automatically rule or confirm a matching rule or a repository or connect a channel or start a test run or pause account access or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, or an allow-automatically rule as a team rule",
    proof: "Which team rule blocks the Launch note routine says there is no team rule. Asking does not lock a team rule. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-locked-team-rule",
    short: "Ask whether the team rule for one is locked",
    text: "saying whether the team rule for one named routine is locked says that routine has no locked team rule in the record and does not lock a team rule or edit a team rule or delete a team rule or save an ask-first rule or turn on allow automatically or turn on an allow-automatically rule or confirm a matching rule or a repository or connect a channel or start a test run or pause account access or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, or a team rule as a locked team rule",
    proof: "Is the team rule for the Launch note routine locked says there is no locked team rule. Asking does not lock a team rule. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-local-computer",
    short: "Ask whether local computer work is refused",
    text: "saying whether local computer work is refused for one named routine says that routine has no local-computer refusal in the record and does not turn local access on or connect a computer or connect a plugin or lock a team rule or edit a team rule or delete a team rule or save an ask-first rule or turn on allow automatically or turn on an allow-automatically rule or confirm a matching rule or a repository or connect a channel or start a test run or pause account access or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, or a source system as a local-computer refusal",
    proof: "Is local computer work refused for the Launch note routine says there is no local-computer refusal. Asking does not turn local access on. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-cloud-computer",
    short: "Ask whether cloud computer work is refused",
    text: "saying whether cloud computer work is refused for one named routine says that routine has no cloud-computer refusal in the record and does not turn cloud access on or turn local access on or connect a computer or connect a plugin or lock a team rule or edit a team rule or delete a team rule or save an ask-first rule or turn on allow automatically or turn on an allow-automatically rule or confirm a matching rule or a repository or connect a channel or start a test run or pause account access or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, or a source system as a cloud-computer refusal",
    proof: "Is cloud computer work refused for the Launch note routine says there is no cloud-computer refusal. Asking does not turn cloud access on. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-reachable-computer",
    short: "Ask whether one routine can reach its computer",
    text: "saying whether one named routine can reach its computer says that routine has no reachable computer in the record and does not recover a computer or update the computer or reset the computer or turn cloud access on or turn local access on or connect a computer or connect a plugin or lock a team rule or edit a team rule or delete a team rule or save an ask-first rule or turn on allow automatically or turn on an allow-automatically rule or confirm a matching rule or a repository or connect a channel or start a test run or pause account access or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, or a source system as a reachable computer",
    proof: "Can the Launch note routine reach its computer says there is no reachable computer. Asking does not recover a computer. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-stuck-state",
    short: "Ask whether one routine is stuck",
    text: "saying whether one named routine is stuck says that routine has no stuck state in the record and does not open the computer or send a redirect or stop the routine or recover a computer or update the computer or reset the computer or turn cloud access on or turn local access on or connect a computer or connect a plugin or lock a team rule or edit a team rule or delete a team rule or save an ask-first rule or turn on allow automatically or turn on an allow-automatically rule or confirm a matching rule or a repository or connect a channel or start a test run or pause account access or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, or a source system as a stuck state",
    proof: "Is the Launch note routine stuck says there is no stuck state. Asking does not open the computer. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-login-wait",
    short: "Ask whether one routine is waiting on a login",
    text: "saying whether one named routine is waiting on a login says that routine has no login wait in the record and does not take over the computer or type a password or paste a code or complete a sign-in or open the computer or send a redirect or stop the routine or recover a computer or update the computer or reset the computer or turn cloud access on or turn local access on or connect a computer or connect a plugin or lock a team rule or edit a team rule or delete a team rule or save an ask-first rule or turn on allow automatically or turn on an allow-automatically rule or confirm a matching rule or a repository or connect a channel or start a test run or pause account access or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, or a source system as a login wait",
    proof: "Is the Launch note routine waiting on a login says there is no login wait. Asking does not take over the computer. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-plugin-auth",
    short: "Ask whether the plugin for one is authenticated",
    text: "saying whether the plugin for one named routine is authenticated says that routine has no plugin authentication in the record and does not authenticate a plugin or install a plugin or reconnect a plugin or remove a plugin or connect a plugin or take over the computer or type a password or paste a code or complete a sign-in or open the computer or send a redirect or stop the routine or recover a computer or update the computer or reset the computer or turn cloud access on or turn local access on or connect a computer or lock a team rule or edit a team rule or delete a team rule or save an ask-first rule or turn on allow automatically or turn on an allow-automatically rule or confirm a matching rule or a repository or connect a channel or start a test run or pause account access or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a required plugin, or a source system as a plugin authentication",
    proof: "Is the plugin for the Launch note routine authenticated says there is no plugin authentication. Asking does not authenticate a plugin. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-readable-attachment",
    short: "Ask whether one routine can read its attachment",
    text: "saying whether one named routine can read its attachment says that routine has no readable attachment in the record and does not read an attachment or remove document protection or export a file or finish an upload or authenticate a plugin or install a plugin or reconnect a plugin or remove a plugin or connect a plugin or take over the computer or type a password or paste a code or complete a sign-in or open the computer or send a redirect or stop the routine or recover a computer or update the computer or reset the computer or turn cloud access on or turn local access on or connect a computer or lock a team rule or edit a team rule or delete a team rule or save an ask-first rule or turn on allow automatically or turn on an allow-automatically rule or confirm a matching rule or a repository or connect a channel or start a test run or pause account access or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a required plugin, or a source system as a readable attachment",
    proof: "Can the Launch note routine read its attachment says there is no readable attachment. Asking does not read an attachment. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-blocked-approval",
    short: "Ask whether the approval for one is blocked",
    text: "saying whether the approval for one named routine is blocked says that routine has no blocked approval in the record and does not reject an approval or cancel an approval or send a replacement instruction or regenerate an action or read an attachment or remove document protection or export a file or finish an upload or authenticate a plugin or install a plugin or reconnect a plugin or remove a plugin or connect a plugin or take over the computer or type a password or paste a code or complete a sign-in or open the computer or send a redirect or stop the routine or recover a computer or update the computer or reset the computer or turn cloud access on or turn local access on or connect a computer or lock a team rule or edit a team rule or delete a team rule or save an ask-first rule or turn on allow automatically or turn on an allow-automatically rule or confirm a matching rule or a repository or connect a channel or start a test run or pause account access or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a required plugin, or a source system as a blocked approval",
    proof: "Is the approval for the Launch note routine blocked says there is no blocked approval. Asking does not reject an approval. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-computer-setup",
    short: "Ask whether the computer for one is still setting up",
    text: "saying whether the computer for one named routine is still setting up says that routine has no computer setup in the record and does not restart the app or check for an app update or update the computer or retry the setup or reject an approval or cancel an approval or send a replacement instruction or regenerate an action or read an attachment or remove document protection or export a file or finish an upload or authenticate a plugin or install a plugin or reconnect a plugin or remove a plugin or connect a plugin or take over the computer or type a password or paste a code or complete a sign-in or open the computer or send a redirect or stop the routine or recover a computer or reset the computer or turn cloud access on or turn local access on or connect a computer or lock a team rule or edit a team rule or delete a team rule or save an ask-first rule or turn on allow automatically or turn on an allow-automatically rule or confirm a matching rule or a repository or connect a channel or start a test run or pause account access or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a required plugin, or a source system as a computer setup",
    proof: "Is the computer for the Launch note routine still setting up says there is no computer setup. Asking does not restart the app. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-app-update",
    short: "Ask whether an app update is waiting for one",
    text: "saying whether an app update is waiting for one named routine says that routine has no app update in the record and does not check for an app update or restart the app or restart to update or update the computer or retry the setup or reject an approval or cancel an approval or send a replacement instruction or regenerate an action or read an attachment or remove document protection or export a file or finish an upload or authenticate a plugin or install a plugin or reconnect a plugin or remove a plugin or connect a plugin or take over the computer or type a password or paste a code or complete a sign-in or open the computer or send a redirect or stop the routine or recover a computer or reset the computer or turn cloud access on or turn local access on or connect a computer or lock a team rule or edit a team rule or delete a team rule or save an ask-first rule or turn on allow automatically or turn on an allow-automatically rule or confirm a matching rule or a repository or connect a channel or start a test run or pause account access or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, a required plugin, or a source system as an app update",
    proof: "Is an app update waiting for the Launch note routine says there is no app update. Asking does not check for an app update. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-open-sign-in",
    short: "Ask whether sign-in is still open for one",
    text: "saying whether sign-in is still open for one named routine says that routine has no open sign-in in the record and does not finish the sign-in or choose Sign in or return to the app or confirm account access or complete an organization login or sign in with a different account or change the data setting or check for an app update or restart the app or restart to update or update the computer or retry the setup or reject an approval or cancel an approval or send a replacement instruction or regenerate an action or read an attachment or remove document protection or export a file or finish an upload or authenticate a plugin or install a plugin or reconnect a plugin or remove a plugin or connect a plugin or take over the computer or type a password or paste a code or complete a sign-in or open the computer or send a redirect or stop the routine or recover a computer or reset the computer or turn cloud access on or turn local access on or connect a computer or lock a team rule or edit a team rule or delete a team rule or save an ask-first rule or turn on allow automatically or turn on an allow-automatically rule or confirm a matching rule or a repository or connect a channel or start a test run or pause account access or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, a required plugin, or a source system as an open sign-in",
    proof: "Is sign-in still open for the Launch note routine says there is no open sign-in. Asking does not finish the sign-in. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-bot-quiet",
    short: "Ask whether @bot is quiet for one",
    text: "saying whether @bot is quiet for one named routine says that routine has no quiet bot in the record and does not post on X or tag @bot or tag @grok or attach a video or change the region or finish the sign-in or choose Sign in or return to the app or confirm account access or complete an organization login or sign in with a different account or change the data setting or check for an app update or restart the app or restart to update or update the computer or retry the setup or reject an approval or cancel an approval or send a replacement instruction or regenerate an action or read an attachment or remove document protection or export a file or finish an upload or authenticate a plugin or install a plugin or reconnect a plugin or remove a plugin or connect a plugin or take over the computer or type a password or paste a code or complete a sign-in or open the computer or send a redirect or stop the routine or recover a computer or reset the computer or turn cloud access on or turn local access on or connect a computer or lock a team rule or edit a team rule or delete a team rule or save an ask-first rule or turn on allow automatically or turn on an allow-automatically rule or confirm a matching rule or a repository or connect a channel or start a test run or pause account access or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a required plugin, or a source system as a quiet bot",
    proof: "Is @bot quiet for the Launch note routine says there is no quiet bot. Asking does not post on X. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-support-note",
    short: "Ask whether a support note is ready for one",
    text: "saying whether a support note is ready for one named routine says that routine has no support note in the record and does not contact support or send a version or send an operating system or send an error message or send a request id or send a conversation id or include a password or include a one-time code or include a private key or include a secret value or post on X or tag @bot or tag @grok or attach a video or change the region or finish the sign-in or choose Sign in or return to the app or confirm account access or complete an organization login or sign in with a different account or change the data setting or check for an app update or restart the app or restart to update or update the computer or retry the setup or reject an approval or cancel an approval or send a replacement instruction or regenerate an action or read an attachment or remove document protection or export a file or finish an upload or authenticate a plugin or install a plugin or reconnect a plugin or remove a plugin or connect a plugin or take over the computer or type a password or paste a code or complete a sign-in or open the computer or send a redirect or stop the routine or recover a computer or reset the computer or turn cloud access on or turn local access on or connect a computer or lock a team rule or edit a team rule or delete a team rule or save an ask-first rule or turn on allow automatically or turn on an allow-automatically rule or confirm a matching rule or a repository or connect a channel or start a test run or pause account access or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a quiet bot, a required plugin, or a source system as a support note",
    proof: "Is a support note ready for the Launch note routine says there is no support note. Asking does not contact support. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-retry-result",
    short: "Ask whether a retry changed the result for one",
    text: "saying whether a retry changed the result for one named routine says that routine has no retry result in the record and does not retry or restart the app or update the computer or contact support or send a version or send an operating system or send an error message or send a request id or send a conversation id or include a password or include a one-time code or include a private key or include a secret value or post on X or tag @bot or tag @grok or attach a video or change the region or finish the sign-in or choose Sign in or return to the app or confirm account access or complete an organization login or sign in with a different account or change the data setting or check for an app update or restart the app or restart to update or update the computer or retry the setup or reject an approval or cancel an approval or send a replacement instruction or regenerate an action or read an attachment or remove document protection or export a file or finish an upload or authenticate a plugin or install a plugin or reconnect a plugin or remove a plugin or connect a plugin or take over the computer or type a password or paste a code or complete a sign-in or open the computer or send a redirect or stop the routine or recover a computer or reset the computer or turn cloud access on or turn local access on or connect a computer or lock a team rule or edit a team rule or delete a team rule or save an ask-first rule or turn on allow automatically or turn on an allow-automatically rule or confirm a matching rule or a repository or connect a channel or start a test run or pause account access or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a quiet bot, a support note, a required plugin, or a source system as a retry result",
    proof: "Did a retry change the result for the Launch note routine says there is no retry result. Asking does not retry. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-disconnected-app",
    short: "Ask whether the app is disconnected for one",
    text: "saying whether the app is disconnected for one named routine says that routine has no disconnected app in the record and does not disconnect the app or retry or restart the app or update the computer or contact support or send a version or send an operating system or send an error message or send a request id or send a conversation id or include a password or include a one-time code or include a private key or include a secret value or post on X or tag @bot or tag @grok or attach a video or change the region or finish the sign-in or choose Sign in or return to the app or confirm account access or complete an organization login or sign in with a different account or change the data setting or check for an app update or restart the app or restart to update or update the computer or retry the setup or reject an approval or cancel an approval or send a replacement instruction or regenerate an action or read an attachment or remove document protection or export a file or finish an upload or authenticate a plugin or install a plugin or reconnect a plugin or remove a plugin or connect a plugin or take over the computer or type a password or paste a code or complete a sign-in or open the computer or send a redirect or stop the routine or recover a computer or reset the computer or turn cloud access on or turn local access on or connect a computer or lock a team rule or edit a team rule or delete a team rule or save an ask-first rule or turn on allow automatically or turn on an allow-automatically rule or confirm a matching rule or a repository or connect a channel or start a test run or pause account access or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a quiet bot, a support note, a retry result, a required plugin, or a source system as a disconnected app",
    proof: "Is the app disconnected for the Launch note routine says there is no disconnected app. Asking does not disconnect the app. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-least-destructive",
    short: "Ask whether one started with the least destructive step",
    text: "saying whether one named routine started with the least destructive step says that routine has no least-destructive step in the record and does not take a destructive step or disconnect the app or retry or restart the app or update the computer or contact support or send a version or send an operating system or send an error message or send a request id or send a conversation id or include a password or include a one-time code or include a private key or include a secret value or post on X or tag @bot or tag @grok or attach a video or change the region or finish the sign-in or choose Sign in or return to the app or confirm account access or complete an organization login or sign in with a different account or change the data setting or check for an app update or restart to update or retry the setup or reject an approval or cancel an approval or send a replacement instruction or regenerate an action or read an attachment or remove document protection or export a file or finish an upload or authenticate a plugin or install a plugin or reconnect a plugin or remove a plugin or connect a plugin or take over the computer or type a password or paste a code or complete a sign-in or open the computer or send a redirect or stop the routine or recover a computer or reset the computer or turn cloud access on or turn local access on or connect a computer or lock a team rule or edit a team rule or delete a team rule or save an ask-first rule or turn on allow automatically or turn on an allow-automatically rule or confirm a matching rule or a repository or connect a channel or start a test run or pause account access or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a quiet bot, a support note, a retry result, a disconnected app, a required plugin, or a source system as a least-destructive step",
    proof: "Did the Launch note routine start with the least destructive step says there is no least-destructive step. Asking does not take a destructive step. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-screen-task",
    short: "Ask whether a computer-use task is already active for one",
    text: "saying whether a computer-use task is already active for one named routine says that routine has no active screen task in the record and does not redirect the screen or start another screen task or finish the current screen task or send a redirect or open the computer or stop the routine or take a destructive step or disconnect the app or retry or restart the app or update the computer or contact support or send a version or send an operating system or send an error message or send a request id or send a conversation id or include a password or include a one-time code or include a private key or include a secret value or post on X or tag @bot or tag @grok or attach a video or change the region or finish the sign-in or choose Sign in or return to the app or confirm account access or complete an organization login or sign in with a different account or change the data setting or check for an app update or restart to update or retry the setup or reject an approval or cancel an approval or send a replacement instruction or regenerate an action or read an attachment or remove document protection or export a file or finish an upload or authenticate a plugin or install a plugin or reconnect a plugin or remove a plugin or connect a plugin or take over the computer or type a password or paste a code or complete a sign-in or recover a computer or reset the computer or turn cloud access on or turn local access on or connect a computer or lock a team rule or edit a team rule or delete a team rule or save an ask-first rule or turn on allow automatically or turn on an allow-automatically rule or confirm a matching rule or a repository or connect a channel or start a test run or pause account access or pause the routine or assign the routine to Grok Bot, Dots, or Muse or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a quiet bot, a support note, a retry result, a disconnected app, a least-destructive step, a required plugin, or a source system as an active screen task",
    proof: "Is a computer-use task already active for the Launch note routine says there is no active screen task. Asking does not redirect the screen. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-finish-before-rebuild",
    short: "Ask whether recovery should wait until one finishes computer work",
    text: "saying whether recovery should wait until one named routine finishes computer work says that routine has no finish-before-rebuild in the record and does not rebuild the computer or recover a computer or reset the computer or redirect the screen or open the computer or take a destructive step or start another screen task or finish the current screen task or send a redirect or stop the routine or disconnect the app or retry or restart the app or update the computer or contact support or send a version or send an operating system or send an error message or send a request id or send a conversation id or include a password or include a one-time code or include a private key or include a secret value or post on X or tag @bot or tag @grok or attach a video or change the region or finish the sign-in or choose Sign in or return to the app or confirm account access or complete an organization login or sign in with a different account or change the data setting or check for an app update or restart to update or retry the setup or reject an approval or cancel an approval or send a replacement instruction or regenerate an action or read an attachment or remove document protection or export a file or finish an upload or authenticate a plugin or install a plugin or reconnect a plugin or remove a plugin or connect a plugin or take over the computer or type a password or paste a code or complete a sign-in or turn cloud access on or turn local access on or connect a computer or lock a team rule or edit a team rule or delete a team rule or save an ask-first rule or turn on allow automatically or turn on an allow-automatically rule or confirm a matching rule or a repository or connect a channel or start a test run or pause account access or pause the routine or assign the routine to Grok Bot, Dots, or Muse or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a quiet bot, a support note, a retry result, a disconnected app, a least-destructive step, an active screen task, a required plugin, or a source system as a finish-before-rebuild",
    proof: "Should recovery wait until the Launch note routine finishes computer work says there is no finish-before-rebuild. Asking does not rebuild the computer. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-kept-conversation",
    short: "Ask whether conversations for one survive a reset",
    text: "saying whether conversations for one named routine survive a reset says that routine has no kept conversation in the record and does not move the saved chat or reset the computer or rebuild the computer or recover a computer or redirect the screen or open the computer or take a destructive step or start another screen task or finish the current screen task or send a redirect or stop the routine or disconnect the app or retry or restart the app or update the computer or contact support or send a version or send an operating system or send an error message or send a request id or send a conversation id or include a password or include a one-time code or include a private key or include a secret value or post on X or tag @bot or tag @grok or attach a video or change the region or finish the sign-in or choose Sign in or return to the app or confirm account access or complete an organization login or sign in with a different account or change the data setting or check for an app update or restart to update or retry the setup or reject an approval or cancel an approval or send a replacement instruction or regenerate an action or read an attachment or remove document protection or export a file or finish an upload or authenticate a plugin or install a plugin or reconnect a plugin or remove a plugin or connect a plugin or take over the computer or type a password or paste a code or complete a sign-in or turn cloud access on or turn local access on or connect a computer or lock a team rule or edit a team rule or delete a team rule or save an ask-first rule or turn on allow automatically or turn on an allow-automatically rule or confirm a matching rule or a repository or connect a channel or start a test run or pause account access or pause the routine or assign the routine to Grok Bot, Dots, or Muse or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a quiet bot, a support note, a retry result, a disconnected app, a least-destructive step, an active screen task, a finish-before-rebuild, a required plugin, or a source system as a kept conversation",
    proof: "Do conversations for the Launch note routine survive a reset says there is no kept conversation. Asking leaves the saved chat in place. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-kept-file",
    short: "Ask whether the computer image for one keeps logins",
    text: "saying whether the computer image for one named routine keeps logins says that routine has no kept-file in the record and does not move the saved files or update the computer or remove an installed app or remove a package or move the saved chat or reset the computer or rebuild the computer or recover a computer or redirect the screen or open the computer or take a destructive step or start another screen task or finish the current screen task or send a redirect or stop the routine or disconnect the app or retry or restart the app or update the computer or contact support or send a version or send an operating system or send an error message or send a request id or send a conversation id or include a password or include a one-time code or include a private key or include a secret value or post on X or tag @bot or tag @grok or attach a video or change the region or finish the sign-in or choose Sign in or return to the app or confirm account access or complete an organization login or sign in with a different account or change the data setting or check for an app update or restart to update or retry the setup or reject an approval or cancel an approval or send a replacement instruction or regenerate an action or read an attachment or remove document protection or export a file or finish an upload or authenticate a plugin or install a plugin or reconnect a plugin or remove a plugin or connect a plugin or take over the computer or type a password or paste a code or complete a sign-in or turn cloud access on or turn local access on or connect a computer or lock a team rule or edit a team rule or delete a team rule or save an ask-first rule or turn on allow automatically or turn on an allow-automatically rule or confirm a matching rule or a repository or connect a channel or start a test run or pause account access or pause the routine or assign the routine to Grok Bot, Dots, or Muse or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a quiet bot, a support note, a retry result, a disconnected app, a least-destructive step, an active screen task, a finish-before-rebuild, a kept conversation, a required plugin, or a source system as a kept-file",
    proof: "Does the computer image for the Launch note routine keep logins says there is no kept-file. Asking leaves the saved files in place. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-software-refresh",
    short: "Ask whether a software update for one keeps installed apps",
    text: "saying whether a software update for one named routine keeps installed apps says that routine has no software refresh in the record and does not refresh the software or install an app or update the computer or remove an installed app or remove a package or move the saved files or move the saved chat or reset the computer or rebuild the computer or recover a computer or redirect the screen or open the computer or take a destructive step or start another screen task or finish the current screen task or send a redirect or stop the routine or disconnect the app or retry or restart the app or contact support or assign the routine to Grok Bot, Dots, or Muse or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a quiet bot, a support note, a retry result, a disconnected app, a least-destructive step, an active screen task, a finish-before-rebuild, a kept conversation, a kept-file, a required plugin, or a source system as a software refresh",
    proof: "Does a software update for the Launch note routine keep installed apps says there is no software refresh. Asking does not refresh the software. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-scratch-folder",
    short: "Ask whether a normal recovery for one replaces uncommitted state",
    text: "saying whether a normal recovery for one named routine replaces uncommitted state says that routine has no scratch folder in the record and does not delete a temporary directory or recover a computer or refresh the software or install an app or update the computer or remove an installed app or remove a package or move the saved files or move the saved chat or reset the computer or rebuild the computer or redirect the screen or open the computer or take a destructive step or start another screen task or finish the current screen task or send a redirect or stop the routine or disconnect the app or retry or restart the app or contact support or assign the routine to Grok Bot, Dots, or Muse or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a quiet bot, a support note, a retry result, a disconnected app, a least-destructive step, an active screen task, a finish-before-rebuild, a kept conversation, a kept-file, a software refresh, a required plugin, or a source system as a scratch folder",
    proof: "Does a normal recovery for the Launch note routine replace uncommitted state says there is no scratch folder. Asking does not delete a temporary directory. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-work-surface",
    short: "Ask whether a screen for one is a separate security boundary",
    text: "saying whether a screen for one named routine is a separate security boundary says that routine has no work surface in the record and does not merge the screens or change a security boundary or delete a temporary directory or recover a computer or refresh the software or install an app or update the computer or remove an installed app or remove a package or move the saved files or move the saved chat or reset the computer or rebuild the computer or redirect the screen or open the computer or take a destructive step or start another screen task or finish the current screen task or send a redirect or stop the routine or disconnect the app or retry or restart the app or contact support or assign the routine to Grok Bot, Dots, or Muse or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a quiet bot, a support note, a retry result, a disconnected app, a least-destructive step, an active screen task, a finish-before-rebuild, a kept conversation, a kept-file, a software refresh, a scratch folder, a required plugin, or a source system as a work surface",
    proof: "Is a screen for the Launch note routine a separate security boundary says there is no work surface. Asking does not merge the screens. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-private-host",
    short: "Ask whether isolation between users is strict for one",
    text: "saying whether isolation between users is strict for one named routine says that routine has no private host in the record and does not share one computer across users or merge the screens or change a security boundary or delete a temporary directory or recover a computer or refresh the software or install an app or update the computer or remove an installed app or remove a package or move the saved files or move the saved chat or reset the computer or rebuild the computer or redirect the screen or open the computer or take a destructive step or start another screen task or finish the current screen task or send a redirect or stop the routine or disconnect the app or retry or restart the app or contact support or assign the routine to Grok Bot, Dots, or Muse or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a quiet bot, a support note, a retry result, a disconnected app, a least-destructive step, an active screen task, a finish-before-rebuild, a kept conversation, a kept-file, a software refresh, a scratch folder, a work surface, a required plugin, or a source system as a private host",
    proof: "Is isolation between users strict for the Launch note routine says there is no private host. Asking does not share one computer across users. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-guest-slice",
    short: "Ask whether one keeps its own kernel",
    text: "saying whether one named routine keeps its own kernel says that routine has no guest slice in the record and does not boot a microVM or share one computer across users or merge the screens or change a security boundary or delete a temporary directory or recover a computer or refresh the software or install an app or update the computer or remove an installed app or remove a package or move the saved files or move the saved chat or reset the computer or rebuild the computer or redirect the screen or open the computer or take a destructive step or start another screen task or finish the current screen task or send a redirect or stop the routine or disconnect the app or retry or restart the app or contact support or assign the routine to Grok Bot, Dots, or Muse or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a quiet bot, a support note, a retry result, a disconnected app, a least-destructive step, an active screen task, a finish-before-rebuild, a kept conversation, a kept-file, a software refresh, a scratch folder, a work surface, a private host, a required plugin, or a source system as a guest slice",
    proof: "Does the Launch note routine keep its own kernel says there is no guest slice. Asking does not boot a microVM. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-persona-ledger",
    short: "Ask whether one isolates workspaces, not compute",
    text: "saying whether one named routine isolates workspaces, not compute says that routine has no persona ledger in the record and does not merge personalities or split compute or boot a microVM or share one computer across users or merge the screens or change a security boundary or delete a temporary directory or recover a computer or refresh the software or install an app or update the computer or remove an installed app or remove a package or move the saved files or move the saved chat or reset the computer or rebuild the computer or redirect the screen or open the computer or take a destructive step or start another screen task or finish the current screen task or send a redirect or stop the routine or disconnect the app or retry or restart the app or contact support or assign the routine to Grok Bot, Dots, or Muse or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a quiet bot, a support note, a retry result, a disconnected app, a least-destructive step, an active screen task, a finish-before-rebuild, a kept conversation, a kept-file, a software refresh, a scratch folder, a work surface, a private host, a guest slice, a required plugin, or a source system as a persona ledger",
    proof: "Does the Launch note routine isolate workspaces, not compute says there is no persona ledger. Asking does not merge personalities. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-common-tray",
    short: "Ask whether a login or file for one is available to every bot",
    text: "saying whether a login or file for one named routine is available to every bot says that routine has no common tray in the record and does not sign the browser out or share a login across bots or remove a temporary file or merge personalities or split compute or boot a microVM or share one computer across users or merge the screens or change a security boundary or delete a temporary directory or recover a computer or refresh the software or install an app or update the computer or remove an installed app or remove a package or move the saved files or move the saved chat or reset the computer or rebuild the computer or redirect the screen or open the computer or take a destructive step or start another screen task or finish the current screen task or send a redirect or stop the routine or disconnect the app or retry or restart the app or contact support or assign the routine to Grok Bot, Dots, or Muse or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a quiet bot, a support note, a retry result, a disconnected app, a least-destructive step, an active screen task, a finish-before-rebuild, a kept conversation, a kept-file, a software refresh, a scratch folder, a work surface, a private host, a guest slice, a persona ledger, a required plugin, or a source system as a common tray",
    proof: "Is a login or file for the Launch note routine available to every bot says there is no common tray. Asking does not sign the browser out. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-solo-roster",
    short: "Ask whether one needs its own Cursor user for a separate computer",
    text: "saying whether one named routine needs its own Cursor user for a separate computer and credential set says that routine has no solo roster in the record and does not give a workload its own user or create a Cursor user or sign the browser out or share a login across bots or remove a temporary file or merge personalities or split compute or boot a microVM or share one computer across users or merge the screens or change a security boundary or delete a temporary directory or recover a computer or refresh the software or install an app or update the computer or remove an installed app or remove a package or move the saved files or move the saved chat or reset the computer or rebuild the computer or redirect the screen or open the computer or take a destructive step or start another screen task or finish the current screen task or send a redirect or stop the routine or disconnect the app or retry or restart the app or contact support or assign the routine to Grok Bot, Dots, or Muse or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a quiet bot, a support note, a retry result, a disconnected app, a least-destructive step, an active screen task, a finish-before-rebuild, a kept conversation, a kept-file, a software refresh, a scratch folder, a work surface, a private host, a guest slice, a persona ledger, a common tray, a required plugin, or a source system as a solo roster",
    proof: "Does the Launch note routine need its own Cursor user for a separate computer and credential set says there is no solo roster. Asking does not give a workload its own user. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-team-bench",
    short: "Ask whether one shares a cloud-hosted bot with everyone on the team",
    text: "saying whether one named routine shares a cloud-hosted bot with everyone on the team says that routine has no team bench in the record and does not share a team bot or invite a member or open someone else's chat or give a workload its own user or create a Cursor user or sign the browser out or share a login across bots or remove a temporary file or merge personalities or split compute or boot a microVM or share one computer across users or merge the screens or change a security boundary or delete a temporary directory or recover a computer or refresh the software or install an app or update the computer or remove an installed app or remove a package or move the saved files or move the saved chat or reset the computer or rebuild the computer or redirect the screen or open the computer or take a destructive step or start another screen task or finish the current screen task or send a redirect or stop the routine or disconnect the app or retry or restart the app or contact support or assign the routine to Grok Bot, Dots, or Muse or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a quiet bot, a support note, a retry result, a disconnected app, a least-destructive step, an active screen task, a finish-before-rebuild, a kept conversation, a kept-file, a software refresh, a scratch folder, a work surface, a private host, a guest slice, a persona ledger, a common tray, a solo roster, a required plugin, or a source system as a team bench",
    proof: "Does the Launch note routine share a cloud-hosted bot with everyone on the team says there is no team bench. Asking does not share a team bot. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-group-computer",
    short: "Ask whether one uses one computer of its own in a Slack group",
    text: "saying whether one named routine uses one computer of its own in Slack channels, threads, group DMs, and group chats says that routine has no group computer in the record and does not give the group its own computer or assign a channel computer or lend the group a machine or share a team bot or invite a member or open someone else's chat or give a workload its own user or create a Cursor user or sign the browser out or share a login across bots or remove a temporary file or merge personalities or split compute or boot a microVM or share one computer across users or merge the screens or change a security boundary or delete a temporary directory or recover a computer or refresh the software or install an app or update the computer or remove an installed app or remove a package or move the saved files or move the saved chat or reset the computer or rebuild the computer or redirect the screen or open the computer or take a destructive step or start another screen task or finish the current screen task or send a redirect or stop the routine or disconnect the app or retry or restart the app or contact support or assign the routine to Grok Bot, Dots, or Muse or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a quiet bot, a support note, a retry result, a disconnected app, a least-destructive step, an active screen task, a finish-before-rebuild, a kept conversation, a kept-file, a software refresh, a scratch folder, a work surface, a private host, a guest slice, a persona ledger, a common tray, a solo roster, a team bench, a required plugin, or a source system as a group computer",
    proof: "Does the Launch note routine use one computer of its own in Slack channels, threads, group DMs, and group chats says there is no group computer. Asking does not give the group its own computer. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-direct-desk",
    short: "Ask whether one works on that member's computer in an own chat or Slack DM",
    text: "saying whether one named routine works on that member's computer in that member's own chat or Slack DM says that routine has no direct desk in the record and does not put the work on that member's computer or borrow that member's computer or seat the work on that member's machine or give the group its own computer or assign a channel computer or lend the group a machine or share a team bot or invite a member or open someone else's chat or give a workload its own user or create a Cursor user or sign the browser out or share a login across bots or remove a temporary file or merge personalities or split compute or boot a microVM or share one computer across users or merge the screens or change a security boundary or delete a temporary directory or recover a computer or refresh the software or install an app or update the computer or remove an installed app or remove a package or move the saved files or move the saved chat or reset the computer or rebuild the computer or redirect the screen or open the computer or take a destructive step or start another screen task or finish the current screen task or send a redirect or stop the routine or disconnect the app or retry or restart the app or contact support or assign the routine to Grok Bot, Dots, or Muse or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a quiet bot, a support note, a retry result, a disconnected app, a least-destructive step, an active screen task, a finish-before-rebuild, a kept conversation, a kept-file, a software refresh, a scratch folder, a work surface, a private host, a guest slice, a persona ledger, a common tray, a solo roster, a team bench, a group computer, a required plugin, or a source system as a direct desk",
    proof: "Does the Launch note routine work on that member's computer in that member's own chat or Slack DM says there is no direct desk. Asking does not put the work on that member's computer. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-asked-meter",
    short: "Ask whether one uses that member's connected accounts and Grok Bot usage",
    text: "saying whether one named routine uses that member's connected accounts after asking and that member's Grok Bot usage says that routine has no asked meter in the record and does not use that member's connected accounts or use that member's Grok Bot usage or bill that member's quota or put the work on that member's computer or borrow that member's computer or seat the work on that member's machine or give the group its own computer or assign a channel computer or lend the group a machine or share a team bot or invite a member or open someone else's chat or give a workload its own user or create a Cursor user or sign the browser out or share a login across bots or remove a temporary file or merge personalities or split compute or boot a microVM or share one computer across users or merge the screens or change a security boundary or delete a temporary directory or recover a computer or refresh the software or install an app or update the computer or remove an installed app or remove a package or move the saved files or move the saved chat or reset the computer or rebuild the computer or redirect the screen or open the computer or take a destructive step or start another screen task or finish the current screen task or send a redirect or stop the routine or disconnect the app or retry or restart the app or contact support or assign the routine to Grok Bot, Dots, or Muse or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a quiet bot, a support note, a retry result, a disconnected app, a least-destructive step, an active screen task, a finish-before-rebuild, a kept conversation, a kept-file, a software refresh, a scratch folder, a work surface, a private host, a guest slice, a persona ledger, a common tray, a solo roster, a team bench, a group computer, a direct desk, a required plugin, or a source system as an asked meter",
    proof: "Does the Launch note routine use that member's connected accounts after asking and that member's Grok Bot usage says there is no asked meter. Asking does not use that member's connected accounts. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-shared-kit",
    short: "Ask whether one makes an owner or Manager kit available in every teammate's chat",
    text: "saying whether one named routine makes secrets, apps, and files the owner or a Manager adds to a Team Bot available in every teammate's chat says that routine has no shared kit in the record and does not spread that kit across teammate chats or add a secret or share a file or use that member's connected accounts or use that member's Grok Bot usage or bill that member's quota or put the work on that member's computer or borrow that member's computer or seat the work on that member's machine or give the group its own computer or assign a channel computer or lend the group a machine or share a team bot or invite a member or open someone else's chat or give a workload its own user or create a Cursor user or sign the browser out or share a login across bots or remove a temporary file or merge personalities or split compute or boot a microVM or share one computer across users or merge the screens or change a security boundary or delete a temporary directory or recover a computer or refresh the software or install an app or update the computer or remove an installed app or remove a package or move the saved files or move the saved chat or reset the computer or rebuild the computer or redirect the screen or open the computer or take a destructive step or start another screen task or finish the current screen task or send a redirect or stop the routine or disconnect the app or retry or restart the app or contact support or assign the routine to Grok Bot, Dots, or Muse or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a quiet bot, a support note, a retry result, a disconnected app, a least-destructive step, an active screen task, a finish-before-rebuild, a kept conversation, a kept-file, a software refresh, a scratch folder, a work surface, a private host, a guest slice, a persona ledger, a common tray, a solo roster, a team bench, a group computer, a direct desk, an asked meter, a required plugin, or a source system as a shared kit",
    proof: "Does the Launch note routine make secrets, apps, and files the owner or a Manager adds to a Team Bot available in every teammate's chat says there is no shared kit. Asking does not spread that kit across teammate chats. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-sealed-chat",
    short: "Ask whether one keeps each member's chat private from the owner and Managers",
    text: "saying whether one named routine keeps each member's chat private, including from the owner and the Bot's Managers says that routine has no sealed chat in the record and does not reveal that member's chat to the owner or a Manager or display that member's chat to the owner or display that member's chat to a Manager or spread that kit across teammate chats or add a secret or share a file or use that member's connected accounts or use that member's Grok Bot usage or bill that member's quota or put the work on that member's computer or borrow that member's computer or seat the work on that member's machine or give the group its own computer or assign a channel computer or lend the group a machine or share a team bot or invite a member or open someone else's chat or give a workload its own user or create a Cursor user or sign the browser out or share a login across bots or remove a temporary file or merge personalities or split compute or boot a microVM or share one computer across users or merge the screens or change a security boundary or delete a temporary directory or recover a computer or refresh the software or install an app or update the computer or remove an installed app or remove a package or move the saved files or move the saved chat or reset the computer or rebuild the computer or redirect the screen or open the computer or take a destructive step or start another screen task or finish the current screen task or send a redirect or stop the routine or disconnect the app or retry or restart the app or contact support or assign the routine to Grok Bot, Dots, or Muse or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a quiet bot, a support note, a retry result, a disconnected app, a least-destructive step, an active screen task, a finish-before-rebuild, a kept conversation, a kept-file, a software refresh, a scratch folder, a work surface, a private host, a guest slice, a persona ledger, a common tray, a solo roster, a team bench, a group computer, a direct desk, an asked meter, a shared kit, a required plugin, or a source system as a sealed chat",
    proof: "Does the Launch note routine keep each member's chat private, including from the owner and the Bot's Managers says there is no sealed chat. Asking does not reveal that member's chat to the owner or a Manager. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-delegated-lane",
    short: "Ask whether one runs delegated work on separate computers",
    text: "saying whether one named routine runs delegated work on separate computers under your existing Cloud Agent controls says that routine has no delegated lane in the record and does not hand the coding work off or start a separate computer or change Cloud Agent controls or reveal that member's chat to the owner or a Manager or display that member's chat to the owner or display that member's chat to a Manager or spread that kit across teammate chats or add a secret or share a file or use that member's connected accounts or use that member's Grok Bot usage or bill that member's quota or put the work on that member's computer or borrow that member's computer or seat the work on that member's machine or give the group its own computer or assign a channel computer or lend the group a machine or share a team bot or invite a member or open someone else's chat or give a workload its own user or create a Cursor user or sign the browser out or share a login across bots or remove a temporary file or merge personalities or split compute or boot a microVM or share one computer across users or merge the screens or change a security boundary or delete a temporary directory or recover a computer or refresh the software or install an app or update the computer or remove an installed app or remove a package or move the saved files or move the saved chat or reset the computer or rebuild the computer or redirect the screen or open the computer or take a destructive step or start another screen task or finish the current screen task or send a redirect or stop the routine or disconnect the app or retry or restart the app or contact support or assign the routine to Grok Bot, Dots, or Muse or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a quiet bot, a support note, a retry result, a disconnected app, a least-destructive step, an active screen task, a finish-before-rebuild, a kept conversation, a kept-file, a software refresh, a scratch folder, a work surface, a private host, a guest slice, a persona ledger, a common tray, a solo roster, a team bench, a group computer, a direct desk, an asked meter, a shared kit, a sealed chat, a required plugin, or a source system as a delegated lane",
    proof: "Does the Launch note routine run delegated work on separate computers under your existing Cloud Agent controls says there is no delegated lane. Asking does not hand the coding work off. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-default-switch",
    short: "Ask whether one keeps the Cloud Agents switch on for the whole team",
    text: "saying whether one named routine keeps the Cloud Agents switch on the Grok Bot page for the whole team and on by default says that routine has no default switch in the record and does not flip that switch or hand the coding work off or start a separate computer or change Cloud Agent controls or reveal that member's chat to the owner or a Manager or display that member's chat to the owner or display that member's chat to a Manager or spread that kit across teammate chats or add a secret or share a file or use that member's connected accounts or use that member's Grok Bot usage or bill that member's quota or put the work on that member's computer or borrow that member's computer or seat the work on that member's machine or give the group its own computer or assign a channel computer or lend the group a machine or share a team bot or invite a member or open someone else's chat or give a workload its own user or create a Cursor user or sign the browser out or share a login across bots or remove a temporary file or merge personalities or split compute or boot a microVM or share one computer across users or merge the screens or change a security boundary or delete a temporary directory or recover a computer or refresh the software or install an app or update the computer or remove an installed app or remove a package or move the saved files or move the saved chat or reset the computer or rebuild the computer or redirect the screen or open the computer or take a destructive step or start another screen task or finish the current screen task or send a redirect or stop the routine or disconnect the app or retry or restart the app or contact support or assign the routine to Grok Bot, Dots, or Muse or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a quiet bot, a support note, a retry result, a disconnected app, a least-destructive step, an active screen task, a finish-before-rebuild, a kept conversation, a kept-file, a software refresh, a scratch folder, a work surface, a private host, a guest slice, a persona ledger, a common tray, a solo roster, a team bench, a group computer, a direct desk, an asked meter, a shared kit, a sealed chat, a delegated lane, a required plugin, or a source system as a default switch",
    proof: "Does the Launch note routine keep the Cloud Agents switch on the Grok Bot page for the whole team and on by default says there is no default switch. Asking does not flip that switch. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-rest-latch",
    short: "Ask whether one turns it off when the team does not need delegation",
    text: "saying whether one named routine turns it off when your team does not need delegation says that routine has no rest latch in the record and does not turn delegation off or flip that switch or hand the coding work off or start a separate computer or change Cloud Agent controls or reveal that member's chat to the owner or a Manager or display that member's chat to the owner or display that member's chat to a Manager or spread that kit across teammate chats or add a secret or share a file or use that member's connected accounts or use that member's Grok Bot usage or bill that member's quota or put the work on that member's computer or borrow that member's computer or seat the work on that member's machine or give the group its own computer or assign a channel computer or lend the group a machine or share a team bot or invite a member or open someone else's chat or give a workload its own user or create a Cursor user or sign the browser out or share a login across bots or remove a temporary file or merge personalities or split compute or boot a microVM or share one computer across users or merge the screens or change a security boundary or delete a temporary directory or recover a computer or refresh the software or install an app or update the computer or remove an installed app or remove a package or move the saved files or move the saved chat or reset the computer or rebuild the computer or redirect the screen or open the computer or take a destructive step or start another screen task or finish the current screen task or send a redirect or stop the routine or disconnect the app or retry or restart the app or contact support or assign the routine to Grok Bot, Dots, or Muse or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a quiet bot, a support note, a retry result, a disconnected app, a least-destructive step, an active screen task, a finish-before-rebuild, a kept conversation, a kept-file, a software refresh, a scratch folder, a work surface, a private host, a guest slice, a persona ledger, a common tray, a solo roster, a team bench, a group computer, a direct desk, an asked meter, a shared kit, a sealed chat, a delegated lane, a default switch, a required plugin, or a source system as a rest latch",
    proof: "Does the Launch note routine turn it off when your team does not need delegation says there is no rest latch. Asking does not turn delegation off. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },

  {
    id: "ask-spawn-hatch",
    short: "Ask whether one says admins can disable spawning",
    text: "saying whether one named routine says admins can disable spawning says that routine has no spawn hatch in the record and does not disable spawning or turn delegation off or flip that switch or hand the coding work off or start a separate computer or change Cloud Agent controls or reveal that member's chat to the owner or a Manager or display that member's chat to the owner or display that member's chat to a Manager or spread that kit across teammate chats or add a secret or share a file or use that member's connected accounts or use that member's Grok Bot usage or bill that member's quota or put the work on that member's computer or borrow that member's computer or seat the work on that member's machine or give the group its own computer or assign a channel computer or lend the group a machine or share a team bot or invite a member or open someone else's chat or give a workload its own user or create a Cursor user or sign the browser out or share a login across bots or remove a temporary file or merge personalities or split compute or boot a microVM or share one computer across users or merge the screens or change a security boundary or delete a temporary directory or recover a computer or refresh the software or install an app or update the computer or remove an installed app or remove a package or move the saved files or move the saved chat or reset the computer or rebuild the computer or redirect the screen or open the computer or take a destructive step or start another screen task or finish the current screen task or send a redirect or stop the routine or disconnect the app or retry or restart the app or contact support or assign the routine to Grok Bot, Dots, or Muse or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a quiet bot, a support note, a retry result, a disconnected app, a least-destructive step, an active screen task, a finish-before-rebuild, a kept conversation, a kept-file, a software refresh, a scratch folder, a work surface, a private host, a guest slice, a persona ledger, a common tray, a solo roster, a team bench, a group computer, a direct desk, an asked meter, a shared kit, a sealed chat, a delegated lane, a default switch, a rest latch, a required plugin, or a source system as a spawn hatch",
    proof: "Does the Launch note routine say admins can disable spawning says there is no spawn hatch. Asking does not disable spawning. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-quiet-gate",
    short: "Ask whether one says to disable Cloud Agent spawning if you do not need delegation",
    text: "saying whether one named routine says to disable Cloud Agent spawning if you do not need delegation says that routine has no quiet gate in the record and does not quiet Cloud Agent spawning or disable spawning or turn delegation off or flip that switch or hand the coding work off or start a separate computer or change Cloud Agent controls or reveal that member's chat to the owner or a Manager or display that member's chat to the owner or display that member's chat to a Manager or spread that kit across teammate chats or add a secret or share a file or use that member's connected accounts or use that member's Grok Bot usage or bill that member's quota or put the work on that member's computer or borrow that member's computer or seat the work on that member's machine or give the group its own computer or assign a channel computer or lend the group a machine or share a team bot or invite a member or open someone else's chat or give a workload its own user or create a Cursor user or sign the browser out or share a login across bots or remove a temporary file or merge personalities or split compute or boot a microVM or share one computer across users or merge the screens or change a security boundary or delete a temporary directory or recover a computer or refresh the software or install an app or update the computer or remove an installed app or remove a package or move the saved files or move the saved chat or reset the computer or rebuild the computer or redirect the screen or open the computer or take a destructive step or start another screen task or finish the current screen task or send a redirect or stop the routine or disconnect the app or retry or restart the app or contact support or assign the routine to Grok Bot, Dots, or Muse or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a quiet bot, a support note, a retry result, a disconnected app, a least-destructive step, an active screen task, a finish-before-rebuild, a kept conversation, a kept-file, a software refresh, a scratch folder, a work surface, a private host, a guest slice, a persona ledger, a common tray, a solo roster, a team bench, a group computer, a direct desk, an asked meter, a shared kit, a sealed chat, a delegated lane, a default switch, a rest latch, a spawn hatch, a required plugin, or a source system as a quiet gate",
    proof: "Does the Launch note routine say to disable Cloud Agent spawning if you do not need delegation says there is no quiet gate. Asking does not quiet Cloud Agent spawning. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-public-veil",
    short: "Ask whether one says to keep public template sharing off unless members should publish Bot templates outside the team",
    text: "saying whether one named routine says to keep public template sharing off unless members should publish Bot templates outside the team says that routine has no public veil in the record and does not keep public template sharing off or publish a Bot template or quiet Cloud Agent spawning or disable spawning or turn delegation off or flip that switch or hand the coding work off or start a separate computer or change Cloud Agent controls or reveal that member's chat to the owner or a Manager or display that member's chat to the owner or display that member's chat to a Manager or spread that kit across teammate chats or add a secret or share a file or use that member's connected accounts or use that member's Grok Bot usage or bill that member's quota or put the work on that member's computer or borrow that member's computer or seat the work on that member's machine or give the group its own computer or assign a channel computer or lend the group a machine or share a team bot or invite a member or open someone else's chat or give a workload its own user or create a Cursor user or sign the browser out or share a login across bots or remove a temporary file or merge personalities or split compute or boot a microVM or share one computer across users or merge the screens or change a security boundary or delete a temporary directory or recover a computer or refresh the software or install an app or update the computer or remove an installed app or remove a package or move the saved files or move the saved chat or reset the computer or rebuild the computer or redirect the screen or open the computer or take a destructive step or start another screen task or finish the current screen task or send a redirect or stop the routine or disconnect the app or retry or restart the app or contact support or assign the routine to Grok Bot, Dots, or Muse or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a quiet bot, a support note, a retry result, a disconnected app, a least-destructive step, an active screen task, a finish-before-rebuild, a kept conversation, a kept-file, a software refresh, a scratch folder, a work surface, a private host, a guest slice, a persona ledger, a common tray, a solo roster, a team bench, a group computer, a direct desk, an asked meter, a shared kit, a sealed chat, a delegated lane, a default switch, a rest latch, a spawn hatch, a quiet gate, a required plugin, or a source system as a public veil",
    proof: "Does the Launch note routine say to keep public template sharing off unless members should publish Bot templates outside the team says there is no public veil. Asking does not keep public template sharing off. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },

  {
    id: "ask-server-ring",
    short: "Ask whether one says that off keeps sharing team-only, including for templates that are already public",
    text: "saying whether one named routine says that off keeps sharing team-only, including for templates that are already public says that routine has no server ring in the record and does not keep sharing team-only or keep public template sharing off or publish a Bot template or quiet Cloud Agent spawning or disable spawning or turn delegation off or flip that switch or hand the coding work off or start a separate computer or change Cloud Agent controls or reveal that member's chat to the owner or a Manager or display that member's chat to the owner or display that member's chat to a Manager or spread that kit across teammate chats or add a secret or share a file or use that member's connected accounts or use that member's Grok Bot usage or bill that member's quota or put the work on that member's computer or borrow that member's computer or seat the work on that member's machine or give the group its own computer or assign a channel computer or lend the group a machine or share a team bot or invite a member or open someone else's chat or give a workload its own user or create a Cursor user or sign the browser out or share a login across bots or remove a temporary file or merge personalities or split compute or boot a microVM or share one computer across users or merge the screens or change a security boundary or delete a temporary directory or recover a computer or refresh the software or install an app or update the computer or remove an installed app or remove a package or move the saved files or move the saved chat or reset the computer or rebuild the computer or redirect the screen or open the computer or take a destructive step or start another screen task or finish the current screen task or send a redirect or stop the routine or disconnect the app or retry or restart the app or contact support or assign the routine to Grok Bot, Dots, or Muse or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a quiet bot, a support note, a retry result, a disconnected app, a least-destructive step, an active screen task, a finish-before-rebuild, a kept conversation, a kept-file, a software refresh, a scratch folder, a work surface, a private host, a guest slice, a persona ledger, a common tray, a solo roster, a team bench, a group computer, a direct desk, an asked meter, a shared kit, a sealed chat, a delegated lane, a default switch, a rest latch, a spawn hatch, a quiet gate, a public veil, a required plugin, or a source system as a server ring",
    proof: "Does the Launch note routine say that off keeps sharing team-only, including for templates that are already public says there is no server ring. Asking does not keep sharing team-only. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },

  {
    id: "ask-plan-notch",
    short: "Ask whether one says that enterprise teams start with public sharing off and other teams start with it allowed",
    text: "saying whether one named routine says that enterprise teams start with public sharing off and other teams start with it allowed says that routine has no plan notch in the record and does not start enterprise teams closed or leave other teams allowed or keep sharing team-only or keep public template sharing off or publish a Bot template or quiet Cloud Agent spawning or disable spawning or turn delegation off or flip that switch or hand the coding work off or start a separate computer or change Cloud Agent controls or reveal that member's chat to the owner or a Manager or display that member's chat to the owner or display that member's chat to a Manager or spread that kit across teammate chats or add a secret or share a file or use that member's connected accounts or use that member's Grok Bot usage or bill that member's quota or put the work on that member's computer or borrow that member's computer or seat the work on that member's machine or give the group its own computer or assign a channel computer or lend the group a machine or share a team bot or invite a member or open someone else's chat or give a workload its own user or create a Cursor user or sign the browser out or share a login across bots or remove a temporary file or merge personalities or split compute or boot a microVM or share one computer across users or merge the screens or change a security boundary or delete a temporary directory or recover a computer or refresh the software or install an app or update the computer or remove an installed app or remove a package or move the saved files or move the saved chat or reset the computer or rebuild the computer or redirect the screen or open the computer or take a destructive step or start another screen task or finish the current screen task or send a redirect or stop the routine or disconnect the app or retry or restart the app or contact support or assign the routine to Grok Bot, Dots, or Muse or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a quiet bot, a support note, a retry result, a disconnected app, a least-destructive step, an active screen task, a finish-before-rebuild, a kept conversation, a kept-file, a software refresh, a scratch folder, a work surface, a private host, a guest slice, a persona ledger, a common tray, a solo roster, a team bench, a group computer, a direct desk, an asked meter, a shared kit, a sealed chat, a delegated lane, a default switch, a rest latch, a spawn hatch, a quiet gate, a public veil, a server ring, a required plugin, or a source system as a plan notch",
    proof: "Does the Launch note routine say that enterprise teams start with public sharing off and other teams start with it allowed says there is no plan notch. Asking does not start enterprise teams closed. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-member-ceiling",
    short: "Ask whether one says to set Execution on Local Computer to Never allow unless Bots need to act on member machines",
    text: "saying whether one named routine says to set Execution on Local Computer to Never allow unless Bots need to act on member machines says that routine has no member ceiling in the record and does not set that ceiling to never allow or leave the choice to each member or start enterprise teams closed or leave other teams allowed or keep sharing team-only or keep public template sharing off or publish a Bot template or quiet Cloud Agent spawning or disable spawning or turn delegation off or flip that switch or hand the coding work off or start a separate computer or change Cloud Agent controls or reveal that member's chat to the owner or a Manager or display that member's chat to the owner or display that member's chat to a Manager or spread that kit across teammate chats or add a secret or share a file or use that member's connected accounts or use that member's Grok Bot usage or bill that member's quota or put the work on that member's computer or borrow that member's computer or seat the work on that member's machine or give the group its own computer or assign a channel computer or lend the group a machine or share a team bot or invite a member or open someone else's chat or give a workload its own user or create a Cursor user or sign the browser out or share a login across bots or remove a temporary file or merge personalities or split compute or boot a microVM or share one computer across users or merge the screens or change a security boundary or delete a temporary directory or recover a computer or refresh the software or install an app or update the computer or remove an installed app or remove a package or move the saved files or move the saved chat or reset the computer or rebuild the computer or redirect the screen or open the computer or take a destructive step or start another screen task or finish the current screen task or send a redirect or stop the routine or disconnect the app or retry or restart the app or contact support or assign the routine to Grok Bot, Dots, or Muse or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a quiet bot, a support note, a retry result, a disconnected app, a least-destructive step, an active screen task, a finish-before-rebuild, a kept conversation, a kept-file, a software refresh, a scratch folder, a work surface, a private host, a guest slice, a persona ledger, a common tray, a solo roster, a team bench, a group computer, a direct desk, an asked meter, a shared kit, a sealed chat, a delegated lane, a default switch, a rest latch, a spawn hatch, a quiet gate, a public veil, a server ring, a plan notch, a required plugin, or a source system as a member ceiling",
    proof: "Does the Launch note routine say to set Execution on Local Computer to Never allow unless Bots need to act on member machines says there is no member ceiling. Asking does not set that ceiling to never allow. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-choice-latch",
    short: "Ask whether one says that the default leaves the choice to each member",
    text: "saying whether one named routine says that the default leaves the choice to each member says that routine has no choice latch in the record and does not leave that choice with each member or pick Never allow for a specific reason or set that ceiling to never allow or leave the choice to each member or start enterprise teams closed or leave other teams allowed or keep sharing team-only or keep public template sharing off or publish a Bot template or quiet Cloud Agent spawning or disable spawning or turn delegation off or flip that switch or hand the coding work off or start a separate computer or change Cloud Agent controls or reveal that member's chat to the owner or a Manager or display that member's chat to the owner or display that member's chat to a Manager or spread that kit across teammate chats or add a secret or share a file or use that member's connected accounts or use that member's Grok Bot usage or bill that member's quota or put the work on that member's computer or borrow that member's computer or seat the work on that member's machine or give the group its own computer or assign a channel computer or lend the group a machine or share a team bot or invite a member or open someone else's chat or give a workload its own user or create a Cursor user or sign the browser out or share a login across bots or remove a temporary file or merge personalities or split compute or boot a microVM or share one computer across users or merge the screens or change a security boundary or delete a temporary directory or recover a computer or refresh the software or install an app or update the computer or remove an installed app or remove a package or move the saved files or move the saved chat or reset the computer or rebuild the computer or redirect the screen or open the computer or take a destructive step or start another screen task or finish the current screen task or send a redirect or stop the routine or disconnect the app or retry or restart the app or contact support or assign the routine to Grok Bot, Dots, or Muse or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a quiet bot, a support note, a retry result, a disconnected app, a least-destructive step, an active screen task, a finish-before-rebuild, a kept conversation, a kept-file, a software refresh, a scratch folder, a work surface, a private host, a guest slice, a persona ledger, a common tray, a solo roster, a team bench, a group computer, a direct desk, an asked meter, a shared kit, a sealed chat, a delegated lane, a default switch, a rest latch, a spawn hatch, a quiet gate, a public veil, a server ring, a plan notch, a member ceiling, a required plugin, or a source system as a choice latch",
    proof: "Does the Launch note routine say that the default leaves the choice to each member says there is no choice latch. Asking does not leave that choice with each member. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-local-shutter",
    short: "Ask whether one says that ask every time makes every local task ask for approval and never allow turns local execution off for the whole team",
    text: "saying whether one named routine says that ask every time makes every local task ask for approval and never allow turns local execution off for the whole team says that routine has no local shutter in the record and does not turn local execution off for the whole team or make every local task ask for approval or leave that choice with each member or pick Never allow for a specific reason or set that ceiling to never allow or leave the choice to each member or start enterprise teams closed or leave other teams allowed or keep sharing team-only or keep public template sharing off or publish a Bot template or quiet Cloud Agent spawning or disable spawning or turn delegation off or flip that switch or hand the coding work off or start a separate computer or change Cloud Agent controls or reveal that member's chat to the owner or a Manager or display that member's chat to the owner or display that member's chat to a Manager or spread that kit across teammate chats or add a secret or share a file or use that member's connected accounts or use that member's Grok Bot usage or bill that member's quota or put the work on that member's computer or borrow that member's computer or seat the work on that member's machine or give the group its own computer or assign a channel computer or lend the group a machine or share a team bot or invite a member or open someone else's chat or give a workload its own user or create a Cursor user or sign the browser out or share a login across bots or remove a temporary file or merge personalities or split compute or boot a microVM or share one computer across users or merge the screens or change a security boundary or delete a temporary directory or recover a computer or refresh the software or install an app or update the computer or remove an installed app or remove a package or move the saved files or move the saved chat or reset the computer or rebuild the computer or redirect the screen or open the computer or take a destructive step or start another screen task or finish the current screen task or send a redirect or stop the routine or disconnect the app or retry or restart the app or contact support or assign the routine to Grok Bot, Dots, or Muse or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a quiet bot, a support note, a retry result, a disconnected app, a least-destructive step, an active screen task, a finish-before-rebuild, a kept conversation, a kept-file, a software refresh, a scratch folder, a work surface, a private host, a guest slice, a persona ledger, a common tray, a solo roster, a team bench, a group computer, a direct desk, an asked meter, a shared kit, a sealed chat, a delegated lane, a default switch, a rest latch, a spawn hatch, a quiet gate, a public veil, a server ring, a plan notch, a member ceiling, a choice latch, a required plugin, or a source system as a local shutter",
    proof: "Does the Launch note routine say that ask every time makes every local task ask for approval and never allow turns local execution off for the whole team says there is no local shutter. Asking does not turn local execution off for the whole team. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-stricter-keep",
    short: "Ask whether one says that a member's own setting still applies when it is stricter than the team's",
    text: "saying whether one named routine says that a member's own setting still applies when it is stricter than the team's says that routine has no stricter keep in the record and does not keep a stricter member setting in force or drop that stricter member setting or ignore a stricter member setting or turn local execution off for the whole team or make every local task ask for approval or leave that choice with each member or pick Never allow for a specific reason or set that ceiling to never allow or leave the choice to each member or start enterprise teams closed or leave other teams allowed or keep sharing team-only or keep public template sharing off or publish a Bot template or quiet Cloud Agent spawning or disable spawning or turn delegation off or flip that switch or hand the coding work off or start a separate computer or change Cloud Agent controls or reveal that member's chat to the owner or a Manager or display that member's chat to the owner or display that member's chat to a Manager or spread that kit across teammate chats or add a secret or share a file or use that member's connected accounts or use that member's Grok Bot usage or bill that member's quota or put the work on that member's computer or borrow that member's computer or seat the work on that member's machine or give the group its own computer or assign a channel computer or lend the group a machine or share a team bot or invite a member or open someone else's chat or give a workload its own user or create a Cursor user or sign the browser out or share a login across bots or remove a temporary file or merge personalities or split compute or boot a microVM or share one computer across users or merge the screens or change a security boundary or delete a temporary directory or recover a computer or refresh the software or install an app or update the computer or remove an installed app or remove a package or move the saved files or move the saved chat or reset the computer or rebuild the computer or redirect the screen or open the computer or take a destructive step or start another screen task or finish the current screen task or send a redirect or stop the routine or disconnect the app or retry or restart the app or contact support or assign the routine to Grok Bot, Dots, or Muse or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a quiet bot, a support note, a retry result, a disconnected app, a least-destructive step, an active screen task, a finish-before-rebuild, a kept conversation, a kept-file, a software refresh, a scratch folder, a work surface, a private host, a guest slice, a persona ledger, a common tray, a solo roster, a team bench, a group computer, a direct desk, an asked meter, a shared kit, a sealed chat, a delegated lane, a default switch, a rest latch, a spawn hatch, a quiet gate, a public veil, a server ring, a plan notch, a member ceiling, a choice latch, a local shutter, a required plugin, or a source system as a stricter keep",
    proof: "Does the Launch note routine say that a member's own setting still applies when it is stricter than the team's says there is no stricter keep. Asking does not keep a stricter member setting in force. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-reason-bar",
    short: "Ask whether one says to pick Never allow unless Bots have a specific reason to work on member machines",
    text: "saying whether one named routine says to pick Never allow unless Bots have a specific reason to work on member machines says that routine has no reason bar in the record and does not pick Never allow unless a specific reason is named or reserve Never allow for a member-machine reason or hold Never allow for that member-machine case or keep a stricter member setting in force or drop that stricter member setting or ignore a stricter member setting or turn local execution off for the whole team or make every local task ask for approval or leave that choice with each member or pick Never allow for a specific reason or set that ceiling to never allow or leave the choice to each member or start enterprise teams closed or leave other teams allowed or keep sharing team-only or keep public template sharing off or publish a Bot template or quiet Cloud Agent spawning or disable spawning or turn delegation off or flip that switch or hand the coding work off or start a separate computer or change Cloud Agent controls or reveal that member's chat to the owner or a Manager or display that member's chat to the owner or display that member's chat to a Manager or spread that kit across teammate chats or add a secret or share a file or use that member's connected accounts or use that member's Grok Bot usage or bill that member's quota or put the work on that member's computer or borrow that member's computer or seat the work on that member's machine or give the group its own computer or assign a channel computer or lend the group a machine or share a team bot or invite a member or open someone else's chat or give a workload its own user or create a Cursor user or sign the browser out or share a login across bots or remove a temporary file or merge personalities or split compute or boot a microVM or share one computer across users or merge the screens or change a security boundary or delete a temporary directory or recover a computer or refresh the software or install an app or update the computer or remove an installed app or remove a package or move the saved files or move the saved chat or reset the computer or rebuild the computer or redirect the screen or open the computer or take a destructive step or start another screen task or finish the current screen task or send a redirect or stop the routine or disconnect the app or retry or restart the app or contact support or assign the routine to Grok Bot, Dots, or Muse or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a quiet bot, a support note, a retry result, a disconnected app, a least-destructive step, an active screen task, a finish-before-rebuild, a kept conversation, a kept-file, a software refresh, a scratch folder, a work surface, a private host, a guest slice, a persona ledger, a common tray, a solo roster, a team bench, a group computer, a direct desk, an asked meter, a shared kit, a sealed chat, a delegated lane, a default switch, a rest latch, a spawn hatch, a quiet gate, a public veil, a server ring, a plan notch, a member ceiling, a choice latch, a local shutter, a stricter keep, a required plugin, or a source system as a reason bar",
    proof: "Does the Launch note routine say to pick Never allow unless Bots have a specific reason to work on member machines says there is no reason bar. Asking does not pick Never allow unless a specific reason is named. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
  },
  {
    id: "ask-habit-ask",
    short: "Ask whether one says that the default leaves the choice to each member, whose own setting defaults to asking before every task",
    text: "saying whether one named routine says that the default leaves the choice to each member, whose own setting defaults to asking before every task says that routine has no habit ask in the record and does not set the member's own setting to ask before every task or preset that member's own setting to ask before every task or lock that member's own setting on ask before every task or pick Never allow unless a specific reason is named or reserve Never allow for a member-machine reason or hold Never allow for that member-machine case or keep a stricter member setting in force or drop that stricter member setting or ignore a stricter member setting or turn local execution off for the whole team or make every local task ask for approval or leave that choice with each member or pick Never allow for a specific reason or set that ceiling to never allow or leave the choice to each member or start enterprise teams closed or leave other teams allowed or keep sharing team-only or keep public template sharing off or publish a Bot template or quiet Cloud Agent spawning or disable spawning or turn delegation off or flip that switch or hand the coding work off or start a separate computer or change Cloud Agent controls or reveal that member's chat to the owner or a Manager or display that member's chat to the owner or display that member's chat to a Manager or spread that kit across teammate chats or add a secret or share a file or use that member's connected accounts or use that member's Grok Bot usage or bill that member's quota or put the work on that member's computer or borrow that member's computer or seat the work on that member's machine or give the group its own computer or assign a channel computer or lend the group a machine or share a team bot or invite a member or open someone else's chat or give a workload its own user or create a Cursor user or sign the browser out or share a login across bots or remove a temporary file or merge personalities or split compute or boot a microVM or share one computer across users or merge the screens or change a security boundary or delete a temporary directory or recover a computer or refresh the software or install an app or update the computer or remove an installed app or remove a package or move the saved files or move the saved chat or reset the computer or rebuild the computer or redirect the screen or open the computer or take a destructive step or start another screen task or finish the current screen task or send a redirect or stop the routine or disconnect the app or retry or restart the app or contact support or assign the routine to Grok Bot, Dots, or Muse or treat a stored run, a desk-wide pause, a failure, a usage pause, a source channel, a source repository, a matching rule, an ask-first rule, an allow-automatically rule, a team rule, a locked team rule, a local-computer refusal, a cloud-computer refusal, a reachable computer, a stuck state, a login wait, a plugin authentication, a readable attachment, a blocked approval, a computer setup, an app update, an open sign-in, a quiet bot, a support note, a retry result, a disconnected app, a least-destructive step, an active screen task, a finish-before-rebuild, a kept conversation, a kept-file, a software refresh, a scratch folder, a work surface, a private host, a guest slice, a persona ledger, a common tray, a solo roster, a team bench, a group computer, a direct desk, an asked meter, a shared kit, a sealed chat, a delegated lane, a default switch, a rest latch, a spawn hatch, a quiet gate, a public veil, a server ring, a plan notch, a member ceiling, a choice latch, a local shutter, a stricter keep, a reason bar, a required plugin, or a source system as a habit ask",
    proof: "Does the Launch note routine say that the default leaves the choice to each member, whose own setting defaults to asking before every task says there is no habit ask. Asking does not set the member's own setting to ask before every task. Two routines with the same name are left unchanged. Nothing is run, changed, sent, or spent.",
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
