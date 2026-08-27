# API reference

Single endpoint: `POST /api/start`. It runs the whole pipeline — research, seven validation agents, synthesis — and returns either a JSON body or a stream of Server-Sent Events.

## Request

```json
{
  "title": "Meal-prep subscription for night-shift nurses",
  "description": "Weekly rotating meal kits delivered to hospital parking lots...",
  "context": "Targeting ICU and ER nurses in US metro hospitals.",
  "targetUser": "...", "problem": "...", "solution": "...",
  "differentiator": "...", "businessModel": "...", "pricing": "...",
  "distribution": "...", "competitors": "...", "constraints": "...",
  "successMetric": "...", "timeline": "..."
}
```

Only `title` and `description` are required (non-empty strings). The twelve optional fields sharpen the critique; agents are told which details are missing rather than left to guess.

Field caps: each field is trimmed to 2,000 chars; combined idea text to 10,000.

## Errors

| Status | Meaning |
| --- | --- |
| `400` | Missing/empty `title` or `description`, or unparseable JSON body. Body: `{"error": "..."}`. |
| `429` | More than 5 runs per minute from one IP. Retry after a minute. |
| `500` | `OPENAI_API_KEY` missing on the server, or an unrecoverable pipeline failure (JSON mode only). |

## Response modes

### `POST /api/start?format=json`

Blocking. Returns:

```json
{
  "research": {
    "sources": [{ "section": "competitors", "title": "Geekbot", "url": "https://geekbot.com" }],
    "competitors": [ ... ],
    "pricing": { "range": ..., "competitors": [...], "recommended_positioning": "..." },
    "funding": { "market_size": {...}, "funding_landscape": {...} },
    "gaps": { "pain_points": [...], "gaps": [...], "unserved_segments": [...] },
    "distribution": { "communities": [...], "distribution_channels": [...] },
    "positioning": { "one_liner": "...", "why_now": "..." },
    "launch": { "phase_1_pre_launch": {...}, "kpis": [...] }
  },
  "agents": [
    { "agent": "vc", "output": "...", "scores": { "market": 3, "overall": 4, "...": null }, "error": false }
  ],
  "synthesis": {
    "output": "1. CONSENSUS ...\n7. KILL CRITERIA ...\n<verdict>PIVOT</verdict>\n<scores>{...}</scores>",
    "scores": { "market": 3, "technical": 5, "launch": 5, "ux": 5, "retention": 5, "overall": 3 }
  }
}
```

Types live in `lib/types.ts` and `lib/research/types.ts`.

### `POST /api/start` (default)

Streams `text/event-stream`. Events arrive in this order:

| Event | Payload | Notes |
| --- | --- | --- |
| `status` | `{type:"status", agent, status}` | Research agent lifecycle: searching → analyzing/planning → done; also `research starting/cached` and `validate starting`. |
| `status` (research) | same shape | One per dossier section as it completes. |
| `competitor` | `{type:"competitor", data: Competitor}` | Streamed individually as found. |
| `pricing`, `funding`, `gaps`, `distribution` | `{type, data}` | One event per completed extraction agent. May be `null` if that agent failed. |
| `positioning`, `launch` | `{type, data}` | Phase-3 synthesis of the dossier. |
| `done` (research) | `{type:"done", report_id, processing_time, cached?}` | Marks Act 1 complete. |
| `sources` | `{type:"sources", data: SourceLink[]}` | All URLs gathered during research, for display and citation. |
| `agent` | full `AgentResult` | Emitted as each validation agent finishes (all run in parallel). Failed agents set `"error": true` with an explanatory output. |
| `synthesis` | `{output, scores}` | Final readout including `<verdict>` and `<scores>` tags inside `output`. |
| `done` | `{}` | Terminal. |
| `error` | `{message}` | Fatal failure or cancellation (`"Cancelled"`). |

The client (`app/brief/useBriefRun.ts`) parses this stream manually line-by-line and treats both `done` events leniently.

## Reliability behaviour

- **Score parsing has four layers:** `<scores>` tag parse → loose JSON scan for known dimension keys → cheap-model repair call → cross-agent averaging for synthesis.
- **Verdict resolution order:** `<verdict>` tag → overall score threshold (≥7 ship, ≥4 pivot) → keyword scan, most destructive first.
- **Agent failure never fails the run.** A failed agent gets `"error": true`; synthesis proceeds with whoever succeeded. Only total failure of all seven agents aborts synthesis.
- **Cancellation:** client disconnects or the cancel button abort all in-flight LLM calls via `AbortController`.
- **Research cache:** identical title+description within 1 hour replays cached events instantly (marked `cached: true`) but still runs fresh validation agents.
