import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  admitGlobalRun,
  releaseGlobalRun,
  resetGlobalRunBudgetForTests,
} from "@/lib/spendGuard";

beforeEach(() => {
  resetGlobalRunBudgetForTests();
  vi.unstubAllEnvs();
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
});

describe("global run cap", () => {
  it("admits runs up to the daily limit and then stops", async () => {
    vi.stubEnv("GLOBAL_DAILY_RUN_LIMIT", "2");

    await expect(admitGlobalRun()).resolves.toBe("ok");
    await expect(admitGlobalRun()).resolves.toBe("ok");
    await expect(admitGlobalRun()).resolves.toBe("cap");
    await expect(admitGlobalRun()).resolves.toBe("cap");
  });

  it("can be disabled with zero", async () => {
    vi.stubEnv("GLOBAL_DAILY_RUN_LIMIT", "0");
    await expect(admitGlobalRun()).resolves.toBe("disabled");
  });

  it("defaults to a finite cap when the env var is absent", async () => {
    vi.stubEnv("GLOBAL_DAILY_RUN_LIMIT", "");
    await expect(admitGlobalRun()).resolves.toBe("ok");
  });

  it("returns a slot when the run never started", async () => {
    vi.stubEnv("GLOBAL_DAILY_RUN_LIMIT", "1");
    await expect(admitGlobalRun()).resolves.toBe("ok");
    await expect(admitGlobalRun()).resolves.toBe("cap");
    await releaseGlobalRun();
    await expect(admitGlobalRun()).resolves.toBe("ok");
  });
});
