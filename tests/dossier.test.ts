import { describe, expect, it } from "vitest";
import { buildDossierForAgents } from "@/lib/dossier";
import type { ResearchResult } from "@/lib/research/types";
import type { Competitor } from "@/lib/research/types";

const competitor = (name: string): Competitor => ({
  name,
  url: `https://${name}.com`,
  description: `${name} does things`,
  strengths: [],
  weaknesses: [],
  source_urls: [],
});

const baseResearch: ResearchResult = {
  sources: [],
  competitors: [],
  pricing: null as never,
  funding: null as never,
  gaps: null as never,
  distribution: null as never,
  positioning: null as never,
  launch: null as never,
};

describe("buildDossierForAgents", () => {
  it("includes competitors with pricing when present", () => {
    const dossier = buildDossierForAgents({
      ...baseResearch,
      competitors: [{ ...competitor("Geekbot"), pricing: "$2.50/user" }],
    });
    expect(dossier).toContain("Competitors:");
    expect(dossier).toContain("- Geekbot: Geekbot does things. Pricing: $2.50/user.");
  });

  it("includes live source lines for citation", () => {
    const dossier = buildDossierForAgents({
      ...baseResearch,
      sources: [
        { section: "competitors", title: "Geekbot", url: "https://geekbot.com" },
      ],
    });
    expect(dossier).toContain("Live sources (cite these URLs");
    expect(dossier).toContain("- Geekbot — https://geekbot.com");
  });

  it("caps the output at 7000 characters", () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      competitor(`Competitor Number ${i} With A Very Long Description`.repeat(5))
    );
    expect(buildDossierForAgents({ ...baseResearch, competitors: many }).length).toBeLessThanOrEqual(7000);
  });

  it("omits empty sections instead of printing headers", () => {
    const dossier = buildDossierForAgents(baseResearch);
    expect(dossier).toBe("Research dossier the agents must use as evidence:");
  });
});
