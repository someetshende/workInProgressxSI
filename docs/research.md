# Research brief: Grok Bot, Dots, Muse, and the window between them

As of 23 October 2026. This is product research for Oriel, not a claim that Oriel is any of those products. Dates, prices, and regional limits below come from vendor pages and reporting. They moved during staggered rollouts, and this brief did not sign in to a live Grok Bot, Dot, or Muse account to re-verify them.

## What shipped, close together

In about seven weeks the three largest consumer AI companies shipped the same kind of product.

| | Grok Bot | Muse | Dots |
| --- | --- | --- | --- |
| Maker | xAI, built and run with Cursor | Meta | OpenAI |
| Announced | Beta, 11 August 2026 | 8 September 2026 | 29 September 2026, DevDay |
| Model, as described | Chosen by Cursor. No model picker in the product docs. | Muse Spark | GPT-6 Astra |
| Where you talk to it | Desktop and mobile apps | Muse app, muse.ai, WhatsApp | ChatGPT on web, desktop, and mobile; voice; Slack and Teams |
| Computer | One persistent cloud computer per person, shared by all of that person's bots. Each bot has its own screen. | Muse Secure VM, one isolated machine per person | Its own cloud computer and browser |
| How work is taught | Skills saved from a demonstrated path. Routines run on a schedule or, where supported, an event. | Goals and plans. It keeps working after the app closes. | Goals, custom rules, scheduled tasks. It decides when to pause and wake. |
| Before it acts | Allow once, always allow, or deny. Auto Review can force a check. Enterprise can enforce review. | Sentinel, a separate checker: allow, deny, or ask. Grants can be perpetual. | Custom rules and auto-review. Hard stops described for deletes and transfers. |
| Who it is for first | Individuals on SuperGrok or Cursor plans; Teams; Enterprise by sales | A personal agent, including a free tier. US and Canada in secondary writeups. Not offered as a team admin product. | ChatGPT Pro, outside the EEA, UK, and Switzerland at launch; Business Premium more broadly; Enterprise beta off until an admin enables it |
| Price shape, from public pages | Included with paid Cursor and SuperGrok plans. Separate usage from chat. | Free with a cap. Power $20/month. Maximum $100/month. | Included with Pro (from about $100/month) or a Business Premium seat. Extra dots described as later. |

