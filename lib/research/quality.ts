import type { Competitor, ResearchInput } from "./types";

export type IdeaFamily = "idea_validation" | "project_management" | "other";

const PM_SUITE =
  /\b(asana|trello|jira|monday\.com|\bmonday\b|clickup|basecamp|smartsheet|wrike|ms project|microsoft project)\b/i;

const IDEA_VALIDATION_KEEP =
  /validat|chatgpt|claude|gemini|gpt\b|perplexity|brief|critique|advisor|mentor|consult|research (report|engine)|founder|startup idea|kill it|ship it|devil'?s advocate|idea proof|validatorai|\bopenai\b|\banthropic\b|crewai|autogen|langgraph/i;

const IDEA_VALIDATION_HINT =
  /ship it|kill it|pivot|should i ship|\bvc\b|venture capital|seven agents|7 agents|idea validat|briefing room|devil'?s advocate|synthesizer/i;

const INVENTED_FREQUENCY =
  /\d+(?:\.\d+)?%\s+of\s+(?:g2|capterra|reddit|twitter|x(?:\.com)?|reviews?)\b/i;

const PLACEHOLDER_URL =
  /xyz\d+|example\.com|placeholder|localhost|reddit\.com\/r\/[^/]+\/comments\/xyz/i;

export function inferFamily(input: ResearchInput): IdeaFamily {
  if (input.family === "idea_validation" || input.family === "project_management") {
    return input.family;
  }
  const blob = `${input.title}\n${input.description}\n${input.context || ""}`;
  if (IDEA_VALIDATION_HINT.test(blob)) return "idea_validation";
  if (
    /\b(jira|asana|kanban|sprint board|issue track)/i.test(blob) &&
    !IDEA_VALIDATION_HINT.test(blob)
  ) {
    return "project_management";
  }
  return input.family || "other";
}

export function competitorQueries(input: ResearchInput): string[] {
  const family = inferFamily(input);
  const job = input.job || input.title;
  if (family === "idea_validation") {
    return [
      "AI startup idea validator competitors alternatives ChatGPT Claude",
      "ValidatorAI founder idea critique GPT wrapper Product Hunt",
      `${job} competitors alternatives ship or kill`,
    ];
  }
  return [
    `${input.description} competitors alternatives`,
    `${input.title} startup funding`,
    `${input.title} vs competitors comparison`,
  ];
}

export function gapsQueries(input: ResearchInput): string[] {
  const family = inferFamily(input);
  if (family === "idea_validation") {
    return [
      "ChatGPT idea validation too nice founders reddit",
      "startup idea validator complaints G2",
      "AI wrapper startup critique product hunt reviews",
    ];
  }
  return [
    `${input.description} pain points complaints frustrations`,
    `${input.description} reddit complaints users`,
    `${input.title} missing features reviews g2`,
  ];
}

export function distributionQueries(input: ResearchInput): string[] {
  const family = inferFamily(input);
  if (family === "idea_validation") {
    return [
      "r/startups r/SaaS indie hackers community idea validation",
      "Product Hunt AI idea validator launch",
      "how ValidatorAI Product Hunt launch acquired users",
    ];
  }
  return [
    `${input.description} community forum subreddit discord`,
    `${input.title} product hunt launch`,
    `${input.description} how competitors acquired users`,
  ];
}

export function isPmSuiteCompetitor(c: {
  name?: string;
  url?: string;
  description?: string;
}): boolean {
  return PM_SUITE.test(`${c.name || ""} ${c.url || ""} ${c.description || ""}`);
}

export function competitorFitsFrame(
  c: Pick<Competitor, "name" | "url" | "description">,
  family: IdeaFamily,
): boolean {
  if (family !== "idea_validation") return true;
  const blob = `${c.name} ${c.url} ${c.description}`;
  if (PM_SUITE.test(blob)) return false;
  return IDEA_VALIDATION_KEEP.test(blob);
}

export function filterCompetitors(
  competitors: Competitor[],
  family: IdeaFamily,
  seeds: Competitor[] = [],
): Competitor[] {
  if (!Array.isArray(competitors)) competitors = [];
  const fromModel =
    family !== "idea_validation"
      ? competitors.filter((c) => c && c.name)
      : competitors.filter((c) => c && competitorFitsFrame(c, family));
  const defaults =
    family === "idea_validation"
      ? seedCompetitorsFromSearch([
          { title: "ChatGPT", url: "https://chatgpt.com", snippet: "openai" },
          { title: "Claude", url: "https://claude.ai", snippet: "anthropic" },
        ])
      : [];
  const merged = new Map<string, Competitor>();
  for (const c of [...fromModel, ...seeds, ...defaults]) {
    if (!c?.name) continue;
    const key = c.name.toLowerCase();
    if (!merged.has(key)) merged.set(key, c);
  }
  return [...merged.values()];
}

