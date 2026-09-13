import { describe, expect, it } from "vitest";
import {
  integritySummary,
  isDegradedRun,
  maybeDowngradeShip,
} from "@/lib/runIntegrity";

describe("maybeDowngradeShip", () => {
  it("leaves SHIP IT when sources exist", () => {
    expect(
      maybeDowngradeShip("<verdict>SHIP IT</verdict>\nGo.", 4),
    ).toContain("SHIP IT");
  });

  it("downgrades SHIP IT with no sources", () => {
    expect(maybeDowngradeShip("<verdict>SHIP IT</verdict>\nGo.", 0)).toContain(
      "PIVOT",
    );
  });
});

describe("isDegradedRun", () => {
  it("flags missing sources, fallback synthesis, or agent failures", () => {
    expect(
      isDegradedRun({
        type: "integrity",
        fallback: false,
        sources: 3,
        agentFailures: 0,
      }),
    ).toBe(false);
    expect(
      isDegradedRun({
        type: "integrity",
        fallback: true,
        sources: 3,
        agentFailures: 0,
      }),
    ).toBe(true);
    expect(
      isDegradedRun({
        type: "integrity",
        fallback: false,
        sources: 0,
        agentFailures: 0,
      }),
    ).toBe(true);
  });
});

describe("integritySummary", () => {
  it("describes evidence weight in one line", () => {
    expect(
      integritySummary({
        type: "integrity",
        fallback: false,
        sources: 1,
        agentFailures: 0,
      }),
    ).toMatch(/1 live source/);
  });
});
