import { describe, expect, it } from "vitest";
import { buildReportMarkdown } from "@/lib/reportMarkdown";
import { emptyScores } from "@/lib/extractScores";
import type { AgentResult } from "@/lib/types";

const agent = (name: string, output: string): AgentResult => ({
  agent: name,
  output,
  scores: { ...emptyScores(), market: 5 },
});

describe("buildReportMarkdown", () => {
  it("renders title, description, verdict, and scores", () => {
    const md = buildReportMarkdown({
      title: "Test idea",
      description: "A test.",
      date: "2026-08-26",
      verdict: "PIVOT",
      scores: { ...emptyScores(), overall: 5 },
    });
    expect(md).toContain("# Debrief — Test idea");
    expect(md).toContain("**PIVOT**");
    expect(md).toContain("- overall: 5/10");
    expect(md).toContain("_Validated 2026-08-26_");
  });

  it("strips machine tags from agent and synthesis output", () => {
    const md = buildReportMarkdown({
      title: "T",
      description: "D",
      synthesis: {
        output: "readout body\n<verdict>KILL IT</verdict>\n<scores>{\"overall\":2}</scores>",
        scores: emptyScores(),
      },
      agents: [
        agent("vc", "critique body <scores>{\"market\":4}</scores>"),
      ],
    });
    expect(md).not.toContain("<verdict>");
    expect(md).not.toContain("<scores>");
    expect(md).toContain("readout body");
    expect(md).toContain("critique body");
    expect(md).toContain("## Agent: vc");
  });

  it("marks failed agents", () => {
    const failed = { ...agent("ux", "nope"), error: true };
    const md = buildReportMarkdown({ title: "T", description: "D", agents: [failed] });
    expect(md).toContain("## Agent: ux (failed this run)");
  });

  it("includes live source links when research is present", () => {
    const md = buildReportMarkdown({
      title: "T",
      description: "D",
      research: {
        sources: [{ section: "competitors", title: "Geekbot", url: "https://geekbot.com" }],
        competitors: [],
        pricing: null as never,
        funding: null as never,
        gaps: null as never,
        distribution: null as never,
        positioning: null as never,
        launch: null as never,
      },
    });
    expect(md).toContain("[Geekbot](https://geekbot.com)");
    expect(md).toContain("_(competitors)_");
  });

  it("omits sections that have no data", () => {
    const md = buildReportMarkdown({ title: "T", description: "D" });
    expect(md).not.toContain("## Verdict");
    expect(md).not.toContain("## Live Sources");
    expect(md).not.toContain("## The Room's Readout");
  });
});
