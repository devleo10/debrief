import { describe, expect, it } from "vitest";
import {
  opportunityLabel,
  pitchSectionNote,
  pitchSectionTitle,
  verdictContestsPitch,
} from "@/lib/verdictFraming";

describe("verdictContestsPitch", () => {
  it("treats KILL and PIVOT as rejecting the pitch", () => {
    expect(verdictContestsPitch("KILL IT")).toBe(true);
    expect(verdictContestsPitch("PIVOT")).toBe(true);
  });

  it("leaves a SHIP verdict's pitch intact", () => {
    expect(verdictContestsPitch("SHIP IT")).toBe(false);
    expect(verdictContestsPitch(null)).toBe(false);
  });
});

describe("opportunity framing", () => {
  // The report used to stamp "High opportunity" next to "KILL IT — no differentiation".
  it("never leaves a high opportunity unqualified under a kill verdict", () => {
    const contested = verdictContestsPitch("KILL IT");
    const label = opportunityLabel("High", contested);
    expect(label).not.toBe("High opportunity");
    expect(label).toMatch(/contested/i);
  });

  it("reads normally when the verdict agrees", () => {
    expect(opportunityLabel("High", false)).toBe("High opportunity");
  });

  it("stays empty when there is no sizing", () => {
    expect(opportunityLabel(undefined, true)).toBe("");
  });
});

describe("pitch section framing", () => {
  it("relabels positioning as the claim under test after a kill", () => {
    expect(pitchSectionTitle(true)).toBe("The case we tested");
    expect(pitchSectionNote(true)).toMatch(/claims under test/i);
  });

  it("leaves positioning alone when the verdict agrees", () => {
    expect(pitchSectionTitle(false)).toBe("Positioning");
    expect(pitchSectionNote(false)).toBeNull();
  });
});
