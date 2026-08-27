import { describe, expect, it } from "vitest";
import { SCORE_DIMENSIONS } from "@/lib/types";
import { SPECIFICITY_RULES, SCORE_CALIBRATION } from "@/lib/agents/shared";
import { vcPrompt } from "@/lib/agents/vc";
import { engineerPrompt } from "@/lib/agents/engineer";
import { indiePrompt } from "@/lib/agents/indiehacker";
import { pmPrompt } from "@/lib/agents/pm";
import { uxPrompt } from "@/lib/agents/ux";
import { userPrompt } from "@/lib/agents/user";
import { devilPrompt } from "@/lib/agents/devil";
import { synthPrompt } from "@/lib/agents/synthesizer";

const VALIDATION_PROMPTS: Record<string, string> = {
  vc: vcPrompt,
  engineer: engineerPrompt,
  indiehacker: indiePrompt,
  pm: pmPrompt,
  ux: uxPrompt,
  user: userPrompt,
  devil: devilPrompt,
};

/** Extracts dimension keys declared inside each prompt's <scores> example. */
function declaredDimensions(prompt: string): string[] {
  const match = prompt.match(/<scores>\s*\{([\s\S]*?)\}/);
  expect(match, "prompt must contain a <scores> example block").toBeTruthy();
  return [...match![1].matchAll(/"(\w+)"\s*:/g)].map((m) => m[1]);
}

describe("validation agent prompts", () => {
  it("every agent declares only known dimensions plus overall", () => {
    for (const [name, prompt] of Object.entries(VALIDATION_PROMPTS)) {
      const dims = declaredDimensions(prompt);
      for (const dim of dims) {
        expect(
          ([...SCORE_DIMENSIONS] as string[]).includes(dim),
          `${name} declares unknown dimension "${dim}"`
        ).toBe(true);
      }
      expect(dims).toContain("overall");
    }
  });

  it("every agent carries the specificity rules and calibration", () => {
    for (const [name, prompt] of Object.entries(VALIDATION_PROMPTS)) {
      // Devil keeps its own terse specificity rule instead of the full block.
      if (name === "devil") {
        expect(prompt).toMatch(/specific to THIS idea/);
      } else {
        expect(
          prompt.includes(SPECIFICITY_RULES.slice(0, 40)),
          `${name} lacks specificity rules`
        ).toBe(true);
      }
      expect(
        prompt.includes("most ideas land 3-6") ||
          name === "devil", // devil uses survivability scoring instead
        `${name} lacks score calibration`
      ).toBe(true);
    }
  });

  it("the scores contract forbids markdown fences and trailing commas", () => {
    for (const [name, prompt] of Object.entries(VALIDATION_PROMPTS)) {
      expect(prompt.includes("no markdown fences"), name).toBe(true);
      expect(prompt.includes("no trailing commas"), name).toBe(true);
      expect(prompt.includes("<scores>"), name).toBe(true);
      expect(prompt.includes("</scores>"), name).toBe(true);
    }
  });

  it("each persona keeps a distinct lens", () => {
    expect(vcPrompt.toLowerCase()).toContain("market");
    expect(engineerPrompt.toLowerCase()).toMatch(/technical|complexity/);
    expect(indiePrompt.toLowerCase()).toMatch(/launch|product hunt|distribution/);
    expect(uxPrompt.toLowerCase()).toMatch(/onboarding|first value|aha/);
    expect(userPrompt.toLowerCase()).toMatch(/willingness to pay|habit|switch/);
    expect(devilPrompt.length).toBeLessThan(2000); // kill-shot stays terse
  });

  it("devil has no balancing paragraph requirement", () => {
    expect(devilPrompt).toMatch(/no balancing|one line|kill/i);
  });
});

describe("synthesizer prompt", () => {
  it("requires all six dimensions in the final block", () => {
    const dims = declaredDimensions(synthPrompt);
    expect(dims.sort()).toEqual([...SCORE_DIMENSIONS].sort());
  });

  it("demands verdict tag consistency with overall score", () => {
    expect(synthPrompt).toContain("<verdict>");
    expect(synthPrompt).toMatch(/SHIP IT \(overall 7\+\)/);
    expect(synthPrompt).toMatch(/PIVOT \(4-6\)/);
    expect(synthPrompt).toMatch(/KILL IT \(1-3\)/);
  });

  it("preserves disagreement instead of averaging it away", () => {
    expect(synthPrompt).toMatch(/TENSION/);
    expect(synthPrompt).toMatch(/do not split the difference/);
  });

  it("requires measurable kill criteria with numbers and deadlines", () => {
    expect(synthPrompt).toContain("KILL CRITERIA");
    expect(synthPrompt).toMatch(/measurable stop signals/);
    expect(synthPrompt).toMatch(/checkable from a dashboard/);
  });

  it("carries the shared calibration", () => {
    expect(synthPrompt).toContain(SCORE_CALIBRATION.split("\n")[0]);
  });
});
