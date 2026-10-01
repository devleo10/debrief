import {
  CreditError,
  refundCreditForUser,
  spendCreditForUser,
  parseIdempotencyKey,
} from "@/lib/auth/serverCredits";
import { getOpenAI } from "@/lib/openaiClient";
import { runResearch } from "@/lib/research/orchestrator";
import { admitRequest, releaseRequest, startLimiter } from "@/lib/rateLimit";
import {
  isSupabaseAuthConfigured,
  isSupabaseServerConfigured,
} from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { liveSearchConfigured } from "@/lib/searchConfig";
import { buildAgentResearchContext } from "@/lib/dossier";
import {
  clientIp,
  originAllowed,
  readJsonCapped,
} from "@/lib/requestGuard";
import { maybeDowngradeShip } from "@/lib/runIntegrity";
import { vcPrompt } from "@/lib/agents/vc";
import { engineerPrompt } from "@/lib/agents/engineer";
import { indiePrompt } from "@/lib/agents/indiehacker";
import { pmPrompt } from "@/lib/agents/pm";
import { uxPrompt } from "@/lib/agents/ux";
import { userPrompt } from "@/lib/agents/user";
import { devilPrompt } from "@/lib/agents/devil";
import { synthPrompt } from "@/lib/agents/synthesizer";
import {
  extractScores,
  emptyScores,
  hasAnyScore,
  stripStructuredBlocks,
  averageScores,
} from "@/lib/extractScores";
import { extractVerdict, verdictFromScore } from "@/lib/extractVerdict";
import type { AgentResult, AgentScores, ValidateResponse } from "@/lib/types";
import type { ResearchInput } from "@/lib/research/types";

export const maxDuration = 300;

const MODEL = process.env.OPENAI_MODEL || "gpt-4o";
const REPAIR_MODEL = process.env.OPENAI_REPAIR_MODEL || "gpt-4o-mini";
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
  opts: { maxTokens: number; temperature: number; model?: string },
): Promise<string> {
  const response = await getOpenAI().chat.completions.create({
    model: opts.model || MODEL,
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
      { maxTokens: 120, temperature: 0, model: REPAIR_MODEL },
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
    return {
      agent: spec.name,
      output: `This agent failed to respond (${err?.message || "unknown error"}). Its perspective is missing from this run.`,
      scores: emptyScores(),
      error: true,
    };
  }
}

async function runAgents(
  ideaText: string,
  enqueue: (chunk: string) => void,
): Promise<AgentResult[]> {
  return Promise.all(
    AGENTS.map(async (spec) => {
      const result = await runAgent(spec, ideaText);
      enqueue(sseEvent("agent", result));
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
): Promise<{
  synthesis: ValidateResponse["synthesis"];
  fallback: boolean;
}> {
  const succeeded = agentResults.filter((r) => !r.error);
  if (succeeded.length === 0) {
    throw new Error("All agents failed; cannot synthesize a verdict.");
  }

  const synthInput = succeeded
    .map((r) => {
      const given = Object.entries(r.scores)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ");
      return `=== ${r.agent.toUpperCase()} (scores: ${given || "none"}) ===\n${stripStructuredBlocks(r.output)}`;
    })
    .join("\n\n");

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
    }),
  );
  return { synthesis, fallback };
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

  if (!process.env.OPENAI_API_KEY) {
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
  let creditCharged = false;
  let ipCharged = false;
  const idempotencyKey = req.headers.get("Idempotency-Key");

  if (isSupabaseAuthConfigured()) {
    if (!isSupabaseServerConfigured()) {
      return Response.json(
        {
          error:
            "Server misconfigured: SUPABASE_SERVICE_ROLE_KEY is required when Supabase auth is enabled.",
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

    try {
      const result = await spendCreditForUser(
        user.id,
        user.email,
        undefined,
        key,
      );
      creditUserId = user.id;
      creditCharged = result.chargedThisRequest;
    } catch (err) {
      if (err instanceof CreditError && err.code === "insufficient") {
        return Response.json({ error: "No briefings left." }, { status: 402 });
      }
      const message =
        err instanceof Error ? err.message : "Could not verify account.";
      return Response.json({ error: message }, { status: 500 });
    }
  } else if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_LOCAL_AUTH !== "1"
  ) {
    return Response.json(
      { error: "Sign-in is required. Supabase auth is not configured." },
      { status: 503 },
    );
  } else {
    const admitted = await admitRequest(ip);
    if (admitted === "misconfigured") {
      return Response.json(
        {
          error:
            "Production rate limits need Upstash Redis (UPSTASH_REDIS_REST_URL + TOKEN), or set ALLOW_INMEMORY_LIMITS=1.",
        },
        { status: 500 },
      );
    }
    if (admitted === "quota") {
      return Response.json(
        {
          error:
            "You've used both free briefings on this network today. Paid plans are coming.",
        },
        { status: 429 },
      );
    }
    ipCharged = true;
  }

  const refund = async (note?: string) => {
    if (creditCharged && creditUserId) {
      creditCharged = false;
      try {
        await refundCreditForUser(
          creditUserId,
          undefined,
          idempotencyKey,
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
      const researchResult = await runResearch(
        researchInput,
        () => {},
        req.signal,
        { skipCache },
      );
      const agentResults = await runAgents(
        `${ideaText}\n\n${buildAgentResearchContext(researchResult)}`,
        () => {},
      );
      const counts = sourceCounts(researchResult);
      const { synthesis, fallback } = await runSynthesis(
        agentResults,
        () => {},
        counts,
      );
      return Response.json({
        research: researchResult,
        agents: agentResults,
        synthesis,
        integrity: {
          type: "integrity",
          fallback,
          sources: counts.cited,
          fetched: counts.fetched,
          discarded: counts.discarded,
          agentFailures: agentResults.filter((r) => r.error).length,
        },
      });
    } catch (err: any) {
      await refund("json_briefing_error");
      return Response.json(
        { error: err.message || "Unknown error" },
        { status: 500 },
      );
    }
  }

  const encoder = new TextEncoder();
  const abortController = new AbortController();

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {}
      };

      const onClientAbort = () => abortController.abort();
      req.signal.addEventListener("abort", onClientAbort);
      if (req.signal.aborted) abortController.abort();

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
        const agentResults = await runAgents(
          `${ideaText}\n\n${buildAgentResearchContext(researchResult)}`,
          enqueue,
        );
        if (abortController.signal.aborted) throw new Error("Cancelled");

        await runSynthesis(agentResults, enqueue, sourceCounts(researchResult));

        enqueue(sseEvent("done", {}));
      } catch (err: any) {
        await refund("briefing_stream_error");
        enqueue(
          sseEvent("error", {
            message:
              err.message === "Cancelled"
                ? "Cancelled"
                : err.message || "Research failed",
          }),
        );
      } finally {
        req.signal.removeEventListener("abort", onClientAbort);
        try {
          controller.close();
        } catch {}
      }
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
