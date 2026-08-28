# Debrief — researched idea briefing

Paste a startup idea. Seven experts with different failure lenses tear into it against a live research dossier, and a synthesizer forces the disagreement into one verdict: `SHIP IT`, `PIVOT`, or `KILL IT`.

It is not a motivational idea generator. Most ideas score 3–6 out of 10, and that is by design — a low score with specific reasons is the tool working, not failing.

Production requires live search (`EXA_API_KEY` or `TAVILY_API_KEY`) and, on Vercel, Upstash Redis for rate limits. Local `npm run dev` still runs on OpenAI alone (mock search for two demo domains).

## What you get

For every idea submitted at `/brief`, the app runs two acts:

1. **Act 1 — Dossier.** Live web search (Exa or Tavily) finds competitors; Firecrawl scrapes their pricing pages into markdown (keyless by default). Seven extraction agents map competitors, pricing tiers, funding, market gaps, distribution channels, positioning, and a launch plan. Every claim traces to source URLs shown in the report.
2. **Act 2 — The room.** A VC, senior engineer, indie hacker, PM, UX designer, skeptical user, and devil's advocate each critique the idea independently using that dossier as shared evidence. A synthesizer then writes the final readout: consensus, genuine tension, kill-shot review, verdict, next move, and measurable kill criteria with deadlines.

## Quick start

Requirements: Node 20+, an OpenAI API key. Search keys are optional but strongly recommended — without one, competitor research only works for two built-in demo domains.

```bash
npm install

# minimal config
echo "OPENAI_API_KEY=sk-..." > .env.local

npm run dev
# open http://localhost:3000/brief
```

Optional but recommended for real research on any idea:

```bash
EXA_API_KEY=...      # preferred search provider (required in production)
TAVILY_API_KEY=...   # fallback if Exa is unset or fails
UPSTASH_REDIS_REST_URL=...   # required on Vercel (rate limit + cache)
UPSTASH_REDIS_REST_TOKEN=...
FIRECRAWL_API_KEY=...        # optional; pricing-page scrape
NEXT_PUBLIC_SUPPORT_EMAIL=you@example.com
```

See [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) for every variable, including model overrides.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server at `localhost:3000` |
| `npm run build` / `npm start` | Production build and serve |
| `npm run test` | Vitest suite (67 tests) |
| `npm run test:watch` | Watch mode |
| `npm run test:coverage` | Coverage report |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (next/core-web-vitals) |

## Repo layout

```
app/
  page.tsx              Landing page
  brief/                The validator itself (form, streaming console, report)
  api/start/route.ts    Orchestrator: research → 7 agents → synthesis, SSE
components/             Verdict banner, scorecard, agent cards, history panel
lib/
  agents/               The prompts. This is the product; change with care.
  research/             Search cascade, extraction agents, JSON repair, cache
  extractScores.ts      4-layer score parsing with fallbacks
  extractVerdict.ts     Verdict tag → score → keyword resolution
  dossier.ts            Research result → evidence block injected into agents
docs/                   Architecture, API contract, environment, testing
```

## Where to read next

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how a run flows end to end, why it degrades gracefully instead of failing
- [docs/API.md](docs/API.md) — request/response contract and every SSE event
- [docs/TESTING.md](docs/TESTING.md) — what the suite covers and how to smoke-test live
- [plan.md](plan.md) — product principles and scoring philosophy

## Editing the prompts

The agent prompts in `lib/agents/` are guarded by contract tests (`tests/agentPrompts.test.ts`). If you change what dimensions an agent scores or remove the calibration language, those tests will fail — intentionally. Scores are only useful when backed by concrete reasoning, so keep the anti-generic rules intact.
