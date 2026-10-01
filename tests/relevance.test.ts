import { describe, expect, it } from "vitest";
import { filterRelevantResults, scoreRelevance } from "@/lib/research/relevance";
import type { ResearchInput } from "@/lib/research/types";

const FREELANCE_IDEA: ResearchInput = {
  title: "Freelance matching platform",
  description:
    "A marketplace that matches freelancers with clients using a swipe interface.",
  search_terms: ["freelance marketplace", "freelancer hiring", "talent matching"],
  metaphor_terms: ["tinder", "swipe"],
};

const result = (title: string, url: string, snippet = "") => ({
  title,
  url,
  snippet,
});

describe("scoreRelevance", () => {
  const terms = FREELANCE_IDEA.search_terms!;
  const metaphors = FREELANCE_IDEA.metaphor_terms!;

  it("scores a real competitor page above zero", () => {
    expect(
      scoreRelevance(
        result(
          "Is Upwork Worth It? One Freelancer's Story",
          "https://example.com/upwork",
          "Advice for freelancers hiring through the marketplace.",
        ),
        terms,
        metaphors,
      ),
    ).toBeGreaterThan(0);
  });

  it("rejects a page that matches only the borrowed metaphor", () => {
    expect(
      scoreRelevance(
        result(
          "Tinder date turned into ER shift!",
          "https://youtube.com/watch?v=1",
          "Smosh sketch comedy",
        ),
        terms,
        metaphors,
      ),
    ).toBeLessThan(0);
  });

  it("scores an unrelated page at zero", () => {
    expect(
      scoreRelevance(
        result("Ninja Swirl by Creami Review", "https://example.com/ninja"),
        terms,
        metaphors,
      ),
    ).toBe(0);
  });
});

describe("filterRelevantResults", () => {
  it("drops off-topic results from a mixed batch", () => {
    const { kept, dropped } = filterRelevantResults(
      [
        result(
          "Upwork vs Fiverr: freelance marketplace comparison",
          "https://example.com/a",
        ),
        result(
          "Freelancer hiring pain points and vague briefs",
          "https://example.com/b",
        ),
        result(
          "Top freelance marketplace platforms for talent matching",
          "https://example.com/c",
        ),
        result("Tinder date turned into ER shift!", "https://youtube.com/watch?v=1"),
        result(
          "The Ultimate Wet Weather Fire Starter - Featherstick Tinder",
          "https://example.com/fire",
        ),
      ],
      FREELANCE_IDEA,
    );

    expect(dropped).toBe(2);
    expect(kept.map((r) => r.url)).not.toContain("https://youtube.com/watch?v=1");
    expect(kept.map((r) => r.url)).not.toContain("https://example.com/fire");
  });

  it("keeps everything rather than leaving the dossier too thin", () => {
    const junk = [
      result("Ninja Slushi Review", "https://example.com/1"),
      result("Reddit May Have Been Right About Espresso", "https://example.com/2"),
      result("Codex vs Claude Code", "https://example.com/3"),
    ];
    const { kept, dropped } = filterRelevantResults(junk, FREELANCE_IDEA);
    expect(kept).toHaveLength(3);
    expect(dropped).toBe(0);
  });
});
