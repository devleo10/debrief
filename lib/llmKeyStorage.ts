import { parseUserLlmKey } from "@/lib/userLlmKey";

const STORAGE_KEY = "debrief.openaiKey";

/** Browser-only. The server receives the key on a briefing request and does not store it. */
export function readStoredLlmKey(): string {
  if (typeof window === "undefined") return "";
  try {
    const key = parseUserLlmKey(window.localStorage.getItem(STORAGE_KEY));
    if (!key) {
      window.localStorage.removeItem(STORAGE_KEY);
      return "";
    }
    return key;
  } catch {
    return "";
  }
}

export function hasStoredLlmKey(): boolean {
  return readStoredLlmKey().length > 0;
}

export function writeStoredLlmKey(key: string) {
  window.localStorage.setItem(STORAGE_KEY, key);
}

export function clearStoredLlmKey() {
  window.localStorage.removeItem(STORAGE_KEY);
}
