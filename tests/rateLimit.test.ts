import { afterEach, describe, expect, it, vi } from "vitest";
import { createRateLimiter, admitRequest } from "@/lib/rateLimit";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createRateLimiter", () => {
  it("allows up to the max requests within the window", () => {
    const rl = createRateLimiter(60_000, 3);
    expect(rl.check("ip1")).toBe(true);
    expect(rl.check("ip1")).toBe(true);
    expect(rl.check("ip1")).toBe(true);
  });

  it("blocks beyond the limit and reports false", () => {
    const rl = createRateLimiter(60_000, 2);
    rl.check("ip1");
    rl.check("ip1");
    expect(rl.check("ip1")).toBe(false);
    expect(rl.check("ip1")).toBe(false);
  });

  it("tracks keys independently", () => {
    const rl = createRateLimiter(60_000, 1);
    expect(rl.check("a")).toBe(true);
    expect(rl.check("b")).toBe(true);
    expect(rl.check("a")).toBe(false);
  });

  it("resets after the window expires", () => {
    const rl = createRateLimiter(10, 1);
    expect(rl.check("a")).toBe(true);
    expect(rl.check("a")).toBe(false);
    return new Promise((resolve) => setTimeout(resolve, 15)).then(() => {
      expect(rl.check("a")).toBe(true);
    });
  });
});

describe("admitRequest", () => {
  it("refuses Vercel deploys without Redis", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv("ALLOW_INMEMORY_LIMITS", "");
    expect(await admitRequest("1.1.1.1")).toBe("misconfigured");
  });

  it("allows two free runs per IP then blocks", async () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const ip = `free-tier-${Math.random().toString(36).slice(2)}`;
    expect(await admitRequest(ip)).toBe("ok");
    expect(await admitRequest(ip)).toBe("ok");
    expect(await admitRequest(ip)).toBe("quota");
  });
});
