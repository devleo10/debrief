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
/** Free tier: two briefings per IP. Redis keeps this across deploys. */
export const FREE_RUNS_PER_IP = 2;

const burstMemory = createRateLimiter(BURST_WINDOW_S * 1000, BURST_MAX);
const freeMemory = new Map<string, number>();

export type AdmitResult = "ok" | "burst" | "quota" | "misconfigured";

function takeFreeSlot(ip: string): boolean {
  const used = freeMemory.get(ip) || 0;
  if (used >= FREE_RUNS_PER_IP) return false;
  freeMemory.set(ip, used + 1);
  return true;
}

/**
 * Burst (5/min) + two free briefings per IP.
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
    const used = await redisIncr(`rl:free:${ip}`);
    if (used !== null && used > FREE_RUNS_PER_IP) return "quota";
    if (burst !== null && used !== null) return "ok";
  }

  if (!burstMemory.check(ip)) return "burst";
  if (!takeFreeSlot(ip)) return "quota";
  return "ok";
}
