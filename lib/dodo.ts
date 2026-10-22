import DodoPayments from "dodopayments";

/** Missing or unknown values stay in test mode. Live mode is opt-in. */
export function dodoEnvironment(): "test_mode" | "live_mode" {
  return process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode"
    ? "live_mode"
    : "test_mode";
}

const USER_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function dodoWebhookKey(): string | undefined {
  const key =
    process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim() ||
    process.env.DODO_PAYMENTS_WEBHOOK_SECRET?.trim();
  return key || undefined;
}

export function briefingProductId(): string | null {
  const id = process.env.DODO_PAYMENTS_PRODUCT_ID?.trim();
  return id || null;
}

/** Credits added once a verified payment for the briefing product succeeds. */
export function creditPackSize(): number {
  const raw = process.env.DODO_PAYMENTS_CREDIT_PACK ?? "5";
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 100) return 5;
  return n;
}

export function dodoClient(): DodoPayments | null {
  const bearerToken = process.env.DODO_PAYMENTS_API_KEY?.trim();
  if (!bearerToken) return null;
  return new DodoPayments({
    bearerToken,
    environment: dodoEnvironment(),
    webhookKey: dodoWebhookKey(),
  });
}

export type PaidBriefing = {
  userId: string;
  paymentId: string;
  credits: number;
};

/** Map a verified payment onto one briefing pack. Anything else is ignored. */
export function purchaseGrantFromPayment(data: {
  payment_id?: string;
  metadata?: Record<string, unknown> | null;
  product_cart?: { product_id: string; quantity: number }[] | null;
}): PaidBriefing | null {
  const productId = briefingProductId();
  const paymentId = data.payment_id?.trim();
  const userId = data.metadata?.app_user_id;
  if (!productId || !paymentId || typeof userId !== "string" || !USER_ID.test(userId)) {
    return null;
  }
  const sold = (data.product_cart ?? []).some(
    (line) => line.product_id === productId && line.quantity >= 1,
  );
  if (!sold) return null;
  return { userId, paymentId, credits: creditPackSize() };
}
