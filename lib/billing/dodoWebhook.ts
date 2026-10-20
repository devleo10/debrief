import { grantPurchasedCredits } from "@/lib/billing/grantPurchase";
import { revokePurchaseCredits } from "@/lib/billing/revokePurchase";
import { purchaseGrantFromPayment } from "@/lib/dodo";

export type PaymentSucceededPayload = {
  data: {
    payment_id: string;
    total_amount?: number;
    currency?: string;
    metadata: Record<string, unknown>;
    product_cart?: { product_id: string; quantity: number }[] | null;
  };
};

export async function onPaymentSucceeded(payload: PaymentSucceededPayload) {
  const grant = purchaseGrantFromPayment(payload.data);
  if (!grant) return;
  await grantPurchasedCredits(grant.userId, grant.paymentId, grant.credits);
}

export type RefundSucceededPayload = {
  data: {
    payment_id?: string;
    refund_id?: string;
    is_partial?: boolean;
    status?: string;
  };
};

/**
 * Full refunds take the credits back. Partial refunds keep them because the
 * grants are discrete packs and there is no sensible partial-credit answer.
 * Throwing lets Dodo retry the webhook.
 */
export async function onRefundSucceeded(payload: RefundSucceededPayload) {
  const { payment_id, refund_id, is_partial, status } = payload.data;
  if (status !== "succeeded" || is_partial) return;
  if (!payment_id || !refund_id) return;
  await revokePurchaseCredits(payment_id, `refund:${refund_id}`);
}

export type DisputeLostPayload = {
  data: {
    payment_id?: string;
    dispute_id?: string;
    dispute_status?: string;
  };
};

export async function onDisputeLost(payload: DisputeLostPayload) {
  const { payment_id, dispute_id, dispute_status } = payload.data;
  if (dispute_status && dispute_status !== "dispute_lost") return;
  if (!payment_id || !dispute_id) return;
  await revokePurchaseCredits(payment_id, `dispute:${dispute_id}`);
}
