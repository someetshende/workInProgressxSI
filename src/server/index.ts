import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderMarkdown } from "../core/brief.js";
import { isCadence } from "../core/cadence.js";
import { convene, probeConnector, reviewWatches, runRoutine, saveRoutine, setConnector, setRoutineCadence, settle, wakeDue } from "../core/convene.js";
import type { Deps } from "../core/types.js";
import { OrielError } from "../core/errors.js";
import { refineWithGlm } from "../core/glm.js";
import { toPublic } from "../core/state.js";
import { getCatalog, queryStories } from "../stories/catalog.js";
import { Store } from "./store.js";

const WEB_ROOT = path.resolve("web");
const FONT_ROOTS: Record<string, string> = {
  "/fonts/newsreader/": path.resolve("node_modules/@fontsource/newsreader"),
  "/fonts/inter/": path.resolve("node_modules/@fontsource/inter"),
};

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

type Running = {
  port: number;
  url: string;
  dir: string;
  close: () => Promise<void>;
};

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new OrielError("Request body must be a JSON object.");
  }
  return value as Record<string, unknown>;
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 100_000) throw new OrielError("Request is too large.", 413);
    chunks.push(buffer);
  }
  if (!size) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new OrielError("Request body must be JSON.");
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  });
  res.end(payload);
}

function safeFile(root: string, urlPath: string): string | null {
  if (urlPath.includes("\0") || urlPath.includes("..")) return null;
  let decoded = urlPath;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes("\0") || decoded.includes("..")) return null;
  const rel = decoded.replace(/^\/+/, "");
  const full = path.resolve(root, rel);
  const base = path.resolve(root);
  if (full !== base && !full.startsWith(base + path.sep)) return null;
  return full;
}

async function sendFile(res: ServerResponse, file: string): Promise<boolean> {
  let info;
  try {
    info = await stat(file);
  } catch {
    return false;
  }
  if (!info.isFile()) return false;
  const ext = path.extname(file);
  const body = await readFile(file);
  res.writeHead(200, {
    "content-type": MIME[ext] ?? "application/octet-stream",
    "content-length": body.length,
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "cache-control": ext === ".html" ? "no-store" : "public, max-age=3600",
  });
  res.end(body);
  return true;
}

async function writeDesk(dir: string, state: ReturnType<Store["get"]>): Promise<void> {
  for (const goal of state.goals) {
    const folder = path.join(dir, "desk", goal.id);
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, "brief.md"), renderMarkdown(goal, state.events), "utf8");
  }
}

