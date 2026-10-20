import { createAdminClient } from "@/lib/supabase/admin";
import { assertSupabaseServerReady } from "@/lib/supabase/config";

/**
 * Revoke the credits granted by a payment after a refund or a lost dispute.
 * The database clamps at zero so an account that already spent the credits
 * cannot go negative. Idempotent on `revokeKey`.
 */
export async function revokePurchaseCredits(
  paymentId: string,
  revokeKey: string,
): Promise<number | null> {
  assertSupabaseServerReady();
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("revoke_purchased_credits", {
    p_payment_id: paymentId,
    p_revoke_key: revokeKey,
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !row.revoked) return null;
  return Number(row.remaining ?? 0);
}
