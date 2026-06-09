# Grading

Grading converts a completed call transcript into a `Feedback` row. The primary
path is browser-triggered, durable, and idempotent.

## Flow

```text
browser transcript
  -> POST /api/attempts/:id/grade
  -> Trigger.dev grade-attempt
  -> DeepSeek analyzeTranscript
  -> Feedback row + raw analysis blob
  -> results screen streams progress
```

Fallbacks:

- `POST /api/vapi/webhook` can trigger the same task from Vapi's report.
- `GET /api/attempts/:id` can reconcile a missed local callback through Vapi.

All paths use idempotency key `grade-{attemptId}`.

## Scoreability Rule

`lib/vapi/webhook.ts` and `lib/transcript.ts` classify the outcome.

An attempt is graded when:

- there is at least one user turn, and
- at least half of the interview questions were reached.

Otherwise it becomes `abandoned`. Setup or pipeline end reasons are also
`abandoned`.

## Route: `POST /api/attempts/:id/grade`

Source: [`app/api/attempts/[id]/grade/route.ts`](../app/api/attempts/[id]/grade/route.ts).

Input:

```json
{ "transcript": [{ "role": "user", "text": "..." }] }
```

Behavior:

- Owner-scoped through Clerk.
- Sanitizes transcript turns.
- Moves scoreable attempts to `analyzing`.
- Triggers `grade-attempt`.
- Returns a `runId` and one-hour public read token for Realtime progress.

## Task: `grade-attempt`

Source: [`trigger/grade-attempt.ts`](../trigger/grade-attempt.ts).

Payload:

```ts
{ attemptId: string; transcript: { role: string; text: string }[] }
```

Task behavior:

- Publishes metadata step: `received`, `scoring`, `saving`, `done`.
- Aborts without retry when the attempt is missing or the transcript is empty.
- Returns early if the attempt is already `ready`.
- Marks the attempt `analyzing`.
- Calls `analyzeTranscript`.
- Saves raw analysis to Blob.
- Upserts `Feedback`.
- Marks the attempt `ready`.

Retry: up to 3 attempts with exponential backoff. Max duration: 300 seconds.

## Analyzer

Source: [`lib/analysis.ts`](../lib/analysis.ts).

`analyzeTranscript(interview, transcript)` returns:

| Field | Shape |
| --- | --- |
| `overallScore` | 0 to 100 |
| `summary` | Short string |
| `dimensionScores` | `{ key, score, note }[]` for the interview dimensions |
| `strengths` | Exactly 3 normalized items when the model supplies them |
| `improvements` | Exactly 3 normalized items when the model supplies them |
| `perQuestion` | One item per interview question |

Normalization clamps scores, rekeys dimensions to the interview, matches
questions by index, and tolerates missing model fields.

## LLM Client

Source: [`lib/llm.ts`](../lib/llm.ts).

`chatJSON`:

- Uses `LLM_*` env vars or `DEEPSEEK_*` aliases.
- Calls `/chat/completions`.
- Requests `response_format: { type: "json_object" }`.
- Accepts fenced JSON or a JSON object embedded in short prose.
- Retries parse and transport failures.

## Results UI

Fresh calls use `useRealtimeRun` with the public token returned by the grade
route. Reports opened later use `GET /api/attempts/:id` polling until `ready`.