export async function startServer(options: {
  port?: number;
  host?: string;
  dataDir: string;
  testMode?: boolean;
  fetchImpl?: typeof fetch;
  refine?: Deps["refine"];
  now?: () => Date;
  wake?: boolean;
  wakeMs?: number;
}): Promise<Running> {
  const store = new Store(options.dataDir);
  await store.load();
  const host = options.host ?? "127.0.0.1";
  const testMode = options.testMode ?? false;
  const depsFor = (): Deps => ({
    now: options.now ?? (() => new Date()),
    fetchImpl: options.fetchImpl ?? fetch,
    refine: options.refine === undefined ? null : options.refine,
  });

  let waking = false;
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const pathname = url.pathname;
      const method = req.method ?? "GET";

      if (method === "GET" && pathname === "/api/health") {
        sendJson(res, 200, { ok: true, product: "Oriel", atlas: getCatalog().length });
        return;
      }
      if (method === "GET" && pathname === "/api/state") {
        sendJson(res, 200, toPublic(store.get(), getCatalog().length));
        return;
      }
      if (method === "GET" && pathname === "/api/stories") {
        const offset = Number(url.searchParams.get("offset") ?? "0");
        const limit = Number(url.searchParams.get("limit") ?? "20");
        sendJson(res, 200, queryStories(url.searchParams.get("q") ?? "", offset, limit));
        return;
      }
      if (method === "GET" && pathname.startsWith("/api/goals/") && pathname.endsWith("/brief")) {
        const id = pathname.slice("/api/goals/".length, -"/brief".length);
        const goal = store.get().goals.find((item) => item.id === id);
        if (!goal) {
          sendJson(res, 404, { error: "That goal is not in the record." });
          return;
        }
        const body = renderMarkdown(goal, store.get().events);
        res.writeHead(200, {
          "content-type": "text/markdown; charset=utf-8",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        });
        res.end(body);
        return;
      }
      if (method === "POST" && pathname === "/api/reset") {
        if (!testMode) {
          sendJson(res, 404, { error: "Not found." });
          return;
        }
        const next = await store.reset();
        sendJson(res, 200, toPublic(next, getCatalog().length));
        return;
      }
      if (method === "POST" && pathname === "/api/watches") {
        const next = await store.update(async (current) => reviewWatches(current, depsFor()));
        sendJson(res, 200, toPublic(next, getCatalog().length));
        return;
      }
      if (method === "POST" && pathname === "/api/tick") {
        const body = asObject(await readBody(req));
        let deps = depsFor();
        if (body.force === true) {
          if (!testMode) throw new OrielError("Not found.", 404);
          const dueAt = store
            .get()
            .routines.map((routine) => routine.nextRunAt)
            .filter((value): value is string => typeof value === "string")
            .sort()[0];
          if (dueAt) {
            const atDue = new Date(dueAt);
            deps = { ...deps, now: () => atDue };
          }
        }
        const next = await store.update(async (current) => {
          const updated = await wakeDue(current, deps);
          if (updated !== current) await writeDesk(options.dataDir, updated);
          return updated;
        });
        sendJson(res, 200, toPublic(next, getCatalog().length));
        return;
      }
      if (method === "POST" && pathname === "/api/turn") {
        const body = asObject(await readBody(req));
        if (typeof body.text !== "string") throw new OrielError("Say what you want finished.");
        const goalId = typeof body.goalId === "string" ? body.goalId : undefined;
        const next = await store.update(async (current) => {
          const updated = await convene(current, body.text as string, goalId, depsFor());
          await writeDesk(options.dataDir, updated);
          return updated;
        });
        sendJson(res, 200, toPublic(next, getCatalog().length));
        return;
      }
      const approvalMatch = method === "POST" ? pathname.match(/^\/api\/approvals\/([A-Za-z0-9_]+)$/) : null;
      if (approvalMatch) {
        const body = asObject(await readBody(req));
        if (body.decision !== "approve" && body.decision !== "deny") {
          throw new OrielError("Decision must be approve or deny.");
        }
        const id = approvalMatch[1] ?? "";
        const next = await store.update(async (current) => {
          const updated = await settle(current, id, body.decision as "approve" | "deny", depsFor());
          await writeDesk(options.dataDir, updated);
          return updated;
        });
        sendJson(res, 200, toPublic(next, getCatalog().length));
        return;
      }
      const probeMatch = method === "POST" ? pathname.match(/^\/api\/connectors\/([A-Za-z0-9_]+)\/probe$/) : null;
      if (probeMatch) {
        const id = probeMatch[1] ?? "";
        const next = await store.update(async (current) => probeConnector(current, id, depsFor()));
        sendJson(res, 200, toPublic(next, getCatalog().length));
        return;
      }
      const connectorMatch = method === "POST" ? pathname.match(/^\/api\/connectors\/([A-Za-z0-9_]+)$/) : null;
      if (connectorMatch) {
        const body = asObject(await readBody(req));
        const patch: { enabled?: boolean; bridgeUrl?: string | null; token?: string } = {};
        if ("enabled" in body) {
          if (typeof body.enabled !== "boolean") throw new OrielError("Enabled must be true or false.");
          patch.enabled = body.enabled;
        }
        if ("bridgeUrl" in body) {
          if (body.bridgeUrl !== null && typeof body.bridgeUrl !== "string") {
            throw new OrielError("Bridge URL must be a string.");
          }
          patch.bridgeUrl = body.bridgeUrl;
        }
        if ("token" in body) {
          if (typeof body.token !== "string") throw new OrielError("Token must be a string.");
          patch.token = body.token;
        }
        const id = connectorMatch[1] ?? "";
        const next = await store.update((current) => setConnector(current, id, patch, depsFor()));
        sendJson(res, 200, toPublic(next, getCatalog().length));
        return;
      }
      if (method === "POST" && pathname === "/api/routines") {
        const body = asObject(await readBody(req));
        if (typeof body.goalId !== "string") throw new OrielError("A goal is required.");
        const name = typeof body.name === "string" ? body.name : undefined;
        const cadence = body.cadence === undefined ? "manual" : body.cadence;
        if (!isCadence(cadence)) throw new OrielError("Cadence must be manual, daily, or hourly.");
        const next = await store.update((current) => saveRoutine(current, body.goalId as string, name, depsFor(), cadence));
        sendJson(res, 200, toPublic(next, getCatalog().length));
        return;
      }
      const routineMatch = method === "POST" ? pathname.match(/^\/api\/routines\/([A-Za-z0-9_]+)\/run$/) : null;
      if (routineMatch) {
        const id = routineMatch[1] ?? "";
        const next = await store.update(async (current) => {
          const updated = await runRoutine(current, id, depsFor());
          await writeDesk(options.dataDir, updated);
          return updated;
        });
        sendJson(res, 200, toPublic(next, getCatalog().length));
        return;
      }
      const cadenceMatch = method === "POST" ? pathname.match(/^\/api\/routines\/([A-Za-z0-9_]+)$/) : null;
      if (cadenceMatch) {
        const body = asObject(await readBody(req));
        const cadence = body.cadence;
        if (!isCadence(cadence)) throw new OrielError("Cadence must be manual, daily, or hourly.");
        const id = cadenceMatch[1] ?? "";
        const next = await store.update((current) => setRoutineCadence(current, id, cadence, depsFor()));
        sendJson(res, 200, toPublic(next, getCatalog().length));
        return;
      }

      if (method === "GET" && (pathname === "/" || pathname === "/index.html")) {
        if (await sendFile(res, path.join(WEB_ROOT, "index.html"))) return;
      }
      if (method === "GET" && pathname === "/atlas") {
        if (await sendFile(res, path.join(WEB_ROOT, "atlas.html"))) return;
      }
      if (method === "GET") {
        for (const [prefix, root] of Object.entries(FONT_ROOTS)) {
          if (pathname.startsWith(prefix)) {
            const resolved = safeFile(root, pathname.slice(prefix.length));
            if (!resolved || !(await sendFile(res, resolved))) sendJson(res, 404, { error: "Not found." });
            return;
          }
        }
        const file = safeFile(WEB_ROOT, pathname);
        if (file && (await sendFile(res, file))) return;
      }
      sendJson(res, 404, { error: "Not found." });
    } catch (error) {
      const status = error instanceof OrielError ? error.status : 500;
      const message = error instanceof OrielError ? error.message : "Something went wrong inside Oriel.";
      if (!res.headersSent) sendJson(res, status, { error: message });
      else res.end();
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(options.port ?? 0, host, () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Oriel could not bind a port.");
  let timer: ReturnType<typeof setInterval> | undefined;
  if (options.wake) {
    timer = setInterval(() => {
      if (waking) return;
      waking = true;
      void store
        .update(async (current) => {
          const updated = await wakeDue(current, depsFor());
          if (updated !== current) await writeDesk(options.dataDir, updated);
          return updated;
        })
        .catch(() => undefined)
        .finally(() => {
          waking = false;
        });
    }, options.wakeMs ?? 60_000);
    timer.unref();
  }
  return {
    port: address.port,
    url: `http://${host}:${address.port}`,
    dir: options.dataDir,
    close: () =>
      new Promise((resolve, reject) => {
        if (timer) clearInterval(timer);
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

const entry = process.argv[1] ?? "";
if (entry.endsWith(`${path.sep}src${path.sep}server${path.sep}index.ts`) || entry.endsWith("src/server/index.ts")) {
  const port = Number(process.env.ORIEL_PORT ?? 8787);
  const host = process.env.ORIEL_HOST ?? "127.0.0.1";
  const dataDir = path.resolve(process.env.ORIEL_DATA_DIR ?? path.join("data", "runtime"));
  const useGlm = process.env.ORIEL_USE_GLM === "1";
  const wake = process.env.ORIEL_TICK !== "0" && process.env.ORIEL_TEST !== "1";
  startServer({
    port,
    host,
    dataDir,
    testMode: process.env.ORIEL_TEST === "1",
    refine: useGlm ? (synthesis) => refineWithGlm(synthesis) : null,
    wake,
  }).then((running) => {
    process.stdout.write(`Oriel listening on ${running.url}\n`);
  });
}
