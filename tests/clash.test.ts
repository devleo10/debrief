import { describe, expect, it } from "vitest";
import {
  clashSystemPrompt,
  buildClashDigest,
  buildClashUserMessage,
} from "@/lib/agents/clash";
import { emptyScores } from "@/lib/extractScores";
import type { AgentResult } from "@/lib/types";

const agent = (name: string, output: string, overall?: number): AgentResult => ({
  agent: name,
  output,
  scores: { ...emptyScores(), overall: overall ?? null },
});

describe("clashSystemPrompt", () => {
  it("names the persona and demands a rejected claim plus terseness", () => {
    const prompt = clashSystemPrompt("vc");
    expect(prompt).toContain("VC Investor");
    expect(prompt.toLowerCase()).toContain("reject");
    expect(prompt).toContain("under 120 words");
    // It must forbid the machine blocks the validation agents emit.
    expect(prompt).toContain("<scores>");
    expect(prompt).toContain("verdict tag");
  });

  it("falls back to the raw agent id for an unknown persona", () => {
    expect(clashSystemPrompt("mystery")).toContain("mystery");
  });
});

describe("buildClashDigest", () => {
  it("carries the label, overall score, and the sharpest claim", () => {
    const digest = buildClashDigest(
      agent("engineer", "The API costs will sink this.\n<scores>{\"overall\":3}</scores>", 3),
    );
    expect(digest).toContain("Senior Engineer");
    expect(digest).toContain("overall 3");
    expect(digest).toContain("API costs");
    expect(digest).not.toContain("<scores>");
  });

  it("marks an unscored critique", () => {
    expect(buildClashDigest(agent("pm", "Some take."))).toContain("unscored");
  });
});

describe("buildClashUserMessage", () => {
  it("includes the critic's own text and only the other critics' claims", () => {
    const own = agent("devil", "Nobody will pay for this.");
    const message = buildClashUserMessage(own, [
      agent("vc", "The market is venture-scale.", 7),
      agent("ux", "Onboarding is confusing.", 5),
    ]);
    expect(message).toContain("Your critique as the Devil's Advocate");
    expect(message).toContain("Nobody will pay");
    expect(message).toContain("- VC Investor (overall 7)");
    expect(message).toContain("- UX Designer (overall 5)");
    // The critic is not listed against itself.
    expect(message).not.toContain("- Devil's Advocate (");
  });
});
