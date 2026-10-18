import { afterEach, describe, expect, it } from "vitest";
import {
  clearStoredLlmKey,
  hasStoredLlmKey,
  readStoredLlmKey,
  writeStoredLlmKey,
} from "@/lib/llmKeyStorage";

const validKey = `sk-${"c".repeat(24)}`;

afterEach(() => {
  window.localStorage.clear();
});

describe("llm key storage", () => {
  it("round-trips a valid key and ignores anything else", () => {
    expect(hasStoredLlmKey()).toBe(false);
    writeStoredLlmKey(validKey);
    expect(readStoredLlmKey()).toBe(validKey);
    expect(hasStoredLlmKey()).toBe(true);

    window.localStorage.setItem("debrief.openaiKey", "sk-nope");
    expect(readStoredLlmKey()).toBe("");
    expect(window.localStorage.getItem("debrief.openaiKey")).toBeNull();
  });

  it("clears the saved key", () => {
    writeStoredLlmKey(validKey);
    clearStoredLlmKey();
    expect(hasStoredLlmKey()).toBe(false);
  });
});
