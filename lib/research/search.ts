import { mockSearchAllowed } from "@/lib/searchConfig";

export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  score?: number;
};

export type SearchOptions = {
  query: string;
  numResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  type?: "neural" | "keyword" | "auto";
};

const SEARCH_TIMEOUT_MS = 15_000;

// Read lazily so serverless environments and tests can control providers at runtime.
function exaKey(): string | undefined {
  return process.env.EXA_API_KEY;
}
function tavilyKey(): string | undefined {
  return process.env.TAVILY_API_KEY;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = SEARCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// --- Exa.ai ---

async function searchExa(opts: SearchOptions): Promise<SearchResult[]> {
  const apiKey = exaKey();
  if (!apiKey) return [];

  let res: Response;
  try {
    res = await fetchWithTimeout("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        query: opts.query,
        numResults: opts.numResults || 5,
        type: opts.type || "auto",
        includeDomains: opts.includeDomains,
        excludeDomains: opts.excludeDomains,
        contents: { text: { maxCharacters: 2000 } },
      }),
    });
  } catch (err: any) {
    throw new Error(`exa: ${err?.message || "request failed"}`);
  }

  if (!res.ok) throw new Error(`exa: HTTP ${res.status}`);

  const data = await res.json();
  return (data.results || []).map((r: any) => ({
    title: r.title || "",
    url: r.url || "",
    snippet: r.text?.slice(0, 500) || "",
    score: r.score,
  }));
}

// --- Tavily ---

async function searchTavily(opts: SearchOptions): Promise<SearchResult[]> {
  const apiKey = tavilyKey();
  if (!apiKey) return [];

  let res: Response;
  try {
    res = await fetchWithTimeout("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: opts.query,
        max_results: opts.numResults || 5,
        search_depth: "advanced",
        include_answer: false,
      }),
    });
  } catch (err: any) {
    throw new Error(`tavily: ${err?.message || "request failed"}`);
  }

  if (!res.ok) throw new Error(`tavily: HTTP ${res.status}`);

  const data = await res.json();
  return (data.results || []).map((r: any) => ({
    title: r.title || "",
    url: r.url || "",
    snippet: r.content?.slice(0, 500) || "",
    score: r.score,
  }));
}

// --- Mock (demo mode) ---

