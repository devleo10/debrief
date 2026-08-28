/**
 * In-memory fixed-window rate limiter keyed by client IP.
 *
 * Suitable for a single-instance deployment. Expired entries are swept
 * lazily on each check rather than on a timer, so there is no background
 * interval keeping the process alive.
 */
import { redisConfigured, redisIncr } from "./upstash";

export type RateLimiter = {
  /** Returns true when the request is allowed under the limit. */
  check(key: string): boolean;
};

export function createRateLimiter(
  windowMs: number,
  maxRequests: number,
): RateLimiter {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return {
    check(key: string): boolean {
      const now = Date.now();
      if (hits.size > maxRequests * 4) {
        for (const [k, v] of hits) {
          if (now > v.resetAt) hits.delete(k);
        }
      }

      const entry = hits.get(key);
      if (!entry || now > entry.resetAt) {
        hits.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      if (entry.count >= maxRequests) return false;
      entry.count++;
      return true;
    },
  };
}

const BURST_MAX = 5;
const BURST_WINDOW_S = 60;
const DAILY_MAX = 15;
const DAILY_WINDOW_S = 86_400;

const burstMemory = createRateLimiter(BURST_WINDOW_S * 1000, BURST_MAX);
const dailyMemory = createRateLimiter(DAILY_WINDOW_S * 1000, DAILY_MAX);

export type AdmitResult = "ok" | "burst" | "daily" | "misconfigured";

/**
 * Burst (5/min) + daily (15/day) per IP.
 * On Vercel, Redis is required unless ALLOW_INMEMORY_LIMITS=1.
 */
export async function admitRequest(ip: string): Promise<AdmitResult> {
  const vercel = process.env.VERCEL === "1";
  if (
    vercel &&
    !redisConfigured() &&
    process.env.ALLOW_INMEMORY_LIMITS !== "1"
  ) {
    return "misconfigured";
  }

  if (redisConfigured()) {
    const burst = await redisIncr(`rl:min:${ip}`, BURST_WINDOW_S);
    if (burst !== null && burst > BURST_MAX) return "burst";
    const day = await redisIncr(`rl:day:${ip}`, DAILY_WINDOW_S);
    if (day !== null && day > DAILY_MAX) return "daily";
    if (burst !== null && day !== null) return "ok";
  }

  if (!burstMemory.check(ip)) return "burst";
  if (!dailyMemory.check(ip)) return "daily";
  return "ok";
}
