const SECRET_PATTERN =
  /(sk-[A-Za-z0-9_*-]{6,}|AIza[0-9A-Za-z_-]{10,}|gsk_[A-Za-z0-9]{10,}|pplx-[A-Za-z0-9]{10,}|xai-[A-Za-z0-9]{10,})/g;

/**
 * Structural validation for a pasted bring-your-own API key. Provider identity
 * and real validity are settled later by a live probe (see lib/llmClient.ts).
 * Empty input means "use the server key".
 */
export function parseLlmKeyInput(value: unknown): {
  key: string | null;
  error: string | null;
} {
  if (value == null || value === "") return { key: null, error: null };
  if (typeof value !== "string") {
    return { key: null, error: "API key must be a string." };
  }
  const key = value.trim();
  if (!key) return { key: null, error: null };
  if (/\s/.test(key)) {
    return { key: null, error: "That API key contains spaces. Paste it exactly." };
  }
  if (key.length < 20 || key.length > 400) {
    return {
      key: null,
      error: "That API key looks the wrong length. Paste the full key.",
    };
  }
  if (!/^[A-Za-z0-9_\-.:/+=]+$/.test(key)) {
    return { key: null, error: "That API key contains unexpected characters." };
  }
  return { key, error: null };
}

export function redactSecrets(text: string): string {
  return text.replace(SECRET_PATTERN, "sk-…");
}

export function isRejectedLlmKey(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: number; rejected?: boolean; message?: string };
  if (e.rejected) return true;
  if (e.status === 401 || e.status === 403) return true;
  const message = String(e.message || "");
  return /incorrect api key|invalid api key|invalid_api_key|api key not valid|api_key_invalid/i.test(
    message,
  );
}

/** Client-safe message. Never includes the key. */
export function publicModelError(err: unknown): string {
  if (isRejectedLlmKey(err)) {
    return "That API key was rejected. Check it and run the briefing again.";
  }
  const message = err instanceof Error ? err.message : "Research failed";
  const clean = redactSecrets(message).replace(/\s+/g, " ").trim().slice(0, 240);
  return clean || "Research failed";
}
