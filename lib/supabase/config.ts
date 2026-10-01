export function isSupabaseAuthConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/** Server can verify sessions and mutate credits via service role. */
export function isSupabaseServerConfigured(): boolean {
  return Boolean(
    isSupabaseAuthConfigured() && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/** @deprecated use isSupabaseAuthConfigured or isSupabaseServerConfigured */
export function isSupabaseConfigured(): boolean {
  return isSupabaseAuthConfigured();
}

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  return url;
}

export function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return key;
}

export function getSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return key;
}

export function assertSupabaseServerReady(): void {
  if (!isSupabaseAuthConfigured()) {
    throw new Error("Supabase auth env vars are missing.");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for server-side credits.",
    );
  }
}
