import { afterEach, describe, expect, it, vi } from "vitest";
import { parseJson } from "@/lib/research/json";
import { searchWithSource } from "@/lib/research/search";

afterEach(() => {
  vi.unstubAllEnvs();
});

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
    vi.stubEnv("EXA_API_KEY", "");
    vi.stubEnv("TAVILY_API_KEY", "");
    const { results, errors } = await searchWithSource({
      query: "slack standup bot competitors alternatives",
    });
    expect(results).toEqual([]);
    expect(errors.join(" ")).toMatch(/mock search disabled/);
  });
});
