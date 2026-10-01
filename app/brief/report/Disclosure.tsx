"use client";

import { useId, type ReactNode } from "react";

/**
 * A row of the case file. Closed, it states what is on record and how much of
 * it there is; open, it hands over the full section. Nothing here is a card —
 * rows are separated by rules, so the file reads as one document.
 */
export default function Disclosure({
  title,
  meta,
  open,
  onToggle,
  tone,
  children,
}: {
  title: string;
  meta?: string;
  open: boolean;
  onToggle: () => void;
  tone?: "kill" | "pivot" | "ship";
  children: ReactNode;
}) {
  const id = useId();

  return (
    <section className={`file-row${open ? " is-open" : ""}`}>
      <h2 className="file-row-heading">
        <button
          type="button"
          className="file-row-toggle"
          aria-expanded={open}
          aria-controls={id}
          onClick={onToggle}
        >
          <span className="file-row-mark" aria-hidden="true" />
          <span className={`file-row-title${tone ? ` tone-${tone}` : ""}`}>
            {title}
          </span>
          {meta ? <span className="file-row-meta">{meta}</span> : null}
        </button>
      </h2>

      <div id={id} className="file-row-panel" role="region" hidden={!open}>
        <div className="file-row-inner">{children}</div>
      </div>
    </section>
  );
}
