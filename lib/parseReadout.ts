export const READOUT_LABELS = [
  "CONSENSUS",
  "TENSION",
  "DIFFERENTIATION & CREDIBILITY",
  "KILL SHOT REVIEW",
  "VERDICT",
  "NEXT MOVE",
  "KILL CRITERIA",
] as const;

export type ReadoutLabel = (typeof READOUT_LABELS)[number];

export type ReadoutSection = {
  label: ReadoutLabel;
  body: string;
};

const LABEL_ALIASES: Record<string, ReadoutLabel> = {
  CONSENSUS: "CONSENSUS",
  TENSION: "TENSION",
  DIFFERENTIATION: "DIFFERENTIATION & CREDIBILITY",
  "DIFFERENTIATION & CREDIBILITY": "DIFFERENTIATION & CREDIBILITY",
  "DIFFERENTIATION AND CREDIBILITY": "DIFFERENTIATION & CREDIBILITY",
  "KILL SHOT": "KILL SHOT REVIEW",
  "KILL SHOT REVIEW": "KILL SHOT REVIEW",
  VERDICT: "VERDICT",
  "NEXT MOVE": "NEXT MOVE",
  "KILL CRITERIA": "KILL CRITERIA",
  "KILL CRITERION": "KILL CRITERIA",
};

const HEADER_RE =
  /(?:^|\n)[ \t]*(?:#{1,3}[ \t]*)?(?:\d+\.[ \t]*)?\*{0,2}(CONSENSUS|TENSION|DIFFERENTIATION(?:[ \t]*(?:&|AND)[ \t]*CREDIBILITY)?|KILL SHOT(?:[ \t]+REVIEW)?|VERDICT|NEXT MOVE|KILL CRITERIA?)\*{0,2}[ \t]*[—–:-]?[ \t]*/gi;

function canonLabel(raw: string): ReadoutLabel | null {
  const key = raw.replace(/\s+/g, " ").trim().toUpperCase();
  return LABEL_ALIASES[key] ?? null;
}

/** Split synthesizer output into labeled sections. Empty if no labels found. */
export function parseReadout(text: string): ReadoutSection[] {
  if (!text.trim()) return [];

  const matches = [...text.matchAll(HEADER_RE)];
  if (matches.length === 0) return [];

  const sections: ReadoutSection[] = [];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const label = canonLabel(match[1] || "");
    if (!label) continue;
    const start = (match.index ?? 0) + match[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
    const body = text.slice(start, end).trim();
    const existing = sections.find((s) => s.label === label);
    if (existing) {
      existing.body = [existing.body, body].filter(Boolean).join("\n\n");
    } else {
      sections.push({ label, body });
    }
  }
  return sections.filter((s) => s.body);
}

export function readoutSection(
  sections: ReadoutSection[],
  label: ReadoutLabel,
): string {
  return sections.find((s) => s.label === label)?.body ?? "";
}

/** Break a blob into short readable paragraphs. */
export function splitParagraphs(text: string, maxChars = 200): string[] {
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.replace(/\n+/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const out: string[] = [];
  for (const block of blocks) {
    if (block.length <= maxChars) {
      out.push(block);
      continue;
    }
    const sentences = block.split(/(?<=\.)\s+(?=[A-Z])/);
    let buf = "";
    for (const sentence of sentences) {
      if (!buf) {
        buf = sentence;
      } else if (`${buf} ${sentence}`.length <= maxChars) {
        buf = `${buf} ${sentence}`;
      } else {
        out.push(buf);
        buf = sentence;
      }
    }
    if (buf) out.push(buf);
  }
  return out;
}

/** Indented list markers survive a naive `^[-*]` strip, so trim before matching. */
function stripListMarker(line: string): string {
  let out = line.trim();
  for (let prev = ""; out !== prev; ) {
    prev = out;
    out = out
      .replace(/^[-*•–—]+\s*/, "")
      .replace(/^\d+[.)]\s*/, "")
      .trim();
  }
  return out;
}

/** A criterion names a trigger and something checkable, not a summary sentence. */
function isCriterion(line: string): boolean {
  return /\bif\b/i.test(line) && /\bstop\b|\d/.test(line);
}

export function splitCriteria(text: string): string[] {
  const lines = text.split(/\n+/).map(stripListMarker).filter(Boolean);
  const items =
    lines.length >= 2
      ? lines
      : text.split(/(?=If\s)/i).map(stripListMarker).filter(Boolean);

  // The synthesizer sometimes runs past the section and appends a score recap.
  const criteria = items.filter(isCriterion);
  return (criteria.length ? criteria : items).slice(0, 3);
}

export function previewLine(text: string, maxChars = 140): string {
  const first = splitParagraphs(text)[0] || text.replace(/\s+/g, " ").trim();
  if (first.length <= maxChars) return first;
  return `${first.slice(0, maxChars).replace(/\s+\S*$/, "")}…`;
}
