# Architecture

TalkT is one Next.js 16 application. Pages and API routes live in `app/`.
Business logic lives in `lib/`. Grading runs in `trigger/`.

## Stack

| Area | Code | Service |
| --- | --- | --- |
| App shell and routes | `app/`, `components/talkt/` | Next.js, React |
| Auth | `proxy.ts`, Clerk helpers | Clerk |
| Data | `lib/prisma.ts`, `lib/db/*` | PostgreSQL, Prisma |
| Voice | `lib/vapi/*`, `components/talkt/use-vapi-call.ts` | Vapi |
| Builder and grading LLM | `lib/llm.ts`, `lib/analysis.ts` | DeepSeek |
| Background grading | `trigger/grade-attempt.ts` | Trigger.dev |
| Artifacts | `lib/blob.ts` | Vercel Blob |

## Boundaries

- `app/(auth)/`: Clerk sign-in and sign-up pages.
- `app/(app)/`: authenticated app routes.
- `app/api/*`: JSON route handlers. Keep handlers thin:
  validate input, enforce auth or ownership, call `lib/*`.
- `components/talkt/*`: client and server UI composition.
- `components/ui/*`: shadcn/Radix primitives.
- `lib/db/*`: Prisma repository layer.
- `lib/dto.ts`: database row to client-safe DTO mapping.
- `lib/vapi/*`: assistant payloads, webhook parsing, voice resolution,
  reconciliation, Vapi SDK calls.
- `lib/analysis.ts`: DeepSeek grading normalization.
- `lib/ranking.ts` and `lib/recommend.ts`: pure directory scoring logic.
- `trigger/grade-attempt.ts`: durable grading task.

## Request Flow

### Build Interview

1. `POST /api/builder` receives conversation history and language.
2. DeepSeek returns one normalized `BuilderTurn`.
3. Once ready, `POST /api/interviews` stores a private custom interview.

### Start Voice Call

1. `POST /api/interviews/:id/call` checks auth, rate limits, and ownership.
2. The route creates an `Attempt`.
3. The server creates an ephemeral Vapi assistant with the interview prompt,
   questions, persona, voice, webhook URL, and attempt metadata.
4. The browser receives only `attemptId`, `assistantId`, `publicKey`, and
   `interviewerName`.
5. The browser starts `@vapi-ai/web`.

### Grade Call

1. On call end, the browser posts its captured transcript to
   `POST /api/attempts/:id/grade`.
2. The route classifies the attempt. At least half the questions must be reached
   for grading; otherwise the attempt is `abandoned`.
3. The route triggers `grade-attempt` with idempotency key `grade-{attemptId}`
   and returns a Trigger.dev public read token.
4. The results screen streams run metadata through `useRealtimeRun`.
5. The task calls DeepSeek, stores `Feedback`, saves raw analysis to Blob, and
   sets the attempt to `ready`.

`POST /api/vapi/webhook` and `lib/vapi/reconcile.ts` are fallbacks for server-side
call completion. They use the same `grade-{attemptId}` key.

### Publish And Rank

1. `POST /api/interviews/:id/publish` makes an owned custom interview public.
2. `POST /api/interviews/:id/vote` writes or clears the caller's vote.
3. Votes update tallies, Wilson rank, and auto-flag status in one transaction.
4. Directory reads use cached public rows plus live per-viewer overlays.

## Auth Boundary

`proxy.ts` currently protects every route except sign-in and sign-up. Some route
handlers are written to support optional or secret auth, such as `/api/templates`
and `/api/vapi/webhook`, but they are still behind Clerk unless `proxy.ts` adds
public matcher exceptions.

## Data Boundary

- PostgreSQL stores users, interviews, attempts, votes, voice personas, and
  structured feedback.
- Vercel Blob stores raw DeepSeek analysis.
- Raw transcripts are not persisted to app storage. They live in the Trigger.dev
  run payload during grading and retry.

## Testable Modules

Pure logic is kept out of SDK and Prisma imports where possible. Unit tests cover
ranking, recommendations, pagination, validation, transcript progress,
session-ended decisions, DTOs, loadable state, and Vapi payload/webhook helpers.
