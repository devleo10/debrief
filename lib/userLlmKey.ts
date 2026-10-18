const KEY_PATTERN = /^sk-[A-Za-z0-9_-]{20,200}$/;
const SECRET_PATTERN = /sk-[A-Za-z0-9_*-]{6,}/g;

/** Accepts an OpenAI secret key. Empty input means "use the server key". */
export function readUserLlmKey(value: unknown): {
  key: string | null;
  error: string | null;
} {
  if (value == null || value === "") return { key: null, error: null };
  if (typeof value !== "string") {
    return { key: null, error: "OpenAI key must be a string." };
  }
  const key = value.trim();
  if (!key) return { key: null, error: null };
  if (!KEY_PATTERN.test(key)) {
    return {
      key: null,
      error:
        "OpenAI key should start with sk- and contain only letters, numbers, hyphens, and underscores.",
    };
  }
  return { key, error: null };
}

export function parseUserLlmKey(value: unknown): string | null {
  return readUserLlmKey(value).key;
}

export function redactSecrets(text: string): string {
  return text.replace(SECRET_PATTERN, "sk-…");
}

export function isRejectedLlmKey(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const status = (err as { status?: number }).status;
  const message = String((err as { message?: string }).message || "");
  if (status === 401) return true;
  return /incorrect api key|invalid api key|invalid_api_key/i.test(message);
}

/** Client-safe message. Never includes the key. */
export function publicModelError(err: unknown): string {
  if (isRejectedLlmKey(err)) {
    return "OpenAI rejected that API key. Check it and run the briefing again.";
  }
  const message = err instanceof Error ? err.message : "Research failed";
  const clean = redactSecrets(message).replace(/\s+/g, " ").trim().slice(0, 240);
  return clean || "Research failed";
}
