import { ensureProfileForUser } from "@/lib/auth/serverCredits";
import {
  isSupabaseAuthConfigured,
  isSupabaseServerConfigured,
} from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSupabaseAuthConfigured()) {
    return Response.json({ error: "Supabase auth is not configured." }, { status: 404 });
  }

  if (!isSupabaseServerConfigured()) {
    return Response.json(
      {
        error:
          "Server misconfigured: set SUPABASE_SECRET_KEY alongside the Supabase URL and publishable key.",
      },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return Response.json({ error: "Sign in required." }, { status: 401 });
  }

  try {
    const profile = await ensureProfileForUser(user.id, user.email);
    return Response.json(profile, {
      headers: { "cache-control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load account.";
    return Response.json({ error: message }, { status: 500 });
  }
}
