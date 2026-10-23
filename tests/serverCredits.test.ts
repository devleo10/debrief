import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  upsert: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@/lib/supabase/config", () => ({
  assertSupabaseServerReady: () => {},
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: mocks.rpc,
    from: () => ({
      upsert: mocks.upsert,
      select: () => ({
        eq: () => ({ maybeSingle: mocks.maybeSingle }),
      }),
    }),
  }),
}));

import {
  CreditError,
  refundCreditForUser,
  revokePurchasedCredits,
  spendCreditForUser,
} from "@/lib/auth/serverCredits";

const USER = "11111111-1111-4111-8111-111111111111";
const KEY = "run-key-1234";

beforeEach(() => {
  mocks.rpc.mockReset();
  mocks.upsert.mockReset().mockResolvedValue({ error: null });
  mocks.maybeSingle
    .mockReset()
    .mockResolvedValue({ data: { email: "a@b.co", credits: 2 }, error: null });
});

describe("spendCreditForUser", () => {
  it("charges with the idempotency key and reports the new balance", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ remaining: 1, charged: true }],
      error: null,
    });

    const result = await spendCreditForUser(USER, "a@b.co", 1, KEY);

    expect(result).toEqual({ remaining: 1, chargedThisRequest: true });
    expect(mocks.rpc).toHaveBeenCalledWith("spend_credit", {
      p_user_id: USER,
      p_cost: 1,
      p_idempotency_key: KEY,
    });
  });

  it("does not charge again when the same key is replayed", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ remaining: 1, charged: false }],
      error: null,
    });

    const result = await spendCreditForUser(USER, "a@b.co", 1, KEY);

    expect(result.chargedThisRequest).toBe(false);
    expect(result.remaining).toBe(1);
  });

  it("maps an empty balance to the insufficient error", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "insufficient_credits" },
    });

    await expect(spendCreditForUser(USER, "a@b.co", 1, KEY)).rejects.toMatchObject({
      code: "insufficient",
    });
  });

  it("refuses to reuse a refunded key", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "key_refunded" },
    });

    await expect(spendCreditForUser(USER, "a@b.co", 1, KEY)).rejects.toBeInstanceOf(
      CreditError,
    );
    await expect(spendCreditForUser(USER, "a@b.co", 1, KEY)).rejects.toMatchObject({
      code: "key_refunded",
    });
  });

  it("requires an idempotency key", async () => {
    await expect(spendCreditForUser(USER, "a@b.co", 1, "")).rejects.toMatchObject({
      code: "invalid_key",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("refundCreditForUser", () => {
  it("returns null when no spend exists for the key", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "no_spend_for_key" },
    });

    await expect(refundCreditForUser(USER, 1, KEY)).resolves.toBeNull();
  });

  it("returns the balance when the refund lands", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ remaining: 2, refunded: true }],
      error: null,
    });

    await expect(refundCreditForUser(USER, 1, KEY)).resolves.toBe(2);
    expect(mocks.rpc).toHaveBeenCalledWith("refund_credit", {
      p_user_id: USER,
      p_cost: 1,
      p_idempotency_key: KEY,
      p_note: "briefing_failed",
    });
  });

  it("returns null when the key was already refunded", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ remaining: 2, refunded: false }],
      error: null,
    });

    await expect(refundCreditForUser(USER, 1, KEY)).resolves.toBeNull();
  });
});

describe("revokePurchasedCredits", () => {
  it("returns the balance after a refund or chargeback", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ remaining: 3, revoked: true }],
      error: null,
    });

    await expect(revokePurchasedCredits("pay_1", "refund:r1")).resolves.toBe(3);
    expect(mocks.rpc).toHaveBeenCalledWith("revoke_purchased_credits", {
      p_payment_id: "pay_1",
      p_revoke_key: "refund:r1",
    });
  });

  it("returns null when the payment has no purchase event", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ remaining: null, revoked: false }],
      error: null,
    });

    await expect(revokePurchasedCredits("pay_missing", "dispute:d1")).resolves.toBeNull();
  });
});
