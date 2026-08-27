import { describe, expect, it } from "vitest";
import { extractVerdict, verdictFromScore } from "@/lib/extractVerdict";

describe("verdictFromScore", () => {
  it.each([
    [10, "SHIP IT"],
    [7, "SHIP IT"],
    [6.9, "PIVOT"],
    [4, "PIVOT"],
    [3.9, "KILL IT"],
    [1, "KILL IT"],
  ])("maps %p to %p", (score, expected) => {
    expect(verdictFromScore(score as number)).toBe(expected);
  });

  it("returns null for missing or non-numeric scores", () => {
    expect(verdictFromScore(null)).toBeNull();
    expect(verdictFromScore(undefined)).toBeNull();
  });
});

describe("extractVerdict", () => {
  it("prefers the <verdict> tag over everything else", () => {
    const text = "I would never say <verdict>KILL IT</verdict> about score 9.";
    expect(extractVerdict(text, 9)).toBe("KILL IT");
  });

  it("falls back to the structured score before keyword scanning", () => {
    const text = "This is not quite SHIP IT material.";
    expect(extractVerdict(text, 3)).toBe("KILL IT");
  });

  it("scans keywords with KILL IT checked first", () => {
    expect(extractVerdict("You could PIVOT or just KILL IT.", null)).toBe("KILL IT");
    expect(extractVerdict("Honestly you should PIVOT.", null)).toBe("PIVOT");
    expect(extractVerdict("Rare one — SHIP IT now.", null)).toBe("SHIP IT");
  });

  it("is case-insensitive on the tag and normalizes to uppercase", () => {
    expect(extractVerdict("<verdict>pivot</verdict>", null)).toBe("PIVOT");
  });

  it("returns null when nothing matches", () => {
    expect(extractVerdict("", null)).toBeNull();
    expect(extractVerdict("no signals here", null)).toBeNull();
  });
});
