import OpenAI from "openai";
import { runResearch } from "@/lib/research/orchestrator";
import { createRateLimiter } from "@/lib/rateLimit";
import { buildDossierForAgents } from "@/lib/dossier";
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

// --- Rate limiting ---

const rateLimiter = createRateLimiter(60_000, 5);

// --- Validation agents ---

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
): Promise<ValidateResponse["synthesis"]> {
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
  }
  if (!/<verdict>/i.test(output)) {
    const verdict =
      extractVerdict(output, scores.overall) ||
      verdictFromScore(scores.overall);
    if (verdict) output = `<verdict>${verdict}</verdict>\n\n${output}`.trim();
  }
  if (!output) {
    output =
      "Synthesis failed for this run. Verdict and scores below are derived from the individual agent reports.";
    const verdict = verdictFromScore(scores.overall);
    if (verdict) output = `<verdict>${verdict}</verdict>\n\n${output}`;
  }

  const synthesis = { output, scores };
  enqueue(sseEvent("synthesis", synthesis));
  return synthesis;
}


// --- Main handler ---

export async function POST(req: Request) {
  const url = new URL(req.url);
  const format = url.searchParams.get("format");

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0] ||
    req.headers.get("x-real-ip") ||
    "unknown";

  if (!rateLimiter.check(ip)) {
    return Response.json(
      { error: "Rate limit exceeded. Try again in 1 minute." },
      { status: 429 },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "Server is missing OPENAI_API_KEY" },
      { status: 500 },
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
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

  const sanitize = (s: string) =>
    s
      .replace(/[^\w\s.,!?;:'"()-]/g, "")
      .trim()
      .slice(0, 2000);

  const researchInput: ResearchInput = {
    title: sanitize(title),
    description: sanitize(description),
    context: context ? sanitize(context) : undefined,
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

  // JSON fallback
  if (format === "json") {
    try {
      const researchEvents: string[] = [];
      const researchResult = await runResearch(
        researchInput,
        (e) => researchEvents.push(e),
        req.signal,
      );
      const agentResults = await runAgents(
        `${ideaText}\n\n${buildDossierForAgents(researchResult)}`,
        () => {},
      );
      const synthesis = await runSynthesis(agentResults, () => {});
      return Response.json({
        research: researchResult,
        agents: agentResults,
        synthesis,
      });
    } catch (err: any) {
      return Response.json(
        { error: err.message || "Unknown error" },
        { status: 500 },
      );
    }
  }

  // SSE streaming
  const encoder = new TextEncoder();
  const abortController = new AbortController();

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {}
      };

      try {
        // Abort when the client cancels OR disconnects — stops in-flight OpenAI calls.
        const clientAbort = new Promise<never>((_, reject) => {
          req.signal.addEventListener("abort", () =>
            reject(new Error("Cancelled")),
          );
        });
        abortController.signal.addEventListener("abort", () => {
          try {
            controller.enqueue(
              encoder.encode(sseEvent("error", { message: "Cancelled" })),
            );
          } catch {}
        });

        // Phase 1: Research
        const researchPromise = runResearch(
          researchInput,
          enqueue,
          abortController.signal,
        );
        const abortPromise = new Promise<never>((_, reject) => {
          abortController.signal.addEventListener("abort", () => {
            reject(new Error("Cancelled"));
          });
        });

        const researchResult = await Promise.race([
          researchPromise,
          abortPromise,
          clientAbort,
        ]);

        // Emit verifiable source links gathered during research.
        if (researchResult?.sources?.length) {
          enqueue(sseEvent("sources", { type: "sources", data: researchResult.sources }));
        }

        // Phase 2: Validation
        enqueue(sseEvent("status", { phase: "validate", status: "starting" }));
        const agentResults = await Promise.race([
          runAgents(
            `${ideaText}\n\n${buildDossierForAgents(researchResult)}`,
            enqueue,
          ),
          abortPromise,
          clientAbort,
        ]);
        await Promise.race([
          runSynthesis(agentResults, enqueue),
          abortPromise,
          clientAbort,
        ]);

        enqueue(sseEvent("done", {}));
      } catch (err: any) {
        if (err.message !== "Cancelled") {
          enqueue(
            sseEvent("error", { message: err.message || "Research failed" }),
          );
        }
      } finally {
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
