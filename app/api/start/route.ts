import {
  CreditError,
  refundCreditForUser,
  spendCreditForUser,
  parseIdempotencyKey,
} from "@/lib/auth/serverCredits";
import { getOpenAI, runWithUserLlmConfig } from "@/lib/openaiClient";
import { resolveLlmConfig } from "@/lib/llmClient";
import { isProviderId, type LlmConfig } from "@/lib/llmProviders";
import {
  isRejectedLlmKey,
  parseLlmKeyInput,
  publicModelError,
  redactSecrets,
} from "@/lib/userLlmKey";
import { runResearch } from "@/lib/research/orchestrator";
import {
  admitByokRequest,
  admitRequest,
  releaseByokRequest,
  releaseRequest,
  startLimiter,
} from "@/lib/rateLimit";
import {
  isSupabaseAuthConfigured,
  isSupabaseServerConfigured,
} from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { liveSearchConfigured } from "@/lib/searchConfig";
import { admitGlobalRun, releaseGlobalRun } from "@/lib/spendGuard";
import { buildAgentResearchContext } from "@/lib/dossier";
import {
  clientIp,
  originAllowed,
  readJsonCapped,
} from "@/lib/requestGuard";
import { maybeDowngradeShip, scoreAgreement } from "@/lib/runIntegrity";
import { vcPrompt } from "@/lib/agents/vc";
import { engineerPrompt } from "@/lib/agents/engineer";
import { indiePrompt } from "@/lib/agents/indiehacker";
import { pmPrompt } from "@/lib/agents/pm";
import { uxPrompt } from "@/lib/agents/ux";
import { userPrompt } from "@/lib/agents/user";
import { devilPrompt } from "@/lib/agents/devil";
import { synthPrompt } from "@/lib/agents/synthesizer";
import {
  clashSystemPrompt,
  buildClashUserMessage,
} from "@/lib/agents/clash";
import {
  extractScores,
  emptyScores,
  hasAnyScore,
  stripStructuredBlocks,
  averageScores,
} from "@/lib/extractScores";
import { extractVerdict, verdictFromScore } from "@/lib/extractVerdict";
import type {
  AgentResult,
  AgentScores,
  ClashResult,
  ValidateResponse,
} from "@/lib/types";
import type { ResearchInput, ResearchResult } from "@/lib/research/types";

export const maxDuration = 300;

const MAX_FIELD_CHARS = 2_000;
const MAX_IDEA_CHARS = 10_000;

type AgentSpec = {
  name: string;
  prompt: string;
  maxTokens: number;
  temperature: number;
};

const AGENTS: AgentSpec[] = [
  { name: "vc", prompt: vcPrompt, maxTokens: 700, temperature: 0.6 },
  {
    name: "engineer",
    prompt: engineerPrompt,
    maxTokens: 700,
    temperature: 0.6,
  },
  {
    name: "indiehacker",
    prompt: indiePrompt,
    maxTokens: 700,
    temperature: 0.6,
  },
  { name: "pm", prompt: pmPrompt, maxTokens: 700, temperature: 0.6 },
  { name: "ux", prompt: uxPrompt, maxTokens: 700, temperature: 0.6 },
  { name: "user", prompt: userPrompt, maxTokens: 700, temperature: 0.7 },
  { name: "devil", prompt: devilPrompt, maxTokens: 300, temperature: 0.7 },
];

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function complete(
  system: string,
  user: string,
  opts: { maxTokens: number; temperature: number; role?: "main" | "mini" },
): Promise<string> {
  const response = await getOpenAI().chat.completions.create({
    model: getOpenAI().resolveModel(opts.role ?? "main"),
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: opts.temperature,
    max_tokens: opts.maxTokens,
  });
  return response.choices[0]?.message?.content || "";
}

async function repairScores(
  agentName: string,
  output: string,
): Promise<AgentScores> {
  try {
    const repaired = await complete(
      `You convert a critique into its score block. Read the critique and output ONLY a <scores> block: raw JSON with keys market, technical, launch, ux, retention, overall. Use integers 1-10 for dimensions the critique clearly judges and null for the rest. No other text.`,
      `Critique from the "${agentName}" agent:\n\n${output}`,
      { maxTokens: 120, temperature: 0, role: "mini" },
    );
    return extractScores(repaired);
  } catch {
    return emptyScores();
  }
}

