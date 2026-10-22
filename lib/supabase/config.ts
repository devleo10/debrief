function supabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
}

function supabasePublishableKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY
  );
}

function supabaseSecretKey(): string | undefined {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function isSupabaseAuthConfigured(): boolean {
  return Boolean(supabaseUrl() && supabasePublishableKey());
}

/** Server can verify sessions and mutate credits via the secret key. */
export function isSupabaseServerConfigured(): boolean {
  return Boolean(isSupabaseAuthConfigured() && supabaseSecretKey());
}

/** @deprecated use isSupabaseAuthConfigured or isSupabaseServerConfigured */
export function isSupabaseConfigured(): boolean {
  return isSupabaseAuthConfigured();
}

export function getSupabaseUrl(): string {
  const url = supabaseUrl();
  if (!url) throw new Error("Missing SUPABASE_URL");
  return url;
}

export function getSupabaseAnonKey(): string {
  const key = supabasePublishableKey();
  if (!key) throw new Error("Missing SUPABASE_PUBLISHABLE_KEY");
  return key;
}

export function getSupabaseServiceRoleKey(): string {
  const key = supabaseSecretKey();
  if (!key) throw new Error("Missing SUPABASE_SECRET_KEY");
  return key;
}

export function assertSupabaseServerReady(): void {
  if (!isSupabaseAuthConfigured()) {
    throw new Error("Supabase auth env vars are missing.");
  }
  if (!supabaseSecretKey()) {
    throw new Error("SUPABASE_SECRET_KEY is required for server-side credits.");
  }
}
