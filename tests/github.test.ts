import { describe, expect, it } from "vitest";
import {
  crowdSignal,
  extractGithubKeywords,
  githubQueries,
  isDirectoryRepo,
  mergeGithubAnalysis,
  popularityTier,
  formatStarCount,
  type RawGitHubRepo,
} from "@/lib/research/github";

const sampleRepo = (name: string, stars: number): RawGitHubRepo => ({
  id: Math.floor(Math.random() * 1e6),
  name,
  full_name: `acme/${name}`,
  html_url: `https://github.com/acme/${name}`,
  description: `${name} does something useful`,
  stargazers_count: stars,
  forks_count: Math.floor(stars / 10),
  watchers_count: stars,
  open_issues_count: 3,
  language: "TypeScript",
  topics: ["startup"],
  updated_at: new Date().toISOString(),
  pushed_at: new Date().toISOString(),
  license: { spdx_id: "MIT" },
});

describe("githubQueries", () => {
  it("builds idea-validation queries for validator ideas", () => {
    const q = githubQueries({
      title: "AI startup idea validator with ship/pivot/kill verdict",
      description: "Seven agents critique founder ideas",
      family: "idea_validation",
    });
    expect(q.some((line) => /validator|startup/i.test(line))).toBe(true);
  });
});

describe("popularityTier", () => {
  it("labels high-star repos as viral", () => {
    expect(popularityTier(5000)).toBe("viral");
  });

  it("labels stale low-star repos as inactive", () => {
    expect(
      popularityTier(5, new Date(Date.now() - 900 * 86400000).toISOString()),
    ).toBe("inactive");
  });
});

describe("mergeGithubAnalysis", () => {
  it("only keeps LLM judgments for repos returned by the API", () => {
    const raw = [sampleRepo("real-tool", 420)];
    const landscape = mergeGithubAnalysis(
      raw,
      {
        summary: "Moderate OSS activity.",
        signal: "moderate",
        repos: [
          { full_name: "acme/real-tool", relevance: "High", overlap: "Same validator workflow." },
          { full_name: "acme/fake-tool", relevance: "High", overlap: "Should be dropped." },
        ],
      },
      120,
      ["startup validator"],
    );
    expect(landscape.repos).toHaveLength(1);
    expect(landscape.repos[0].overlap).toContain("Same validator");
    expect(landscape.signal).toBe("moderate");
  });
});

describe("crowdSignal", () => {
  it("marks spaces with multiple high-star repos as crowded", () => {
    expect(
      crowdSignal([
        { stars: 2000, relevance: "High" },
        { stars: 1500, relevance: "Medium" },
      ]),
    ).toBe("crowded");
  });
});

describe("formatStarCount", () => {
  it("formats thousands with k suffix", () => {
    expect(formatStarCount(4200)).toBe("4.2k");
  });
});

describe("extractGithubKeywords", () => {
  it("strips filler words from the idea title", () => {
    const kw = extractGithubKeywords({
      title: "AI calendar assistant for freelance designers",
      description: "Reads client emails and schedules timelines",
    });
    expect(kw).toContain("calendar");
    expect(kw).not.toMatch(/\bthe\b/);
  });

  it("uses planned search terms over raw phrasing", () => {
    const kw = extractGithubKeywords({
      title: "tinder but for freelancers",
      description: "tinder but for freelancers",
      search_terms: ["freelance marketplace", "talent matching"],
      metaphor_terms: ["tinder"],
    });
    expect(kw).toContain("freelance");
    expect(kw).not.toContain("tinder");
  });
});

describe("isDirectoryRepo", () => {
  it("recognizes awesome-lists, which match any keyword", () => {
    expect(
      isDirectoryRepo({
        full_name: "ai-collection/ai-collection",
        description: "The Generative AI Landscape - A Collection of Awesome Generative AI Applications",
      }),
    ).toBe(true);
    expect(
      isDirectoryRepo({
        full_name: "hemanth/awesome-pwa",
        description: "A curated list of Progressive Web Apps",
      }),
    ).toBe(true);
  });

  it("leaves real products alone", () => {
    expect(
      isDirectoryRepo({
        full_name: "acme/freelance-matcher",
        description: "Swipe-based matching for freelance contracts",
      }),
    ).toBe(false);
  });
});

describe("mergeGithubAnalysis relevance defaults", () => {
  it("drops unjudged repos instead of promoting them to Medium", () => {
    const raw = [sampleRepo("mystery-tool", 900), sampleRepo("other-tool", 800)];
    const landscape = mergeGithubAnalysis(raw, null, 41, ["freelance"]);
    expect(landscape.repos).toHaveLength(0);
  });

  it("keeps awesome-lists out of the rendered landscape", () => {
    const list: RawGitHubRepo = {
      ...sampleRepo("ai-collection", 9163),
      full_name: "ai-collection/ai-collection",
      description: "A Collection of Awesome Generative AI Applications",
    };
    const landscape = mergeGithubAnalysis(
      [list],
      {
        summary: "Crowded.",
        signal: "crowded",
        repos: [
          {
            full_name: "ai-collection/ai-collection",
            relevance: "Medium",
            overlap: "Similar problem space.",
          },
        ],
      },
      41,
      ["freelance"],
    );
    expect(landscape.repos).toHaveLength(0);
  });

  it("does not let a thin OSS field read as an opportunity", () => {
    const landscape = mergeGithubAnalysis([], null, 0, ["freelance"]);
    expect(landscape.summary).toMatch(/weak evidence/i);
    expect(landscape.summary).not.toMatch(/opportunit/i);
  });
});
