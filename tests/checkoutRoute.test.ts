import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authConfigured: true,
  user: { email: "buyer@example.com", id: "11111111-1111-4111-8111-111111111111" } as
    | { email: string; id: string }
    | null,
  productId: "pdt_test" as string | null,
  client: null as null | { checkoutSessions: { create: ReturnType<typeof vi.fn> } },
}));

vi.mock("@/lib/auth/serverCredits", () => ({
  ensureProfileForUser: vi.fn().mockResolvedValue({ credits: 2, email: "buyer@example.com" }),
}));

vi.mock("@/lib/supabase/config", () => ({
  isSupabaseAuthConfigured: () => mocks.authConfigured,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: mocks.user } }),
    },
  }),
}));

vi.mock("@/lib/dodo", () => ({
  briefingProductId: () => mocks.productId,
  dodoClient: () => mocks.client,
}));

import { POST } from "@/app/api/checkout/route";

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  mocks.authConfigured = true;
  mocks.user = { email: "buyer@example.com", id: "11111111-1111-4111-8111-111111111111" };
  mocks.productId = "pdt_test";
  mocks.client = {
    checkoutSessions: {
      create: vi.fn().mockResolvedValue({
        checkout_url: "https://checkout.dodo.test/session",
        session_id: "cks_1",
      }),
    },
  };
});

describe("POST /api/checkout", () => {
  it("rejects an unknown pack", async () => {
    const res = await post({ pack: "free" });
    expect(res.status).toBe(400);
  });

  it("requires sign-in configuration", async () => {
    mocks.authConfigured = false;
    const res = await post({ pack: "five" });
    expect(res.status).toBe(503);
  });

  it("requires a signed-in user", async () => {
    mocks.user = null;
    const res = await post({ pack: "five" });
    expect(res.status).toBe(401);
  });

  it("reports missing Dodo configuration", async () => {
    mocks.productId = null;
    mocks.client = null;
    const res = await post({ pack: "five" });
    expect(res.status).toBe(503);
  });

  it("creates a session with the pack metadata and amount", async () => {
    const res = await post({ pack: "fifteen" });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      checkoutUrl: "https://checkout.dodo.test/session",
      sessionId: "cks_1",
    });
    expect(mocks.client?.checkoutSessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        product_cart: [{ product_id: "pdt_test", quantity: 1, amount: 1200 }],
        metadata: {
          app_user_id: "11111111-1111-4111-8111-111111111111",
          pack: "fifteen",
        },
      }),
    );
  });
});
