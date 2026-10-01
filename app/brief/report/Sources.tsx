"use client";

import { useState } from "react";
import type { SourceLink } from "@/lib/research/types";
import { isUsableSourceUrl } from "@/lib/safeUrl";

function SourceList({ sources }: { sources: SourceLink[] }) {
  return (
    <ul className="source-list">
      {sources.map((s, i) => (
        <li key={`${s.url}-${i}`} className="source-item">
          <span className="source-section">{s.section}</span>
          {isUsableSourceUrl(s.url) ? (
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              {s.title}
            </a>
          ) : (
            <span>{s.title}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Leads with the pages a dossier claim actually leans on. The rest were fetched
 * during the run and are kept for auditing, not as a trust signal.
 */
export default function Sources({
  sources,
  discarded = 0,
}: {
  sources: SourceLink[];
  discarded?: number;
}) {
  const [showAll, setShowAll] = useState(false);

  if (!sources.length) {
    return (
      <p className="sources-note">No live sources were collected on this run.</p>
    );
  }

  const cited = sources.filter((s) => s.cited);
  const uncited = sources.filter((s) => !s.cited);
  // Before any claim is attributed, everything we have is the best we can show.
  const primary = cited.length ? cited : sources;
  const rest = cited.length ? uncited : [];

  return (
    <>
      <p className="sources-note">
        Every dossier claim traces back to one of these pages. Check them
        yourself.
        {discarded > 0
          ? ` ${discarded} more result${discarded === 1 ? " was" : "s were"} discarded as off-topic before the agents saw them.`
          : ""}
      </p>
      <SourceList sources={primary} />

      {rest.length > 0 && (
        <>
          <button
            type="button"
            className="act sources-toggle"
            onClick={() => setShowAll((v) => !v)}
            aria-expanded={showAll}
          >
            {showAll ? "Hide" : "Show"} {rest.length} other page
            {rest.length === 1 ? "" : "s"} fetched
          </button>
          {showAll && <SourceList sources={rest} />}
        </>
      )}
    </>
  );
}
