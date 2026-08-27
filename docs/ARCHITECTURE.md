# Architecture

A single Next.js 14 app running on the App Router. One API route does everything; a client page consumes it via SSE and builds the report from incoming events.

## Pipeline overview

```
┌─────────────────────────────────────────────────────────────┐
│  POST /api/start                                            │
│                                                             │
│  1. Rate limit (per-IP fixed window, lazy sweep)            │
│  2. Validate title + description (400 if missing)           │
│  3. Sanitize fields to [\w\s.,!?;:'"()-] + length caps     │
│                                                             │
│  ┌───────────────────────────────────────┐                  │
│  │  Act 1: Research                      │                  │
│  │                                       │                  │
│  │  Search: Exa → Tavily → mock          │                  │
│  │  (15s timeout per query)              │                  │
│  │                                       │                  │
│  │  Phase 1 (parallel):                  │                  │
│  │    competitors ──┐                    │                  │
│  │    gaps         ──┤── 3 agents        │                  │
│  │    distribution ──┘   running at      │                  │
│  │                       once            │                  │
│  │  Phase 2 (after competitors done):    │                  │
│  │    pricing ─────┐                     │                  │
│  │    funding ─────┘── 2 agents          │                  │
│  │  Phase 3 (parallel):                  │                  │
│  │    positioning ──┐                    │                  │
│  │    launch ───────┘── 2 agents         │                  │
│  │                                       │                  │
│  │  Sources collected per-section,       │                  │
│  │  cached for 1 hour (max 100 reports)  │                  │
│  └───────────────────────────────────────┘                  │
│                                                             │
│  ┌───────────────────────────────────────┐                  │
│  │  Act 2: The Room                      │                  │
│  │                                       │                  │
│  │  7 agents run in PARALLEL:            │                  │
│  │    vc, engineer, indiehacker,         │                  │
│  │    pm, ux, user, devil                │                  │
│  │                                       │                  │
│  │  Each sees: ideaText + dossier        │                  │
│  │  (ideaText capped at 10k chars,       │                  │
│  │   dossier at 7k chars)                │                  │
│  │                                       │                  │
│  │  Score repair: if parse fails,        │                  │
│  │  cheap-model re-extracts the block    │                  │
│  │                                       │                  │
│  │  Synthesis (runs last):               │                  │
│  │    consensus, tension, kill-shot,     │                  │
│  │    verdict, kill criteria, next move  │                  │
│  └───────────────────────────────────────┘                  │
│                                                             │
│  4. Score repair on individual agents                       │
│  5. Synthesis fallbacks (3 layers)                          │
│  6. Stream events to client                                 │
└─────────────────────────────────────────────────────────────┘
```

## Score parsing: four layers

Layer 1 — parse `<scores>{JSON}</scores>` tag, strip markdown fences and trailing commas.

Layer 2 — scan loose JSON objects in text for any containing a known dimension key.

Layer 3 — if an agent produced output but zero parseable scores, a cheap LLM call re-extracts just the score block.

Layer 4 — if synthesis scores are still unparseable, average across successful agents.

All values are clamped 1–10, numeric strings coerced, null preserved for un-scored dimensions. The full chain lives in `lib/extractScores.ts`.

## Verdict resolution: three tiers

1. `<verdict>` tag in synthesis output.
2. Overall score threshold: ≥7 → SHIP IT, ≥4 → PIVOT, else KILL IT.
3. Keyword scan in synthesis text, checking "KILL IT" first (most destructive first, so "this is not a KILL IT" correctly resolves to KILL IT).

`lib/extractVerdict.ts`

## Graceful degradation

The pipeline is designed so a single agent failure never fails the run:

- Search provider timeout → fall back to next provider.
- All search providers fail → empty dossier, agents run on idea text only.
- Individual extraction agent fails → null for that section, downstream agents still run.
- Validation agent fails → `error: true` on its result, synthesis proceeds with remaining agents.
- Synthesis fails completely → fallback message with scores averaged from agents and verdict derived from overall.

The only thing that aborts a run: all seven validation agents fail, or client disconnect.

## Why the prompts are the product

The prompts in `lib/agents/` are guarded by contract tests (`tests/agentPrompts.test.ts`). These tests enforce:

- Every agent carries SPECIFICITY_RULES (except devil, which has its own terse version).
- Every agent carries SCORE_CALIBRATION ("most ideas land 3-6").
- Every agent's `<scores>` example block declares only known dimensions.
- The synthesizer requires kill criteria, preserves tension, and demands verdict+score consistency.

Removing or softening these constraints will cause tests to fail. This is intentional — it keeps the scoring harsh and the critique specific.
