import { isRedisConfigured, redisDecr, redisIncr } from "@/lib/upstash";

/**
 * Hard ceiling on briefings started per UTC day across the whole deployment.
 * A briefing costs real OpenAI + search money, so a signup or BYOK wave should
 * not be able to drain the account. Set GLOBAL_DAILY_RUN_LIMIT=0 to disable
 * (not recommended in production).
 *
 * Redis is used when configured (atomic across instances). Without it this is
 * a per-process counter, which is only a best-effort guard.
 */
const DEFAULT_DAILY_RUN_LIMIT = 300;

let memoryDay = "";
let memoryCount = 0;

export function globalDailyRunLimit(): number {
  const raw = process.env.GLOBAL_DAILY_RUN_LIMIT;
  if (raw === undefined || raw.trim() === "") return DEFAULT_DAILY_RUN_LIMIT;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

export type GlobalRunAdmission = "ok" | "cap" | "disabled";

export async function admitGlobalRun(): Promise<GlobalRunAdmission> {
  const limit = globalDailyRunLimit();
  if (!limit) return "disabled";

  const day = utcDay();

  if (isRedisConfigured()) {
    const key = `runs:global:${day}`;
    const count = await redisIncr(key, 172_800);
    if (count == null) {
      console.error(
        "[spend] global run counter unavailable; allowing the run",
      );
      return "ok";
    }
    if (count > limit) {
      await redisDecr(key);
      return "cap";
    }
    return "ok";
  }

  if (memoryDay !== day) {
    memoryDay = day;
    memoryCount = 0;
  }
  if (memoryCount >= limit) return "cap";
  memoryCount += 1;
  return "ok";
}

/** Give back an admitted slot when the run never started (spend/admission failed). */
export async function releaseGlobalRun(): Promise<void> {
  const limit = globalDailyRunLimit();
  if (!limit) return;

  const day = utcDay();
  if (isRedisConfigured()) {
    await redisDecr(`runs:global:${day}`);
    return;
  }
  if (memoryDay !== day) return;
  memoryCount = Math.max(0, memoryCount - 1);
}

export function resetGlobalRunBudgetForTests() {
  memoryDay = "";
  memoryCount = 0;
}
