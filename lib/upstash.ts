/**
 * Optional Upstash Redis REST client (no SDK). Used for rate limits and
 * research cache on Vercel. Local dev keeps working without these vars.
 */
export function redisConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}

async function command(args: (string | number)[]): Promise<unknown> {
  const base = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!base || !token) return null;
  try {
    const res = await fetch(base, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: unknown };
    return body.result ?? null;
  } catch {
    return null;
  }
}

/** INCR key. If ttlSeconds is set, apply it on first hit. Returns count, or null if Redis is down. */
export async function redisIncr(
  key: string,
  ttlSeconds?: number,
): Promise<number | null> {
  const n = await command(["INCR", key]);
  if (typeof n !== "number") return null;
  if (n === 1 && ttlSeconds && ttlSeconds > 0) {
    await command(["EXPIRE", key, ttlSeconds]);
  }
  return n;
}

export async function redisGet(key: string): Promise<string | null> {
  const v = await command(["GET", key]);
  return typeof v === "string" ? v : null;
}

export async function redisSet(
  key: string,
  value: string,
  ttlSeconds: number,
): Promise<void> {
  await command(["SET", key, value, "EX", ttlSeconds]);
}
