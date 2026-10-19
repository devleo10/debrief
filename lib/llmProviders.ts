// Bring-your-own-key providers. Only OpenAI and Google Gemini for now.
// Kept dependency-free so it can run on both the client (detection) and server (validation).

export type ProviderId = "openai" | "google";

export type ProviderKind = "openai" | "google";

export type ProviderDef = {
  id: ProviderId;
  label: string;
  kind: ProviderKind;
  /** Base URL for the OpenAI-compatible client (unused for google). */
  baseURL: string;
  /** Model used when discovery returns nothing usable. */
  defaultModel: string;
  /** Cheaper model for repair/research passes. */
  miniModel: string;
  /** Distinctive key prefixes, most specific first. */
  prefixes: string[];
  keyHint: string;
  docsUrl: string;
};

export const PROVIDERS: Record<ProviderId, ProviderDef> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    kind: "openai",
    baseURL: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
    miniModel: "gpt-4o-mini",
    prefixes: ["sk-proj-", "sk-svcacct-", "sk-"],
    keyHint: "sk-...",
    docsUrl: "https://platform.openai.com/api-keys",
  },
  google: {
    id: "google",
    label: "Google Gemini",
    kind: "google",
    baseURL: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-2.0-flash",
    miniModel: "gemini-2.0-flash",
    prefixes: ["AIza"],
    keyHint: "AIza...",
    docsUrl: "https://aistudio.google.com/app/apikey",
  },
};

export function isProviderId(value: unknown): value is ProviderId {
  return value === "openai" || value === "google";
}

export function providerFor(id: ProviderId): ProviderDef {
  return PROVIDERS[id];
}

/** A stored/selected bring-your-own-key configuration. */
export type LlmConfig = {
  provider: ProviderId;
  model: string;
  apiKey: string;
};

/**
 * Best-effort provider detection from the key shape alone.
 * Returns null when the shape is not recognised (caller should ask or default).
 */
export function detectProviderFromKey(value: string): ProviderId | null {
  const key = value.trim();
  if (!key) return null;
  if (/^AIza[0-9A-Za-z_-]{10,}$/.test(key)) return "google";
  if (/^sk-(proj-|svcacct-)?[0-9A-Za-z_-]{16,}$/.test(key)) return "openai";
  return null;
}

const EXCLUDE = [
  "embed",
  "whisper",
  "tts",
  "dall-e",
  "image",
  "vision-only",
  "realtime",
  "audio",
  "moderation",
  "rerank",
  "guard",
  "aqa",
];

const PREFER: Record<ProviderId, string[]> = {
  openai: ["gpt-4o", "gpt-4.1", "gpt-4-turbo"],
  google: ["gemini-2", "gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro"],
};

/** Picks a chat-capable model from a discovery list, or "" when none qualify. */
export function pickModel(models: string[], provider: ProviderId): string {
  const usable = models
    .map((m) => m.trim())
    .filter((m) => m && !EXCLUDE.some((e) => m.toLowerCase().includes(e)));
  const preferred = usable.find((m) =>
    PREFER[provider].some((p) => m.toLowerCase().includes(p)),
  );
  return preferred || usable[0] || "";
}
