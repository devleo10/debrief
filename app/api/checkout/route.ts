import { NextResponse } from "next/server";
import { briefingProductId, dodoClient } from "@/lib/dodo";
import { originAllowed } from "@/lib/requestGuard";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function returnUrl(request: Request): string {
  const configured = process.env.DODO_PAYMENTS_RETURN_URL?.trim();
  if (configured) return configured;
  return new URL("/checkout/success", request.url).toString();
}

export async function POST(request: Request) {
  if (!originAllowed(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isSupabaseAuthConfigured()) {
    return NextResponse.json(
      { error: "Sign-in is required before checkout." },
      { status: 503 },
    );
  }

  const productId = briefingProductId();
  const client = dodoClient();
  if (!productId || !client) {
    return NextResponse.json(
      { error: "Checkout is not configured." },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Sign in to buy briefings." }, { status: 401 });
  }

  try {
    const session = await client.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: { email: user.email },
      metadata: { app_user_id: user.id },
      return_url: returnUrl(request),
    });
    if (!session.checkout_url) {
      return NextResponse.json(
        { error: "Checkout did not return a URL." },
        { status: 502 },
      );
    }
    return NextResponse.json({
      checkoutUrl: session.checkout_url,
      sessionId: session.session_id,
    });
  } catch (error) {
    console.error(
      "[checkout] session create failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json(
      { error: "Could not start checkout." },
      { status: 502 },
    );
  }
}
