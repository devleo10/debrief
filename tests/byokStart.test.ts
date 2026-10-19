import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/openaiClient", () => ({
  getOpenAI: vi.fn(),
  runWithUserLlmConfig: vi.fn((_config: unknown, fn: () => unknown) => fn()),
}));

vi.mock("@/lib/llmClient", () => ({
  resolveLlmConfig: vi.fn(),
}));

vi.mock("@/lib/supabase/config", () => ({
  isSupabaseAuthConfigured: () => false,
  isSupabaseServerConfigured: () => false,
}));

import { POST } from "@/app/api/start/route";
import { resolveLlmConfig } from "@/lib/llmClient";
import { resetFreeQuotaForTests } from "@/lib/rateLimit";

const resolve = vi.mocked(resolveLlmConfig);
const secret = `sk-proj-${"b".repeat(32)}`;

function post(body: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  resolve.mockReset();
  resetFreeQuotaForTests();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("OPENAI_API_KEY", "sk-server");
});

describe("POST /api/start own key", () => {
  it("rejects a malformed key before verifying", async () => {
    const res = await post({
      title: "Clinic MRI rental",
      description: "Clinics rent idle MRI time by the hour.",
      llmKey: "not-a-real-key",
    });
    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.error).toMatch(/API key/);
    expect(JSON.stringify(payload)).not.toContain("not-a-real-key");
    expect(resolve).not.toHaveBeenCalled();
  });

  it("returns the verify error without echoing the key", async () => {
    resolve.mockResolvedValue({
      config: null,
      error: "OpenAI rejected that API key. Check it and try again.",
      models: [],
    });
    const res = await post({
      title: "Clinic MRI rental",
      description: "Clinics rent idle MRI time by the hour.",
      llmKey: secret,
    });
    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.error).toMatch(/rejected that API key/);
    expect(JSON.stringify(payload)).not.toContain(secret);
    expect(resolve).toHaveBeenCalledWith({
      apiKey: secret,
      provider: null,
      model: "",
    });
  });
});