function mockSearch(opts: SearchOptions): SearchResult[] {
  const q = opts.query.toLowerCase();
  const isTeamUpdates =
    /(slack|teams|microsoft teams|chat|standup|status|progress|updates|async)/i.test(
      q,
    );
  const isScheduling =
    /(calendar|schedul|meeting booking|appointment|calendly|motion|reclaim)/i.test(
      q,
    );

  if (
    isTeamUpdates &&
    (q.includes("competitor") ||
      q.includes("alternative") ||
      q.includes("comparison"))
  ) {
    return [
      {
        title: "Geekbot - asynchronous standups in Slack and Microsoft Teams",
        url: "https://geekbot.com",
        snippet:
          "Geekbot runs async standups, surveys, and recurring check-ins inside Slack and Microsoft Teams for managers who need structured team updates.",
      },
      {
        title: "Standuply - Slack standup bot",
        url: "https://standuply.com",
        snippet:
          "Standuply automates standup meetings, retrospectives, polls, and team reports in Slack and Microsoft Teams.",
      },
      {
        title: "Range - team check-ins and status updates",
        url: "https://www.range.co",
        snippet:
          "Range helps teams share check-ins, goals, and status updates, with integrations for Slack and other workplace tools.",
      },
    ];
  }

  if (isTeamUpdates && q.includes("pricing")) {
    return [
      {
        title: "Geekbot Pricing",
        url: "https://geekbot.com/pricing",
        snippet:
          "Geekbot offers a free plan and paid per-user team plans for Slack and Microsoft Teams async standups.",
      },
      {
        title: "Standuply Pricing",
        url: "https://standuply.com/pricing",
        snippet:
          "Standuply pricing is based on team usage and includes Slack and Microsoft Teams reporting workflows.",
      },
      {
        title: "Range Pricing",
        url: "https://www.range.co/pricing",
        snippet:
          "Range offers team pricing for check-ins, goals, and meeting workflows.",
      },
    ];
  }

  if (
    isTeamUpdates &&
    (q.includes("community") ||
      q.includes("subreddit") ||
      q.includes("discord"))
  ) {
    return [
      {
        title: "r/projectmanagement - Reddit",
        url: "https://www.reddit.com/r/projectmanagement/",
        snippet:
          "Project managers discuss status reporting, stakeholder updates, team communication, and tooling pain points.",
      },
      {
        title: "r/slack - Reddit",
        url: "https://www.reddit.com/r/Slack/",
        snippet:
          "Slack admins and users discuss apps, workflow automation, notifications, and team communication issues.",
      },
      {
        title: "Microsoft Teams Community",
        url: "https://techcommunity.microsoft.com/category/microsoftteams",
        snippet:
          "Microsoft Teams users and admins discuss app integrations, workflows, reporting, and collaboration problems.",
      },
    ];
  }

  if (
    isTeamUpdates &&
    (q.includes("pain point") ||
      q.includes("complaint") ||
      q.includes("frustrat"))
  ) {
    return [
      {
        title: "Slack workflow and notification complaints",
        url: "https://www.reddit.com/r/Slack/",
        snippet:
          "Users discuss missed updates, noisy channels, notification overload, and difficulty extracting decisions from chat history.",
      },
      {
        title: "Project management status reporting discussions",
        url: "https://www.reddit.com/r/projectmanagement/",
        snippet:
          "Managers describe manual status chasing, unclear ownership, and the burden of turning team messages into reliable reports.",
      },
    ];
  }

  if (
    isTeamUpdates &&
    (q.includes("funding") ||
      q.includes("market size") ||
      q.includes("raised") ||
      q.includes("growth"))
  ) {
    return [
      {
        title: "Workplace collaboration software market",
        url: "https://www.grandviewresearch.com/industry-analysis/team-collaboration-software-market",
        snippet:
          "Team collaboration software includes workplace messaging, project collaboration, and communication workflows.",
      },
      {
        title: "Slack Fund and workplace app ecosystem",
        url: "https://slack.com/fund",
        snippet:
          "Slack has supported apps built on workplace collaboration and workflow automation use cases.",
      },
    ];
  }

  if (isScheduling && (q.includes("competitor") || q.includes("alternative"))) {
    return [
      {
        title: "Calendly - Scheduling Automation",
        url: "https://calendly.com",
        snippet:
          "Calendly is a scheduling automation tool that eliminates the back-and-forth emails. Pricing starts at $10/user/mo. Founded 2013, raised $55M Series B.",
      },
      {
        title: "Motion - AI Calendar",
        url: "https://usemotion.com",
        snippet:
          "Motion uses AI to auto-schedule tasks and meetings. $19/user/mo. Raised $30M Series B in 2024. 10,000+ teams.",
      },
      {
        title: "Reclaim.ai - Smart Scheduling",
        url: "https://reclaim.ai",
        snippet:
          "AI-powered scheduling for teams. Free tier available, Pro at $10/user/mo. Raised $17M Series A.",
      },
    ];
  }

  if (isScheduling && q.includes("pricing")) {
    return [
      {
        title: "Calendly Pricing",
        url: "https://calendly.com/pricing",
        snippet:
          "Free: 1 event type. Standard: $12/user/mo unlimited events. Teams: $20/user/mo admin features. Enterprise: custom.",
      },
      {
        title: "Motion Pricing",
        url: "https://usemotion.com/pricing",
        snippet:
          "Individual: $19/mo. Team: $12/user/mo. Enterprise: custom. 7-day free trial.",
      },
    ];
  }

  if (
    isScheduling &&
    (q.includes("funding") || q.includes("raised") || q.includes("crunchbase"))
  ) {
    return [
      {
        title: "Calendly Funding - Crunchbase",
        url: "https://crunchbase.com/organization/calendly",
        snippet:
          "Calendly has raised $55M in total funding. Series B led by OpenView Partners in 2021. Valued at $3B.",
      },
      {
        title: "Motion Funding",
        url: "https://crunchbase.com/organization/motion-app",
        snippet:
          "Motion raised $30M Series B in March 2024. Total funding: $42M. Investors include Bessemer Venture Partners.",
      },
    ];
  }

  if (
    isScheduling &&
    (q.includes("pain point") ||
      q.includes("complaint") ||
      q.includes("frustrat"))
  ) {
    return [
      {
        title: "Calendly Reviews - G2",
        url: "https://g2.com/products/calendly/reviews",
        snippet:
          "Common complaints: limited free tier, no AI features, expensive for teams, poor customer support for small accounts.",
      },
      {
        title: "r/freelance - Scheduling tools suck",
        url: "https://reddit.com/r/freelance",
        snippet:
          "Freelancers complain about juggling multiple client calendars, no tool that reads email context, manual scheduling takes 5+ hours/week.",
      },
    ];
  }

  if (
    isScheduling &&
    (q.includes("community") ||
      q.includes("subreddit") ||
      q.includes("discord"))
  ) {
    return [
      {
        title: "r/freelance - Reddit",
        url: "https://reddit.com/r/freelance",
        snippet:
          "500K+ members. Active community discussing freelance tools, client management, and productivity.",
      },
      {
        title: "Designer Hangout - Slack",
        url: "https://designerhangout.co",
        snippet:
          "15K+ freelance designers. Active Slack community for design tools and workflow discussions.",
      },
    ];
  }

  return [];
}

// --- Unified search ---

export async function searchWithSource(opts: SearchOptions): Promise<{
  results: SearchResult[];
  source: "exa" | "tavily" | "mock";
  errors: string[];
}> {
  const errors: string[] = [];

  try {
    const results = await searchExa(opts);
    if (results.length > 0) return { results, source: "exa", errors };
  } catch (err: any) {
    errors.push(err?.message || "exa failed");
  }

  try {
    const results = await searchTavily(opts);
    if (results.length > 0) return { results, source: "tavily", errors };
  } catch (err: any) {
    errors.push(err?.message || "tavily failed");
  }

  if (!mockSearchAllowed()) {
    return {
      results: [],
      source: "mock",
      errors: [...errors, "mock search disabled in production"],
    };
  }

  return { results: mockSearch(opts), source: "mock", errors };
}

export async function search(opts: SearchOptions): Promise<SearchResult[]> {
  const { results } = await searchWithSource(opts);
  return results;
}
