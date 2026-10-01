import { refundCreditForUser, spendCreditForUser } from "@/lib/auth/serverCredits";
import { createClient } from "@/lib/supabase/server";
import {
  isSupabaseAuthConfigured,
  isSupabaseServerConfigured,
} from "@/lib/supabase/config";

export async function POST(req: Request) {
  if (!isSupabaseAuthConfigured() || !isSupabaseServerConfigured()) {
    return Response.json({ error: "Not configured." }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return Response.json({ error: "Sign in required." }, { status: 401 });
  }

  let body: { idempotencyKey?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const idempotencyKey = body.idempotencyKey?.trim();
  if (!idempotencyKey || idempotencyKey.length < 8) {
    return Response.json({ error: "idempotencyKey is required." }, { status: 400 });
  }

  try {
    const remaining = await refundCreditForUser(
      user.id,
      undefined,
      idempotencyKey,
      body.reason ?? "client_refund",
    );
    return Response.json({
      refunded: remaining !== null,
      credits: remaining,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Refund failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
