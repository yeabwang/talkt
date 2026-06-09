# API Reference

All routes are Next.js route handlers under `app/api/*` and return JSON.
Response helpers live in `lib/api.ts`; client fetch wrappers live in
`components/talkt/api.ts`.

## Auth Note

`proxy.ts` currently protects every path except sign-in and sign-up. The auth
column below describes handler intent. To make a handler reachable without Clerk
auth, add a public matcher exception in `proxy.ts`.

Common errors:

| Status | Meaning |
| --- | --- |
| `400` | Invalid JSON or invalid input |
| `401` | Missing Clerk session, or invalid webhook secret |
| `403` | Authenticated but not allowed |
| `404` | Missing or not owned |
| `429` | Rate limited, with `Retry-After` |
| `502` | Upstream LLM or Vapi failure |
| `503` | Missing production configuration |

## Routes

| Method | Path | Handler auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/templates` | optional in handler | Ranked directory page |
| `GET` | `/api/templates/recommended` | Clerk | Personalized directory order |
| `GET` | `/api/attempts` | Clerk | Current user's ready attempts |
| `GET` | `/api/attempts/:id` | Clerk owner | Attempt status and feedback |
| `POST` | `/api/attempts/:id/grade` | Clerk owner | Trigger grading for a finished call |
| `POST` | `/api/builder` | Clerk | One builder LLM turn |
| `POST` | `/api/interviews` | Clerk | Store a generated private interview |
| `POST` | `/api/interviews/:id/call` | Clerk owner/read access | Start a Vapi call |
| `POST` | `/api/interviews/:id/publish` | Clerk owner | Publish a custom interview |
| `POST` | `/api/interviews/:id/vote` | Clerk | Cast, flip, or clear a vote |
| `POST` | `/api/vapi/webhook` | Vapi secret in handler | Vapi end-of-call fallback |

## `GET /api/templates`

Returns `{ interviews, nextCursor }`.

Query:

- `limit`: clamped page size.
- `cursor`: previous `nextCursor`.

Rows come from the cached public directory. If a viewer id is available, `mine`
and `myVote` are overlaid live.

## `GET /api/templates/recommended`

Returns `{ interviews }` ordered by:

```text
0.6 * affinity + 0.4 * normalizedRank
```

Affinity comes from the caller's attempt history. Cold start falls back to rank.

## `GET /api/attempts`

Returns `{ attempts }` for the current user, newest first. Only `ready` attempts
with feedback are listed.

## `GET /api/attempts/:id`

Owner-scoped status read. It also runs Vapi reconciliation for local or missed
callbacks before reading the row.

Response:

- `{ status }` for `in_progress`, `analyzing`, `failed`, or `abandoned`.
- Ready feedback fields for `ready`.

This route is not cached.

## `POST /api/attempts/:id/grade`

Primary grading trigger for a just-finished browser call.

Body:

```json
{ "transcript": [{ "role": "user", "text": "..." }] }
```

Behavior:

- Sanitizes transcript turns.
- Marks too-short calls `abandoned`.
- Marks scoreable calls `analyzing`.
- Triggers `grade-attempt` with key `grade-{attemptId}`.
- Returns `{ status: "grading", runId, publicAccessToken }`.

Terminal attempts return `{ status: "ready" | "abandoned" | "failed" }`.
Trigger failures return `{ status: "analyzing" }` so polling can continue.

## `POST /api/builder`

Runs one DeepSeek builder turn.

Body:

```json
{ "messages": [{ "from": "you", "text": "..." }], "language": "English" }
```

Returns a normalized `BuilderTurn`: response text, suggestions, running summary,
and final questions/dimensions once `ready` is true. Rate limit: 20/min/user.

## `POST /api/interviews`

Stores a builder-generated private interview.

Validated fields include title, subtitle, role, category, difficulty, blurb,
minutes, focus, language, voice id, questions, and dimensions. Returns
`{ interview }` with the database id. Status `201`.

## `POST /api/interviews/:id/call`

Starts a voice interview.

Behavior:

- Rate limit: 10/min/user.
- Requires Vapi public/private keys, app URL, webhook URL, and webhook secret.
- Refuses local webhook URLs in production.
- Creates an attempt.
- Creates an ephemeral Vapi assistant.
- Returns `{ attemptId, assistantId, publicKey, interviewerName }`.

The browser never receives the system prompt or question set.

## `POST /api/interviews/:id/publish`

Publishes an owned custom interview.

Body:

```json
{ "displayName": "Ada", "anonymous": false }
```

Anonymous publishing stores no public display name. Publishing invalidates the
directory cache.

## `POST /api/interviews/:id/vote`

Body:

```json
{ "value": 1 }
```

`value` is `1`, `-1`, or `0`. The transaction updates the caller's vote,
recomputes tallies and rank, may auto-flag the interview, and invalidates the
directory cache.

Returns `{ upvotes, downvotes, myVote, flagged }`.

## `POST /api/vapi/webhook`

Vapi `end-of-call-report` fallback. Handler verification accepts
`X-Vapi-Secret` or `Authorization: Bearer` against `VAPI_WEBHOOK_SECRET`.

Behavior:

- Rejects invalid secrets.
- Fails closed in production when `VAPI_WEBHOOK_SECRET` is missing.
- Maps Vapi payloads to `{ attemptId, assistantId, transcript, endedReason }`.
- Classifies outcome using the same half-answered rule.
- Triggers `grade-attempt` idempotently for completed calls.
- Deletes the ephemeral assistant when possible.
- Returns `200` for non-report Vapi events.

This route must be reachable by Vapi in production. With the current protected
`proxy.ts`, add a public exception before relying on it.
