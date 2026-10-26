import { afterEach, describe, expect, it } from "vitest";
import { refineWithGlm } from "../src/core/glm.js";

const originalKey = process.env.OPENROUTER_API_KEY;
const originalModel = process.env.ORIEL_MODEL;

afterEach(() => {
  if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = originalKey;
  if (originalModel === undefined) delete process.env.ORIEL_MODEL;
  else process.env.ORIEL_MODEL = originalModel;
});

describe("GLM 5.3 via OpenRouter", () => {
  it("does nothing when no key is configured", async () => {
    delete process.env.OPENROUTER_API_KEY;
    let called = false;
    const result = await refineWithGlm("Hello", async () => {
      called = true;
      throw new Error("should not be called");
    });
    expect(result).toBeNull();
    expect(called).toBe(false);
  });

  it("asks z-ai/glm-5.3 and keeps only the reply text", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    delete process.env.ORIEL_MODEL;
    let seenModel = "";
    let seenAuth = "";
    const result = await refineWithGlm("Keep this fact.", async (_input, init) => {
      const headers = new Headers(init?.headers);
      seenAuth = headers.get("authorization") ?? "";
      seenModel = JSON.parse(String(init?.body)).model;
      return new Response(JSON.stringify({ choices: [{ message: { content: "  Tightened.  " } }] }), { status: 200 });
    });
    expect(seenModel).toBe("z-ai/glm-5.3");
    expect(seenAuth).toBe("Bearer test-key");
    expect(result).toBe("Tightened.");
  });

  it("falls back when the model returns an empty reply", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const result = await refineWithGlm("Keep this fact.", async () => {
      return new Response(JSON.stringify({ choices: [{ message: { content: "   " } }] }), { status: 200 });
    });
    expect(result).toBeNull();
  });
});
