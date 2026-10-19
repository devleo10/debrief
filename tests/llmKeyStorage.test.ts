import { afterEach, describe, expect, it } from "vitest";
import {
  clearStoredLlmKey,
  hasStoredLlmKey,
  readStoredLlmConfig,
  writeStoredLlmConfig,
} from "@/lib/llmKeyStorage";

const config = {
  provider: "openai" as const,
  model: "gpt-4o",
  apiKey: `sk-proj-${"c".repeat(24)}`,
};

afterEach(() => {
  window.localStorage.clear();
});

describe("llm config storage", () => {
  it("round-trips a config", () => {
    expect(hasStoredLlmKey()).toBe(false);
    writeStoredLlmConfig(config);
    expect(readStoredLlmConfig()).toEqual(config);
    expect(hasStoredLlmKey()).toBe(true);
  });

  it("migrates a legacy openai key", () => {
    window.localStorage.setItem("debrief.openaiKey", `sk-proj-${"d".repeat(24)}`);
    const migrated = readStoredLlmConfig();
    expect(migrated?.provider).toBe("openai");
    expect(window.localStorage.getItem("debrief.openaiKey")).toBeNull();
  });

  it("ignores a corrupt config", () => {
    window.localStorage.setItem("debrief.llmConfig", "{not json");
    expect(readStoredLlmConfig()).toBeNull();
  });

  it("clears a saved config", () => {
    writeStoredLlmConfig(config);
    clearStoredLlmKey();
    expect(hasStoredLlmKey()).toBe(false);
  });
});
