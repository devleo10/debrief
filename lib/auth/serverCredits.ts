import { CREDIT_COST, STARTING_CREDITS } from "@/lib/auth/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertSupabaseServerReady } from "@/lib/supabase/config";

export class CreditError extends Error {
  code: "insufficient" | "missing_profile" | "rpc_failed" | "misconfigured";

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

async function logCreditEvent(
  userId: string,
  eventType: "spend" | "refund" | "refund_failed",
  delta: number,
  idempotencyKey: string | null,
  note?: string,
) {
  const admin = createAdminClient();
  const { error } = await admin.from("credit_events").insert({
    user_id: userId,
    event_type: eventType,
    delta,
    idempotency_key: idempotencyKey,
    note: note ?? null,
  });

  if (error && !error.message.includes("duplicate key")) {
    console.error("[credits] audit log failed:", error.message);
  }
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

async function hasSpendEvent(
  userId: string,
  idempotencyKey: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("credit_events")
    .select("id")
    .eq("user_id", userId)
    .eq("event_type", "spend")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  return Boolean(data);
}

async function hasRefundEvent(
  userId: string,
  idempotencyKey: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("credit_events")
    .select("id")
    .eq("user_id", userId)
    .eq("event_type", "refund")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  return Boolean(data);
}

export async function spendCreditForUser(
  userId: string,
  email: string,
  cost = CREDIT_COST,
  idempotencyKeyRaw?: string | null,
): Promise<SpendResult> {
  assertSupabaseServerReady();
  await ensureProfileForUser(userId, email);

  const idempotencyKey = normalizeIdempotencyKey(idempotencyKeyRaw);
  const admin = createAdminClient();

  if (idempotencyKey && (await hasSpendEvent(userId, idempotencyKey))) {
    const profile = await ensureProfileForUser(userId, email);
    return { remaining: profile.credits, chargedThisRequest: false };
  }

  const { data, error } = await admin.rpc("spend_credit", {
    p_user_id: userId,
    cost,
  });

  if (error) {
    if (error.message.includes("insufficient_credits")) {
      throw new CreditError("insufficient", "No briefings left.");
    }
    throw new CreditError("rpc_failed", error.message);
  }

  const remaining = Number(data);
  await logCreditEvent(userId, "spend", -cost, idempotencyKey);

  return { remaining, chargedThisRequest: true };
}

export async function refundCreditForUser(
  userId: string,
  cost = CREDIT_COST,
  idempotencyKeyRaw?: string | null,
  note?: string,
): Promise<number | null> {
  assertSupabaseServerReady();
  const idempotencyKey = normalizeIdempotencyKey(idempotencyKeyRaw);

  if (idempotencyKey && (await hasRefundEvent(userId, idempotencyKey))) {
    return null;
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("refund_credit", {
    p_user_id: userId,
    cost,
  });

  if (error) {
    console.error("[credits] refund RPC failed:", error.message);
    await logCreditEvent(
      userId,
      "refund_failed",
      cost,
      idempotencyKey,
      error.message,
    );
    throw new CreditError("rpc_failed", error.message);
  }

  await logCreditEvent(userId, "refund", cost, idempotencyKey, note);
  return Number(data);
}
