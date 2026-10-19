import { describe, expect, it } from "vitest";
import { detectProviderFromKey, pickModel } from "@/lib/llmProviders";

describe("detectProviderFromKey", () => {
  it("detects Google Gemini keys", () => {
    expect(detectProviderFromKey(`AIza${"a".repeat(35)}`)).toBe("google");
  });

  it("detects OpenAI keys", () => {
    expect(detectProviderFromKey(`sk-proj-${"a".repeat(24)}`)).toBe("openai");
    expect(detectProviderFromKey(`sk-${"a".repeat(40)}`)).toBe("openai");
  });

  it("returns null for unknown shapes", () => {
    expect(detectProviderFromKey("hello-world-key-1234567890")).toBeNull();
    expect(detectProviderFromKey("")).toBeNull();
  });
});

describe("pickModel", () => {
  it("prefers a known chat model and skips non-chat models", () => {
    expect(
      pickModel(["text-embedding-3-small", "gpt-4o-mini", "dall-e-3"], "openai"),
    ).toBe("gpt-4o-mini");
  });

  it("falls back to the first usable model", () => {
    expect(pickModel(["custom-model-x"], "openai")).toBe("custom-model-x");
  });

  it("returns empty when nothing qualifies", () => {
    expect(pickModel(["text-embedding-3-small"], "openai")).toBe("");
  });
});
