import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeRoutine } from "../core/cadence.js";
import { initialState } from "../core/state.js";
import type { AppState } from "../core/types.js";

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
      parsed.routines = (parsed.routines ?? []).map(normalizeRoutine).filter((routine) => routine !== null);
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