async function runAgent(
  spec: AgentSpec,
  ideaText: string,
): Promise<AgentResult> {
  try {
    const output = await complete(
      spec.prompt,
      `Evaluate this idea:\n\n${ideaText}`,
      spec,
    );
    let scores = extractScores(output);
    if (!hasAnyScore(scores) && output.trim()) {
      scores = await repairScores(spec.name, output);
    }
    return { agent: spec.name, output, scores };
  } catch (err: any) {
    if (isRejectedLlmKey(err)) throw err;
    const detail = redactSecrets(String(err?.message || "unknown error")).slice(
      0,
      180,
    );
    return {
      agent: spec.name,
      output: `This agent failed to respond (${detail}). Its perspective is missing from this run.`,
      scores: emptyScores(),
      error: true,
    };
  }
}

async function runAgents(
  ideaText: string,
  research: ResearchResult,
  enqueue: (chunk: string) => void,
): Promise<AgentResult[]> {
  return Promise.all(
    AGENTS.map(async (spec) => {
      const context = buildAgentResearchContext(research, spec.name);
      const result = await runAgent(spec, `${ideaText}\n\n${context}`);
      enqueue(sseEvent("agent", result));
      return result;
    }),
  );
}

/**
 * Cross-examination pass: each critic reacts to the other critics' claims so
 * the synthesizer can draw tension from a real exchange. Skipped when fewer
 * than two critics succeeded.
 */
async function runClash(
  ideaText: string,
  agentResults: AgentResult[],
  enqueue: (chunk: string) => void,
): Promise<ClashResult[]> {
  const succeeded = agentResults.filter((r) => !r.error);
  if (succeeded.length < 2) return [];

  return Promise.all(
    succeeded.map(async (own) => {
      const others = succeeded.filter((r) => r.agent !== own.agent);
      let output = "";
      try {
        output = stripStructuredBlocks(
          await complete(
            clashSystemPrompt(own.agent),
            `${ideaText}\n\n${buildClashUserMessage(own, others)}`,
            { maxTokens: 220, temperature: 0.4 },
          ),
        );
      } catch {
        output = "";
      }
      const result: ClashResult = { agent: own.agent, output };
      enqueue(sseEvent("clash", { type: "clash", ...result }));
      return result;
    }),
  );
}

type SourceCounts = { cited: number; fetched: number; discarded: number };

/** Cited sources are the honest headline; fetched pages include unused noise. */
function sourceCounts(research: {
  sources?: { cited?: boolean }[];
  discardedSources?: number;
}): SourceCounts {
  const all = research.sources || [];
  const cited = all.filter((s) => s.cited).length;
  return {
    // Before any claim is attributed, fall back to the fetched count.
    cited: cited || all.length,
    fetched: all.length,
    discarded: research.discardedSources || 0,
  };
}

