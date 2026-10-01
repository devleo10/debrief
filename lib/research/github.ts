import type { ResearchInput } from "./types";
import { inferFamily, searchTermsFor } from "./quality";

const GITHUB_API = "https://api.github.com";
const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "for",
  "and",
  "or",
  "to",
  "with",
  "that",
  "this",
  "your",
  "from",
  "into",
  "using",
  "auto",
  "automatically",
  "app",
  "tool",
  "platform",
  "saas",
  "startup",
  "idea",
  "ai",
  "powered",
]);

export type RawGitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  open_issues_count: number;
  language: string | null;
  topics?: string[];
  updated_at: string;
  pushed_at?: string;
  license?: { spdx_id: string | null } | null;
};

export type GitHubRepoHit = {
  name: string;
  full_name: string;
  url: string;
  description: string;
  stars: number;
  forks: number;
  watchers: number;
  open_issues: number;
  language: string | null;
  topics: string[];
  license: string | null;
  last_pushed: string;
  popularity_tier: "viral" | "established" | "niche" | "inactive";
  relevance: "High" | "Medium" | "Low";
  overlap: string;
};

export type GitHubLandscape = {
  queries: string[];
  total_matches: number;
  signal: "crowded" | "moderate" | "open";
  summary: string;
  repos: GitHubRepoHit[];
  unavailable?: boolean;
  note?: string;
};

