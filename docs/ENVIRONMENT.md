# Environment variables

Copy `.env.example` to `.env.local` and fill in what you have. Only the OpenAI key is required; everything else degrades.

## Required

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | All LLM calls: research extraction, validation agents, synthesis, score repair. The server refuses to start a run without it (HTTP 500). |

## Search providers (optional but recommended)

Without either key, `lib/research/search.ts` falls back to hardcoded mock data that only covers two demo domains (Slack/Teams standup tools and scheduling apps). Any other idea gets an empty dossier — agents still run, but with no live evidence and no source links.

| Variable | Purpose |
| --- | --- |
| `EXA_API_KEY` | Primary provider. Neural/keyword search with page contents. |
| `TAVILY_API_KEY` | Fallback when Exa is unset or returns nothing. |

The cascade is: Exa → Tavily → mock. Provider failures are collected and returned alongside results rather than thrown.

## Page scrape (optional)

After competitor URLs are found, the pricing agent scrapes `/pricing` pages via Firecrawl (JS-rendered markdown). No key is required ([keyless scrape](https://docs.firecrawl.dev/features/scrape)); a key only raises rate limits. Failures are ignored and the agent falls back to search snippets.

| Variable | Purpose |
| --- | --- |
| `FIRECRAWL_API_KEY` | Optional. `Authorization: Bearer` on scrape requests. |
| `FIRECRAWL_DISABLED` | Set to `1` to skip scrape (search snippets only). |

## Model overrides (optional)

| Variable | Default | Used for |
| --- | --- | --- |
| `OPENAI_MODEL` | `gpt-4o` | Validation agents and synthesis — output quality matters most here. |
| `OPENAI_RESEARCH_MODEL` | `gpt-4o-mini` | Dossier extraction agents and dictation cleanup — high volume, structured JSON output. |
| `OPENAI_REPAIR_MODEL` | `gpt-4o-mini` | Second-chance score extraction when an agent's critique lacks a parseable block. |

## Not set via environment

- Rate limit: 5 runs/min/IP, fixed window, in memory (`lib/rateLimit.ts`). Resets on deploy. Change in `app/api/start/route.ts`.
- Score/idea length caps: fields 2,000 chars each, combined idea text 10,000 chars.
- Research cache: 1 hour TTL, 100 entries, keyed by normalized title+description.
