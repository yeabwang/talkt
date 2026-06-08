# Caching Strategy

> Cache keys, TTLs, invalidation rules, and ownership boundaries for talkt's
> server- and client-side caching.

## Why `unstable_cache`, not `use cache`

`cacheComponents` is **not** enabled in `next.config.ts` (the config is empty).
The `use cache` directive requires `cacheComponents`, so it is unavailable here.
`unstable_cache` is the supported server-cache primitive in this configuration —
see `node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md`.
This is also an explicit AGENTS.md mandate: read the bundled Next docs before
writing caching code, because this Next version differs from training data.

## Server cache entry: directory rows

Defined in `lib/db/directory-cache.ts`.

| Property | Value |
|---|---|
| Key | `["directory-rows"]` |
| Tag | `"directory"` (`DIRECTORY_TAG`) |
| TTL | `DIRECTORY_TTL_SECONDS = 60` seconds |
| Payload | Public, non-flagged interview rows, rank-ordered (`rankScore desc, createdAt desc`), **capped at `DIRECTORY_MAX_ROWS = 200`**. **No per-viewer data.** |

The cap bounds the cached read, the response payload, and client memory regardless
of table growth. Callers page within this bounded set via `listDirectoryPage`
(`lib/db/interviews.ts`) + the pure `paginateById`/`clampLimit` helpers
(`lib/pagination.ts`); `GET /api/templates` exposes `?limit=&cursor=` and returns
`{ interviews, nextCursor }`. The default limit returns the whole bounded set so
the client retains instant client-side filtering/search.

The cached function `cachedDirectoryRows()` wraps the `prisma.interview.findMany`
that previously ran for **every** viewer on **every** directory load. The row set
is identical across viewers, so it is cached once and shared.

## Ownership boundary (no cross-user leakage)

The cached payload contains **only public, non-viewer-specific** rows. Per-viewer
fields — `myVote` and `mine` — are computed **live per request** inside
`listDirectory` (`lib/db/interviews.ts`) by overlaying `votesByViewer(viewerId, …)`
onto the cached rows. Nothing viewer-specific is ever written to the cache, so a
cached entry cannot leak one user's votes to another.

## Invalidation rules

`revalidateDirectory()` (→ `revalidateTag("directory", DIRECTORY_REVALIDATE_PROFILE)`,
where the profile is `{ expire: 0 }`) is called after mutations that change
directory contents or order:

- **Vote** — `castVote` in `lib/db/votes.ts`, after the transaction succeeds.
  A vote re-ranks and can auto-flag, changing directory order/contents.
- **Publish** — `publish` in `lib/db/interviews.ts`, after the update. A newly
  public interview enters the directory.

**Why `{ expire: 0 }` and not `"max"`:** these mutations run in a Route Handler
and are **read-your-own-writes** — the mutating user must see their change on the
*next* directory read. Per the bundled Next 16 docs (`revalidateTag.md`),
`profile="max"` is *stale-while-revalidate*: it serves the **stale** cached list
first and refreshes only in the background, so a freshly published template did
**not** appear on the immediate next load (it surfaced only on a later visit).
`updateTag()` gives the desired immediate read-your-own-writes semantics but is
**Server-Action-only** and cannot be called from a Route Handler; the documented
Route Handler equivalent is `revalidateTag(tag, { expire: 0 })`, which expires the
entry immediately so the next read is a fresh cache miss. Single-arg
`revalidateTag(tag)` remains deprecated in Next 16 (AGENTS.md notice).

**Not invalidated:** creating a **private** custom interview
(`createFromBuilder`) — it is not in the public directory, so the cache is
untouched.

## Client caching

- **User profile** — `talkt-app.tsx` caches the resolved app user in
  `sessionStorage` under key `talkt-user` (`USER_CACHE_KEY`), keyed by id, so a
  reload within the session skips re-resolving the profile. Degrades silently if
  `sessionStorage` is unavailable (private mode / quota).
- **Directory & attempts** — held in client state for the session. The directory
  is fetched **once on mount** (via `/recommended`, Phase B), and attempts are
  fetched on dashboard/reports entry. Load status is tracked via `Loadable<T>`
  (`lib/loadable.ts`) so screens show skeletons rather than empty-state flashes
  and do not refetch once loaded.

## Not cached, and why

- **Attempt status poll** (`GET /api/attempts/[id]`) — must always be fresh while
  grading is in flight.
- **Recommended order** (`GET /api/templates/recommended`) — per-user ranking;
  cheap to recompute in-memory. (Its underlying directory rows *are* cached.)
- **All mutations** — votes, publish, create, call start, grade, builder turns.

## Follow-ups

- Move the rate limiter (`lib/rate-limit.ts`) and the directory cache to a shared
  store (Redis) for multi-instance deployments. Both are currently per-process:
  each instance keeps its own cache and limiter buckets, which is adequate for a
  single instance but not horizontally scaled.