async function runSynthesis(
  agentResults: AgentResult[],
  enqueue: (chunk: string) => void,
  counts: SourceCounts = { cited: 0, fetched: 0, discarded: 0 },
  clashes: ClashResult[] = [],
): Promise<{
  synthesis: ValidateResponse["synthesis"];
  fallback: boolean;
  agreement: "split" | "unanimous";
}> {
  const succeeded = agentResults.filter((r) => !r.error);
  if (succeeded.length === 0) {
    throw new Error("All agents failed; cannot synthesize a verdict.");
  }

  const agreement = scoreAgreement(
    succeeded
      .map((r) => r.scores.overall)
      .filter((v): v is number => v != null),
  );

  const agentBlocks = succeeded
    .map((r) => {
      const given = Object.entries(r.scores)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ");
      return `=== ${r.agent.toUpperCase()} (scores: ${given || "none"}) ===\n${stripStructuredBlocks(r.output)}`;
    })
    .join("\n\n");

  const clashBlock = clashes
    .filter((c) => c.output.trim())
    .map((c) => `${c.agent.toUpperCase()}: ${c.output}`)
    .join("\n\n");

  const synthInput = clashBlock
    ? `${agentBlocks}\n\n=== CROSS-EXAMINATION ===\n${clashBlock}`
    : agentBlocks;

  let output = "";
  let fallback = false;
  try {
    output = await complete(synthPrompt, synthInput, {
      maxTokens: 1400,
      temperature: 0.3,
    });
  } catch {
    output = "";
  }

  let scores = extractScores(output);
  if (!hasAnyScore(scores)) {
    scores = averageScores(succeeded.map((r) => r.scores));
    fallback = true;
  }
  if (!/<verdict>/i.test(output)) {
    const verdict =
      extractVerdict(output, scores.overall) ||
      verdictFromScore(scores.overall);
    if (verdict) output = `<verdict>${verdict}</verdict>\n\n${output}`.trim();
  }
  if (!output) {
    fallback = true;
    output =
      "Synthesis failed for this run. Verdict and scores below are derived from the individual agent reports.";
    const verdict = verdictFromScore(scores.overall);
    if (verdict) output = `<verdict>${verdict}</verdict>\n\n${output}`;
  }

  output = maybeDowngradeShip(output, counts.cited);
  const synthesis = { output, scores };
  enqueue(sseEvent("synthesis", synthesis));
  enqueue(
    sseEvent("integrity", {
      type: "integrity",
      fallback,
      sources: counts.cited,
      fetched: counts.fetched,
      discarded: counts.discarded,
      agentFailures: agentResults.filter((r) => r.error).length,
      agreement,
    }),
  );
  return { synthesis, fallback, agreement };
}


// --- Main handler ---

