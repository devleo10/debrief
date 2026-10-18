import type { AgentResult } from "@/lib/types";
import { stripStructuredBlocks } from "@/lib/extractScores";
import { previewLine } from "@/lib/parseReadout";

/** Plain labels so this module stays server-safe (no React icons). */
export const CLASH_LABELS: Record<string, string> = {
  vc: "VC Investor",
  engineer: "Senior Engineer",
  indiehacker: "Indie Hacker",
  pm: "Product Manager",
  ux: "UX Designer",
  user: "Skeptical User",
  devil: "Devil's Advocate",
};

function labelOf(agent: string): string {
  return CLASH_LABELS[agent] || agent;
}

/**
 * The cross-examination pass. Each critic reacts to the other critics' claims
 * before the synthesizer writes the readout, so tension comes from an actual
 * exchange instead of being invented by the synthesizer.
 */
export function clashSystemPrompt(agent: string): string {
  return `You are the ${labelOf(agent)} in a startup review panel. You already wrote your own critique. Now you read what the other experts argued.

Cross-examination rules:
- Name the single claim from another expert you reject, and say why in one line.
- State whether that expert moved your view, and if so, how.
- If you do not disagree with anyone, say so plainly. Manufactured disagreement is worse than agreement.
- Reply in under 120 words. Plain prose only: no section headings, no <scores> block, no verdict tag.`;
}

/** One line per other critic: who they are, their overall score, their sharpest claim. */
export function buildClashDigest(result: AgentResult): string {
  const overall = result.scores?.overall;
  const claim = previewLine(stripStructuredBlocks(result.output), 220);
  const score = overall == null ? "unscored" : `overall ${overall}`;
  return `- ${labelOf(result.agent)} (${score}): ${claim || "no usable critique"}`;
}

export function buildClashUserMessage(
  own: AgentResult,
  others: AgentResult[],
): string {
  const ownText = stripStructuredBlocks(own.output).slice(0, 1_500);
  const digest = others
    .filter((r) => r.agent !== own.agent && !r.error)
    .map(buildClashDigest)
    .join("\n");

  return [
    `Your critique as the ${labelOf(own.agent)}:`,
    ownText,
    "",
    "Cross-examination — what the other experts argued:",
    digest || "(no other expert produced a usable critique)",
    "",
    "Reply in under 120 words. Name the claim you reject (and why), say whether it moved your score, and admit agreement if there is none to contest.",
  ].join("\n");
}
