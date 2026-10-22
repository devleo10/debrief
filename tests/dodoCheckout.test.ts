import { afterEach, describe, expect, it, vi } from "vitest";
import { dodoEnvironment, purchaseGrantFromPayment } from "@/lib/dodo";

const USER = "11111111-1111-4111-8111-111111111111";

function payment(overrides: Record<string, unknown> = {}) {
  return {
    payment_id: "pay_test_1",
    total_amount: 1200,
    currency: "USD",
    metadata: { app_user_id: USER, pack: "fifteen" },
    product_cart: [{ product_id: "pdt_test_briefings", quantity: 1 }],
    ...overrides,
  };
}

describe("dodo checkout grant", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("stays in test mode unless live mode is set explicitly", () => {
    vi.stubEnv("DODO_PAYMENTS_ENVIRONMENT", "");
    expect(dodoEnvironment()).toBe("test_mode");
    vi.stubEnv("DODO_PAYMENTS_ENVIRONMENT", "live_mode");
    expect(dodoEnvironment()).toBe("live_mode");
  });

  it("grants the pack the payment actually covered", () => {
    vi.stubEnv("DODO_PAYMENTS_PRODUCT_ID", "pdt_test_briefings");
    expect(purchaseGrantFromPayment(payment())).toEqual({
      userId: USER,
      paymentId: "pay_test_1",
      credits: 15,
    });
    expect(
      purchaseGrantFromPayment(payment({ total_amount: 2400, metadata: { app_user_id: USER, pack: "forty" } })),
    ).toMatchObject({ credits: 40 });
  });

  it("ignores a cheaper charge, another product, and a missing amount", () => {
    vi.stubEnv("DODO_PAYMENTS_PRODUCT_ID", "pdt_test_briefings");
    expect(purchaseGrantFromPayment(payment({ total_amount: 500 }))).toBeNull();
    expect(
      purchaseGrantFromPayment(
        payment({ product_cart: [{ product_id: "pdt_other", quantity: 1 }] }),
      ),
    ).toBeNull();
    expect(purchaseGrantFromPayment(payment({ total_amount: undefined }))).toBeNull();
  });
});
