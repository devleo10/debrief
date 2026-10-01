/**
 * Positioning, gaps and the GitHub read are written before the critique agents
 * argue, and were never revised afterwards. That produced reports asserting a
 * "unique, unserved, high opportunity" directly beneath a KILL IT stamp.
 *
 * Rather than re-running those agents, the report re-presents their output as the
 * case that was tested, and qualifies any claim the verdict went on to reject.
 */

/** True when the verdict rejected or downgraded the idea's own pitch. */
export function verdictContestsPitch(verdict?: string | null): boolean {
  return /kill|pivot/i.test(verdict || "");
}

export function pitchSectionTitle(contested: boolean): string {
  return contested ? "The case we tested" : "Positioning";
}

export function pitchSectionNote(contested: boolean): string | null {
  if (!contested) return null;
  return "Written from the research before the room argued. The verdict below rejected it — read these as the claims under test, not findings.";
}

/**
 * An opportunity the verdict rejected must not read as an endorsement. Returns
 * the label for an opportunity-size badge.
 */
export function opportunityLabel(
  size: string | undefined,
  contested: boolean,
): string {
  const normalized = (size || "").trim();
  if (!normalized) return "";
  if (!contested) return `${normalized} opportunity`;
  return `${normalized} opportunity — contested`;
}
