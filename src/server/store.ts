import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeRoutine } from "../core/cadence.js";
import { normalizeHandoff, normalizeHandoffRule } from "../core/handoff.js";
import { normalizeSkill } from "../core/skill.js";
import { initialState } from "../core/state.js";
import type { AppState, Handoff, HandoffRule, Skill } from "../core/types.js";

type SecretFile = Record<string, string>;

function isErrno(error: unknown, code: string): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === code);
}

export class Store {
  private chain: Promise<void> = Promise.resolve();
  private state: AppState = initialState();

  constructor(private readonly dir: string) {}

  directory(): string {
    return this.dir;
  }

  async load(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    try {
      const raw = await readFile(path.join(this.dir, "state.json"), "utf8");
      const parsed = JSON.parse(raw) as AppState;
      parsed.paused = parsed.paused === true;
      parsed.approvals = (parsed.approvals ?? []).map((approval) => ({
        ...approval,
        expiresAt: typeof approval.expiresAt === "string" ? approval.expiresAt : null,
        scope: approval.scope === "task" ? "task" : "once",
      }));
      parsed.routines = (parsed.routines ?? []).map(normalizeRoutine).filter((routine) => routine !== null);
      parsed.skills = (Array.isArray(parsed.skills) ? parsed.skills : [])
        .map(normalizeSkill)
        .filter((skill): skill is Skill => skill !== null);
      parsed.handoffs = (Array.isArray(parsed.handoffs) ? parsed.handoffs : [])
        .map(normalizeHandoff)
        .filter((handoff): handoff is Handoff => handoff !== null);
      const seenRules = new Set<string>();
      parsed.handoffRules = (Array.isArray(parsed.handoffRules) ? parsed.handoffRules : [])
        .map(normalizeHandoffRule)
        .filter((rule): rule is HandoffRule => {
          if (!rule || seenRules.has(rule.action)) return false;
          seenRules.add(rule.action);
          return true;
        });
      this.state = parsed;
    } catch (error) {
      if (!isErrno(error, "ENOENT")) throw error;
      this.state = initialState();
    }
    let secrets: SecretFile = {};
    try {
      secrets = JSON.parse(await readFile(path.join(this.dir, "secrets.json"), "utf8")) as SecretFile;
    } catch (error) {
      if (!isErrno(error, "ENOENT")) throw error;
    }
    for (const connector of this.state.connectors) {
      const saved = secrets[connector.id];
      connector.token = typeof saved === "string" ? saved : null;
    }
    await this.persist();
  }

  get(): AppState {
    return this.state;
  }

  async update(fn: (state: AppState) => Promise<AppState> | AppState): Promise<AppState> {
    let result = this.state;
    const run = this.chain.then(async () => {
      result = await fn(this.state);
      this.state = result;
      await this.persist();
    });
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    await run;
    return result;
  }

  async reset(): Promise<AppState> {
    return this.update(async () => {
      await rm(path.join(this.dir, "desk"), { recursive: true, force: true });
      return initialState();
    });
  }

  private async persist(): Promise<void> {
    const secrets: SecretFile = {};
    for (const connector of this.state.connectors) {
      if (connector.token) secrets[connector.id] = connector.token;
    }
    await this.writeAtomic("secrets.json", JSON.stringify(secrets), 0o600);
    const publicState: AppState = {
      ...this.state,
      connectors: this.state.connectors.map((connector) => ({ ...connector, token: null })),
    };
    await this.writeAtomic("state.json", JSON.stringify(publicState, null, 2), 0o644);
  }

  private async writeAtomic(name: string, contents: string, mode: number): Promise<void> {
    const dest = path.join(this.dir, name);
    const tmp = path.join(this.dir, `.${name}.${process.pid}.tmp`);
    await writeFile(tmp, contents, { mode });
    await rename(tmp, dest);
  }
}
