# Testing

## Running the suite

```bash
npm run test          # single run
npm run test:watch    # watch mode
npm run test:coverage # with coverage report
npm run typecheck     # tsc --noEmit
npm run lint          # next lint
```

## What is covered

8 test files, 67 tests total.

| File | Tests | What it covers |
| --- | --- | --- |
| `extractScores.test.ts` | 14 | Score tag parsing, markdown fences, trailing commas, numeric strings, clamping, loose-object fallback, stripping. |
| `extractVerdict.test.ts` | 11 | Score thresholds, tag priority over keywords, KILL-first scan order, case normalization, null handling. |
| `historyStorage.test.ts` | 11 | localStorage round-trip, deduping on normalized title+description, max-20 cap, corrupted JSON survival. |
| `agentPrompts.test.ts` | 10 | Every agent declares known dimensions, carries calibration, has a distinct lens, devil is terse. Synthesizer has kill criteria + tension preservation. |
| `reportMarkdown.test.ts` | 6 | Markdown export: title, scores, verdict tag stripping, agent sections, failed-agent markers, live source links. |
| `research.test.ts` | 9 | parseJson: clean JSON, fences, trailing commas, prose extraction, garbage handling. Search cascade: mock fallback for standup and scheduling domains, empty results for unknowns. |
| `rateLimit.test.ts` | 4 | Max requests, blocking beyond limit, independent keys, window expiry. |
| `dossier.test.ts` | 4 | Competitor formatting, sentence separator fix, source URL inclusion, 7k char cap, empty-section omission. |

## What is not covered (and why)

- **LLM output quality.** Prompt contract tests verify the prompts carry the right structure and rules; they do not test what the LLM actually produces. That requires live runs or expensive mocking.
- **Research cache.** Covered indirectly by E2E testing (the probe run hit "cached" status). The cache is a simple Map with a 1-hour TTL; a mocked OpenAI integration test would add overhead disproportionate to the risk.
- **Component rendering.** The frontend is tested only through production build and live E2E runs. No Vitest component tests for page.tsx — jsdom renders of a 1300-line client component are fragile and slow for the value they return.
- **SSE stream parsing.** Tested implicitly by every E2E run. Unit-testing the parser in useBriefRun would require mocking the streaming API, which the existing tests handle via live calls.

## E2E smoke test

`scripts/validate_loop.py` runs a hardcoded payload against a live server:

```bash
# start the dev server first
python3 scripts/validate_loop.py
```

It expects `http://localhost:3000/api/start?format=json` and prints the extracted verdict and scores. Requires a valid OPENAI_API_KEY.

## Node version note

The test suite runs on Node 22+. Node 25 ships an experimental built-in `localStorage` global that shadows jsdom's implementation and lacks standard methods. The test setup (`tests/setup.ts`) detects this and installs a spec-compliant in-memory polyfill so tests pass consistently across Node versions.
