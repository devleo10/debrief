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

/**
 * Consumer brands that founders use as UI shorthand ("tinder but for X"). Searching
 * these verbatim returns the brand's own domain — dating, rides, rentals — instead of
 * the market the founder means.
 */
const METAPHOR_BRANDS =
  /\b(tinder|uber|airbnb|netflix|spotify|shazam|duolingo|instagram|tiktok|robinhood|doordash|substack|figma|notion|slack|github)\b/gi;

const METAPHOR_MECHANICS = /\b(swipe|swiping|right swipe|match|matching)\b/gi;

const QUERY_STOP_WORDS = new Set([
  "a", "an", "the", "for", "and", "or", "to", "with", "that", "this", "your",
  "from", "into", "using", "but", "like", "app", "tool", "platform", "saas",
  "startup", "idea", "ai", "powered", "simple", "new", "based",
]);

/**
 * Tokens in this input that are analogies rather than market entities. Prefers the
 * normalizer's judgment; falls back to the brand list so a failed LLM call still
 * keeps "tinder" out of the queries.
 */
export function metaphorTermsFor(input: ResearchInput): string[] {
  if (input.metaphor_terms?.length) {
    return [...new Set(input.metaphor_terms.map((t) => t.toLowerCase().trim()))].filter(
      Boolean,
    );
  }
  const blob = `${input.title} ${input.description}`;
  // Only treat a brand as a metaphor when the idea reads as "X for Y".
  if (!/\bfor\b/i.test(blob)) return [];
  const brands = blob.match(METAPHOR_BRANDS) || [];
  const mechanics = blob.match(METAPHOR_MECHANICS) || [];
  return [...new Set([...brands, ...mechanics].map((t) => t.toLowerCase()))];
}

/**
 * Canonical domain terms for query building. Uses the normalizer's `search_terms`
 * when present, otherwise derives them from the text with metaphors removed.
 */
export function searchTermsFor(input: ResearchInput): string[] {
  const metaphors = new Set(metaphorTermsFor(input));
  const fromNormalizer = (input.search_terms || [])
    .map((t) => t.toLowerCase().trim())
    .filter((t) => t && !metaphors.has(t));
  if (fromNormalizer.length) return [...new Set(fromNormalizer)].slice(0, 8);

  const words = `${input.title} ${input.description}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(
      (w) => w.length > 2 && !QUERY_STOP_WORDS.has(w) && !metaphors.has(w),
    );
  return [...new Set(words)].slice(0, 8);
}

/** Google-style negative terms so metaphor brands cannot dominate the results. */
export function metaphorExclusions(input: ResearchInput): string {
  return metaphorTermsFor(input)
    .map((t) => `-${t}`)
    .join(" ");
}

/** Builds a query from canonical terms plus intent, never from raw user phrasing. */
function plan(input: ResearchInput, intent: string): string {
  return [searchTermsFor(input).join(" "), intent, metaphorExclusions(input)]
    .filter(Boolean)
    .join(" ")
    .trim();
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
    plan(input, "competitors alternatives"),
    plan(input, "startup funding company"),
    plan(input, "vs comparison market leaders"),
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
    plan(input, "pain points complaints frustrations"),
    plan(input, "reddit user complaints"),
    plan(input, "missing features reviews g2"),
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
    plan(input, "community forum subreddit discord"),
    plan(input, "product hunt launch"),
    plan(input, "how competitors acquired first users"),
  ];
}

export function pricingQueries(input: ResearchInput, competitorNames: string): string[] {
  return [
    competitorNames
      ? `${competitorNames} pricing plans tiers`
      : plan(input, "pricing plans tiers"),
    plan(input, "pricing comparison cost"),
  ];
}

export function fundingQueries(
  input: ResearchInput,
  competitorNames: string,
): string[] {
  return [
    plan(input, "market size TAM industry report"),
    competitorNames
      ? `${competitorNames} funding round raised`
      : plan(input, "startup funding round raised"),
    plan(input, "market growth rate forecast"),
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
  for (const raw of [...fromModel, ...seeds, ...defaults]) {
    if (!raw?.name) continue;
    const c = isUsableSourceUrl(raw.url) ? raw : { ...raw, url: "" };
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

export function isUsableSourceUrl(url?: string | null): url is string {
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

/**
 * Market figures are the one place the model reliably guesses, and they sit in a
 * report that claims every number traces to a page. Anything without a source URL
 * that actually turned up in search is dropped.
 */
export function scrubMarketSize(marketSize: any, searchBlob = ""): any {
  if (!marketSize || typeof marketSize !== "object") return marketSize;

  const shared = (Array.isArray(marketSize.sources) ? marketSize.sources : [])
    .filter(isUsableSourceUrl)
    .filter((u: string) => !searchBlob || urlAppearsInSearch(u, searchBlob));

  const next: any = { ...marketSize, sources: shared };

  for (const key of ["tam", "sam", "som"] as const) {
    const sourceKey = `${key}_source` as const;
    const own = isUsableSourceUrl(marketSize[sourceKey])
      ? marketSize[sourceKey]
      : shared[0];
    if (!next[key] || !own) {
      next[key] = "";
      next[sourceKey] = "";
      continue;
    }
    next[key] = markStaleFigure(String(next[key]));
    next[sourceKey] = own;
  }

  return next;
}

/** Flags a figure whose only year is old enough to mislead. */
export function markStaleFigure(value: string, now = new Date()): string {
  const years = (value.match(/\b(19|20)\d{2}\b/g) || []).map(Number);
  if (!years.length) return value;
  const latest = Math.max(...years);
  if (latest >= now.getFullYear() - 2) return value;
  if (/as of \d{4}/i.test(value)) return value;
  return `${value.replace(/\s*$/, "")} (as of ${latest})`;
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
