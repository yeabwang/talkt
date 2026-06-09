# Security

Report vulnerabilities through the root [`SECURITY.md`](../SECURITY.md).

## Auth

`proxy.ts` runs Clerk middleware. Current behavior:

- Public: sign-in and sign-up routes only.
- Protected: every other page and API route.

Several handlers also implement their own auth intent:

- Owner-scoped reads and writes check the Clerk user id at the repository layer.
- `POST /api/vapi/webhook` verifies a Vapi secret in the handler.
- `GET /api/templates` can overlay optional viewer data in the handler.

Because `proxy.ts` currently gates non-auth routes first, unauthenticated access
to handler-level public or secret routes requires adding explicit proxy
exceptions.

## Ownership

Rules:

- Users can read/take public templates and their own custom interviews.
- Users can read only their own attempts and feedback.
- Custom interview mutations require ownership.
- Publishing requires ownership.
- Voting rejects self-votes and non-votable targets.

Prefer owner-scoped queries or `updateMany` checks that cannot cross users.

## Secrets

Server-only:

- `CLERK_SECRET_KEY`
- `DATABASE_URL`
- `DIRECT_URL`
- `BLOB_READ_WRITE_TOKEN`
- `LLM_API_KEY` / `DEEPSEEK_API_KEY`
- `VAPI_PRIVATE_KEY`
- `VAPI_WEBHOOK_SECRET`
- Trigger.dev secret credentials

Browser-safe only when intentionally publishable:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_VAPI_PUBLIC_KEY`
- `NEXT_PUBLIC_APP_URL`

Never put a secret behind `NEXT_PUBLIC_*`.

## Prompt And Question Boundary

The browser does not receive the interview system prompt or question payload for
Vapi. `POST /api/interviews/:id/call` creates an ephemeral assistant server-side
and returns only the assistant id plus public key.

`lib/dto.ts` is the database-to-client privacy boundary. Do not import
`lib/db/*`, `lib/llm`, `lib/analysis`, or `lib/vapi/server` into client
components.

## Webhook Verification

`POST /api/vapi/webhook` accepts:

- `X-Vapi-Secret`
- `Authorization: Bearer <secret>`

Both compare against `VAPI_WEBHOOK_SECRET`. In production, a missing secret
returns `503`.

Production caveat: Vapi must be able to reach the route through `proxy.ts`.

## Rate Limits

Source: [`lib/rate-limit.ts`](../lib/rate-limit.ts).

| Route | Limit | Why |
| --- | --- | --- |
| `POST /api/interviews/:id/call` | 10/min/user | Vapi assistant cost |
| `POST /api/builder` | 20/min/user | LLM cost |

Rate limits return `429` with `Retry-After`.

## Validation

- Route inputs use `lib/validate.ts` and route-local parsers.
- Transcript input uses `sanitizeTranscript`.
- LLM output is normalized before storage.
- Directory reads are capped at 200 rows.
- LLM transcript input and completions are bounded.

## Data Handling

- Raw transcripts are not persisted to app storage.
- Raw DeepSeek analysis is saved to Blob.
- Structured feedback is stored in Postgres.
- Vote responses never expose voter identities.
- Anonymous template rank penalty is internal only.
- Directory cache stores no viewer-specific fields.

## Repo Hygiene

Do not commit `.env.local`, generated Prisma client, build output, or local
scratch data. Rotate any key that was exposed on a shared machine.
