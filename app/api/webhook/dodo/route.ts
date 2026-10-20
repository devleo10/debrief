import { Webhooks } from "@dodopayments/nextjs";
import {
  onDisputeLost,
  onPaymentSucceeded,
  onRefundSucceeded,
} from "@/lib/billing/dodoWebhook";
import { dodoWebhookKey } from "@/lib/dodo";

export const runtime = "nodejs";

const webhookKey = dodoWebhookKey();

export const POST = webhookKey
  ? Webhooks({
      webhookKey,
      onPaymentSucceeded,
      onRefundSucceeded,
      onDisputeLost,
    })
  : async function unconfigured() {
      return Response.json(
        { error: "Webhook key is not configured." },
        { status: 503 },
      );
    };
