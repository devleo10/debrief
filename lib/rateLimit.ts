import { isRedisConfigured, redisDecr, redisIncr } from "@/lib/upstash";

export const FREE_RUNS_PER_IP = 2;
/** Own-key runs still spend our search quota, so they stay capped per network. */
export const BYOK_RUNS_PER_IP = 24;
export const FREE_WINDOW_SECONDS = 86_400;

type LimitResult = { count: number; resetAt: number };

const buckets = new Map<string, LimitResult>();

function incrMemory(key: string, windowSec: number): LimitResult {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    const next = { count: 1, resetAt: now + windowSec * 1000 };
    buckets.set(key, next);
    return next;
  }
  current.count += 1;
  buckets.set(key, current);
  return current;
}

function decrMemory(key: string) {
  const current = buckets.get(key);
  if (!current) return;
  current.count = Math.max(0, current.count - 1);
  buckets.set(key, current);
}

export function resetFreeQuotaForTests() {
  buckets.clear();
}

export function createRateLimiter(windowMs: number, max: number) {
  const hits = new Map<string, number[]>();
  return {
    check(key: string): boolean {
      const now = Date.now();
      const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      return true;
    },
  };
}

export const startLimiter = createRateLimiter(60_000, 8);
export const validateLimiter = createRateLimiter(60_000, 12);
export const verifyKeyLimiter = createRateLimiter(60_000, 20);

export type AdmitResult = "ok" | "quota" | "misconfigured";

function vercelWithoutRedis(): boolean {
  return (
    Boolean(process.env.VERCEL) &&
    !isRedisConfigured() &&
    process.env.ALLOW_INMEMORY_LIMITS !== "1"
  );
}

async function admitScoped(
  ip: string,
  prefix: string,
  limit: number,
): Promise<AdmitResult> {
  if (vercelWithoutRedis()) return "misconfigured";
  const key = `${prefix}:${ip}`;
  if (isRedisConfigured()) {
    const count = await redisIncr(key, FREE_WINDOW_SECONDS);
    if (count == null) return "misconfigured";
    if (count > limit) {
      await redisDecr(key);
      return "quota";
    }
    return "ok";
  }
  const count = incrMemory(key, FREE_WINDOW_SECONDS).count;
  if (count > limit) {
    decrMemory(key);
    return "quota";
  }
  return "ok";
}

async function releaseScoped(ip: string, prefix: string): Promise<void> {
  const key = `${prefix}:${ip}`;
  if (isRedisConfigured()) {
    await redisDecr(key);
    return;
  }
  decrMemory(key);
}

export async function admitRequest(ip: string): Promise<AdmitResult> {
  return admitScoped(ip, "free", FREE_RUNS_PER_IP);
}

export async function releaseRequest(ip: string): Promise<void> {
  return releaseScoped(ip, "free");
}

export async function admitByokRequest(ip: string): Promise<AdmitResult> {
  return admitScoped(ip, "byok", BYOK_RUNS_PER_IP);
}

export async function releaseByokRequest(ip: string): Promise<void> {
  return releaseScoped(ip, "byok");
}
