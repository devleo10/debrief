import type { ResearchResult } from "./research/types";

const MAX_DOSSIER_CHARS = 7_000;

const sampleGithubRepo = (research: ResearchResult) =>
  research.github?.repos?.slice(0, 5).map(
    (r) =>
      `- ${r.full_name} (${r.stars}★, ${r.forks} forks, ${r.relevance} overlap): ${r.overlap}`,
  ).join("\n");

/**
 * Short, high-salience GitHub block appended last so agents address OSS overlap.
 */
export function buildGithubMandateForAgents(
  research: ResearchResult,
): string | null {
  const github = research.github;
  if (!github?.repos?.length) return null;

  const repos = sampleGithubRepo(research);
  return [
    "MANDATORY GITHUB CHECK (address this explicitly in your critique):",
    `Signal: ${github.signal || "unknown"} — ${github.total_matches ?? "?"} repos match this idea space.`,
    github.summary?.trim() || "Open-source overlap exists in this category.",
    repos,
    "You must name at least one repo above (owner/repo) and state what it means for moat, clone risk, or differentiation.",
  ]
    .filter(Boolean)
    .join("\n");
}

type SectionKey =
  | "competitors"
  | "github"
  | "pricing"
  | "funding"
  | "gaps"
  | "distribution"
  | "positioning"
  | "launch"
  | "sources";

function sectionCompetitors(research: ResearchResult): string | null {
  const lines = research.competitors
    .slice(0, 6)
    .map(
      (c) =>
        `- ${c.name}: ${c.description}${c.pricing ? `. Pricing: ${c.pricing}.` : "."}`
    )
    .join("\n");
  return lines ? `Competitors:\n${lines}` : null;
}

function sectionGithub(research: ResearchResult): string | null {
  const github = sampleGithubRepo(research);
  if (!github) return null;
  return `GitHub landscape (${research.github?.signal || "unknown"}): ${research.github?.summary || ""}\n${github}`;
}

function sectionPricing(research: ResearchResult): string | null {
  const lines = research.pricing?.competitors
    ?.slice(0, 5)
    .map(
      (c) =>
        `- ${c.name}: ${(c.tiers || [])
          .map((t) => `${t.name} ${t.price}`)
          .join(", ")}`
    )
    .join("\n");
  return lines ? `Pricing:\n${lines}` : null;
}

function sectionFunding(research: ResearchResult): string | null {
  const ms = research.funding?.market_size;
  const rounds = research.funding?.funding_landscape?.notable_rounds
    ?.slice(0, 4)
    .map((r) => `- ${r.company}: ${r.round} ${r.amount}${r.date ? ` (${r.date})` : ""}`)
    .join("\n");
  const sizeBits = [
    ms?.tam ? `TAM ${ms.tam}` : null,
    ms?.sam ? `SAM ${ms.sam}` : null,
    ms?.som ? `SOM ${ms.som}` : null,
  ].filter(Boolean);
  const lines = [
    sizeBits.length ? `- Market size: ${sizeBits.join("; ")}` : null,
    rounds ? `Notable rounds:\n${rounds}` : null,
  ].filter(Boolean).join("\n");
  return lines ? `Funding:\n${lines}` : null;
}

function sectionGaps(research: ResearchResult): string | null {
  const lines = research.gaps?.pain_points
    ?.slice(0, 4)
    .map((p) => `- ${p.point} (${p.frequency || "frequency unknown"})`)
    .join("\n");
  return lines ? `Pain points / gaps:\n${lines}` : null;
}

function sectionDistribution(research: ResearchResult): string | null {
  const lines = research.distribution?.distribution_channels
    ?.slice(0, 4)
    .map((d) => `- ${d.channel}: ${d.effectiveness}`)
    .join("\n");
  return lines ? `Distribution:\n${lines}` : null;
}

function sectionPositioning(research: ResearchResult): string | null {
  return research.positioning?.one_liner
    ? `Positioning draft: ${research.positioning.one_liner}`
    : null;
}

