export type ScrapedPage = {
  url: string;
  markdown: string;
};

const SCRAPE_URL = "https://api.firecrawl.dev/v2/scrape";
const SCRAPE_TIMEOUT_MS = 25_000;
const MAX_PAGES = 5;
const MAX_MARKDOWN_CHARS = 8_000;
const CONCURRENCY = 3;

const SKIP_HOSTS = [
  "twitter.com",
  "x.com",
  "facebook.com",
  "instagram.com",
  "tiktok.com",
  "youtube.com",
  "youtu.be",
  "linkedin.com",
  "reddit.com",
  "medium.com",
  "wikipedia.org",
  "crunchbase.com",
  "producthunt.com",
];

export function firecrawlEnabled(): boolean {
  if (process.env.FIRECRAWL_DISABLED === "1") return false;
  if (process.env.VITEST === "true") return false;
  return true;
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function shouldSkip(url: string): boolean {
  const host = hostnameOf(url)?.replace(/^www\./, "").toLowerCase();
  if (!host) return true;
  return SKIP_HOSTS.some((s) => host === s || host.endsWith(`.${s}`));
}

function pricingUrlFromSite(url: string): string | null {
  const origin = originOf(url);
  if (!origin || shouldSkip(url)) return null;
  try {
    const parsed = new URL(url);
    if (/\/(pricing|plans|price)(\/|$)/i.test(parsed.pathname)) {
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return `${origin}/pricing`;
}

/** Competitor homepages + search hits that already look like pricing pages. */
export function pricingPageUrls(
  competitors: { url?: string }[],
  searchResults: { url?: string }[],
  limit = MAX_PAGES,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const push = (url: string | null) => {
    if (!url || seen.has(url) || out.length >= limit) return;
    seen.add(url);
    out.push(url);
  };

  for (const r of searchResults) {
    if (!r.url) continue;
    try {
      const path = new URL(r.url).pathname;
      if (/\/(pricing|plans|price)(\/|$)/i.test(path) && !shouldSkip(r.url)) {
        push(r.url);
      }
    } catch {
      /* ignore */
    }
  }

  for (const c of competitors) {
    if (c.url) push(pricingUrlFromSite(c.url));
  }

  return out;
}

function markdownFromBody(body: any): string {
  const direct =
    body?.data?.markdown ||
    body?.markdown ||
    body?.data?.content ||
    "";
  return typeof direct === "string" ? direct : "";
}

export async function scrapeUrl(
  url: string,
  signal?: AbortSignal,
): Promise<ScrapedPage | null> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const key = process.env.FIRECRAWL_API_KEY?.trim();
  if (key) headers.Authorization = `Bearer ${key}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);

  try {
    const res = await fetch(SCRAPE_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
      signal: controller.signal,
    });
    if (res.status === 429) return null;
    if (!res.ok) return null;
    const body = await res.json();
    const markdown = markdownFromBody(body).trim();
    if (!markdown) return null;
    return { url, markdown: markdown.slice(0, MAX_MARKDOWN_CHARS) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

export async function scrapePricingPages(
  urls: string[],
  signal?: AbortSignal,
): Promise<ScrapedPage[]> {
  if (!firecrawlEnabled() || urls.length === 0) return [];
  const pages = await mapPool(urls, CONCURRENCY, (url) =>
    scrapeUrl(url, signal),
  );
  return pages.filter((p): p is ScrapedPage => p !== null);
}
