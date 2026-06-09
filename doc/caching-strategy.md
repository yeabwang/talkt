# Caching Strategy

Current cache surface: public directory rows.

## Next.js Primitive

This repo uses `unstable_cache` because `cacheComponents` is not enabled in
`next.config.ts`. The `use cache` directive is not available in this config.

Read the bundled Next.js 16 caching docs before changing this area:

```text
node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md
```

## Directory Cache

Source: [`lib/db/directory-cache.ts`](../lib/db/directory-cache.ts).

| Property | Value |
| --- | --- |
| Cache key | `["directory-rows"]` |
| Tag | `directory` |
| TTL | 60 seconds |
| Max rows | 200 |
| Contents | Public, non-flagged interviews sorted by rank and creation date |

The cache stores only viewer-neutral rows. It does not contain `myVote`, `mine`,
or any user-specific data.

## Pagination

`GET /api/templates` exposes `limit` and `cursor`. Pagination happens within the
bounded cached row set through helpers in `lib/pagination.ts`.

Default behavior returns the bounded set so the client can filter locally.

## Per-Viewer Overlay

`lib/db/interviews.ts` overlays viewer fields after reading cached rows:

- `myVote`
- `mine`

This keeps the shared cache safe across users.

## Invalidation

`revalidateDirectory()` calls:

```ts
revalidateTag("directory", { expire: 0 })
```

Invalidated by:

- publishing an interview
- voting or clearing a vote

Not invalidated by:

- creating a private interview
- reading recommendations
- reading attempts

`{ expire: 0 }` is intentional. Directory mutations need read-your-own-writes
behavior from route handlers. `profile: "max"` can serve stale data first.

## Client State

Client-side state keeps:

- resolved user in `sessionStorage`
- directory rows during the app session
- attempts during dashboard/report navigation

`Loadable<T>` in `lib/loadable.ts` tracks loading, ready, and error states.

## Not Cached

- `GET /api/attempts/:id`: grading status must be fresh.
- `GET /api/templates/recommended`: user-specific ordering.
- Mutations: builder turns, create, call start, grade, publish, vote.

## Follow-Up

The directory cache and rate limiter are process-local. Use a shared store before
running multiple app instances.