Sources for the table: [Grok Bot overview](https://docs.x.ai/grok-bot/overview), [Introducing Grok Bot](https://x.ai/news/introducing-grok-bot), [Introducing dots](https://openai.com/index/introducing-dots/), [Meet dots](https://learn.chatgpt.com/docs/dots), [Getting started with your dot](https://help.openai.com/en/articles/20001530-getting-started-with-your-dot), [Introducing Muse](https://about.fb.com/news/2026/09/introducing-muse-personal-ai-agent/), [Muse subscriptions](https://www.meta.com/help/subscriptions/1021145227643680/), and the 1 October 2026 comparison by [Caddi](https://www.trycaddi.com/blog/grok-bot-vs-muse-vs-dots).

## How each one actually works

**Grok Bot** is a team, not a single avatar. You message a named bot. It works on a cloud computer with a browser, a filesystem, and a terminal, and it keeps going after the laptop closes. Every bot on one account shares that computer: cookies, files, and command-line credentials. The screens are separate. The security boundary is not. Bots can message each other, sit in a group, and hand off a task, so the person is not the router. A skill is the method. A routine is when it runs. Sensitive steps come back for approval. On an Enterprise plan the docs describe network allowlists, Privacy Mode, audit logs, and enforced Auto Review. Coding work can be delegated to a separate Cloud Agent computer.

**Dots** is one primary agent you name. OpenAI's line is that it is an extension of you: it starts from ChatGPT memory, works between conversations, and brings back decisions rather than waiting for the next prompt. It has its own computer and browser, a plugin surface described as thousands of apps, and a path into Codex and connected tools. You can open the computer and watch. Voice is part of the product, including from Slack or Teams. Specialist dots, with their own identity and company credentials, were described as a later enterprise step, not the thing a Pro user gets on day one. Conversations with the dot were said not to count against ordinary ChatGPT limits. Deeper work still draws on the plan's allowance.

**Muse** is built to feel like texting a person, including inside WhatsApp. Meta's claim is that there is no learning curve: say what to do, including a long-term goal, and it makes a plan and advances it. The machine is Muse Secure VM. Credentials are described as living in a store the model does not read as passwords. Sentinel is a second agent that checks an action before it goes out. Money is a first-class path, via Link by Stripe, with the real card hidden behind a one-time number. The product remembers details a person mentioned once and will bring them back unprompted. That is the feature and the risk.

The shared skeleton is now obvious. An always-on agent, a computer that is not the user's laptop, a browser, memory that compounds, and a check before something hard to undo. The differences that matter are who the agent belongs to, what it is allowed to remember, and whether a company can see or stop it.

## The rest of the field

The same season produced cousins, not copies.

- **Muse Code** is Meta's coding agent in the terminal, a different product from the personal Muse. It is the coding seat, not the life seat.
- **Instinct**, from Spear Street, was reported as invite-only and unusually broad: mail, calendar, screen, location, and credentials, with a data license that drew criticism and reports of actions taken without confirmation. It is the cautionary version of "always on."
- Earlier computer-use agents, including OpenAI's Operator and the general pattern of browser-driving assistants, are the predecessors. Dots is the always-on form of that idea, not a chat box with tools.
- Coding agents (Cloud Agents, Codex, Muse Code, and the rest of that class) are specialists. Grok Bot can delegate to one. They are a seat, not the whole product.

Noma's roundup of personal agents is a useful map of where each one runs and what it can touch: [Discovering and governing dots, Grok Bot, Instinct, Muse, and Muse Code](https://noma.security/blog/personal-ai-agent-security-discovering-and-governing-dots-grok-bot-muse-muse-code).

## Hype, and what survived it

The marketing says "handle everything," "built for everyone," and "a team that works while you sleep." Some of that is the right product shape. A lot of it is the launch.

What the launch coverage actually showed:

- Muse reached the top of the US App Store charts. The Verge, citing Apptopia, reported about 600,000 US daily active users within weeks. That is a reported figure, not a number counted here.
- The same coverage reported that Muse's privacy story was thinner than the keynote. Data is isolated from other users, but Meta can still access the VM. A user-keyed Confidential VM was described as later. Training on sanitized activity was the default, with an opt-out. Reporters described the agent reading messages or offering an address further than the person realized. A macOS zero-day that could steal tokens was reported and then described as patched.
- OpenAI used DevDay to aim Dots at that story: trust, spend limits, and enterprise retention options. Dots was also the expensive seat, so fewer people were in a position to have a public incident.
- Professional-services commentary, including Caddi, made a quieter point that none of the three claim repeatable runs or a firm books-and-records archive. For a lawyer or an adviser, "it usually works" is not a control.
- Prompt injection is still described, including by the vendors' own cautious pages, as unsolved. An agent that is signed into mail will eventually read a hostile message.

The hype is the promise that one agent becomes your company. The substance is a computer, a memory, and a gate. The gate is where products diverge, and where they fail when "always allow" or a shared computer turns one mistake into all of them.

## What a hands-on pass actually finished

On 20 October 2026, Axios gave Dots and Muse the same personal job: a trip, a watch party, a souvenir program, and a small purchase. Both noticed that a game had moved by a day and that public tickets were not on sale. Both produced long creative packets that still needed a person to edit them, and both included statistics that did not hold. Muse later sent a correction on its own. The purchase is the result that matters here. Muse reached a store sign-in and stopped. Dots handed the last step to an app where the person was already signed in. Neither finished the buy faster than doing it by hand.

That is the shape Oriel keeps. Convene the work across the seats that are actually connected. Stop at the sign-in, the send, and the charge. A local stand-in can sit in a seat so the window can be tested, and it says it is a stand-in. It is not Grok Bot, a Dot, or Muse, and it cannot spend.

Secondary comparisons published around the same weeks still sort the three by job rather than by a shared score. Muse is the free personal seat, with paid tiers above a cap, and secondary writeups still limit early access to the US and Canada. Grok Bot is the paid entry that already comes with Cursor and SuperGrok. Dots is the always-on seat on ChatGPT Pro, Business Premium, and an Enterprise beta an admin has to turn on. There is no public bake-off that ranks them. Operations and code lean toward Grok Bot, a goal that has to live for days leans toward Dots, and life logistics lean toward Muse.

## From a person using it

A person does not want three products. They want the work finished, in their voice, with a chance to stop the part that spends money or sends the note.

What each one is genuinely good at, if you already have it:

- **Grok Bot**, when the work is operational: several lanes at once, a method you can save, a routine, a computer that keeps going, and, on the company plan, an admin who can say no.
- **Dots**, when the work has to be owned across days: a document, a build, a goal that should continue while you are in another tab. One named agent, not a roster you have to manage.
- **Muse**, when the work is life: a message, an errand, a goal you would rather say than configure. It is the one a non-technical person can start. It is also the one a company should not point at client material.

The pain shows up the week someone is paying for more than one. They become the router. They paste context. They forget which one is allowed to send. They have no single record of what was held.

## From a business buying it

| Question | What the public record supports |
| --- | --- |
| Can an admin turn it off? | Grok Bot Enterprise, yes. Dots Enterprise, an admin has to turn the beta on. Muse, no admin console is described. |
| Does it train on the work? | Grok Bot: not with Privacy Mode on. Dots on business plans: described as not used for training. Muse: used by default, with an opt-out. |
| Where do secrets sit? | All three say the model should not see raw passwords. Grok Bot is explicit that OAuth tokens stay in the connector backend. Muse describes a secure credential store and a check before use. |
| What is the blast radius? | Grok Bot: every bot on the account shares one computer. Muse: one VM, but Meta can operate it. Dots: one computer in OpenAI's cloud, plus whatever apps were connected. Disconnecting an app does not, in the writeups, delete what was already pulled. |
| Is there a record a firm can keep? | Enterprise Grok Bot comes closest, with audit logs and optional action recording. The others are per-user activity views. None of the three, per Caddi, offer the archive a regulated firm actually wants. |
| What should be banned on day one? | Client and patient material on a consumer seat. Standing "always allow." Shared credentials on a computer other bots can see. Any path that can pay, delete, or send without a fresh approval. |

For a company, Grok Bot is the only one of the three that currently looks like a team product. Dots is the right bet if the company already lives in ChatGPT and can wait for specialist dots to leave pilot. Muse is a personal tool that will show up on employees' phones whether or not IT bought it. That last fact is the governance problem: the agent is already in the building.

## What Oriel takes, and what it refuses

Oriel is the window, not a fourth computer pretending to be the other three.

It takes:

- From **Dots**, one voice, and a way to stop unattended work. The person should not manage a roster to get an answer. There is one recommendation. Dots' own pause stops the current main task and leaves schedules running unless they are disabled separately. Oriel's pause is the desk-wide form of Grok Bot's per-routine pause: every cadence sleeps, the routines stay, and Run still works.
- From **Muse**, the message. Plain language, a goal you can say, and a stop before money or mail. No configuration ritual before the first task.
- From **Grok Bot**, the seats, the skill, the routine, and the record. A skill is the method. A routine is when it runs. Oriel can save a method from a finished turn and apply it to a later request. The skill carries prohibitions, including a do-not-send, and it keeps client work off Muse. It has no cadence. It does not wake, and it does not approve a hold. A routine can still bake that method in when you save one from the turn. Other agents stay visible. Every hold is written down.
- From the enterprise gap, the books. Who was convened, what was held, what was released, and whether a live bridge failed.

It refuses:

- Signing in to Grok, Dots, or Muse on the user's behalf. There is no honest public API here that says "drive my agent." A live seat is a bridge the user runs. Until then the seat is labeled **Reference**, and the copy says what that seat would do. It does not pretend the work happened on their computer.
- Always-allow. One approval releases one hold. The next payment asks again.
- Putting client, patient, or confidential work on Muse. That seat is a consumer product in the public record, and Oriel treats it that way even in reference mode.
- Moving money, sending mail, deleting, or publishing from Oriel itself. Releasing a hold records the decision. A live bridge may be told. Oriel still does not pay or send.

The name is Oriel: a window that projects from the wall, one view made of several panes. Grok Bot, Dots, and Muse stay who they are. Oriel decides who should move, holds the risky step, and speaks once.

## Same-day check

Checked again on 23 October 2026, including a pass at 08:30 UTC, against the vendor pages. Oriel still did not sign in to a live account.

Grok Bot's overview still describes named bots on one shared cloud computer, with skills and routines. The skills page says a routine can be enabled or paused, and that a test run performs real work. The 11 August launch post said Bot usage is separate from chat. Current billing help for The X Subscription describes one shared weekly pool with Cursor and the Grok apps. Oriel does not meter either arrangement, and it does not run a test that spends.

Dots' help, updated the day before this check, still says you can pause a dot from its profile until you resume it. The controls page is more precise: that pause stops the current main task and does not, by itself, cancel future scheduled runs. Dots can also decide when to pause and wake. That is why Oriel has a cadence, and why pausing wakes is a separate control from approving a hold. Oriel pauses every cadence at once, because there is one window. It does not pretend that matches Dots' pause exactly.

The Associated Press reported Muse as available in the United States at the 8 September launch. Some secondary writeups have also said Canada. Oriel does not depend on the region. Muse stays the consumer seat, including on a reachability check and on a watch check: neither check sends client, patient, or confidential text to Muse. A watch check posts `action: status` only, the same action as Check bridge.

Checked again at 08:45 UTC the same day. Grok Bot's skills page still separates the two building blocks: a skill is a reusable set of instructions, and a routine tells one bot when to run. The page still says to save the method first and automate it only after that, and that a test run performs real work. Dots' controls page still says that pausing a dot stops the current main task and does not, by itself, stop delegated tasks or cancel future scheduled runs. Oriel's skill follows the first distinction. Oriel's pause follows the desk-wide form already recorded above. Neither a skill nor a pause approves a hold.

## Sources

- Grok Bot: https://docs.x.ai/grok-bot/overview · https://docs.x.ai/grok-bot/computer-and-apps · https://docs.x.ai/grok-bot/skills-routines-and-automations · https://docs.x.ai/grok-bot/teams-and-enterprises · https://x.ai/news/introducing-grok-bot
- Dots: https://openai.com/index/introducing-dots/ · https://learn.chatgpt.com/docs/dots · https://learn.chatgpt.com/docs/dots/controls · https://chatgpt.com/features/dots/ · https://help.openai.com/en/articles/20001530-getting-started-with-your-dot · https://techcrunch.com/2026/09/29/openai-launches-dots-its-bubbly-agentic-avatar/
- Muse: https://about.fb.com/news/2026/09/introducing-muse-personal-ai-agent/ · https://www.meta.com/help/subscriptions/1021145227643680/ · https://www.meta.com/help/artificial-intelligence/1047255454427887/ · https://ai.meta.com/muse/ · https://www.reuters.com/business/meta-launches-ai-agent-that-can-access-other-apps-send-emails-make-payments-2026-09-08/
- Comparison and criticism: https://www.trycaddi.com/blog/grok-bot-vs-muse-vs-dots · https://www.onewave-ai.com/blog/muse-vs-grok-bot-vs-dots · https://www.theverge.com/ai-artificial-intelligence/1009051/privacy-ai-agent-promises-openai-meta-muse-dots · https://noma.security/blog/personal-ai-agent-security-discovering-and-governing-dots-grok-bot-muse-muse-code · https://www.axios.com/2026/10/20/battle-of-bots-openai-meta-ai-agents-test · https://www.betterclaw.io/blog/openai-dots-vs-meta-muse-vs-grok-bot · https://knowngood.sh/agents
- Optional prose model used by Oriel when configured: GLM 5.3 on OpenRouter, `z-ai/glm-5.3` · https://openrouter.ai/z-ai/glm-5.3
