import { describe, expect, it } from "vitest";
import {
  isRejectedLlmKey,
  publicModelError,
  readUserLlmKey,
  redactSecrets,
} from "@/lib/userLlmKey";

describe("readUserLlmKey", () => {
  it("treats an empty value as the server key", () => {
    expect(readUserLlmKey("")).toEqual({ key: null, error: null });
    expect(readUserLlmKey(null)).toEqual({ key: null, error: null });
    expect(readUserLlmKey("   ")).toEqual({ key: null, error: null });
  });

  it("accepts a project key and trims it", () => {
    const key = `sk-proj-${"a".repeat(24)}`;
    expect(readUserLlmKey(`  ${key}  `)).toEqual({ key, error: null });
  });

  it("rejects keys that are not OpenAI secrets", () => {
    expect(readUserLlmKey("sk-short").error).toMatch(/start with sk-/);
    expect(readUserLlmKey("anthropic-key-123456789012345").error).toMatch(
      /start with sk-/,
    );
    expect(readUserLlmKey(12).error).toMatch(/string/);
  });
});

describe("secret redaction", () => {
  it("strips a key out of a provider error", () => {
    const leaked = "Incorrect API key provided: sk-proj-abcdefghijklmnopqrstuv";
    expect(redactSecrets(leaked)).not.toContain("abcdefghijklmnopqrstuv");
    expect(publicModelError(new Error(leaked))).toBe(
      "OpenAI rejected that API key. Check it and run the briefing again.",
    );
  });

  it("treats HTTP 401 as a rejected key", () => {
    const err = Object.assign(new Error("Unauthorized"), { status: 401 });
    expect(isRejectedLlmKey(err)).toBe(true);
    expect(publicModelError(err)).not.toMatch(/sk-/);
  });
});
