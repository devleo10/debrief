import { afterEach, describe, expect, it, vi } from "vitest";
import { dodoEnvironment, purchaseGrantFromPayment } from "@/lib/dodo";

const USER = "11111111-1111-4111-8111-111111111111";

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

  it("grants one pack when the verified payment is the briefing product", () => {
    vi.stubEnv("DODO_PAYMENTS_PRODUCT_ID", "pdt_test_briefings");
    vi.stubEnv("DODO_PAYMENTS_CREDIT_PACK", "5");
    expect(
      purchaseGrantFromPayment({
        payment_id: "pay_test_1",
        metadata: { app_user_id: USER },
        product_cart: [{ product_id: "pdt_test_briefings", quantity: 1 }],
      }),
    ).toEqual({ userId: USER, paymentId: "pay_test_1", credits: 5 });
  });

  it("ignores a payment for a different product", () => {
    vi.stubEnv("DODO_PAYMENTS_PRODUCT_ID", "pdt_test_briefings");
    expect(
      purchaseGrantFromPayment({
        payment_id: "pay_test_2",
        metadata: { app_user_id: USER },
        product_cart: [{ product_id: "pdt_other", quantity: 1 }],
      }),
    ).toBeNull();
  });
});
