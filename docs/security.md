# Security

This documents talkt's security posture. To **report** a vulnerability, see
[`SECURITY.md`](../SECURITY.md) at the repo root.

## Authentication & authorization
- **Protected-first middleware.** `proxy.ts` runs Clerk's `clerkMiddleware`; every
  route requires a session except the sign-in / sign-up routes. You opt routes *out*
  of auth, never *into* it — so a new route is protected by default.
- **Two intentional exceptions:** `GET /api/templates` (public directory, auth
  optional) and `POST /api/vapi/webhook` (server-to-server, shared-secret verified).
- **Ownership checks.** Mutations and owner-scoped reads verify ownership at the data
  layer (e.g. owner-scoped `updateMany`, `403`/`404` on miss). A user cannot read or
  mutate another user's interviews, attempts, or feedback.

## Secrets
- Secrets are **server-only** and read from environment variables; `.env*` is
  git-ignored (only `.env.example`, with empty values, is committed).
- Only **publishable** keys are exposed to the browser, behind `NEXT_PUBLIC_*`.
  Never put a secret behind a `NEXT_PUBLIC_` name.
- The interview's **system prompt and questions never reach the browser** — the call
  route provisions an ephemeral Vapi assistant server-side and returns only an
  assistant id + the public key.
- `lib/dto.ts` is the DB→client **privacy seam**: server modules (`lib/llm`,
  `lib/analysis`, `lib/vapi/server`, `lib/db/*`) must never be imported into client
  components.

## Webhook verification
`POST /api/vapi/webhook` verifies `X-Vapi-Secret` (and optionally `Authorization:
Bearer`) against `VAPI_WEBHOOK_SECRET` with a **constant-time** compare
(`timingSafeEqual`). With a secret set, a mismatch is rejected (`401`). With **no**
secret set, it **fails closed in production** (`503`) and is permissive only in dev.

## Rate limiting & cost control
Cost-bearing endpoints are rate-limited per user (`lib/rate-limit.ts`), returning
`429` + `Retry-After` on deny:
- `POST /api/interviews/:id/call` — 10/min (each provisions a paid assistant).
- `POST /api/builder` — 20/min (LLM cost).

Payloads are bounded: the builder/grader transcript is sanitized and truncated, the
directory read is capped at 200 rows, and LLM completions are token-capped.

## Input validation
Route inputs pass through `lib/validate.ts` (string/array coercion, length caps,
`minutes` clamped 1–180, vote value constrained to `{-1, 0, 1}`, dimensions
filtered). LLM output is normalized and never trusted (`lib/analysis.ts`); LLM
errors return a safe message with no stack leak.

## Data handling
- **Transcripts are not persisted** to our storage — they live in the Trigger.dev run
  payload (replayed on retry) and are discarded after grading.
- Bulky **raw analysis** goes to Vercel Blob; only the blob URL is stored in the row.
- **Voter privacy:** the vote endpoint returns tallies and the caller's own vote
  only — never voter identities.
- **Anonymity:** anonymously-published templates carry an internal ranking
  down-weight that is never surfaced in the UI or API.
- **Cache isolation:** the directory cache holds only public, non-viewer-specific
  rows; per-viewer data is overlaid live and never written to the shared cache.

## Public-repo hygiene
- No secrets are committed (verified across the working tree and git history).
- `.env.local`, build output, generated Prisma client, and local agent/scratch dirs
  are git-ignored.
- Before rotating environments, treat any key that ever touched a shared machine as
  compromised and rotate it.
