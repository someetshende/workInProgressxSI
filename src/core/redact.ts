const SECRET = /\bsk-[A-Za-z0-9_-]{8,}\b/g;
const ASSIGNED = /\b(?:api[_-]?key|token|password|secret)\s*[:=]\s*\S+/gi;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/-]{6,}/gi;
const SSN = /\b\d{3}-\d{2}-\d{4}\b/g;
const CARD = /\b(?:\d[ -]*?){13,16}\b/g;

export function redactSecrets(text: string): string {
  return text
    .replace(BEARER, "Bearer [redacted secret]")
    .replace(ASSIGNED, "[redacted secret]")
    .replace(SECRET, "[redacted secret]")
    .replace(SSN, "[redacted id]")
    .replace(CARD, "[redacted id]");
}

export function redactValue(text: string, secret: string | null): string {
  const base = redactSecrets(text);
  if (!secret || secret.length < 4) return base;
  return base.split(secret).join("[redacted secret]");
}

export function clamp(text: string, max: number): string {
  const one = text.replace(/\s+/g, " ").trim();
  if (one.length <= max) return one;
  return `${one.slice(0, max - 1).trimEnd()}…`;
}

export function safeUrl(input: string): string {
  try {
    const url = new URL(input);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "[invalid url]";
  }
}
