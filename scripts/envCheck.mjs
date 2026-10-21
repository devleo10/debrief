/**
 * Production environment validation shared by the build script and tests.
 * Plain ESM so it can run on Vercel with no TypeScript build step.
 */

const SEARCH_KEYS = ["SERPAPI_API_KEY", "EXA_API_KEY", "TAVILY_API_KEY"];

function has(env, key) {
  return Boolean((env[key] || "").trim());
}

function present(env, keys) {
  return keys.some((key) => has(env, key));
}

export function validateProdEnv(env = process.env) {
  const errors = [];
  const warnings = [];

  if (!has(env, "OPENAI_API_KEY")) {
    errors.push("OPENAI_API_KEY is required.");
  }

  if (!present(env, SEARCH_KEYS)) {
    errors.push(
      "One of SERPAPI_API_KEY, EXA_API_KEY, or TAVILY_API_KEY is required (reports would be mock data).",
    );
  }

  if (!has(env, "NEXT_PUBLIC_SUPABASE_URL") || !has(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY")) {
    errors.push(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set at build time so the browser can sign in.",
    );
  }

  if (!present(env, ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"])) {
    errors.push(
      "SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) is required for server-side credits.",
    );
  }

  if (!has(env, "UPSTASH_REDIS_REST_URL") || !has(env, "UPSTASH_REDIS_REST_TOKEN")) {
    if (env.ALLOW_INMEMORY_LIMITS === "1") {
      warnings.push(
        "Upstash is not configured; rate limits and the daily run cap are per-instance only.",
      );
    } else {
      errors.push(
        "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required for rate limits, the daily run cap, and the research cache.",
      );
    }
  }

  if (!has(env, "DODO_PAYMENTS_API_KEY")) {
    errors.push("DODO_PAYMENTS_API_KEY is required for checkout.");
  }
  if (!has(env, "DODO_PAYMENTS_WEBHOOK_KEY")) {
    errors.push("DODO_PAYMENTS_WEBHOOK_KEY is required for payment webhooks.");
  }
  if (!has(env, "DODO_PAYMENTS_PRODUCT_ID")) {
    errors.push("DODO_PAYMENTS_PRODUCT_ID is required for checkout.");
  }
  if (env.DODO_PAYMENTS_ENVIRONMENT !== "live_mode") {
    errors.push(
      "DODO_PAYMENTS_ENVIRONMENT must be live_mode in production (test_mode is still enabled).",
    );
  }

  if (env.ALLOW_MOCK_SEARCH === "1") {
    errors.push("ALLOW_MOCK_SEARCH=1 must not be set in production.");
  }
  if (env.ALLOW_LOCAL_AUTH === "1") {
    errors.push("ALLOW_LOCAL_AUTH=1 must not be set in production.");
  }
  if (env.ALLOW_INMEMORY_LIMITS === "1") {
    errors.push("ALLOW_INMEMORY_LIMITS=1 must not be set in production.");
  }

  const runLimit =
    env.GLOBAL_DAILY_RUN_LIMIT === undefined ||
    String(env.GLOBAL_DAILY_RUN_LIMIT).trim() === ""
      ? 300
      : Number(env.GLOBAL_DAILY_RUN_LIMIT);
  if (!Number.isFinite(runLimit) || runLimit <= 0) {
    warnings.push(
      "GLOBAL_DAILY_RUN_LIMIT is disabled; nothing stops a signup wave from draining API spend.",
    );
  }

  if (!has(env, "NEXT_PUBLIC_SUPPORT_EMAIL")) {
    warnings.push(
      "NEXT_PUBLIC_SUPPORT_EMAIL is not set; the out-of-credits banner will not show a support address.",
    );
  }

  if (!has(env, "TURNSTILE_SECRET_KEY") && !has(env, "SUPABASE_CAPTCHA_ENABLED")) {
    warnings.push(
      "No bot protection configured. Enable captcha in Supabase Auth or set TURNSTILE_SECRET_KEY.",
    );
  }

  return { errors, warnings };
}
