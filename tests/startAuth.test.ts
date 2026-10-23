import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class CreditError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }
  return {
    CreditError,
    user: { id: "11111111-1111-4111-8111-111111111111", email: "a@b.co" } as
      | { id: string; email: string }
      | null,
    spend: vi.fn(),
    refund: vi.fn(),
    research: vi.fn(),
  };
});

vi.mock("@/lib/auth/serverCredits", () => ({
  CreditError: mocks.CreditError,
  parseIdempotencyKey: (key: string | null | undefined) => {
    const trimmed = (key || "").trim();
    return trimmed.length >= 8 ? trimmed : null;
  },
  spendCreditForUser: mocks.spend,
  refundCreditForUser: mocks.refund,
}));

vi.mock("@/lib/supabase/config", () => ({
  isSupabaseAuthConfigured: () => true,
  isSupabaseServerConfigured: () => true,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: mocks.user } }),
    },
  }),
}));

vi.mock("@/lib/openaiClient", () => ({
  getOpenAI: vi.fn(),
  runWithUserLlmConfig: vi.fn((_config: unknown, fn: () => unknown) => fn()),
}));

vi.mock("@/lib/llmClient", () => ({
  resolveLlmConfig: vi.fn().mockResolvedValue({
    config: { provider: "openai", apiKey: "sk-test", model: "gpt-4o" },
    error: null,
    models: [],
  }),
}));

vi.mock("@/lib/research/orchestrator", () => ({
  runResearch: mocks.research,
}));

import { POST } from "@/app/api/start/route";
import { resetFreeQuotaForTests } from "@/lib/rateLimit";
import { resetGlobalRunBudgetForTests } from "@/lib/spendGuard";

const KEY = "run-key-1234";

function post(headers: Record<string, string> = { "Idempotency-Key": KEY }) {
  return POST(
    new Request("http://localhost/api/start", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({
        title: "Clinic MRI rental",
        description: "Clinics rent idle MRI time by the hour.",
      }),
    }),
  );
}

beforeEach(() => {
  mocks.user = { id: "11111111-1111-4111-8111-111111111111", email: "a@b.co" };
  mocks.spend.mockReset().mockResolvedValue({ remaining: 1, chargedThisRequest: true });
  mocks.refund.mockReset().mockResolvedValue(2);
  mocks.research.mockReset();
  resetFreeQuotaForTests();
  resetGlobalRunBudgetForTests();
  vi.unstubAllEnvs();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("OPENAI_API_KEY", "sk-server");
  vi.stubEnv("GLOBAL_DAILY_RUN_LIMIT", "300");
});

describe("POST /api/start signed-in credits", () => {
  it("requires a signed-in user", async () => {
    mocks.user = null;
    const res = await post();
    expect(res.status).toBe(401);
    expect(mocks.spend).not.toHaveBeenCalled();
  });

  it("requires an idempotency key", async () => {
    const res = await post({});
    expect(res.status).toBe(400);
    expect(mocks.spend).not.toHaveBeenCalled();
  });

  it("returns 402 when the account has no credits", async () => {
    mocks.spend.mockRejectedValue(new mocks.CreditError("insufficient", "No briefings left."));
    const res = await post();
    expect(res.status).toBe(402);
  });

  it("rejects replaying a key that already started a run", async () => {
    mocks.spend.mockResolvedValue({ remaining: 1, chargedThisRequest: false });
    const res = await post();
    expect(res.status).toBe(409);
    expect(mocks.research).not.toHaveBeenCalled();
  });

  it("returns 409 when the key was already refunded", async () => {
    mocks.spend.mockRejectedValue(
      new mocks.CreditError("key_refunded", "That run was already refunded. Start a new run."),
    );
    const res = await post();
    expect(res.status).toBe(409);
  });

  it("refunds the credit when the run fails before the report is delivered", async () => {
    mocks.research.mockRejectedValue(new Error("search exploded"));

    const res = await post();
    const body = await res.text();

    expect(body).toContain("event: error");
    expect(mocks.spend).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      "a@b.co",
      undefined,
      KEY,
    );
    expect(mocks.refund).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      undefined,
      KEY,
      "briefing_stream_error",
    );
  });

  it("does not charge a credit when the run uses the user's own key", async () => {
    mocks.research.mockRejectedValue(new Error("search exploded"));

    const res = await POST(
      new Request("http://localhost/api/start", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": KEY,
        },
        body: JSON.stringify({
          title: "Clinic MRI rental",
          description: "Clinics rent idle MRI time by the hour.",
          llmKey: `sk-proj-${"b".repeat(32)}`,
        }),
      }),
    );

    await res.text();
    expect(mocks.spend).not.toHaveBeenCalled();
    expect(mocks.refund).not.toHaveBeenCalled();
  });
});
