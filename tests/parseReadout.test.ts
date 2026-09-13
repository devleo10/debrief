import { describe, expect, it } from "vitest";
import {
  parseReadout,
  previewLine,
  readoutSection,
  splitCriteria,
  splitParagraphs,
} from "@/lib/parseReadout";

const LABELED = `
1. CONSENSUS — Three agents say the buyer is real. As the engineer put it: the workflow is painful and daily.

2. TENSION — The VC wants a platform. The indie hacker wants a wedge.

3. DIFFERENTIATION & CREDIBILITY — This still reads like an AI wrapper on Gmail.

4. KILL SHOT REVIEW — No distribution. Survivable with changes.

5. VERDICT — PIVOT

6. NEXT MOVE — Drop studios. Sell only to solo freelance designers who already live in Gmail.

7. KILL CRITERIA —
If fewer than 10 paying users by Day 60, stop.
If CAC stays above $40 for 3 consecutive weeks, stop.
If under 30% of beta users return in week 2, stop.
`;

describe("parseReadout", () => {
  it("splits numbered em-dash sections", () => {
    const sections = parseReadout(LABELED);
    expect(sections.map((s) => s.label)).toEqual([
      "CONSENSUS",
      "TENSION",
      "DIFFERENTIATION & CREDIBILITY",
      "KILL SHOT REVIEW",
      "VERDICT",
      "NEXT MOVE",
      "KILL CRITERIA",
    ]);
    expect(readoutSection(sections, "NEXT MOVE")).toContain("solo freelance designers");
  });

  it("handles labels on their own line and markdown bold", () => {
    const text = [
      "**CONSENSUS**",
      "Everyone hates the current spreadsheet.",
      "TENSION",
      "PM wants scope. Engineer wants less.",
      "Kill shot — No one will pay for this.",
    ].join("\n");
    const sections = parseReadout(text);
    expect(readoutSection(sections, "CONSENSUS")).toContain("spreadsheet");
    expect(readoutSection(sections, "TENSION")).toContain("Engineer");
    expect(readoutSection(sections, "KILL SHOT REVIEW")).toContain("No one will pay");
  });

  it("returns empty when there are no labels so the UI can paragraph-split instead", () => {
    expect(parseReadout("Just a long ramble without structure.")).toEqual([]);
  });
});

describe("splitParagraphs", () => {
  it("breaks a wall of text on sentence boundaries", () => {
    const wall =
      "The market is crowded with calendar tools that already auto-block time from email. " +
      "None of them are designed for freelance designers who juggle client work in Gmail. " +
      "The real risk is distribution, not the model. " +
      "Without a wedge into an existing community this dies as another AI wrapper.";
    const parts = splitParagraphs(wall, 160);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.length <= 180)).toBe(true);
  });
});

describe("splitCriteria", () => {
  it("turns If-clauses into a list", () => {
    const items = splitCriteria(
      "If fewer than 10 paying users by Day 60, stop. If CAC stays above $40 for 3 consecutive weeks, stop.",
    );
    expect(items).toHaveLength(2);
  });
});

describe("previewLine", () => {
  it("clips a long first paragraph", () => {
    const preview = previewLine("A".repeat(200), 80);
    expect(preview.endsWith("…")).toBe(true);
    expect(preview.length).toBeLessThanOrEqual(81);
  });
});
