import { defineConfig } from "@playwright/test";

function env(extra: Record<string, string>): Record<string, string> {
  const base: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") base[key] = value;
  }
  return { ...base, ...extra };
}

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: "npx tsx src/server/index.ts",
    url: "http://127.0.0.1:4173/api/health",
    reuseExistingServer: false,
    timeout: 30000,
    env: env({
      ORIEL_PORT: "4173",
      ORIEL_HOST: "127.0.0.1",
      ORIEL_DATA_DIR: ".tmp/e2e",
      ORIEL_TEST: "1",
      ORIEL_USE_GLM: "0",
    }),
  },
});
