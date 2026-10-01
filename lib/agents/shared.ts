// Shared prompt fragments so all agents follow the same calibration,
// anti-generic rules, and score contract. The prompts are the product.

export const DOSSIER_GITHUB_RULE = `- When the user message includes a "MANDATORY GITHUB CHECK" or "GitHub landscape" section from the live research dossier, you MUST cite it: name at least one repo by full_name (owner/repo), its star count, and what it implies for this idea (clone risk, crowded signal, fork/contribute vs compete, or a differentiation gap). Ignoring GitHub evidence when it is present is forbidden.`;

export const SPECIFICITY_RULES = `Hard rules:
- Treat the live research dossier in the user message as ground truth for competitors, pricing, and GitHub overlap — prefer it over training-memory guesses.
- Every claim must be specific to THIS idea. Generic startup advice ("validate with users", "execution matters", "marketing is key") is forbidden.
- Name the user's CURRENT SUBSTITUTE: the exact tool, workflow, or habit they use today instead of this product.
- Name at least one real product, company, or precedent relevant to this idea. If you are not confident a product exists, describe the closest real category leader instead of inventing names.
${DOSSIER_GITHUB_RULE}
- If the product is just a generic AI wrapper with no clear buyer, workflow, moat, or distribution advantage, say that plainly and score it lower. Do not reward vague "AI + X" positioning.
- The differentiator must be concrete: a specific buyer, a real workflow, a real data source, or a real distribution edge. "It uses AI" is not a differentiator.
- Raise at least one objection that could ONLY apply to this specific idea, not to startups in general.
- If the idea is too vague to evaluate on some point, say exactly which detail is missing instead of guessing.
- Keep the critique under 250 words. Short, dense, and concrete beats long and padded.`;

export const SCORE_CALIBRATION = `Score calibration (be strict, most ideas land 3-6):
- 1-2: fundamentally broken on this dimension
- 3-4: serious unresolved problems
- 5-6: plausible but unproven, real risks remain
- 7-8: genuinely strong with evidence or clear logic
- 9-10: exceptional, almost never warranted
Score only the dimensions listed in your format; use null for everything else. Never give a score you did not justify in your critique.`;

export function scoreBlockInstruction(dimensions: string[]): string {
  const example = dimensions.map(d => `  "${d}": YOUR_SCORE`).join(",\n");
  return `After your critique, end your reply with EXACTLY one score block in this format (raw JSON between the tags, no markdown fences, no trailing commas, integers 1-10 or null — YOUR ACTUAL scores, not placeholders):
<scores>
{
${example},
  "overall": YOUR_SCORE
}
</scores>`;
}
