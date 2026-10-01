"use client";

import type { Verdict } from "@/lib/extractVerdict";
import type { AgentScores } from "@/lib/types";

const LABELS: Record<string, string> = {
  market: "Market",
  technical: "Technical",
  launch: "Launch",
  ux: "UX",
  retention: "Retention",
};

export function verdictTone(verdict: Verdict): "kill" | "pivot" | "ship" {
  if (verdict === "SHIP IT") return "ship";
  if (verdict === "KILL IT") return "kill";
  return "pivot";
}

/** The hero is the sentence, not the number — the score is a notation on it. */
export default function Ruling({
  verdict,
  scores,
  reason,
  actions,
}: {
  verdict: Verdict;
  scores: AgentScores | null;
  reason: string;
  actions: React.ReactNode;
}) {
  const tone = verdictTone(verdict);
  const dimensions = scores
    ? (Object.entries(scores).filter(
        ([k, v]) => v !== null && k !== "overall",
      ) as [string, number][])
    : [];
  // Marking the weakest dimensions says where the idea actually broke.
  const weakest = dimensions.length
    ? Math.min(...dimensions.map(([, v]) => v))
    : null;

  return (
    <div className={`ruling tone-${tone}`}>
      <p className="ruling-call">
        <span className="ruling-word">{verdict}</span>
        {scores?.overall != null ? (
          <span className="ruling-score">
            {scores.overall}
            <span className="ruling-score-of">/10</span>
          </span>
        ) : null}
      </p>

      {reason ? <p className="ruling-reason">{reason}</p> : null}

      {dimensions.length > 0 && (
        <dl className="ruling-scores">
          {dimensions.map(([key, val]) => (
            <div
              key={key}
              className={`ruling-dim${val === weakest ? " is-weakest" : ""}`}
            >
              <dt>{LABELS[key] || key}</dt>
              <dd>{val}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="ruling-actions">{actions}</div>
    </div>
  );
}
