export type RunIntegrity = {
  type: "integrity";
  fallback: boolean;
  /** Sources a dossier claim actually leans on. */
  sources: number;
  agentFailures: number;
  /** Pages fetched, including those no claim used. */
  fetched?: number;
  /** Results dropped as off-topic before any agent saw them. */
  discarded?: number;
  /** Overall-score spread across critics: a near-flat room is a weak signal. */
  agreement?: "split" | "unanimous";
};

export function isDegradedRun(integrity: RunIntegrity): boolean {
  return (
    integrity.fallback ||
    integrity.sources === 0 ||
    integrity.agentFailures > 0
  );
}

/** Do not stamp SHIP IT when the dossier has no live sources. */
export function maybeDowngradeShip(output: string, sources: number): string {
  if (sources > 0) return output;
  return output.replace(
    /<verdict>\s*SHIP IT\s*<\/verdict>/i,
    "<verdict>PIVOT</verdict>",
  );
}

/**
 * A room where every critic landed within one point did not disagree, which is
 * a weak signal (TheBoardroom's rule). Needs at least two scored critics.
 */
export function scoreAgreement(overalls: number[]): "split" | "unanimous" {
  if (overalls.length < 2) return "split";
  const spread = Math.max(...overalls) - Math.min(...overalls);
  return spread <= 1 ? "unanimous" : "split";
}

export function integritySummary(integrity: RunIntegrity): string {
  const bits = [
    `${integrity.sources} cited source${integrity.sources === 1 ? "" : "s"}${
      integrity.fetched && integrity.fetched > integrity.sources
        ? ` of ${integrity.fetched} fetched`
        : ""
    }`,
    integrity.discarded
      ? `${integrity.discarded} dropped as off-topic`
      : null,
    integrity.agentFailures > 0
      ? `${integrity.agentFailures} agent${integrity.agentFailures === 1 ? "" : "s"} failed`
      : "all agents responded",
    integrity.agreement === "unanimous"
      ? "the room failed to disagree"
      : null,
    integrity.fallback ? "synthesis averaged from agents" : "synthesizer wrote the readout",
  ];
  return bits.filter(Boolean).join(", ");
}
