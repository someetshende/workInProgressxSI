import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { DISPLAY } from "../core/doctrine.js";
import type { SeatId } from "../core/types.js";

const SEATS = new Set<SeatId>(["grok", "dots", "muse"]);

const VOICE: Record<SeatId, string> = {
  grok: "Local stand-in for Grok Bot. It would run one pass on a computer you control and name the proving check. It did not sign in anywhere.",
  dots: "Local stand-in for Dots. It would own the outcome until a decision comes back. It did not send mail or spend money.",
  muse: "Local stand-in for Muse. It would keep this as a message and stop before money or mail. It did not check out.",
};

export type LocalSeat = {
  url: string;
  hits: () => number;
  close: () => Promise<void>;
};

function isSeat(value: string): value is SeatId {
  return SEATS.has(value as SeatId);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 100_000) throw new Error("too large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(payload) });
  res.end(payload);
}

export async function startLocalSeat(options: { seat: SeatId; token?: string; port?: number }): Promise<LocalSeat> {
  let hits = 0;
  const expected = options.token ?? "";
  const server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
      if (req.method !== "POST" || pathname !== "/tasks") {
        send(res, 404, { error: "Not found" });
        return;
      }
      if (expected && req.headers.authorization !== `Bearer ${expected}`) {
        send(res, 401, { error: "Unauthorized" });
        return;
      }
      const body = (await readJson(req)) as {
        action?: unknown;
        kind?: unknown;
        businessSensitive?: unknown;
        task?: unknown;
      };
      if (options.seat === "muse" && body.businessSensitive === true) {
        send(res, 409, { error: "Muse stand-in refuses client, patient, and confidential work." });
        return;
      }
      hits += 1;
      const allowed = new Set(["send", "pay", "delete", "post", "credential"]);
      const kind = typeof body.kind === "string" && allowed.has(body.kind) ? body.kind : "hold";
      const forwarding = typeof body.task === "string" && /do not pull an inbox/i.test(body.task);
      const summary =
        body.action === "released"
          ? `Acknowledged a ${kind} release. This stand-in did not send, pay, delete, post, or sign in.`
          : body.action === "status"
            ? `Bridge is reachable. This stand-in for ${DISPLAY[options.seat]} did not send, pay, delete, post, or sign in.`
            : forwarding
              ? `${VOICE[options.seat]} This stand-in did not pull an inbox or its attachments.`
              : VOICE[options.seat];
      send(res, 200, {
        summary,
        points: ["This process is a local stand-in. It is not Grok Bot, Dots, or Muse."],
        stance: "Stop before anything hard to undo.",
      });
    } catch {
      if (!res.headersSent) send(res, 400, { error: "JSON required" });
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(options.port ?? 0, "127.0.0.1", () => resolve());
  });
  const address = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${address.port}/tasks`,
    hits: () => hits,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith("--") ? value : undefined;
}

const entry = process.argv[1] ?? "";
if (entry.endsWith(`${path.sep}seats${path.sep}local.ts`) || entry.endsWith("src/seats/local.ts")) {
  const seat = process.env.ORIEL_SEAT ?? arg("--seat") ?? "";
  if (!isSeat(seat)) {
    process.stderr.write("Set ORIEL_SEAT to grok, dots, or muse.\n");
    process.exit(1);
  }
  const port = Number(process.env.ORIEL_SEAT_PORT ?? arg("--port") ?? 0);
  startLocalSeat({
    seat,
    token: process.env.ORIEL_SEAT_TOKEN,
    port: Number.isFinite(port) ? port : 0,
  }).then((running) => {
    process.stdout.write(`listening ${running.url}\n`);
  });
}
