import { CREDIT_COST, STARTING_CREDITS } from "@/lib/auth/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertSupabaseServerReady } from "@/lib/supabase/config";

export class CreditError extends Error {
  code:
    | "insufficient"
    | "missing_profile"
    | "rpc_failed"
    | "misconfigured"
    | "invalid_key"
    | "key_refunded";

  constructor(code: CreditError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

export type ProfileRow = {
  email: string;
  credits: number;
};

export type SpendResult = {
  remaining: number;
  /** False when this request reused an existing idempotent spend. */
  chargedThisRequest: boolean;
};

type RpcRow = { remaining: number | string | null; charged?: boolean; refunded?: boolean; revoked?: boolean };

function firstRow(data: unknown): RpcRow | null {
  if (Array.isArray(data)) return (data[0] as RpcRow) ?? null;
  if (data && typeof data === "object") return data as RpcRow;
  return null;
}

function normalizeIdempotencyKey(key: string | null | undefined): string | null {
  if (!key) return null;
  const trimmed = key.trim().slice(0, 128);
  return trimmed.length >= 8 ? trimmed : null;
}

export function parseIdempotencyKey(
  key: string | null | undefined,
): string | null {
  return normalizeIdempotencyKey(key);
}

export async function ensureProfileForUser(
  userId: string,
  email: string,
): Promise<ProfileRow> {
  assertSupabaseServerReady();
  const admin = createAdminClient();
  const normalized = email.trim().toLowerCase();

  const { error: upsertError } = await admin.from("profiles").upsert(
    {
      id: userId,
      email: normalized,
      credits: STARTING_CREDITS,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );

  if (upsertError) {
    throw new CreditError("rpc_failed", upsertError.message);
  }

  const { data, error } = await admin
    .from("profiles")
    .select("email, credits")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    throw new CreditError("missing_profile", "Account profile not found.");
  }

  return { email: data.email, credits: data.credits };
}

/**
 * Charge one briefing. The database inserts the spend event and decrements the
 * balance in one transaction, so concurrent retries with the same key are safe.
 * Reusing a key that was refunded is rejected instead of granting a free run.
 */
export async function spendCreditForUser(
  userId: string,
  email: string,
  cost = CREDIT_COST,
  idempotencyKeyRaw?: string | null,
): Promise<SpendResult> {
  assertSupabaseServerReady();
  await ensureProfileForUser(userId, email);

  const idempotencyKey = normalizeIdempotencyKey(idempotencyKeyRaw);
  if (!idempotencyKey) {
    throw new CreditError("invalid_key", "Missing or invalid Idempotency-Key.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("spend_credit", {
    p_user_id: userId,
    p_cost: cost,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    const message = error.message || "";
    if (message.includes("insufficient_credits")) {
      throw new CreditError("insufficient", "No briefings left.");
    }
    if (message.includes("key_refunded")) {
      throw new CreditError(
        "key_refunded",
        "That run was already refunded. Start a new run.",
      );
    }
    throw new CreditError("rpc_failed", message || "Could not charge credit.");
  }

  const row = firstRow(data);
  if (!row) {
    throw new CreditError("rpc_failed", "Credit charge returned no result.");
  }

  return {
    remaining: Number(row.remaining ?? 0),
    chargedThisRequest: Boolean(row.charged),
  };
}

/**
 * Refund one briefing. Only callable by the server, and only for a spend that
 * actually happened with the same idempotency key. Returns the remaining
 * balance, or null when the key was already refunded or never charged.
 */
export async function refundCreditForUser(
  userId: string,
  cost = CREDIT_COST,
  idempotencyKeyRaw?: string | null,
  note?: string,
): Promise<number | null> {
  assertSupabaseServerReady();
  const idempotencyKey = normalizeIdempotencyKey(idempotencyKeyRaw);
  if (!idempotencyKey) {
    throw new CreditError("invalid_key", "Missing or invalid Idempotency-Key.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("refund_credit", {
    p_user_id: userId,
    p_cost: cost,
    p_idempotency_key: idempotencyKey,
    p_note: note ?? "briefing_failed",
  });

  if (error) {
    if ((error.message || "").includes("no_spend_for_key")) {
      return null;
    }
    console.error("[credits] refund RPC failed:", error.message);
    throw new CreditError("rpc_failed", error.message);
  }

  const row = firstRow(data);
  if (!row || !row.refunded) return null;
  return Number(row.remaining ?? 0);
}

/**
 * Take back credits granted by a payment that was refunded or charged back.
 * Idempotent on the revoke key (refund id / dispute id).
 */
export async function revokePurchasedCredits(
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
    throw new CreditError("rpc_failed", error.message);
  }

  const row = firstRow(data);
  if (!row || !row.revoked) return null;
  return Number(row.remaining ?? 0);
}
