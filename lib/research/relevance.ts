import type { ResearchInput } from "./types";
import { metaphorTermsFor, searchTermsFor } from "./quality";
import type { SearchResult } from "./search";

/**
 * Pages that are never market evidence. Kept deliberately short: over-blocking
 * costs more than the occasional junk result, because a thin dossier produces a
 * confident report built on four sources.
 */
const JUNK_HOSTS =
  /(^|\.)(youtube\.com|youtu\.be|tiktok\.com|instagram\.com|facebook\.com|pinterest\.[a-z.]+|imdb\.com|etsy\.com|ebay\.com)$/i;

const TOKEN_STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "your", "you",
  "are", "was", "how", "why", "what", "when", "best", "top", "new", "get",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !TOKEN_STOP_WORDS.has(w));
}

/** Prefix match so "freelance" matches "freelancer" and "freelancing". */
function tokensOverlap(a: string, b: string): boolean {
  if (a === b) return true;
  const min = Math.min(a.length, b.length);
  if (min < 4) return false;
  return a.startsWith(b.slice(0, min)) || b.startsWith(a.slice(0, min));
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Fraction of the idea's domain terms that appear in a result, minus a penalty
 * when the result matches only the borrowed metaphor ("tinder") and nothing about
 * the actual market.
 */
export function scoreRelevance(
  result: Pick<SearchResult, "title" | "url" | "snippet">,
  domainTerms: string[],
  metaphorTerms: string[] = [],
): number {
  const haystack = tokenize(
    `${result.title || ""} ${result.snippet || ""} ${hostOf(result.url || "").replace(/[.-]/g, " ")}`,
  );
  if (!haystack.length || !domainTerms.length) return 0;

  const termTokens = [...new Set(domainTerms.flatMap(tokenize))];
  if (!termTokens.length) return 0;

  const matched = termTokens.filter((t) =>
    haystack.some((h) => tokensOverlap(h, t)),
  ).length;
  const score = matched / termTokens.length;

  const metaphorOnly =
    matched === 0 &&
    metaphorTerms.some((m) => haystack.some((h) => tokensOverlap(h, m)));

  return metaphorOnly ? -1 : score;
}

export type RelevanceFilter = {
  kept: SearchResult[];
  dropped: number;
};

/**
 * Drops off-topic search results before they reach any agent or the source list.
 * Bails out and keeps everything when filtering would leave too little evidence —
 * a thin honest run is better than a confident one, but an empty one is useless.
 */
export function filterRelevantResults(
  results: SearchResult[],
  input: ResearchInput,
  opts?: { threshold?: number; minKept?: number },
): RelevanceFilter {
  if (!results.length) return { kept: results, dropped: 0 };

  const threshold = opts?.threshold ?? 0.15;
  const minKept = opts?.minKept ?? 3;
  const domainTerms = searchTermsFor(input);
  const metaphorTerms = metaphorTermsFor(input);

  const kept = results.filter((r) => {
    if (JUNK_HOSTS.test(hostOf(r.url || ""))) return false;
    return scoreRelevance(r, domainTerms, metaphorTerms) >= threshold;
  });

  if (kept.length < minKept && results.length >= minKept) {
    return { kept: results, dropped: 0 };
  }

  return { kept, dropped: results.length - kept.length };
}
