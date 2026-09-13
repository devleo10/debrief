import OpenAI from "openai";
import { runResearch } from "@/lib/research/orchestrator";
import { admitRequest, releaseRequest, startLimiter } from "@/lib/rateLimit";
import { liveSearchConfigured } from "@/lib/searchConfig";
import { buildDossierForAgents } from "@/lib/dossier";
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
const AGENT_TIMEOUT_MS = 60_000;
const MAX_FIELD_CHARS = 2_000;
const MAX_IDEA_CHARS = 10_000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: AGENT_TIMEOUT_MS,
  maxRetries: 2,
});

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
  const response = await openai.chat.completions.create({
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

async function runSynthesis(
  agentResults: AgentResult[],
  enqueue: (chunk: string) => void,
  sources = 0,
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

  output = maybeDowngradeShip(output, sources);
  const synthesis = { output, scores };
  enqueue(sseEvent("synthesis", synthesis));
  enqueue(
    sseEvent("integrity", {
      type: "integrity",
      fallback,
      sources,
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

  let charged = true;
  const refund = async () => {
    if (!charged) return;
    charged = false;
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
        `${ideaText}\n\n${buildDossierForAgents(researchResult)}`,
        () => {},
      );
      const { synthesis, fallback } = await runSynthesis(
        agentResults,
        () => {},
        researchResult.sources?.length || 0,
      );
      return Response.json({
        research: researchResult,
        agents: agentResults,
        synthesis,
        integrity: {
          type: "integrity",
          fallback,
          sources: researchResult.sources?.length || 0,
          agentFailures: agentResults.filter((r) => r.error).length,
        },
      });
    } catch (err: any) {
      await refund();
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
          `${ideaText}\n\n${buildDossierForAgents(researchResult)}`,
          enqueue,
        );
        if (abortController.signal.aborted) throw new Error("Cancelled");

        await runSynthesis(
          agentResults,
          enqueue,
          researchResult.sources?.length || 0,
        );

        enqueue(sseEvent("done", {}));
      } catch (err: any) {
        await refund();
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
