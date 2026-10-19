import {
  detectProviderFromKey,
  isProviderId,
  providerFor,
  type LlmConfig,
} from "@/lib/llmProviders";

const STORAGE_KEY = "debrief.llmConfig";
const LEGACY_KEY = "debrief.openaiKey";
const CHANGE_EVENT = "debrief:llm-key";

function persist(config: LlmConfig) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function notify() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

function normalize(raw: unknown): LlmConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.apiKey !== "string" || !o.apiKey.trim()) return null;
  if (!isProviderId(o.provider)) return null;
  return {
    provider: o.provider,
    apiKey: o.apiKey.trim(),
    model: typeof o.model === "string" ? o.model.trim() : "",
  };
}

/** Browser-only. The server receives the key on a request and does not store it. */
export function readStoredLlmConfig(): LlmConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = normalize(JSON.parse(raw));
      if (parsed) return parsed;
      window.localStorage.removeItem(STORAGE_KEY);
    }
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy && legacy.trim()) {
      const provider = detectProviderFromKey(legacy) ?? "openai";
      const config: LlmConfig = {
        provider,
        apiKey: legacy.trim(),
        model: providerFor(provider).defaultModel,
      };
      persist(config);
      window.localStorage.removeItem(LEGACY_KEY);
      return config;
    }
    return null;
  } catch {
    return null;
  }
}

export function hasStoredLlmKey(): boolean {
  return readStoredLlmConfig() != null;
}

export function writeStoredLlmConfig(config: LlmConfig) {
  persist(config);
  notify();
}

export function clearStoredLlmKey() {
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_KEY);
  notify();
}

/** Fires on same-tab writes and cross-tab storage changes. */
export function subscribeLlmKeyChanges(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => fn();
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}
