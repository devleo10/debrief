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

/**
 * Renders the research result as compact evidence text injected into every
 * validation agent's prompt, including verifiable source URLs the agents
 * should cite when referencing market facts.
 */
export function buildDossierForAgents(research: ResearchResult): string {
  const competitors = research.competitors
    .slice(0, 6)
    .map(
      (c) =>
        `- ${c.name}: ${c.description}${c.pricing ? `. Pricing: ${c.pricing}.` : "."}`
    )
    .join("\n");
  const pricing = research.pricing?.competitors
    ?.slice(0, 5)
    .map(
      (c) =>
        `- ${c.name}: ${(c.tiers || [])
          .map((t) => `${t.name} ${t.price}`)
          .join(", ")}`
    )
    .join("\n");
  const gaps = research.gaps?.pain_points
    ?.slice(0, 4)
    .map((p) => `- ${p.point} (${p.frequency || "frequency unknown"})`)
    .join("\n");
  const distribution = research.distribution?.distribution_channels
    ?.slice(0, 4)
    .map((d) => `- ${d.channel}: ${d.effectiveness}`)
    .join("\n");
  const sourceLines = (research.sources || [])
    .slice(0, 12)
    .map((s) => `- ${s.title} — ${s.url}`)
    .join("\n");
  const github = sampleGithubRepo(research);

  return [
    "Research dossier the agents must use as evidence (cite facts from here, including GitHub repos when present):",
    research.brief?.family
      ? `Frame: ${research.brief.family}${research.brief.job ? ` — ${research.brief.job}` : ""}. Do not recast this as project-management software unless the competitor list is actually PM tools.`
      : null,
    competitors ? `Competitors:\n${competitors}` : null,
    github
      ? `GitHub landscape (${research.github?.signal || "unknown"}): ${research.github?.summary || ""}\n${github}`
      : null,
    pricing ? `Pricing:\n${pricing}` : null,
    gaps ? `Pain points / gaps:\n${gaps}` : null,
    distribution ? `Distribution:\n${distribution}` : null,
    research.positioning?.one_liner
      ? `Positioning draft: ${research.positioning.one_liner}`
      : null,
    sourceLines
      ? `Live sources (cite these URLs when referencing market facts):\n${sourceLines}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, MAX_DOSSIER_CHARS);
}

/** Full research context for validation agents: dossier plus mandatory GitHub block. */
export function buildAgentResearchContext(research: ResearchResult): string {
  return [buildDossierForAgents(research), buildGithubMandateForAgents(research)]
    .filter(Boolean)
    .join("\n\n");
}
