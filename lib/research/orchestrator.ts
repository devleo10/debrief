import OpenAI from "openai";
import { search } from "./search";
import {
  competitorAgentPrompt,
  pricingAgentPrompt,
  fundingAgentPrompt,
  gapsAgentPrompt,
  distributionAgentPrompt,
  positioningAgentPrompt,
  launchAgentPrompt,
} from "./agents";
import { parseJson } from "./json";
import type {
  ResearchInput,
  ResearchResult,
  ResearchEvent,
  SourceLink,
} from "./types";
import {
  competitorQueries,
  distributionQueries,
  dropUnsourcedRounds,
  filterCompetitors,
  gapsQueries,
  inferFamily,
  scrubCommunities,
  scrubGaps,
  scrubPositioning,
  seedCompetitorsFromSearch,
} from "./quality";
import { redisConfigured, redisGet, redisSet } from "../upstash";
import { pricingPageUrls, scrapePricingPages } from "./firecrawl";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o";
const RESEARCH_MODEL = process.env.OPENAI_RESEARCH_MODEL || "gpt-4o-mini";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60_000,
  maxRetries: 2,
});

// --- Report cache (in-memory, keyed by normalized input hash) ---

const reportCache = new Map<
  string,
  { result: ResearchResult; reportId: string; timestamp: number }
>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function cacheKey(input: ResearchInput): string {
  const normalized = `${input.title.toLowerCase().trim()}|${input.description.toLowerCase().trim()}`;
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 31 + normalized.charCodeAt(i)) | 0;
  }
  return `report_${hash}`;
}

