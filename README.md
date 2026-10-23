# Oriel

Oriel is one window onto the agents you already run. Grok Bot, Dots, and Muse stay themselves. Oriel convenes them, holds anything risky, and answers in one voice.

The name is a projecting window: several panes, one view. The research behind the product is in [docs/research.md](docs/research.md). The story atlas has more than a thousand stories in [data/user-stories.json](data/user-stories.json), and the twenty flagship stories are the spec the tests run.

Oriel does not sign in to those products. A seat is in **reference** mode until you bridge an endpoint you control. Reference copy says what that seat would do. It does not pretend the work happened on their computer.

## Run

```bash
npm install
npm run dev
```

Open http://127.0.0.1:8787. The story atlas is at http://127.0.0.1:8787/atlas.

## Test

The test environment is local. Unit tests cover the convening rules. End-to-end tests drive the window in Chromium, including a phone-sized dark viewport.

```bash
npx playwright install chromium
npm run check
```

`npm run check` rewrites the story atlas, typechecks, runs unit tests, and runs the browser suite.

## What a turn does

1. You say what to finish.
2. Oriel scores the request and picks the seats that are on. Client, patient, and confidential work is not given to Muse.
3. Each seat answers. A bridged seat is called over HTTP. If that call fails, Oriel says so and continues with a reference read.
4. Sends, payments, deletions, public posts, and credential use are held. "Do not send" skips the send instead of asking again.
5. You get one recommendation. The working brief, the disagreement, and the record stay one click down.
6. Approving a hold records the decision. Oriel still does not send mail, move money, delete, or publish. There is no always-allow.

Say `Remember that I prefer short briefs.` and the next working brief stays collapsed. `What do you remember?` reads it back. A goal can be continued from the list. `Save as skill` keeps the method. Arm it in the rail, then send a new request: prohibitions in the method still apply, including a do-not-send, and client work in the method stays off Muse. A skill has no cadence. It does not wake, and it does not approve a hold. `Save as routine` reruns the instruction later, and the holds still apply. If that turn used a skill, the routine keeps the method. A saved routine starts as manual. In the rail, the cadence control cycles Manual, Daily, and Hourly. While `npm run dev` is open, Oriel wakes one due routine about once a minute. Set `ORIEL_TICK=0` to keep wakes on the Run button only. A wake does not approve a hold, send mail, or move money. The thread labels that turn Routine.

**Pause wakes** stops those cadences until you resume. The routines stay, Run still works, and an open hold stays open. Pausing does not send mail or move money. You can also say `Pause wakes` or `Resume wakes`. A sentence that merely contains the word pause, such as a request to pause a draft, is ordinary work.

## Bridge a seat you already run

There is no public API that lets a third party drive Grok Bot, a Dot, or Muse. Oriel will not ask for their passwords. If you run a bridge in front of an agent you control, point a seat at it:

```http
POST /tasks
Authorization: Bearer <token you set in Oriel>
Content-Type: application/json

{
  "product": "Oriel",
  "action": "convene",
  "seat": "grok",
  "task": "the request, with secrets redacted",
  "intents": ["research"],
  "businessSensitive": false
}
```

Reply:

```json
{ "summary": "One short result.", "points": ["Optional."], "stance": "Optional." }
```

When a turn uses a skill, `task` starts with that saved method and then the person's request. A skill never wakes by itself. When you approve a hold, Oriel may POST the same shape with `"action": "released"` and a `kind` of `send`, `pay`, `delete`, `post`, or `credential`. The token is stored outside the public state and is not written back into the thread. Metadata addresses and non-HTTP URLs are rejected. Use HTTPS for any bridge that is not on your own machine.

In the window, open **Bridge** on a seat, paste the URL, and optionally a token. Plain HTTP is only accepted for a bridge on this machine (`localhost`, `127.0.0.1`, or `::1`). Anywhere else, use HTTPS. Oriel does not follow a redirect from a bridge.

To try the connection before a real bridge exists, run a local stand-in. It speaks the same protocol and labels itself as a stand-in. It will not send, pay, delete, post, or sign in.

```bash
ORIEL_SEAT=grok ORIEL_SEAT_TOKEN=a-local-token ORIEL_SEAT_PORT=8791 npm run seat
```

Point Grok Bot's bridge at `http://127.0.0.1:8791/tasks` and paste the same token. `ORIEL_SEAT` may be `grok`, `dots`, or `muse`. The token stays in the environment of that process, not in the command's arguments. A Muse stand-in refuses a task marked client, patient, or confidential. **Check bridge** asks only whether the saved endpoint answers. That check does not send, pay, delete, post, or sign in.

While a hold or a watch is open, **Check what's open** posts `action: status` to the bridged seats and changes nothing. It does not convene new work, and it does not send, pay, delete, post, or sign in. Muse is left out of that check when the desk is holding client, patient, or confidential work. A watch survives a later turn on the same goal until you say to stop watching.

## Optional prose pass

The recommendation is deterministic so the tests can hold it to a sentence. If you want GLM 5.3 to tighten the long brief, set:

```bash
ORIEL_USE_GLM=1 OPENROUTER_API_KEY=... npm run dev
```

The model id is `z-ai/glm-5.3` unless `ORIEL_MODEL` overrides it. A short preference skips the call. If the call fails, the deterministic brief stands. This environment had no OpenRouter key, so the suite tests the client with a fake response and does not spend a live call.

## Limits

Oriel is a local product with a JSON record on disk (`ORIEL_DATA_DIR`, default `data/runtime`). It is not a hosted control plane, and it is not a place to paste production credentials. Reset exists only when `ORIEL_TEST=1`.
