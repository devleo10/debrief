import { describe, expect, it } from "vitest";
import {
  buildAgentResearchContext,
  buildDossierForAgents,
  buildGithubMandateForAgents,
} from "@/lib/dossier";
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
  github: null,
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
    expect(dossier).toBe(
      "Research dossier the agents must use as evidence (cite facts from here, including GitHub repos when present):",
    );
  });

  it("includes GitHub landscape when repos are present", () => {
    const dossier = buildDossierForAgents({
      ...baseResearch,
      github: {
        queries: ["startup validator"],
        total_matches: 40,
        signal: "moderate",
        summary: "Several OSS validators exist.",
        repos: [
          {
            name: "idea-validator",
            full_name: "acme/idea-validator",
            url: "https://github.com/acme/idea-validator",
            description: "Validator",
            stars: 320,
            forks: 40,
            watchers: 320,
            open_issues: 2,
            language: "TypeScript",
            topics: [],
            license: "MIT",
            last_pushed: "2025-01-01",
            popularity_tier: "established",
            relevance: "High",
            overlap: "Same multi-agent critique flow.",
          },
        ],
      },
    });
    expect(dossier).toContain("GitHub landscape");
    expect(dossier).toContain("acme/idea-validator");
  });
});

const githubFixture = {
  queries: ["startup validator"],
  total_matches: 40,
  signal: "moderate" as const,
  summary: "Several OSS validators exist.",
  repos: [
    {
      name: "idea-validator",
      full_name: "acme/idea-validator",
      url: "https://github.com/acme/idea-validator",
      description: "Validator",
      stars: 320,
      forks: 40,
      watchers: 320,
      open_issues: 2,
      language: "TypeScript",
      topics: [],
      license: "MIT",
      last_pushed: "2025-01-01",
      popularity_tier: "established" as const,
      relevance: "High" as const,
      overlap: "Same multi-agent critique flow.",
    },
  ],
};

describe("buildGithubMandateForAgents", () => {
  it("returns null when no github repos", () => {
    expect(buildGithubMandateForAgents(baseResearch)).toBeNull();
  });

  it("requires agents to address github overlap", () => {
    const mandate = buildGithubMandateForAgents({
      ...baseResearch,
      github: githubFixture,
    });
    expect(mandate).toContain("MANDATORY GITHUB CHECK");
    expect(mandate).toContain("acme/idea-validator");
    expect(mandate).toContain("You must name at least one repo");
  });
});

describe("buildAgentResearchContext", () => {
  it("appends github mandate after dossier", () => {
    const context = buildAgentResearchContext({
      ...baseResearch,
      github: githubFixture,
    });
    expect(context.indexOf("GitHub landscape")).toBeLessThan(
      context.indexOf("MANDATORY GITHUB CHECK"),
    );
  });
});