function sectionLaunch(research: ResearchResult): string | null {
  const launch = research.launch;
  if (!launch) return null;
  const phases = [
    launch.phase_1_pre_launch,
    launch.phase_2_launch,
    launch.phase_3_post_launch,
  ]
    .filter(Boolean)
    .map((p) => `- ${p.timeline}: ${(p.actions || []).join("; ")}`);
  const kpis = launch.kpis?.length ? `- KPIs: ${launch.kpis.join("; ")}` : null;
  const lines = [...phases, kpis].filter(Boolean).join("\n");
  return lines ? `Launch plan:\n${lines}` : null;
}

function sectionSources(research: ResearchResult): string | null {
  const lines = (research.sources || [])
    .slice(0, 12)
    .map((s) => `- ${s.title} — ${s.url}`)
    .join("\n");
  return lines
    ? `Live sources (cite these URLs when referencing market facts):\n${lines}`
    : null;
}

const SECTION_BUILDERS: Record<SectionKey, (r: ResearchResult) => string | null> = {
  competitors: sectionCompetitors,
  github: sectionGithub,
  pricing: sectionPricing,
  funding: sectionFunding,
  gaps: sectionGaps,
  distribution: sectionDistribution,
  positioning: sectionPositioning,
  launch: sectionLaunch,
  sources: sectionSources,
};

/** Shared default order — preserves the historical single-dossier output. */
const DEFAULT_ORDER: SectionKey[] = [
  "competitors",
  "github",
  "pricing",
  "gaps",
  "distribution",
  "positioning",
  "sources",
];

/**
 * Per-critic priority. The needed sections come first so a 7k truncation never
 * starves the one critic who needs them; unrelated sections only fill leftovers.
 */
const AGENT_ORDER: Record<string, SectionKey[]> = {
  vc: ["pricing", "funding", "competitors", "gaps", "positioning", "distribution", "github", "launch", "sources"],
  engineer: ["github", "competitors", "pricing", "gaps", "distribution", "positioning", "launch", "funding", "sources"],
  indiehacker: ["distribution", "positioning", "launch", "competitors", "gaps", "pricing", "github", "funding", "sources"],
  pm: ["launch", "gaps", "positioning", "pricing", "competitors", "distribution", "github", "funding", "sources"],
  ux: ["gaps", "positioning", "competitors", "pricing", "distribution", "launch", "github", "funding", "sources"],
  user: ["gaps", "pricing", "competitors", "positioning", "distribution", "launch", "github", "funding", "sources"],
  devil: ["competitors", "github", "funding", "gaps", "pricing", "distribution", "positioning", "launch", "sources"],
};

function buildHeaderLines(research: ResearchResult): string[] {
  return [
    "Research dossier the agents must use as evidence (cite facts from here, including GitHub repos when present):",
    research.brief?.family
      ? `Frame: ${research.brief.family}${research.brief.job ? ` — ${research.brief.job}` : ""}. Do not recast this as project-management software unless the competitor list is actually PM tools.`
      : null,
  ].filter(Boolean) as string[];
}

function assemble(research: ResearchResult, order: SectionKey[]): string {
  const sections = order
    .map((key) => SECTION_BUILDERS[key](research))
    .filter(Boolean) as string[];
  return [...buildHeaderLines(research), ...sections]
    .join("\n\n")
    .slice(0, MAX_DOSSIER_CHARS);
}

/**
 * Renders the research result as compact evidence text injected into every
 * validation agent's prompt, including verifiable source URLs the agents
 * should cite when referencing market facts.
 */
export function buildDossierForAgents(research: ResearchResult): string {
  return assemble(research, DEFAULT_ORDER);
}

/**
 * Same dossier, reordered so a specific critic's most relevant sections fit
 * inside the character cap. Unknown agents fall back to the shared order.
 */
export function buildDossierForAgent(
  research: ResearchResult,
  agent: string,
): string {
  return assemble(research, AGENT_ORDER[agent] || DEFAULT_ORDER);
}

/** Full research context for validation agents: dossier plus mandatory GitHub block. */
export function buildAgentResearchContext(
  research: ResearchResult,
  agent?: string,
): string {
  const dossier = agent
    ? buildDossierForAgent(research, agent)
    : buildDossierForAgents(research);
  return [dossier, buildGithubMandateForAgents(research)]
    .filter(Boolean)
    .join("\n\n");
}
