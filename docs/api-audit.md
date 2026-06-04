# API Audit

> Deliverable 1 of `context/specs/11-performance.md`. One entry per route handler
> under `app/api/`. Each documents: what it does, where it is called from, its
> read/write class, current problems, duplication, the changes it needs
> (cache / batch / paginate / index / validate / secure), and the impact.
>
> Phase references (A–E) point at the implementation plan
> `docs/superpowers/plans/2026-06-05-performance-caching-hardening.md`.

## Summary

- **No N+1 patterns remain.** The only fan-out risk — per-interview vote lookups
  on the directory — is batched through `votesByViewer` (single `groupBy` over all
  ids), in both `listDirectory` and the single-interview read.
- **Directory is bounded + cursor-paginated.** The cached row read is capped at
  `DIRECTORY_MAX_ROWS = 200` (top-N by rank), bounding the DB read, payload, and
  client memory. `GET /api/templates` accepts `?limit=&cursor=` for true cursor
  pagination; the default limit returns the whole bounded set in one call so the
  client keeps instant client-side filtering/search.
- **All reads select only required fields** via the `interviewRowSelect` /
  attempt selects in the `lib/db/*` repository layer and the `lib/dto.ts` privacy
  seam.
- **Auth** is enforced in every handler except `GET /api/templates` (intentionally
  public, auth optional) and `POST /api/vapi/webhook` (shared-secret verified,
  fail-closed in production).

---

## `GET /api/templates`

| Field | Value |
|---|---|
| What it does | Returns the public, ranked template directory. Auth optional; when signed in, each row carries the caller's own `myVote`. |
| Called from | `components/talkt/api.ts → fetchDirectory`. **Fallback-only** after Phase B — the client now loads the directory via `/recommended` and only calls this on failure/empty. |
| Class | Read |
| Problems | None remaining. Previously read on every load alongside `/recommended` (duplicate full directory read). |
| Duplication | Overlaps `/recommended`, which returns the same rows re-ranked. Resolved in Phase B: this is the fallback, not the primary path. |
| Needs | **Cache** — done (Phase C): row read served from `cachedDirectoryRows` (`unstable_cache`, tag `directory`, 60s). Per-viewer votes stay live. **Paginate** — done: bounded to `DIRECTORY_MAX_ROWS = 200`; accepts `?limit=&cursor=` (`listDirectoryPage` + `lib/pagination.ts`), returns `{ interviews, nextCursor }`. Default limit returns the whole bounded set (back-compat). |
| Impact | High read frequency. Caching removes a repeated `findMany` for every viewer; Phase B removes the duplicate fetch in the common path. |

## `GET /api/templates/recommended`

| Field | Value |
|---|---|
| What it does | Returns the directory re-ordered for the signed-in user — a recency-weighted content profile (from attempt history) blended with each template's directory rank. Cold start falls back to pure rank. |
| Called from | `components/talkt/api.ts → fetchRecommended`. **Primary directory source** after Phase B. |
| Class | Read (+ in-memory re-rank) |
| Problems | None blocking. Ranking is recomputed per request — cheap, in-memory, and per-user so it is intentionally **not** cached. |
| Duplication | Reads the same rows as `/api/templates`; this is now the single primary read (`listAttemptFacets` + cached `listDirectory` in parallel). |
| Needs | **Secure** — auth required (401 if unsigned). Underlying directory rows cached (Phase C); facets read covered by composite index (Phase D). |
| Impact | High read frequency, now the only directory request on mount. Underlying DB read cached; per-user ordering computed live. |

## `GET /api/attempts`

| Field | Value |
|---|---|
| What it does | Returns the signed-in user's graded attempt history (newest first, `ready` only) for the Reports list and dashboard. |
| Called from | `components/talkt/api.ts → fetchAttempts`; loaded on dashboard/reports entry. |
| Class | Read |
| Problems | Filter `userId + status + feedback` ordered by `startedAt desc` previously scanned `userId` index then sorted. |
| Duplication | None. |
| Needs | **Index** — done (Phase D): composite `@@index([userId, status, startedAt])` covers the filter + sort. |
| Impact | Owner-scoped, moderate frequency. Composite index removes the post-scan sort. |

## `GET /api/attempts/[id]`

| Field | Value |
|---|---|
| What it does | Polls a single attempt's status (+ feedback once ready). Owner-scoped. |
| Called from | Results poller (`components/talkt/*` results view). |
| Class | Read |
| Problems | High-frequency poll — acceptable: cheap indexed point read by primary key, scoped to the owner. |
| Duplication | None. |
| Needs | **Secure** — done: 401 unsigned, 404 if not owned (`getAttemptStatus(id, userId)`). Intentionally **not cached** (status must be fresh). |
| Impact | Frequent but trivial cost per call. |

## `PATCH /api/attempts/[id]`

| Field | Value |
|---|---|
| What it does | Attaches the Vapi call id to the attempt when the browser's call actually starts (defensive join key for the webhook). |
| Called from | `components/talkt/api.ts` at call start. |
| Class | Update |
| Problems | None. |
| Duplication | None. |
| Needs | **Validate / secure** — done: owner-scoped `updateMany`; `vapiCallId` validated via `optString` (≤200 chars). Client cannot target another user's row. |
| Impact | Low frequency, one per call. |

## `POST /api/attempts/[id]/grade`

