import { Webhooks } from "@dodopayments/nextjs";
import { grantPurchasedCredits } from "@/lib/billing/grantPurchase";
import { dodoWebhookKey, purchaseGrantFromPayment } from "@/lib/dodo";

export const runtime = "nodejs";

const webhookKey = dodoWebhookKey();

async function onPaymentSucceeded(payload: {
  data: {
    payment_id: string;
    metadata: Record<string, unknown>;
    product_cart?: { product_id: string; quantity: number }[] | null;
  };
}) {
  const grant = purchaseGrantFromPayment(payload.data);
  if (!grant) return;
  await grantPurchasedCredits(grant.userId, grant.paymentId, grant.credits);
}

export const POST = webhookKey
  ? Webhooks({
      webhookKey,
      onPaymentSucceeded,
    })
  : async function unconfigured() {
      return Response.json(
        { error: "Webhook key is not configured." },
        { status: 503 },
      );
    };