const SEARCH_SEED: {
  re: RegExp;
  name: string;
  url: string;
  description: string;
}[] = [
  {
    re: /chatgpt|openai\.com/i,
    name: "ChatGPT",
    url: "https://chatgpt.com",
    description:
      "General-purpose LLM; the default substitute founders use to critique ideas.",
  },
  {
    re: /claude\.ai|anthropic/i,
    name: "Claude",
    url: "https://claude.ai",
    description:
      "General-purpose LLM used as a thorough idea and writing critique.",
  },
  {
    re: /validatorai|validator\.ai/i,
    name: "ValidatorAI",
    url: "https://validatorai.com",
    description: "Startup idea validator that generates feedback from a prompt.",
  },
  {
    re: /perplexity/i,
    name: "Perplexity",
    url: "https://www.perplexity.ai",
    description:
      "Live-web research assistant founders use instead of a briefing product.",
  },
  {
    re: /gemini\.google|google gemini/i,
    name: "Gemini",
    url: "https://gemini.google.com",
    description: "General-purpose LLM used for idea brainstorming and critique.",
  },
];

export function seedCompetitorsFromSearch(
  results: { title?: string; url?: string; snippet?: string }[],
): Competitor[] {
  const blob = results
    .map((r) => `${r.title || ""} ${r.url || ""} ${r.snippet || ""}`)
    .join("\n");
  const out: Competitor[] = [];
  for (const row of SEARCH_SEED) {
    if (!row.re.test(blob)) continue;
    out.push({
      name: row.name,
      url: row.url,
      description: row.description,
      strengths: [],
      weaknesses: [],
      source_urls: results
        .filter((r) => row.re.test(`${r.title} ${r.url} ${r.snippet}`))
        .map((r) => r.url)
        .filter((u): u is string => Boolean(u))
        .slice(0, 2),
    });
  }
  return out;
}

export function scrubPositioning(
  positioning: any,
  family: IdeaFamily,
): any {
  if (!positioning || typeof positioning !== "object") return positioning;
  if (family !== "idea_validation") return positioning;
  const next = { ...positioning };
  if (/project/i.test(String(next.category || ""))) {
    next.category = "Founder idea-validation briefing (ship / pivot / kill)";
  }
  if (/project/i.test(String(next.one_liner || ""))) {
    next.one_liner =
      "A researched founder briefing: live market evidence, then a ship / pivot / kill verdict.";
  }
  const moat = String(next.competitive_advantage || "");
  if (/unique|difficult to replicate|no current competitor/i.test(moat)) {
    next.competitive_advantage =
      "No durable moat beyond prompts and UI. ChatGPT and Claude already do this job. The only plausible wedge is live-web evidence plus a harshly calibrated verdict, not 'seven agents.'";
  }
  return next;
}

export function urlAppearsInSearch(url: string, searchBlob: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.length < 5) return false;
    return searchBlob.toLowerCase().includes(host.toLowerCase());
  } catch {
    return false;
  }
}

export function scrubPainFrequency(frequency?: string | null): string {
  const raw = (frequency || "").trim();
  if (!raw || INVENTED_FREQUENCY.test(raw)) return "unquantified in sources";
  return raw;
}

export function isUsableSourceUrl(url?: string | null): boolean {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  return !PLACEHOLDER_URL.test(url);
}

export function scrubGaps(gaps: any): any {
  if (!gaps || typeof gaps !== "object") return gaps;
  const pain = Array.isArray(gaps.pain_points) ? gaps.pain_points : [];
  return {
    ...gaps,
    pain_points: pain
      .filter((p: any) => p && p.point)
      .map((p: any) => ({
        ...p,
        frequency: scrubPainFrequency(p.frequency),
        source: isUsableSourceUrl(p.source) ? p.source : "",
      }))
      .filter((p: any) => isUsableSourceUrl(p.source)),
  };
}

export function dropUnsourcedRounds(
  rounds: any[] | undefined,
  searchBlob: string,
): any[] {
  if (!Array.isArray(rounds)) return [];
  const blob = searchBlob.toLowerCase();
  return rounds.filter((r) => {
    const name = String(r?.company || "").trim();
    if (name.length < 2) return false;
    return blob.includes(name.toLowerCase());
  });
}

const TRUSTED_COMMUNITY =
  /reddit\.com|indiehackers\.com|producthunt\.com|news\.ycombinator\.com|ycombinator\.com/i;

export function scrubCommunities(
  communities: any[] | undefined,
  searchBlob = "",
): any[] {
  if (!Array.isArray(communities)) return [];
  return communities.filter((c) => {
    if (!isUsableSourceUrl(c?.url)) return false;
    if (TRUSTED_COMMUNITY.test(c.url)) return true;
    return Boolean(searchBlob) && urlAppearsInSearch(c.url, searchBlob);
  });
}