function tokenHeaders(): HeadersInit {
  const token = process.env.GITHUB_TOKEN?.trim();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** Pull meaningful keywords from the idea for GitHub search. */
export function extractGithubKeywords(input: ResearchInput): string {
  const planned = searchTermsFor(input);
  if (planned.length) return planned.slice(0, 6).join(" ");

  const blob = `${input.title} ${input.description}`.toLowerCase();
  const words = blob
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  const unique = [...new Set(words)].slice(0, 6);
  return unique.join(" ") || input.title.slice(0, 80);
}

/**
 * Curated link collections match almost any keyword and are never competitive
 * signal, so they must not count as overlap.
 */
export function isDirectoryRepo(repo: {
  full_name: string;
  description?: string | null;
}): boolean {
  const name = repo.full_name.toLowerCase();
  const desc = (repo.description || "").toLowerCase();
  return (
    /awesome[-_/]|[-_]list$|[-_]lists$|\bdirectory\b|\bcollection\b/.test(name) ||
    /^(a )?(curated|awesome|comprehensive) (list|collection)/.test(desc) ||
    /\bcurated list\b|\bawesome list\b/.test(desc)
  );
}

export function githubQueries(input: ResearchInput): string[] {
  const family = inferFamily(input);
  const kw = extractGithubKeywords(input);

  if (family === "idea_validation") {
    return [
      `${kw} startup validator in:name,description,readme stars:>5`,
      "AI startup idea validator multi-agent in:name,description",
      "founder idea research ship pivot in:name,description,readme",
    ];
  }

  return [
    `${kw} in:name,description,readme stars:>3`,
    `${input.title} in:name,description`,
  ];
}

export function popularityTier(
  stars: number,
  pushedAt?: string,
): GitHubRepoHit["popularity_tier"] {
  const daysSincePush = pushedAt
    ? (Date.now() - new Date(pushedAt).getTime()) / (1000 * 60 * 60 * 24)
    : 999;
  if (daysSincePush > 730 && stars < 20) return "inactive";
  if (stars >= 1000) return "viral";
  if (stars >= 100) return "established";
  if (stars >= 10) return "niche";
  return "inactive";
}

export function crowdSignal(
  repos: Pick<GitHubRepoHit, "stars" | "relevance">[],
): GitHubLandscape["signal"] {
  const relevant = repos.filter((r) => r.relevance !== "Low");
  const viral = relevant.filter((r) => r.stars >= 1000).length;
  const established = relevant.filter((r) => r.stars >= 100).length;
  if (viral >= 2 || established >= 4) return "crowded";
  if (established >= 1 || relevant.filter((r) => r.stars >= 30).length >= 2) {
    return "moderate";
  }
  return "open";
}

export function formatStarCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function dedupeRepos(repos: RawGitHubRepo[]): RawGitHubRepo[] {
  const seen = new Set<number>();
  const out: RawGitHubRepo[] = [];
  for (const r of repos) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out.sort((a, b) => b.stargazers_count - a.stargazers_count);
}

export async function searchGitHubRepos(
  query: string,
  opts?: { perPage?: number; signal?: AbortSignal },
): Promise<{ total: number; repos: RawGitHubRepo[]; error?: string }> {
  const perPage = Math.min(opts?.perPage ?? 8, 15);
  const url = `${GITHUB_API}/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${perPage}`;

  try {
    const res = await fetch(url, {
      headers: tokenHeaders(),
      signal: opts?.signal,
      next: { revalidate: 0 },
    });

    if (res.status === 403) {
      return {
        total: 0,
        repos: [],
        error: "GitHub rate limit — add GITHUB_TOKEN for higher limits",
      };
    }

    if (!res.ok) {
      return { total: 0, repos: [], error: `GitHub search failed (${res.status})` };
    }

    const data = (await res.json()) as {
      total_count?: number;
      items?: RawGitHubRepo[];
    };

    return {
      total: data.total_count ?? 0,
      repos: data.items ?? [],
    };
  } catch (err: any) {
    if (err?.name === "AbortError") throw err;
    return { total: 0, repos: [], error: err?.message || "GitHub search failed" };
  }
}

export async function fetchGithubLandscape(
  input: ResearchInput,
  signal?: AbortSignal,
): Promise<{ repos: RawGitHubRepo[]; queries: string[]; total: number; error?: string }> {
  const queries = githubQueries(input);
  const batches = await Promise.all(
    queries.map((q) => searchGitHubRepos(q, { perPage: 6, signal })),
  );

  const error = batches.find((b) => b.error)?.error;
  const repos = dedupeRepos(batches.flatMap((b) => b.repos)).slice(0, 12);
  const total = Math.max(...batches.map((b) => b.total), 0);

  return { repos, queries, total, error };
}

export function mergeGithubAnalysis(
  raw: RawGitHubRepo[],
  analysis: {
    repos?: { full_name: string; relevance: string; overlap: string }[];
    summary?: string;
    signal?: string;
  } | null,
  fallbackTotal: number,
  queries: string[],
): GitHubLandscape {
  const allowed = new Map(raw.map((r) => [r.full_name, r]));
  const byName = new Map(
    (analysis?.repos || [])
      .filter((r) => allowed.has(r.full_name))
      .map((r) => [r.full_name, r]),
  );

  const repos: GitHubRepoHit[] = raw.map((r) => {
    const judged = byName.get(r.full_name);
    // An unjudged repo is an unproven one. Defaulting to Medium promoted six
    // awesome-lists into a "differentiation gap" the founder never had.
    const relevance = isDirectoryRepo(r)
      ? "Low"
      : judged?.relevance === "High" ||
          judged?.relevance === "Medium" ||
          judged?.relevance === "Low"
        ? judged.relevance
        : "Low";
    return {
      name: r.name,
      full_name: r.full_name,
      url: r.html_url,
      description: r.description || "No description",
      stars: r.stargazers_count,
      forks: r.forks_count,
      watchers: r.watchers_count,
      open_issues: r.open_issues_count,
      language: r.language,
      topics: r.topics || [],
      license: r.license?.spdx_id || null,
      last_pushed: r.pushed_at || r.updated_at,
      popularity_tier: popularityTier(r.stargazers_count, r.pushed_at || r.updated_at),
      relevance,
      overlap: judged?.overlap || "Keyword match only — no judged overlap.",
    };
  });

  const signal =
    analysis?.signal === "crowded" ||
    analysis?.signal === "moderate" ||
    analysis?.signal === "open"
      ? analysis.signal
      : crowdSignal(repos);

  // Only judged-relevant repos are shown; keyword noise stays out of the report.
  const relevant = repos.filter((r) => r.relevance !== "Low");

  // Absence of OSS overlap is weak evidence either way. Say that, rather than
  // letting "Few OSS players" read as an opportunity.
  const summary =
    relevant.length < 2
      ? "No credible open-source equivalents surfaced. That is weak evidence either way — it says little about demand, and a thin OSS field is not a moat."
      : analysis?.summary ||
        `Found ${relevant.length} related repos on GitHub (${formatStarCount(relevant[0]?.stars || 0)} top stars).`;

  return {
    queries,
    total_matches: fallbackTotal,
    signal,
    summary,
    repos: relevant,
  };
}