| Field | Value |
|---|---|
| What it does | Kicks off grading: verifies ownership, sanitizes the captured transcript, triggers the idempotent `grade-attempt` Trigger.dev task, returns the run id + a read-scoped public token for Realtime progress. |
| Called from | `components/talkt/api.ts` when a call ends. |
| Class | Create (run) / triggers async write |
| Problems | Previously accepted an **unbounded** client `transcript` array straight into a durable task. |
| Duplication | Overlaps the webhook fallback path, but both share idempotency key `grade-{id}` so they collapse into one run (no double grade). |
| Needs | **Validate / secure** — done (Phase E4): `sanitizeTranscript` caps turns (400) and per-turn length (4000 chars), normalizes role. Owner-checked before trigger; idempotent. |
| Impact | Low frequency. Sanitizer bounds payload + downstream LLM cost. |

## `POST /api/interviews`

| Field | Value |
|---|---|
| What it does | Persists a builder-generated interview as the caller's **private** custom interview. Returns the stored interview with its real id. |
| Called from | Builder flow (`components/talkt/*`). |
| Class | Create |
| Problems | None. |
| Duplication | None. |
| Needs | **Validate** — done: full input validation (`reqString`/`optString`/`stringArray`, minutes clamped 1–180, dimensions filtered). Does **not** invalidate the directory cache (private, not in directory). |
| Impact | Low frequency. |

## `POST /api/interviews/[id]/call`

| Field | Value |
|---|---|
| What it does | Begins a call: resolves a live interviewer voice (availability-checked), opens an Attempt row, returns the transient assistant config for the Vapi Web SDK. |
| Called from | `components/talkt/api.ts` when the user starts an interview. |
| Class | Create (Attempt) + external provisioning |
| Problems | Cost-bearing (provisions a Vapi assistant) — previously unthrottled. |
| Duplication | None. |
| Needs | **Secure / rate-limit** — done (Phase E3): 10/min/user fixed-window limiter, 429 + `Retry-After` on deny. Owner-scoped interview lookup. |
| Impact | Low frequency, high per-call cost; limiter blocks rapid-fire abuse. |

## `POST /api/interviews/[id]/publish`

| Field | Value |
|---|---|
| What it does | Makes the caller's custom interview public in the directory. Ownership-enforced. Body: `{ displayName?, anonymous }`. |
| Called from | Builder/library publish action. |
| Class | Update (visibility) |
| Problems | None. |
| Duplication | None. |
| Needs | **Secure / invalidate** — done: ownership checked (403/404 on miss); validated body; calls `revalidateDirectory()` (Phase C2) since a newly public interview enters the directory. |
| Impact | Low frequency. Correctly busts the directory cache. |

## `POST /api/interviews/[id]/vote`

| Field | Value |
|---|---|
| What it does | Casts (1 / −1) or clears (0) the caller's vote. Returns fresh tallies + the caller's vote only — never voter identities. |
| Called from | Directory cards (`components/talkt/*`). |
| Class | Update (transactional) |
| Problems | None. |
| Duplication | None. |
| Needs | **Validate / secure / invalidate** — done: value validated to {−1,0,1}; rejects self-vote and non-votable targets; atomic tally + rank + auto-flag in one `$transaction`; calls `revalidateDirectory()` on success (vote can re-rank/flag → directory order/contents change). |
| Impact | Moderate frequency. Transaction prevents count drift; cache invalidation keeps ordering fresh. |

## `POST /api/builder`

| Field | Value |
|---|---|
| What it does | One LLM builder turn: takes the conversation history, returns a strict-shaped `BuilderTurn` (response + suggestions + running summary + final question/dimension set). |
| Called from | Builder chat (`components/talkt/api.ts`). |
| Class | Read (LLM call, no DB write) |
| Problems | Cost-bearing LLM endpoint — previously unthrottled. |
| Duplication | None. |
| Needs | **Secure / rate-limit** — done (Phase E2): 20/min/user limiter, 429 + `Retry-After`. Auth required; output normalized; LLM errors return a safe 502 message (no stack leak). |
| Impact | Moderate frequency, high per-call cost; limiter caps abuse. |

## `POST /api/vapi/webhook`

| Field | Value |
|---|---|
| What it does | Vapi server webhook (end-of-call-report). Server-side fallback to the client grade trigger: resolves the attempt and hands its transcript to the idempotent `grade-attempt` task. Always returns 200 so Vapi does not retry. |
| Called from | Vapi (external), not the client. |
| Class | Create (run) / triggers async write |
| Problems | Previously, if `VAPI_WEBHOOK_SECRET` was unset, the grading-triggering webhook was unauthenticated. |
| Duplication | Overlaps the client grade path; shared idempotency key `grade-{id}` collapses both into one run. |
| Needs | **Secure** — done (Phase E5): verifies `x-vapi-secret`; in production a **missing** secret fails closed (503) instead of accepting unverified requests. |
| Impact | Low frequency. Fail-closed removes the prod auth bypass. |

---

## Follow-ups

- **Server-side filtered pagination** — the cursor pagination + 200-row cap bound
  the result today, and the client filters the bounded set in memory. If the
  catalog must grow past the cap *and* stay fully filterable, move filtering/search
  server-side (indexed `where` + cursor) so paging and filtering compose.
- **Shared store (Redis)** for the rate limiter and directory cache — both are
  per-process and need a shared backend for multi-instance deployments (see
  `docs/caching-strategy.md`).
