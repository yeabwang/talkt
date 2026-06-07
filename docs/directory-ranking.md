# Directory & ranking

Published custom interviews enter a public **directory**. A Reddit-style vote feeds
a Wilson-ranking model that surfaces quality over raw count, heavily-downvoted
templates are auto-taken-down, and a per-user content-based recommender re-orders
the catalog. All ranking math is pure and unit-tested.

## Publishing
`POST /api/interviews/:id/publish` makes the caller's custom interview public
(ownership enforced). Body: `{ displayName?, anonymous }`. Publishing busts the
directory cache (a new template entered the directory).

## Voting
`POST /api/interviews/:id/vote` casts (`1` / `-1`) or clears (`0`) the caller's vote.
In one `$transaction` it updates the tally, recomputes `rankScore`, and may auto-flag
the template. It returns fresh tallies **plus the caller's own vote only** — never
voter identities. Self-votes and non-votable targets are rejected. A successful vote
busts the directory cache (order/contents can change).

## Ranking math
Source: [`lib/ranking.ts`](../lib/ranking.ts).

### Wilson lower bound
`rankScore` is the **Wilson score lower bound** of the upvote ratio at a 95%
confidence interval (`z = 1.96`). This ranks by the *quality* of votes, not the raw
count: a 9/10 template can outrank a 50/60 one only when the small sample justifies
it, and brand-new items are neither buried nor boosted. Result is in `[0, 1]`; `0`
votes → `0`.

### Anonymity down-weight
Templates published anonymously keep `ANONYMITY_KEEP = 0.65` of their score (a 35%
penalty). The penalty is **internal only** — never surfaced in the UI or API.

### Auto-flag (takedown)
`shouldFlag` returns true once a template has at least `FLAG_MIN_VOTES = 20` votes
**and** downvotes are at least `FLAG_DOWNVOTE_SHARE = 0.4` of the total. Flagged
templates are hidden from the directory and queued for admin review. The small-sample
guard prevents a few early downvotes from taking anything down.

## Personalized recommendations
Source: [`lib/recommend.ts`](../lib/recommend.ts). Read via
`GET /api/templates/recommended`.

Each user is profiled from their own **attempt history** across four facets —
`category`, `role`, `difficulty`, `language` — with exponential time decay
(`DECAY_HALF_LIFE_DAYS = 30`) so recent activity counts more (a "preference
timeline"). Per-facet weights are normalized to sum to 1.

For each candidate interview, an **affinity** in `[0, 1]` is the mean over facets of
the weight the profile assigns to that interview's facet value. The final order
blends affinity with the template's normalized directory rank:

```
personalizedScore = 0.6 · affinity + 0.4 · normalizedRank
```

Properties:
- **No cross-account data** — only the viewer's own attempts are used, so nothing
  leaks between users.
- **No cold-start cliff** — an empty history (`isColdStart`) scores affinity `0`, so
  the order falls back to pure directory rank.
- **Not cached** — per-user and cheap to recompute in memory; the underlying
  directory rows *are* cached. See [Caching](caching-strategy.md).

## Reading the directory
- `GET /api/templates/recommended` — primary, per-user order (auth required).
- `GET /api/templates` — fallback; public, rank-ordered, cursor-paginated, bounded to
  `DIRECTORY_MAX_ROWS = 200`. When signed in, each row carries the caller's `myVote`.

Per-viewer fields (`myVote`, `mine`) are overlaid live per request and never written
to the shared cache. See [API reference](api-reference.md) and the
[design note](design/templates-directory-design.md).
