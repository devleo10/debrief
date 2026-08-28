import { describe, expect, it } from "vitest";
import {
  competitorFitsFrame,
  competitorQueries,
  dropUnsourcedRounds,
  filterCompetitors,
  inferFamily,
  scrubGaps,
  scrubPainFrequency,
  scrubPositioning,
} from "@/lib/research/quality";
import type { Competitor } from "@/lib/research/types";

const c = (name: string, description: string, url = "https://x.com"): Competitor => ({
  name,
  url,
  description,
  strengths: [],
  weaknesses: [],
  source_urls: [],
});

describe("inferFamily", () => {
  it("detects ship/kill multi-agent dictation as idea validation", () => {
    expect(
      inferFamily({
        title: "7 agents",
        description: "VC and engineer should i ship it or not",
      }),
    ).toBe("idea_validation");
  });
});

describe("competitorQueries", () => {
  it("searches LLM validators not project-management suites", () => {
    const q = competitorQueries({
      title: "7 agents evaluate idea",
      description: "should i ship it or kill it with a VC agent",
    }).join(" ");
    expect(q.toLowerCase()).toMatch(/chatgpt/);
    expect(q.toLowerCase()).not.toMatch(/asana/);
  });
});

describe("filterCompetitors", () => {
  it("drops Asana and OKR tools for idea-validation ideas", () => {
    const kept = filterCompetitors(
      [
        c("Asana", "Team project tracking"),
        c("Gtmhub", "OKR platform for organizations"),
        c("ChatGPT", "General LLM that founders use to critique ideas"),
      ],
      "idea_validation",
    );
    const names = kept.map((x) => x.name);
    expect(names).toContain("ChatGPT");
    expect(names).not.toContain("Asana");
    expect(names).not.toContain("Gtmhub");
  });

  it("always includes ChatGPT/Claude for idea-validation even if the model returns junk", () => {
    const kept = filterCompetitors(
      [c("Asana", "Boards"), c("IdeaScale", "Enterprise crowdsourcing")],
      "idea_validation",
      [],
    );
    expect(kept.map((x) => x.name)).toEqual(["ChatGPT", "Claude"]);
  });
});

describe("competitorFitsFrame", () => {
  it("keeps ValidatorAI-style products", () => {
    expect(
      competitorFitsFrame(
        { name: "ValidatorAI", url: "https://validatorai.com", description: "Startup idea validator" },
        "idea_validation",
      ),
    ).toBe(true);
  });
});

describe("scrubPainFrequency", () => {
  it("strips invented G2 percentages", () => {
    expect(scrubPainFrequency("28% of G2 reviews")).toBe("unquantified in sources");
    expect(scrubPainFrequency("Mentioned repeatedly on r/startups")).toBe(
      "Mentioned repeatedly on r/startups",
    );
  });
});

describe("scrubGaps", () => {
  it("drops pain points with placeholder or missing sources", () => {
    const out = scrubGaps({
      pain_points: [
        {
          point: "Too nice",
          frequency: "22% of Reddit discussions",
          source: "https://www.reddit.com/r/projectmanagement/comments/xyz123",
        },
        {
          point: "ChatGPT is too agreeable",
          frequency: "unquantified",
          source: "https://www.reddit.com/r/startups/comments/abc",
        },
      ],
    });
    expect(out.pain_points).toHaveLength(1);
    expect(out.pain_points[0].point).toMatch(/agreeable/);
  });
});

describe("scrubPositioning", () => {
  it("replaces fake-moat copy for idea-validation products", () => {
    const out = scrubPositioning(
      {
        category: "AI-driven project idea evaluation platform",
        one_liner: "Unlock project evaluations from seven agents",
        competitive_advantage: "The multi-agent system is unique and difficult to replicate",
      },
      "idea_validation",
    );
    expect(out.category).toMatch(/Founder idea-validation/);
    expect(out.one_liner).not.toMatch(/project eval/i);
    expect(out.competitive_advantage).toMatch(/ChatGPT/);
    expect(out.competitive_advantage).not.toMatch(/difficult to replicate/i);
  });
});

describe("dropUnsourcedRounds", () => {
  it("drops companies that never appeared in search text", () => {
    const kept = dropUnsourcedRounds(
      [
        { company: "EvalTech", amount: "$15 million" },
        { company: "OpenAI", amount: "$10B" },
      ],
      "OpenAI raised from Microsoft",
    );
    expect(kept.map((r) => r.company)).toEqual(["OpenAI"]);
  });
});
