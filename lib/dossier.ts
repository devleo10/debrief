import type { ResearchResult } from "./research/types";

const MAX_DOSSIER_CHARS = 7_000;

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

  return [
    "Research dossier the agents must use as evidence:",
    research.brief?.family
      ? `Frame: ${research.brief.family}${research.brief.job ? ` — ${research.brief.job}` : ""}. Do not recast this as project-management software unless the competitor list is actually PM tools.`
      : null,
    competitors ? `Competitors:\n${competitors}` : null,
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
