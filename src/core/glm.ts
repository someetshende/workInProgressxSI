import { redactSecrets } from "./redact.js";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export async function refineWithGlm(synthesis: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  const model = process.env.ORIEL_MODEL || "z-ai/glm-5.3";
  try {
    const response = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "Edit Oriel's brief. Keep every fact. Do not add recipients, payments, or claims that mail was sent, money moved, or a login happened. Two short paragraphs at most.",
          },
          { role: "user", content: synthesis },
        ],
        max_tokens: 400,
        reasoning_effort: "low",
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      choices?: { message?: { content?: unknown } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) return null;
    return redactSecrets(content.trim()).slice(0, 1200);
  } catch {
    return null;
  }
}
