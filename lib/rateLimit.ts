/**
 * In-memory fixed-window rate limiter keyed by client IP.
 *
 * Suitable for a single-instance deployment. Expired entries are swept
 * lazily on each check rather than on a timer, so there is no background
 * interval keeping the process alive.
 */
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

      // Lazy sweep of expired entries.
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
