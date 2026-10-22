import { createAdminClient } from "@/lib/supabase/admin";
import { assertSupabaseServerReady } from "@/lib/supabase/config";

export async function grantPurchasedCredits(
  userId: string,
  paymentId: string,
  credits: number,
): Promise<number> {
  assertSupabaseServerReady();
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("grant_purchased_credits", {
    p_user_id: userId,
    p_payment_id: paymentId,
    p_credits: credits,
  });
  if (error) {
    throw new Error(error.message);
  }
  return Number(data);
}
