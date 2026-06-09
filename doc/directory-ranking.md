# Directory Ranking

Published custom interviews enter the template directory. Ranking and
recommendations are pure logic in `lib/ranking.ts` and `lib/recommend.ts`.

## Publishing

Route: `POST /api/interviews/:id/publish`.

Rules:

- Caller must own the custom interview.
- Body is `{ displayName?, anonymous }`.
- Anonymous publishing stores no public author name.
- Publishing invalidates the directory cache.

## Voting

Route: `POST /api/interviews/:id/vote`.

Body:

```json
{ "value": 1 }
```

`value` is:

- `1`: upvote
- `-1`: downvote
- `0`: clear vote

The vote transaction:

1. Writes or deletes the caller's vote.
2. Recomputes `upvotes`, `downvotes`, and `rankScore`.
3. Applies auto-flag rules.
4. Invalidates the directory cache.

The response returns tallies and the caller's own vote only.

## Rank Score

Source: [`lib/ranking.ts`](../lib/ranking.ts).

Constants:

| Constant | Value | Meaning |
| --- | --- | --- |
| `WILSON_Z` | `1.96` | 95% confidence interval |
| `ANONYMITY_KEEP` | `0.65` | Anonymous templates keep 65% of score |
| `FLAG_MIN_VOTES` | `20` | Minimum votes before auto-flag |
| `FLAG_DOWNVOTE_SHARE` | `0.4` | Downvote share threshold |

`rankScore(up, down, anonymous)` is the Wilson lower bound of the upvote ratio.
Anonymous templates get the internal 35% down-weight. The UI does not expose the
penalty.

`shouldFlag(up, down)` returns true when total votes are at least 20 and
downvotes are at least 40%.

## Recommendations

Source: [`lib/recommend.ts`](../lib/recommend.ts).

The recommender uses only the current user's attempt history. It profiles four
facets:

- `category`
- `role`
- `difficulty`
- `language`

Each attempt decays with a 30-day half-life. Per-facet weights are normalized.

Final score:

```text
personalizedScore = 0.6 * affinity + 0.4 * normalizedRank
```

Cold start has no affinity signal, so ordering falls back to directory rank.

## Directory Reads

- `GET /api/templates/recommended`: personalized order for the signed-in user.
- `GET /api/templates`: rank order, cursor pagination, capped at 200 cached rows.

Per-viewer fields such as `myVote` and `mine` are overlaid per request and never
stored in the shared cache.