export async function POST(req: Request) {
  if (!originAllowed(req)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const format = url.searchParams.get("format");
  const skipCache = url.searchParams.get("fresh") === "1";

  let body: Record<string, unknown>;
  try {
    const parsed = await readJsonCapped(req);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch (err: any) {
    const tooLarge = err?.message === "payload too large";
    return Response.json(
      { error: tooLarge ? "Request too large" : "Invalid JSON body" },
      { status: tooLarge ? 413 : 400 },
    );
  }

  const {
    title,
    description,
    context,
    targetUser,
    problem,
    solution,
    differentiator,
    businessModel,
    pricing,
    distribution,
    competitors,
    constraints,
    successMetric,
    timeline,
  } = body;

  if (!title || typeof title !== "string" || !title.trim()) {
    return Response.json({ error: "title is required" }, { status: 400 });
  }
  if (!description || typeof description !== "string" || !description.trim()) {
    return Response.json({ error: "description is required" }, { status: 400 });
  }

  const { key: userLlmKey, error: keyError } = parseLlmKeyInput(body.llmKey);
  if (keyError) {
    return Response.json({ error: keyError }, { status: 400 });
  }
  const llmProvider = isProviderId(body.llmProvider) ? body.llmProvider : null;
  const llmModel =
    typeof body.llmModel === "string" ? body.llmModel.trim().slice(0, 120) : "";

  if (!userLlmKey && !process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "Server is missing OPENAI_API_KEY" },
      { status: 500 },
    );
  }

  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_MOCK_SEARCH !== "1" &&
    !liveSearchConfigured()
  ) {
    return Response.json(
      {
        error:
          "Production requires SERPAPI_API_KEY, EXA_API_KEY, or TAVILY_API_KEY so reports are not mock data.",
      },
      { status: 500 },
    );
  }

  const ip = clientIp(req.headers);
  if (!startLimiter.check(ip)) {
    return Response.json(
      { error: "Rate limit exceeded. Try again in 1 minute." },
      { status: 429 },
    );
  }

  let creditUserId: string | null = null;
  let creditKey: string | null = null;
  let creditCharged = false;
  let ipCharged = false;
  let byokCharged = false;
  let llmConfig: LlmConfig | null = null;
  const idempotencyKey = req.headers.get("Idempotency-Key");

  let budgetChecked = false;
  let budgetOk = false;
  const budgetAllows = async (): Promise<boolean> => {
    if (!budgetChecked) {
      budgetChecked = true;
      budgetOk = (await admitGlobalRun()) !== "cap";
    }
    return budgetOk;
  };
  const budgetBlocked = () =>
    Response.json(
      {
        error:
          "Daily briefing capacity reached. Try again tomorrow or add your own API key.",
      },
      { status: 429 },
    );
  const releaseBudget = async () => {
    if (!budgetOk) return;
    budgetOk = false;
    await releaseGlobalRun();
  };

  if (isSupabaseAuthConfigured()) {
    if (!isSupabaseServerConfigured()) {
      return Response.json(
        {
          error:
            "Server misconfigured: SUPABASE_SECRET_KEY is required when Supabase auth is enabled.",
        },
        { status: 503 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return Response.json(
        { error: "Sign in to run a briefing." },
        { status: 401 },
      );
    }

    const key = parseIdempotencyKey(idempotencyKey);
    if (!key) {
      return Response.json(
        { error: "Missing or invalid Idempotency-Key header." },
        { status: 400 },
      );
    }

    if (!userLlmKey) {
      if (!(await budgetAllows())) return budgetBlocked();
      try {
        const result = await spendCreditForUser(
          user.id,
          user.email,
          undefined,
          key,
        );
        if (!result.chargedThisRequest) {
          await releaseBudget();
          return Response.json(
            {
              error:
                "This run key was already used. Start a new briefing to run again.",
            },
            { status: 409 },
          );
        }
        creditUserId = user.id;
        creditKey = key;
        creditCharged = true;
      } catch (err) {
        await releaseBudget();
        if (err instanceof CreditError && err.code === "insufficient") {
          return Response.json({ error: "No briefings left." }, { status: 402 });
        }
        if (err instanceof CreditError && err.code === "key_refunded") {
          return Response.json({ error: err.message }, { status: 409 });
        }
        const message =
          err instanceof Error ? err.message : "Could not verify account.";
        return Response.json({ error: message }, { status: 500 });
      }
    }
  } else if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_LOCAL_AUTH !== "1"
  ) {
    return Response.json(
      { error: "Sign-in is required. Supabase auth is not configured." },
      { status: 503 },
    );
  } else if (!userLlmKey) {
    if (!(await budgetAllows())) return budgetBlocked();
    const admitted = await admitRequest(ip);
    if (admitted === "misconfigured") {
      await releaseBudget();
      return Response.json(
        {
          error:
            "Production rate limits need Upstash Redis (UPSTASH_REDIS_REST_URL + TOKEN), or set ALLOW_INMEMORY_LIMITS=1.",
        },
        { status: 500 },
      );
    }
    if (admitted === "quota") {
      await releaseBudget();
      return Response.json(
        {
          error:
            "You've used your free briefings on this network today. Sign in for credits or add your own API key.",
        },
        { status: 429 },
      );
    }
    ipCharged = true;
  }

  if (userLlmKey) {
    const resolved = await resolveLlmConfig({
      apiKey: userLlmKey,
      provider: llmProvider,
      model: llmModel,
    });
    if (resolved.error || !resolved.config) {
      return Response.json(
        { error: resolved.error || "That API key didn't work." },
        { status: 400 },
      );
    }
    llmConfig = resolved.config;
    if (!(await budgetAllows())) return budgetBlocked();
    const admitted = await admitByokRequest(ip);
    if (admitted === "misconfigured") {
      await releaseBudget();
      return Response.json(
        {
          error:
            "Production rate limits need Upstash Redis (UPSTASH_REDIS_REST_URL + TOKEN), or set ALLOW_INMEMORY_LIMITS=1.",
        },
        { status: 500 },
      );
    }
    if (admitted === "quota") {
      await releaseBudget();
      return Response.json(
        {
          error:
            "Too many briefings on your key from this network today. Try again tomorrow.",
        },
        { status: 429 },
      );
    }
    byokCharged = true;
  }

  const refund = async (note?: string) => {
    if (creditCharged && creditUserId) {
      creditCharged = false;
      try {
        await refundCreditForUser(
          creditUserId,
          undefined,
          creditKey ?? idempotencyKey,
          note ?? "briefing_failed",
        );
      } catch (err) {
        console.error(
          "[credits] refund after briefing failure:",
          err instanceof Error ? err.message : err,
        );
      }
      return;
    }
    if (byokCharged) {
      byokCharged = false;
      await releaseByokRequest(ip);
      return;
    }
    if (!ipCharged) return;
    ipCharged = false;
    await releaseRequest(ip);
  };

  const sanitize = (s: string) =>
    s
      .replace(/[^\p{L}\p{N}\s.,!?;:'"()-]/gu, "")
      .trim()
      .slice(0, 2000);

  const researchInput: ResearchInput = {
    title: sanitize(title),
    description: sanitize(description),
    context: typeof context === "string" ? sanitize(context) : undefined,
  };

  const buildSection = (label: string, value?: unknown) => {
    const trimmed =
      typeof value === "string" ? value.trim().slice(0, MAX_FIELD_CHARS) : "";
    return trimmed ? `${label}: ${trimmed}` : null;
  };

  const sections = [
    buildSection("Title", title),
    buildSection("Description", description),
    buildSection("Target user", targetUser),
    buildSection("Problem", problem),
    buildSection("Solution", solution),
    buildSection("Differentiator", differentiator),
    buildSection("Business model", businessModel),
    buildSection("Pricing", pricing),
    buildSection("Distribution", distribution),
    buildSection("Competitors", competitors),
    buildSection("Constraints", constraints),
    buildSection("Success metric", successMetric),
    buildSection("Timeline", timeline),
    buildSection("Extra context", context),
  ].filter(Boolean);

  const ideaText = sections.join("\n\n").slice(0, MAX_IDEA_CHARS);

  if (format === "json") {
    try {
      return await runWithUserLlmConfig(llmConfig, async () => {
        const researchResult = await runResearch(
          researchInput,
          () => {},
          req.signal,
          { skipCache },
        );
        const agentResults = await runAgents(ideaText, researchResult, () => {});
        const clashes = await runClash(ideaText, agentResults, () => {});
        const counts = sourceCounts(researchResult);
        const { synthesis, fallback, agreement } = await runSynthesis(
          agentResults,
          () => {},
          counts,
          clashes,
        );
        return Response.json({
          research: researchResult,
          agents: agentResults,
          clashes,
          synthesis,
          integrity: {
            type: "integrity",
            fallback,
            sources: counts.cited,
            fetched: counts.fetched,
            discarded: counts.discarded,
            agentFailures: agentResults.filter((r) => r.error).length,
            agreement,
          },
        });
      });
    } catch (err: any) {
      await refund("json_briefing_error");
      return Response.json({ error: publicModelError(err) }, { status: 500 });
    }
  }

  const encoder = new TextEncoder();
  const abortController = new AbortController();

  const stream = new ReadableStream({
    async start(controller) {
      await runWithUserLlmConfig(llmConfig, async () => {
      const enqueue = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {}
      };

      const onClientAbort = () => abortController.abort();
      req.signal.addEventListener("abort", onClientAbort);
      if (req.signal.aborted) abortController.abort();

      let synthesisDelivered = false;
      const heartbeat = setInterval(() => {
        enqueue(sseEvent("ping", { t: Date.now() }));
      }, 15_000);

      try {
        if (abortController.signal.aborted) {
          throw new Error("Cancelled");
        }

        const researchResult = await runResearch(
          researchInput,
          enqueue,
          abortController.signal,
          { skipCache },
        );
        if (abortController.signal.aborted) throw new Error("Cancelled");

        if (researchResult?.sources?.length) {
          enqueue(
            sseEvent("sources", {
              type: "sources",
              data: researchResult.sources,
            }),
          );
        }

        enqueue(sseEvent("status", { phase: "validate", status: "starting" }));
        const agentResults = await runAgents(ideaText, researchResult, enqueue);
        if (abortController.signal.aborted) throw new Error("Cancelled");

        const clashes = await runClash(ideaText, agentResults, enqueue);
        if (abortController.signal.aborted) throw new Error("Cancelled");

        await runSynthesis(
          agentResults,
          enqueue,
          sourceCounts(researchResult),
          clashes,
        );
        synthesisDelivered = true;

        enqueue(sseEvent("done", {}));
      } catch (err: any) {
        // Once the report has been delivered, a disconnect is not a failed
        // run. Refunding here would hand out a free report.
        if (!synthesisDelivered) {
          await refund("briefing_stream_error");
        }
        enqueue(
          sseEvent("error", {
            message:
              err.message === "Cancelled"
                ? "Cancelled"
                : publicModelError(err),
          }),
        );
      } finally {
        clearInterval(heartbeat);
        req.signal.removeEventListener("abort", onClientAbort);
        try {
          controller.close();
        } catch {}
      }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });
}
