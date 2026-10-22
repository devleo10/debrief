import DodoPayments from "dodopayments";
import { briefingPack } from "@/lib/pricing";

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

/**
 * Map a verified payment onto the pack we sold. The amount has to cover that
 * pack. A cheaper charge, another product, or a missing user id grants nothing.
 */
export function purchaseGrantFromPayment(data: {
  payment_id?: string;
  total_amount?: number | null;
  currency?: string | null;
  metadata?: Record<string, unknown> | null;
  product_cart?: { product_id: string; quantity: number }[] | null;
}): PaidBriefing | null {
  const productId = briefingProductId();
  const paymentId = data.payment_id?.trim();
  const userId = data.metadata?.app_user_id;
  const packId = data.metadata?.pack;
  if (!productId || !paymentId || typeof userId !== "string" || !USER_ID.test(userId)) {
    return null;
  }
  if (typeof packId !== "string") return null;
  const pack = briefingPack(packId);
  if (!pack) return null;
  if (data.currency && data.currency !== "USD") return null;
  if (typeof data.total_amount !== "number" || data.total_amount < pack.priceCents) {
    return null;
  }
  const sold = (data.product_cart ?? []).some(
    (line) => line.product_id === productId && line.quantity >= 1,
  );
  if (!sold) return null;
  return { userId, paymentId, credits: pack.credits };
}
