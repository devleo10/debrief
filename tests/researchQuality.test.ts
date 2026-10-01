import { describe, expect, it } from "vitest";
import {
  competitorFitsFrame,
  competitorQueries,
  distributionQueries,
  dropUnsourcedRounds,
  filterCompetitors,
  gapsQueries,
  inferFamily,
  markStaleFigure,
  metaphorTermsFor,
  scrubGaps,
  scrubMarketSize,
  scrubPainFrequency,
  scrubPositioning,
  searchTermsFor,
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

describe("query planning for analogical input", () => {
  // The run that motivated this: "tinder but for freelancers" searched the literal
  // word "tinder" and returned dating clips and campfire kindling.
  const raw = {
    title: "tinder but for freelancers",
    description: "tinder but for freelancers",
  };
  const normalized = {
    title: "Freelance matching platform",
    description: "A marketplace matching freelancers to clients via swiping.",
    search_terms: ["freelance marketplace", "talent matching"],
    metaphor_terms: ["tinder", "swipe"],
  };

  it("treats a borrowed brand in an 'X for Y' pitch as a metaphor", () => {
    expect(metaphorTermsFor(raw)).toContain("tinder");
  });

  it("does not strip a brand when the idea is actually about that brand", () => {
    expect(
      metaphorTermsFor({
        title: "Tinder profile analytics",
        description: "Analytics dashboard sold to Tinder power users.",
      }),
    ).toEqual([]);
  });

  it("keeps metaphor terms out of the canonical search terms", () => {
    expect(searchTermsFor(normalized)).not.toContain("tinder");
    expect(searchTermsFor(raw)).not.toContain("tinder");
  });

  it("never emits a bare metaphor term in any planned query", () => {
    for (const input of [raw, normalized]) {
      const queries = [
        ...competitorQueries(input),
        ...gapsQueries(input),
        ...distributionQueries(input),
      ];
      for (const q of queries) {
        expect(q).not.toMatch(/(^|\s)tinder\b/i);
        expect(q).toMatch(/-tinder/);
      }
    }
  });

  it("searches the real market once the input is normalized", () => {
    const q = competitorQueries(normalized).join(" ").toLowerCase();
    expect(q).toMatch(/freelance/);
    expect(q).toMatch(/marketplace|matching/);
  });
});

describe("scrubMarketSize", () => {
  const blob = "https://grandviewresearch.com/freelance-platforms grandviewresearch.com";

  it("drops a figure with no source", () => {
    const out = scrubMarketSize(
      { tam: "$455 billion by 2023", sam: "", som: "", sources: [] },
      blob,
    );
    expect(out.tam).toBe("");
  });

  it("keeps a figure attributed to a page that turned up in search", () => {
    const out = scrubMarketSize(
      {
        tam: "$24.2 billion by 2033",
        tam_source: "https://grandviewresearch.com/freelance-platforms",
        sam: "",
        som: "",
        sources: [],
      },
      blob,
    );
    expect(out.tam).toContain("24.2");
    expect(out.tam_source).toContain("grandviewresearch");
  });

  it("falls back to the shared source list for an unattributed figure", () => {
    const out = scrubMarketSize(
      {
        tam: "$24.2 billion by 2033",
        sam: "",
        som: "",
        sources: ["https://grandviewresearch.com/freelance-platforms"],
      },
      blob,
    );
    expect(out.tam).toContain("24.2");
  });
});

describe("markStaleFigure", () => {
  const now = new Date("2026-09-19");

  it("flags a figure whose year is well behind the report", () => {
    expect(markStaleFigure("$455 billion by 2023", now)).toContain("(as of 2023)");
  });

  it("leaves a current figure alone", () => {
    expect(markStaleFigure("$24.2 billion by 2033", now)).toBe(
      "$24.2 billion by 2033",
    );
  });

  it("leaves a figure with no year alone", () => {
    expect(markStaleFigure("roughly $10 billion", now)).toBe("roughly $10 billion");
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

  it("blanks non-http competitor urls", () => {
    const kept = filterCompetitors(
      [c("ChatGPT", "General LLM that founders use to critique ideas", "javascript:alert(1)")],
      "idea_validation",
    );
    const gpt = kept.find((x) => x.name === "ChatGPT");
    expect(gpt?.url).not.toMatch(/^javascript:/);
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
