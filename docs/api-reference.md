# API reference

All endpoints live under `app/api/*` as Next.js route handlers and return JSON.
Auth is enforced by `proxy.ts` (Clerk) for every route **except** the two noted
below. Responses use the helpers in `lib/api.ts`; client wrappers live in
`components/talkt/api.ts`.

Common error codes: `401` (unsigned), `403` (not owner), `404` (not found / not
owned), `429` (rate-limited, with `Retry-After`), `502`/`503` (upstream/config).

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/templates` | optional | Public ranked directory (fallback) |
| GET | `/api/templates/recommended` | required | Per-user ranked directory (primary) |
| GET | `/api/attempts` | required | Caller's graded attempt history |
| GET | `/api/attempts/:id` | required | Single attempt status + feedback |
| POST | `/api/interviews` | required | Save a builder-generated interview (private) |
| POST | `/api/interviews/:id/call` | required | Start a voice interview |
| POST | `/api/interviews/:id/publish` | required | Publish a custom interview |
| POST | `/api/interviews/:id/vote` | required | Cast / clear a vote |
| POST | `/api/builder` | required | One LLM builder turn |
| POST | `/api/vapi/webhook` | secret | Vapi end-of-call report (server-to-server) |

---

## GET /api/templates
Public, rank-ordered template directory; **fallback** for `/recommended`. Auth
optional — when signed in, each row carries the caller's own `myVote`. Cursor
paginated via `?limit=&cursor=`, bounded to 200 rows; the default limit returns the
whole bounded set. Returns `{ interviews, nextCursor }`. The underlying rows are
cached (60s, tag `directory`); per-viewer votes are live.

## GET /api/templates/recommended
The directory re-ordered for the signed-in user (recency-weighted content profile
blended with directory rank; cold start → pure rank). **Auth required** (`401` if
unsigned). Computed live per request; underlying rows cached. See
[Directory & ranking](directory-ranking.md#personalized-recommendations).

## GET /api/attempts
The caller's graded attempt history (newest first, `ready` only) for the dashboard
and reports list. Owner-scoped; backed by the composite index `[userId, status,
startedAt]`.

## GET /api/attempts/:id
Polls a single attempt's status (and feedback once `ready`). Owner-scoped: `401`
unsigned, `404` if not owned. A cheap indexed point read — intentionally **not
cached** (status must be fresh while grading is in flight). See [Grading](grading.md).

## POST /api/interviews
Persists a builder-generated interview as the caller's **private** custom interview;
returns the stored interview with its real id. Input is fully validated (strings,
arrays, `minutes` clamped 1–180, dimensions filtered). Does not touch the directory
cache (private interviews aren't in the directory).

## POST /api/interviews/:id/call
Begins a call: resolves the interviewer voice, opens an `Attempt`, provisions an
ephemeral Vapi assistant server-side, and returns `{ attemptId, assistantId,
publicKey, interviewerName }`. **Rate-limited** 10/min/user (`429` + `Retry-After`).
Requires Vapi env to be configured (`503` otherwise; webhook URL must be public in
production). Full detail in [Voice interview](voice-interview.md).

## POST /api/interviews/:id/publish
Makes the caller's custom interview public. Ownership-enforced (`403`/`404` on miss).
Body: `{ displayName?, anonymous }`. Busts the directory cache.

## POST /api/interviews/:id/vote
Casts (`1` / `-1`) or clears (`0`) the caller's vote. Value validated to `{-1, 0,
1}`; rejects self-votes and non-votable targets. Atomic tally + rank + auto-flag in
one transaction; busts the directory cache. Returns fresh tallies and the caller's
vote only — never voter identities.

## POST /api/builder
One conversational-builder turn: takes the conversation history, returns a
strict-shaped `BuilderTurn` (response + suggestions + running summary + the final
question/dimension set). No DB write. **Rate-limited** 20/min/user (`429` +
`Retry-After`). LLM errors return a safe `502` (no stack leak).

## POST /api/vapi/webhook
Vapi server webhook (`end-of-call-report`); **server-to-server, not called by the
browser**. Verifies `X-Vapi-Secret` / `Authorization: Bearer` against
`VAPI_WEBHOOK_SECRET` (constant-time); a **missing** secret **fails closed in
production** (`503`). Resolves the attempt, classifies the outcome, and for a
completed interview triggers the idempotent `grade-attempt` task (`grade-{id}`).
Always returns `200` so Vapi does not retry. See
[Voice interview](voice-interview.md#the-webhook--post-apivapiwebhook).
