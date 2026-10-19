import { describe, expect, it } from "vitest";
import {
  isRejectedLlmKey,
  parseLlmKeyInput,
  publicModelError,
  redactSecrets,
} from "@/lib/userLlmKey";

describe("parseLlmKeyInput", () => {
  it("treats an empty value as the server key", () => {
    expect(parseLlmKeyInput("")).toEqual({ key: null, error: null });
    expect(parseLlmKeyInput(null)).toEqual({ key: null, error: null });
    expect(parseLlmKeyInput("   ")).toEqual({ key: null, error: null });
  });

  it("accepts an OpenAI project key and trims it", () => {
    const key = `sk-proj-${"a".repeat(24)}`;
    expect(parseLlmKeyInput(`  ${key}  `)).toEqual({ key, error: null });
  });

  it("accepts a Google Gemini key", () => {
    const key = `AIza${"b".repeat(35)}`;
    expect(parseLlmKeyInput(key)).toEqual({ key, error: null });
  });

  it("rejects malformed keys", () => {
    expect(parseLlmKeyInput("short").error).toBeTruthy();
    expect(parseLlmKeyInput("has spaces in it at all")).toEqual({
      key: null,
      error: "That API key contains spaces. Paste it exactly.",
    });
    expect(parseLlmKeyInput(12).error).toMatch(/string/);
  });
});

describe("secret redaction", () => {
  it("strips a key out of a provider error", () => {
    const leaked = "Incorrect API key provided: sk-proj-abcdefghijklmnopqrstuv";
    expect(redactSecrets(leaked)).not.toContain("abcdefghijklmnopqrstuv");
    expect(publicModelError(new Error(leaked))).toBe(
      "That API key was rejected. Check it and run the briefing again.",
    );
  });

  it("treats HTTP 401 as a rejected key", () => {
    const err = Object.assign(new Error("Unauthorized"), { status: 401 });
    expect(isRejectedLlmKey(err)).toBe(true);
    expect(publicModelError(err)).not.toMatch(/sk-/);
  });
});
