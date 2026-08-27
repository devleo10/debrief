import { describe, expect, it } from "vitest";
import { createRateLimiter } from "@/lib/rateLimit";

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