async function getCachedReport(
  input: ResearchInput,
): Promise<{ result: ResearchResult; reportId: string } | null> {
  const key = cacheKey(input);
  const entry = reportCache.get(key);
  if (entry) {
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      reportCache.delete(key);
    } else {
      return { result: entry.result, reportId: entry.reportId };
    }
  }
  if (!redisConfigured()) return null;
  const raw = await redisGet(`research:${key}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      result: ResearchResult;
      reportId: string;
    };
    if (!parsed?.result || !parsed.reportId) return null;
    reportCache.set(key, {
      result: parsed.result,
      reportId: parsed.reportId,
      timestamp: Date.now(),
    });
    return parsed;
  } catch {
    return null;
  }
}

async function setCachedReport(
  input: ResearchInput,
  result: ResearchResult,
  reportId: string,
) {
  const key = cacheKey(input);
  reportCache.set(key, { result, reportId, timestamp: Date.now() });
  if (reportCache.size > 100) {
    const oldest = reportCache.keys().next().value;
    if (oldest) reportCache.delete(oldest);
  }
  if (redisConfigured()) {
    await redisSet(
      `research:${key}`,
      JSON.stringify({ result, reportId }),
      60 * 60,
    );
  }
}

function sseEvent(event: ResearchEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

function isAbort(err: any): boolean {
  return err?.name === "AbortError" || /abort/i.test(err?.message || "");
}

async function normalizeResearchInput(
  input: ResearchInput,
  signal?: AbortSignal,
): Promise<ResearchInput> {
  const originalFamily = inferFamily(input);
  const raw =
    `${input.title}\n${input.description}\n${input.context || ""}`.trim();

  const applyGuardrails = (next: ResearchInput): ResearchInput => {
  const family =
      originalFamily === "idea_validation"
        ? "idea_validation"
        : inferFamily({
            ...next,
            family:
              originalFamily === "project_management"
                ? "project_management"
                : undefined,
          });
    let title = next.title;
    if (
      family === "idea_validation" &&
      /project (evaluation|management)/i.test(title)
    ) {
      title = input.title;
    }
    let job = next.job;
    if (
      family === "idea_validation" &&
      (!job ||
        (/project ideas?/i.test(job) && !/ship|kill|validat|brief/i.test(job)))
    ) {
      job = "founder idea validation with a ship/pivot/kill verdict";
    }
    return {
      ...next,
      title,
      family,
      job,
      buyer:
        next.buyer ||
        (family === "idea_validation" ? "early-stage founders" : undefined),
    };
  };

  if (raw.length < 240) return applyGuardrails(input);

  try {
    const res = await openai.chat.completions.create(
      {
        model: RESEARCH_MODEL,
        messages: [
          {
            role: "system",
            content:
              'Rewrite noisy founder dictation into a concise startup research brief. Preserve the actual product (including multi-agent critique, VC vs engineer, ship/pivot/kill). Do not reframe as project management or "project evaluation software". Correct speech-to-text. Output only raw JSON: title, description, context, job, buyer, family (idea_validation | project_management | other).',
          },
          { role: "user", content: raw.slice(0, 5000) },
        ],
        temperature: 0,
        max_tokens: 400,
      },
      { signal },
    );
    const parsed = parseJson(res.choices[0]?.message?.content || "").data;
    if (!parsed?.title || !parsed?.description) return applyGuardrails(input);
    const familyRaw = String(parsed.family || "");
    const family =
      familyRaw === "idea_validation" || familyRaw === "project_management"
        ? familyRaw
        : undefined;
    return applyGuardrails({
      title: String(parsed.title).trim().slice(0, 180),
      description: String(parsed.description).trim().slice(0, 800),
      context:
        [input.context, parsed.context]
          .filter(Boolean)
          .join("\n")
          .slice(0, 1200) || undefined,
      job: parsed.job ? String(parsed.job).trim().slice(0, 200) : input.job,
      buyer: parsed.buyer
        ? String(parsed.buyer).trim().slice(0, 200)
        : input.buyer,
      family,
    });
  } catch {
    return applyGuardrails(input);
  }
}

async function llmExtract(
  systemPrompt: string,
  context: string,
  agentName: string,
  enqueue: (e: string) => void,
  signal?: AbortSignal,
): Promise<any> {
  let lastErr: any;

  // One retry for transient failures (network errors, malformed JSON output)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await openai.chat.completions.create(
        {
          model: RESEARCH_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: context },
          ],
          temperature: 0.1,
          max_tokens: 4000,
        },
        { signal },
      );

      const text = res.choices[0]?.message?.content || "";
      const { data, error } = parseJson(text);
      if (!error) return data;
      lastErr = new Error(error);
    } catch (err: any) {
      if (isAbort(err)) throw err;
      lastErr = err;
    }
  }

  enqueue(
    sseEvent({
      type: "error",
      message: `${agentName} agent failed: ${lastErr?.message || "unknown"}`,
    }),
  );
  return null;
}

// --- Source collection ---

/** Dedupes raw search results into source links attributed to one dossier section. */
function toSourceLinks(
  section: string,
  results: { title?: string; url?: string }[],
): SourceLink[] {
  const seen = new Set<string>();
  const links: SourceLink[] = [];
  for (const r of results) {
    if (!r.url || seen.has(r.url)) continue;
    seen.add(r.url);
    links.push({ section, title: r.title || r.url, url: r.url });
  }
  return links;
}

// --- Agent: Competitor Discovery ---

async function runCompetitorAgent(
  idea: ResearchInput,
  enqueue: (e: string) => void,
  signal?: AbortSignal,
  sources?: SourceLink[],
) {
  enqueue(
    sseEvent({ type: "status", agent: "competitors", status: "searching" }),
  );

  const queries = competitorQueries(idea);

  const searchResults = await Promise.all(
    queries.map((q) => search({ query: q, numResults: 5 })),
  );
  const allResults = searchResults.flat();
  if (sources) sources.push(...toSourceLinks("competitors", allResults));

  const context = `IDEA: ${idea.title}\n${idea.description}\n${
    idea.context ? `\nCONTEXT: ${idea.context}` : ""
  }\nJOB: ${idea.job || ""}\nBUYER: ${idea.buyer || ""}\nFAMILY: ${inferFamily(idea)}\n\nSEARCH RESULTS:\n${allResults
    .map((r) => `[${r.title}](${r.url}) — ${r.snippet}`)
    .join("\n")}`;

  const data = await llmExtract(
    competitorAgentPrompt,
    context,
    "competitors",
    enqueue,
    signal,
  );
  const competitors = filterCompetitors(
    data?.competitors || data || [],
    inferFamily(idea),
    seedCompetitorsFromSearch(allResults),
  );

  for (const c of competitors) {
    enqueue(sseEvent({ type: "competitor", data: c }));
  }

  enqueue(sseEvent({ type: "status", agent: "competitors", status: "done" }));
  return Array.isArray(competitors) ? competitors : [];
}

// --- Agent: Pricing Intelligence ---

async function runPricingAgent(
  idea: ResearchInput,
  competitors: any[],
  enqueue: (e: string) => void,
  signal?: AbortSignal,
  sources?: SourceLink[],
) {
  enqueue(sseEvent({ type: "status", agent: "pricing", status: "searching" }));

  const competitorNames = competitors.map((c) => c.name).join(", ");
  const queries = [
    `${competitorNames || idea.title} pricing plans tiers`,
    `${idea.title} pricing comparison software`,
  ];

  const searchResults = await Promise.all(
    queries.map((q) => search({ query: q, numResults: 5 })),
  );
  const allResults = searchResults.flat();
  if (sources) sources.push(...toSourceLinks("pricing", allResults));

  enqueue(sseEvent({ type: "status", agent: "pricing", status: "scraping" }));
  const pageUrls = pricingPageUrls(competitors, allResults);
  const scraped = await scrapePricingPages(pageUrls, signal);
  if (sources) {
    sources.push(
      ...toSourceLinks(
        "pricing",
        scraped.map((p) => ({ title: p.url, url: p.url })),
      ),
    );
  }

  const pageBlock =
    scraped.length > 0
      ? `\n\nPAGE CONTENT (scraped pricing pages — prefer this over snippets):\n${scraped
          .map((p) => `--- ${p.url} ---\n${p.markdown}`)
          .join("\n\n")}`
      : "";

  const context = `IDEA: ${idea.title}\n${idea.description}\n\nCOMPETITORS: ${competitorNames}\n\nSEARCH RESULTS:\n${allResults
    .map((r) => `[${r.title}](${r.url}) — ${r.snippet}`)
    .join("\n")}${pageBlock}`;

  const data = await llmExtract(
    pricingAgentPrompt,
    context,
    "pricing",
    enqueue,
    signal,
  );

  enqueue(sseEvent({ type: "pricing", data }));
  enqueue(sseEvent({ type: "status", agent: "pricing", status: "done" }));
  return data;
}

// --- Agent: Funding & Market Data ---

async function runFundingAgent(
  idea: ResearchInput,
  competitors: any[],
  enqueue: (e: string) => void,
  signal?: AbortSignal,
  sources?: SourceLink[],
) {
  enqueue(sseEvent({ type: "status", agent: "funding", status: "searching" }));

  const competitorNames = competitors.map((c) => c.name).join(", ");
  const family = inferFamily(idea);
  const queries =
    family === "idea_validation"
      ? [
          "generative AI ChatGPT Claude market size TAM",
          `${competitorNames || "OpenAI Anthropic"} funding rounds raised`,
          "AI copilot SaaS startup funding 2024 2025",
        ]
      : [
          `${idea.description} market size TAM 2024 2025`,
          `${competitorNames} funding rounds raised`,
          `${idea.title} market growth rate`,
        ];

  const searchResults = await Promise.all(
    queries.map((q) => search({ query: q, numResults: 5 })),
  );
  const allResults = searchResults.flat();
  if (sources) sources.push(...toSourceLinks("market", allResults));

  const context = `IDEA: ${idea.title}\n${idea.description}\n\nSEARCH RESULTS:\n${allResults
    .map((r) => `[${r.title}](${r.url}) — ${r.snippet}`)
    .join("\n")}`;

  const searchBlob = allResults
    .map((r) => `${r.title} ${r.url} ${r.snippet}`)
    .join("\n");

  const data = await llmExtract(
    fundingAgentPrompt,
    context,
    "funding",
    enqueue,
    signal,
  );
  if (data?.funding_landscape?.notable_rounds) {
    let rounds = dropUnsourcedRounds(
      data.funding_landscape.notable_rounds,
      searchBlob,
    );
    if (family === "idea_validation") {
      const allow = new Set(
        competitors.map((c) => String(c.name || "").toLowerCase()),
      );
      rounds = rounds.filter((r) => {
        const name = String(r?.company || "").toLowerCase();
        if (allow.has(name)) return true;
        return /openai|anthropic|validatorai|perplexity/.test(name);
      });
    }
    data.funding_landscape.notable_rounds = rounds;
  }

  enqueue(sseEvent({ type: "funding", data }));
  enqueue(sseEvent({ type: "status", agent: "funding", status: "done" }));
  return data;
}

// --- Agent: Market Gaps ---

async function runGapsAgent(
  idea: ResearchInput,
  enqueue: (e: string) => void,
  signal?: AbortSignal,
  sources?: SourceLink[],
) {
  enqueue(sseEvent({ type: "status", agent: "gaps", status: "searching" }));

  const queries = gapsQueries(idea);

  const searchResults = await Promise.all(
    queries.map((q) => search({ query: q, numResults: 5 })),
  );
  const allResults = searchResults.flat();
  if (sources) sources.push(...toSourceLinks("gaps", allResults));

  const context = `IDEA: ${idea.title}\n${idea.description}\n\nSEARCH RESULTS:\n${allResults
    .map((r) => `[${r.title}](${r.url}) — ${r.snippet}`)
    .join("\n")}`;

  const data = await llmExtract(
    gapsAgentPrompt,
    context,
    "gaps",
    enqueue,
    signal,
  );
  const scrubbed = scrubGaps(data);

  enqueue(sseEvent({ type: "gaps", data: scrubbed }));
  enqueue(sseEvent({ type: "status", agent: "gaps", status: "done" }));
  return scrubbed;
}

// --- Agent: Distribution ---

async function runDistributionAgent(
  idea: ResearchInput,
  enqueue: (e: string) => void,
  signal?: AbortSignal,
  sources?: SourceLink[],
) {
  enqueue(
    sseEvent({ type: "status", agent: "distribution", status: "searching" }),
  );

  const queries = distributionQueries(idea);

  const searchResults = await Promise.all(
    queries.map((q) => search({ query: q, numResults: 5 })),
  );
  const allResults = searchResults.flat();
  if (sources) sources.push(...toSourceLinks("distribution", allResults));

  const context = `IDEA: ${idea.title}\n${idea.description}\n\nSEARCH RESULTS:\n${allResults
    .map((r) => `[${r.title}](${r.url}) — ${r.snippet}`)
    .join("\n")}`;

  const data = await llmExtract(
    distributionAgentPrompt,
    context,
    "distribution",
    enqueue,
    signal,
  );
  if (data?.communities) {
    data.communities = scrubCommunities(
      data.communities,
      allResults.map((r) => `${r.title} ${r.url} ${r.snippet}`).join("\n"),
    );
  }

  enqueue(sseEvent({ type: "distribution", data }));
  enqueue(sseEvent({ type: "status", agent: "distribution", status: "done" }));
  return data;
}

// --- Agent: Positioning (synthesis) ---

async function runPositioningAgent(
  idea: ResearchInput,
  researchData: any,
  enqueue: (e: string) => void,
  signal?: AbortSignal,
) {
  enqueue(
    sseEvent({ type: "status", agent: "positioning", status: "analyzing" }),
  );

  const context = `IDEA: ${idea.title}\n${idea.description}\nFAMILY: ${inferFamily(idea)}\nJOB: ${idea.job || ""}\n\nCOMPETITORS:\n${JSON.stringify(
    researchData.competitors,
    null,
    2,
  )}\n\nPRICING:\n${JSON.stringify(
    researchData.pricing,
    null,
    2,
  )}\n\nMARKET GAPS:\n${JSON.stringify(
    researchData.gaps,
    null,
    2,
  )}\n\nDISTRIBUTION:\n${JSON.stringify(researchData.distribution, null, 2)}`;

  const data = scrubPositioning(
    await llmExtract(
      positioningAgentPrompt,
      context,
      "positioning",
      enqueue,
      signal,
    ),
    inferFamily(idea),
  );

  enqueue(sseEvent({ type: "positioning", data }));
  enqueue(sseEvent({ type: "status", agent: "positioning", status: "done" }));
  return data;
}

// --- Agent: Launch Strategy ---

async function runLaunchAgent(
  idea: ResearchInput,
  researchData: any,
  positioning: any,
  enqueue: (e: string) => void,
  signal?: AbortSignal,
) {
  enqueue(sseEvent({ type: "status", agent: "launch", status: "planning" }));

  const context = `IDEA: ${idea.title}\n${idea.description}\n\nPOSITIONING:\n${JSON.stringify(
    positioning,
    null,
    2,
  )}\n\nCOMPETITORS:\n${JSON.stringify(
    researchData.competitors,
    null,
    2,
  )}\n\nPRICING:\n${JSON.stringify(
    researchData.pricing,
    null,
    2,
  )}\n\nDISTRIBUTION:\n${JSON.stringify(
    researchData.distribution,
    null,
    2,
  )}\n\nMARKET GAPS:\n${JSON.stringify(researchData.gaps, null, 2)}`;

  const data = await llmExtract(
    launchAgentPrompt,
    context,
    "launch",
    enqueue,
    signal,
  );

  enqueue(sseEvent({ type: "launch", data }));
  enqueue(sseEvent({ type: "status", agent: "launch", status: "done" }));
  return data;
}

// --- Main orchestrator ---

export async function runResearch(
  input: ResearchInput,
  enqueue: (e: string) => void,
  signal?: AbortSignal,
  opts?: { skipCache?: boolean },
): Promise<ResearchResult> {
  const researchInput = await normalizeResearchInput(input, signal);
  enqueue(
    sseEvent({
      type: "brief",
      data: {
        title: researchInput.title,
        description: researchInput.description,
        job: researchInput.job,
        buyer: researchInput.buyer,
        family: researchInput.family,
      },
    }),
  );
  const cached = opts?.skipCache ? null : await getCachedReport(researchInput);
  if (cached) {
    enqueue(
      sseEvent({ type: "status", agent: "research", status: "starting" }),
    );
    enqueue(sseEvent({ type: "status", agent: "research", status: "cached" }));

    if (cached.result.brief) {
      enqueue(sseEvent({ type: "brief", data: cached.result.brief }));
    }
    for (const c of cached.result.competitors) {
      enqueue(sseEvent({ type: "competitor", data: c }));
    }
    enqueue(sseEvent({ type: "pricing", data: cached.result.pricing }));
    enqueue(sseEvent({ type: "funding", data: cached.result.funding }));
    enqueue(sseEvent({ type: "gaps", data: cached.result.gaps }));
    enqueue(
      sseEvent({ type: "distribution", data: cached.result.distribution }),
    );
    enqueue(sseEvent({ type: "positioning", data: cached.result.positioning }));
    enqueue(sseEvent({ type: "launch", data: cached.result.launch }));

    enqueue(
      sseEvent({
        type: "done",
        report_id: cached.reportId,
        processing_time: "0s",
        cached: true,
      }),
    );

    return cached.result;
  }

  const startTime = Date.now();
  const sources: SourceLink[] = [];

  enqueue(sseEvent({ type: "status", agent: "research", status: "starting" }));

  // Phase 1: Run competitors, gaps, distribution in parallel
  // Pricing and funding run AFTER competitors complete (no double execution)
  const [competitors, gaps, distribution] = await Promise.all([
    runCompetitorAgent(researchInput, enqueue, signal, sources).catch((e) => {
      if (isAbort(e)) throw e;
      return null;
    }),
    runGapsAgent(researchInput, enqueue, signal, sources).catch((e) => {
      if (isAbort(e)) throw e;
      return null;
    }),
    runDistributionAgent(researchInput, enqueue, signal, sources).catch((e) => {
      if (isAbort(e)) throw e;
      return null;
    }),
  ]);

  // Phase 2: Run pricing and funding with competitor data
  const [pricing, funding] = await Promise.all([
    runPricingAgent(
      researchInput,
      competitors || [],
      enqueue,
      signal,
      sources,
    ).catch((e) => {
      if (isAbort(e)) throw e;
      return null;
    }),
    runFundingAgent(
      researchInput,
      competitors || [],
      enqueue,
      signal,
      sources,
    ).catch((e) => {
      if (isAbort(e)) throw e;
      return null;
    }),
  ]);

  // Phase 3: Synthesis
  const researchData = {
    competitors: competitors || [],
    pricing: pricing || {
      range: { low: 0, high: 50, currency: "USD", period: "month" },
      common_models: [],
      free_tier: false,
      competitors: [],
      recommended_positioning: "",
    },
    funding: funding || {
      market_size: { tam: "", sam: "", som: "", sources: [] },
      funding_landscape: {
        total_raised: "",
        average_round: "",
        hot_areas: [],
        notable_rounds: [],
      },
    },
    gaps: gaps || {
      pain_points: [],
      gaps: [],
      unserved_segments: [],
    },
    distribution: distribution || {
      communities: [],
      distribution_channels: [],
      content_opportunities: [],
    },
  };

  // Phase 3: Synthesis — positioning and launch run in parallel.
  // Launch's context already includes all research data; positioning is only
  // a nice-to-have input, so we don't serialize on it.
  const [positioning, launch] = await Promise.all([
    runPositioningAgent(researchInput, researchData, enqueue, signal).catch(
      (e) => {
        if (isAbort(e)) throw e;
        return null;
      },
    ),
    runLaunchAgent(researchInput, researchData, null, enqueue, signal).catch(
      (e) => {
        if (isAbort(e)) throw e;
        return null;
      },
    ),
  ]);

  const result: ResearchResult = {
    brief: {
      title: researchInput.title,
      description: researchInput.description,
      job: researchInput.job,
      buyer: researchInput.buyer,
      family: researchInput.family,
    },
    sources,
    competitors: researchData.competitors,
    pricing: researchData.pricing,
    funding: researchData.funding,
    gaps: researchData.gaps,
    distribution: researchData.distribution,
    positioning: positioning || {
      one_liner: "",
      category: "",
      differentiation: "",
      target_user: "",
      why_now: "",
      competitive_advantage: "",
    },
    launch: launch || {
      phase_1_pre_launch: { timeline: "", actions: [] },
      phase_2_launch: { timeline: "", actions: [] },
      phase_3_post_launch: { timeline: "", actions: [] },
      kpis: [],
    },
  };

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  const reportId = `report_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Cache the result
  await setCachedReport(researchInput, result, reportId);

  enqueue(
    sseEvent({
      type: "done",
      report_id: reportId,
      processing_time: `${elapsed}s`,
    }),
  );

  return result;
}
