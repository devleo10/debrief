import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseJson } from "@/lib/research/json";
import { mapSerpApiResults, searchWithSource } from "@/lib/research/search";
import { liveSearchConfigured } from "@/lib/searchConfig";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function stubNoLiveSearch() {
  vi.stubEnv("SERPAPI_API_KEY", "");
  vi.stubEnv("EXA_API_KEY", "");
  vi.stubEnv("TAVILY_API_KEY", "");
}

describe("parseJson", () => {
  it("parses clean JSON", () => {
    expect(parseJson('{"a":1}').data).toEqual({ a: 1 });
  });

  it("recovers JSON wrapped in markdown fences", () => {
    expect(parseJson('```json\n{"a": [1,2]}\n```').data).toEqual({ a: [1, 2] });
  });

  it("removes trailing commas before objects and arrays close", () => {
    expect(parseJson('{"a": 1, "b": [2, 3,],}').data).toEqual({
      a: 1,
      b: [2, 3],
    });
  });

  it("extracts the object embedded in surrounding prose", () => {
    expect(
      parseJson("Here is the result you asked for:\n{\"competitors\": []}\nDone.").data
    ).toEqual({ competitors: [] });
  });

  it("extracts a bare array when no object exists", () => {
    expect(parseJson('["one","two"]').data).toEqual(["one", "two"]);
  });

  it("reports an error instead of throwing on garbage", () => {
    const { data, error } = parseJson("no json here at all");
    expect(data).toBeNull();
    expect(error).toBeTruthy();
  });
});

describe("searchWithSource (mock fallback, no API keys)", () => {
  beforeEach(() => {
    stubNoLiveSearch();
  });

  it("falls back to mock data for the standup-tool demo domain", async () => {
    const { results, source, errors } = await searchWithSource({
      query: "slack standup bot competitors alternatives",
    });
    expect(source).toBe("mock");
    expect(errors).toEqual([]);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].url).toMatch(/^https?:\/\//);
  });

  it("mock covers pricing queries in the scheduling demo domain", async () => {
    const { results, source } = await searchWithSource({
      query: "calendly scheduling competitor pricing",
    });
    expect(source).toBe("mock");
    expect(results.length).toBeGreaterThan(0);
  });

  it("returns empty results for ideas outside both demo domains", async () => {
    const { results, source } = await searchWithSource({
      query: "dog grooming appointment app",
    });
    expect(source).toBe("mock");
    expect(results).toEqual([]);
  });

  it("does not use mock search in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_MOCK_SEARCH", "");
    stubNoLiveSearch();
    const { results, errors } = await searchWithSource({
      query: "slack standup bot competitors alternatives",
    });
    expect(results).toEqual([]);
    expect(errors.join(" ")).toMatch(/mock search disabled/);
  });
});

describe("mapSerpApiResults", () => {
  it("maps organic results and skips duplicate URLs", () => {
    const results = mapSerpApiResults(
      {
        knowledge_graph: {
          title: "Acme",
          description: "Scheduling software",
          source: { name: "Wikipedia", link: "https://en.wikipedia.org/wiki/Acme" },
        },
        organic_results: [
          {
            title: "Acme",
            link: "https://acme.test",
            snippet: "Calendar automation",
          },
          {
            title: "Acme again",
            link: "https://acme.test",
            snippet: "duplicate",
          },
        ],
        news_results: [
          {
            title: "Acme raises Series A",
            link: "https://news.test/acme",
            snippet: "Raised $12M",
            source: "TechCrunch",
            date: "2 days ago",
          },
        ],
      },
      5,
    );
    expect(results).toEqual([
      {
        title: "Acme",
        url: "https://en.wikipedia.org/wiki/Acme",
        snippet: "Scheduling software",
      },
      {
        title: "Acme",
        url: "https://acme.test",
        snippet: "Calendar automation",
      },
      {
        title: "Acme raises Series A",
        url: "https://news.test/acme",
        snippet: "TechCrunch — 2 days ago — Raised $12M",
      },
    ]);
  });
});

describe("searchWithSource (SerpApi)", () => {
  it("uses Google organic results when SERPAPI_API_KEY is set", async () => {
    vi.stubEnv("SERPAPI_API_KEY", "test-key");
    vi.stubEnv("EXA_API_KEY", "");
    vi.stubEnv("TAVILY_API_KEY", "");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        organic_results: [
          {
            title: "Acme",
            link: "https://acme.test",
            snippet: "A competitor",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { results, source } = await searchWithSource({
      query: "acme competitors",
      engine: "google_news",
    });

    expect(source).toBe("serpapi");
    expect(results[0]).toEqual({
      title: "Acme",
      url: "https://acme.test",
      snippet: "A competitor",
    });
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("https://serpapi.com/search.json?");
    expect(url).toContain("engine=google_news");
    expect(url).toContain("q=acme+competitors");
    expect(url).toContain("api_key=test-key");
  });
});

describe("liveSearchConfigured", () => {
  it("treats SerpApi as a live search provider", () => {
    stubNoLiveSearch();
    expect(liveSearchConfigured()).toBe(false);
    vi.stubEnv("SERPAPI_API_KEY", "test-key");
    expect(liveSearchConfigured()).toBe(true);
  });
});
