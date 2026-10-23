import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  grant: vi.fn(),
  revoke: vi.fn(),
}));

vi.mock("@/lib/billing/grantPurchase", () => ({
  grantPurchasedCredits: mocks.grant,
}));

vi.mock("@/lib/billing/revokePurchase", () => ({
  revokePurchaseCredits: mocks.revoke,
}));

import {
  onDisputeLost,
  onPaymentSucceeded,
  onRefundSucceeded,
} from "@/lib/billing/dodoWebhook";
import { resetFreeQuotaForTests } from "@/lib/rateLimit";

const USER = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  mocks.grant.mockReset().mockResolvedValue(15);
  mocks.revoke.mockReset().mockResolvedValue(0);
  resetFreeQuotaForTests();
  vi.unstubAllEnvs();
  vi.stubEnv("DODO_PAYMENTS_PRODUCT_ID", "pdt_test_briefings");
});

describe("Dodo payment webhook", () => {
  it("grants the purchased pack once the payment succeeds", async () => {
    await onPaymentSucceeded({
      data: {
        payment_id: "pay_1",
        total_amount: 1200,
        currency: "USD",
        metadata: { app_user_id: USER, pack: "fifteen" },
        product_cart: [{ product_id: "pdt_test_briefings", quantity: 1 }],
      },
    });

    expect(mocks.grant).toHaveBeenCalledWith(USER, "pay_1", 15);
  });

  it("ignores a payment that does not cover a pack", async () => {
    await onPaymentSucceeded({
      data: {
        payment_id: "pay_2",
        total_amount: 500,
        currency: "USD",
        metadata: { app_user_id: USER, pack: "fifteen" },
        product_cart: [{ product_id: "pdt_test_briefings", quantity: 1 }],
      },
    });

    expect(mocks.grant).not.toHaveBeenCalled();
  });
});

describe("Dodo refund webhook", () => {
  it("revokes credits on a full refund", async () => {
    await onRefundSucceeded({
      data: {
        payment_id: "pay_1",
        refund_id: "ref_1",
        is_partial: false,
        status: "succeeded",
      },
    });

    expect(mocks.revoke).toHaveBeenCalledWith("pay_1", "refund:ref_1");
  });

  it("keeps credits on partial refunds", async () => {
    await onRefundSucceeded({
      data: {
        payment_id: "pay_1",
        refund_id: "ref_2",
        is_partial: true,
        status: "succeeded",
      },
    });

    expect(mocks.revoke).not.toHaveBeenCalled();
  });

  it("ignores refunds that did not succeed", async () => {
    await onRefundSucceeded({
      data: {
        payment_id: "pay_1",
        refund_id: "ref_3",
        is_partial: false,
        status: "failed",
      },
    });

    expect(mocks.revoke).not.toHaveBeenCalled();
  });
});

describe("Dodo dispute webhook", () => {
  it("revokes credits when a dispute is lost", async () => {
    await onDisputeLost({
      data: {
        payment_id: "pay_1",
        dispute_id: "dsp_1",
        dispute_status: "dispute_lost",
      },
    });

    expect(mocks.revoke).toHaveBeenCalledWith("pay_1", "dispute:dsp_1");
  });

  it("keeps credits when a dispute is won", async () => {
    await onDisputeLost({
      data: {
        payment_id: "pay_1",
        dispute_id: "dsp_2",
        dispute_status: "dispute_won",
      },
    });

    expect(mocks.revoke).not.toHaveBeenCalled();
  });
});
