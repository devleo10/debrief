import { describe, expect, it } from "vitest";
import {
  averageScores,
  emptyScores,
  extractScores,
  hasAnyScore,
  stripStructuredBlocks,
} from "@/lib/extractScores";

describe("extractScores", () => {
  it("returns empty scores for empty input", () => {
    expect(extractScores("")).toEqual(emptyScores());
  });

  it("parses a well-formed <scores> block", () => {
    const text = `Great critique.
<scores>
{ "market": 6, "technical": null, "launch": 7 }
</scores>`;
    expect(extractScores(text)).toEqual({
      market: 6,
      technical: null,
      launch: 7,
      ux: null,
      retention: null,
      overall: null,
    });
  });

  it("strips markdown fences inside the scores block", () => {
    const text = "<scores>```json\n{ \"market\": 5 }\n```</scores>";
    expect(extractScores(text).market).toBe(5);
  });

  it("tolerates trailing commas", () => {
    const text = '<scores>{ "market": 5, "ux": 4, }</scores>';
    expect(extractScores(text).ux).toBe(4);
  });

  it("coerces numeric strings", () => {
    const text = '<scores>{ "overall": "8" }</scores>';
    expect(extractScores(text).overall).toBe(8);
  });

  it("clamps out-of-range values to 1-10 and rounds fractions", () => {
    const text = '<scores>{ "market": 99, "technical": -3, "launch": 6.6 }</scores>';
    const scores = extractScores(text);
    expect(scores.market).toBe(10);
    expect(scores.technical).toBe(1);
    expect(scores.launch).toBe(7);
  });

  it("falls back to scanning loose JSON objects mentioning a known dimension", () => {
    const text = 'The panel scored it: { "note": "mixed" } but really { "retention": 3 } is the number.';
    expect(extractScores(text).retention).toBe(3);
  });

  it("prefers the last loose JSON candidate when several match", () => {
    const text = '{ "market": 2 } then later revised: { "market": 9 }';
    expect(extractScores(text).market).toBe(9);
  });

  it("ignores JSON objects without any known dimension key", () => {
    const text = '{ "foo": 5 }';
    expect(extractScores(text)).toEqual(emptyScores());
  });

  it("returns empty scores when the tagged block contains garbage", () => {
    const text = "<scores>not json at all</scores>";
    expect(hasAnyScore(extractScores(text))).toBe(false);
  });
});

describe("hasAnyScore", () => {
  it("is false when every dimension is null", () => {
    expect(hasAnyScore(emptyScores())).toBe(false);
  });

  it("is true when at least one dimension is set", () => {
    expect(hasAnyScore({ ...emptyScores(), ux: 4 })).toBe(true);
  });
});

describe("stripStructuredBlocks", () => {
  it("removes both scores and verdict blocks and trims whitespace", () => {
    const text = "\n<scores>{\"market\":5}</scores>\nVerdict body here.\n<verdict>PIVOT</verdict>\n";
    expect(stripStructuredBlocks(text)).toBe("Verdict body here.");
  });
});

describe("averageScores", () => {
  it("averages only dimensions that have values, rounding to integers", () => {
    const result = averageScores([
      { ...emptyScores(), market: 4, overall: 3 },
      { ...emptyScores(), market: 5, technical: 8 },
      { ...emptyScores(), market: 6 },
    ]);
    expect(result.market).toBe(5);
    expect(result.technical).toBe(8);
    expect(result.overall).toBe(3);
    expect(result.ux).toBeNull();
  });

  it("returns empty scores for an empty list", () => {
    expect(averageScores([])).toEqual(emptyScores());
  });
});
