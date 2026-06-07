# Template Directory, Publishing, Voting & Recommendations — Design

Date: 2026-06-03
Status: Implemented — see [Directory & ranking](../directory-ranking.md) for the
shipped behavior.

## Goal

Turn the interview library into a real, persisted **template directory**:

1. A template directory backed by Postgres + a fetch API (replaces mock `data.ts`).
2. A **Publish** action that makes a user's generated custom interview public.
3. Reddit-style **upvote/downvote** with transparent counts; rank by vote quality.
4. A **recommendation** layer that profiles each user from their interview
   history (type, level, language) over a decaying timeline and surfaces
   suitable interviews higher.
5. **Author attribution** on the card and detail page, with an anonymous option.

This is privacy-, security-, and efficiency-sensitive. All external input is
validated with zod at the boundary; all mutations are Clerk-gated; voter and
owner identities are never exposed to the client.

## Scope decision

**Full real stack.** This slice wires the persistence that did not exist before:
Clerk → Postgres user sync, interview persistence (templates seeded + published
customs), attempt logging, and the vote/recommendation layer on top of real
data. The mock arrays in `components/talkt/data.ts` (`TEMPLATES`,
`CUSTOM_INTERVIEWS`, `ATTEMPTS`) are seeded into the DB and the screens read
from the API instead.

## Data model (Prisma)

### `Interview` — added fields

| Field | Type | Purpose |
| --- | --- | --- |
| `upvotes` | `Int @default(0)` | Denormalized tally; transparent count, no per-vote scan. |
| `downvotes` | `Int @default(0)` | Denormalized tally. |
| `rankScore` | `Float @default(0)` | Wilson lower bound with anonymity penalty baked in. Indexed for sorted directory queries. |
| `authorName` | `String?` | Snapshot credit shown on card/detail. `null` = anonymous. |
| `anonymous` | `Boolean @default(false)` | Published without attribution. |
| `publishedAt` | `DateTime?` | When made public. |
| `flagged` | `Boolean @default(false)` | Auto-takedown state; excluded from all public queries. |
| `flaggedAt` | `DateTime?` | When flagged. |

New relation: `votes Vote[]`. New index: `@@index([flagged, visibility, rankScore])`.

### `Vote` — new model

```prisma
model Vote {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  interviewId String
  interview   Interview @relation(fields: [interviewId], references: [id], onDelete: Cascade)
  value       Int       // 1 = up, -1 = down
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@unique([userId, interviewId]) // one vote per user per interview
  @@index([interviewId])
}
```

`User` gains `votes Vote[]`. `Attempt`/`Feedback` are unchanged — the existing
`Attempt → Interview` link feeds the recommendation profile.

## Server layer (`lib/`)

Pure functions are isolated from DB access so they unit-test with crafted
literals (per architecture testing decision).

- **`lib/ranking.ts`** (pure)
  - `wilsonLowerBound(up: number, down: number, z = 1.96): number` — lower bound
    of the 95% confidence interval on the upvote ratio. Returns `0` when there
    are no votes.
  - `rankScore(up, down, anonymous): number` — `wilsonLowerBound(up, down)`
    multiplied by `0.65` when `anonymous` (a 35% down-weight). Internal only;
    never surfaced in UI or API copy.
- **`lib/recommend.ts`** (pure)
  - `buildProfile(attempts, now): Profile` — exponential time decay with a
    **30-day half-life**; accumulates weights over facets
    `category`, `role`, `difficulty`, `language`. Normalized.
  - `scoreInterview(profile, interview): number` — 0–1 affinity from weighted
    facet matches. Cold start (no attempts) → neutral `0`.
- **`lib/db/users.ts`** — `ensureUser()`: upsert Clerk identity into Postgres on
  the first authenticated request (id, email, name).
- **`lib/db/interviews.ts`** — `listDirectory(filters)` (ranked, excludes
  `flagged` and `private`), `getInterview(id)`, `createFromBuilder(input)`,
  `publish(id, { displayName, anonymous })`.
- **`lib/db/votes.ts`** — `castVote(userId, interviewId, value)`: rejects
  self-vote, upserts or clears the row, recomputes `upvotes`/`downvotes`/
  `rankScore`, and runs the auto-flag check — all in one transaction.
- **`lib/db/attempts.ts`** — `createAttempt`, `listUserAttempts`.

## Algorithms

### Ranking — Wilson lower bound

```
n = up + down
if n == 0: return 0
phat = up / n
z = 1.96
score = (phat + z^2/(2n) - z * sqrt((phat*(1-phat) + z^2/(4n)) / n)) / (1 + z^2/n)
```

A statistically sound order: high-ratio templates with enough votes rise; new
items are neither unfairly buried nor boosted. **Anonymity down-weight:**
`rankScore = score × 0.65` when published anonymously (35% reduction). Kept
internal.

### Auto-flag / takedown

In the same transaction as a vote, after recomputing tallies:

```
n = up + down
if n >= 20 and (down / n) >= 0.40:
    flagged = true
    flaggedAt = now
```

The small-sample guard (`n >= 20`) prevents takedown before a template has
accumulated enough votes — a safety hook against accidental/early damage. Flagged interviews drop out of every public query. An admin review
page is future work; for now this is a silent server-side takedown.

### Recommendation blend

```
personalizedScore = 0.6 * affinity + 0.4 * normalizedRankScore
```

`normalizedRankScore` maps the directory's rank scores into 0–1. No attempt
history → `affinity = 0`, so the order falls back to pure rank.

## APIs (`app/api/`)

Each handler follows: validate (zod) → auth/ownership → delegate to `lib/`. No
business logic in handlers. Never returns `ownerId` or voter identities.

| Route | Method | Auth | Body / Query | Returns |
| --- | --- | --- | --- | --- |
| `/api/templates` | GET | optional | filter params (topic, language, length, difficulty, source) | Ranked DTO list with `upvotes`, `downvotes`, `myVote`, `authorName`. |
| `/api/templates/recommended` | GET | required | — | Personalized order (affinity ⊕ rank). |
| `/api/interviews` | POST | required | built-interview payload | Persists a private custom interview from builder output. |
| `/api/interviews/[id]/publish` | POST | required + owner | `{ displayName?, anonymous: boolean }` | Sets public + `publishedAt`, snapshots `authorName`. |
| `/api/interviews/[id]/vote` | POST | required | `{ value: 1 \| -1 \| 0 }` (0 clears) | Fresh counts + caller's current vote only. |

> Next.js 16 has breaking changes; read `node_modules/next/dist/docs/` before
> writing route handlers and dynamic-segment APIs.

## UI

- **Library → directory** (`library-screen.tsx`): fetches `/api/templates`
  (ranked). Signed-in users with history get a **"For you"** section on top from
  `/api/templates/recommended`. Each card and the detail page show a
  Reddit-style vote control — up ▲ / down ▼ with transparent `↑123 ↓4` counts —
  and a small author credit (`by Name`, or `Community` when anonymous).
- **Publish** (`builder-screen.tsx` result + owned-custom detail): a Publish
  button opens a dialog — display-name field defaulting to the Clerk first name,
  a "Publish anonymously" toggle, and a public-visibility confirm.
- **DTO mapping**: a mapper reconciles Prisma `Interview` → the existing UI
  `Interview` type, adding `upvotes`, `downvotes`, `myVote`, `authorName`,
  `anonymous`.

## Privacy & security

1. All mutations Clerk-gated; publish enforces ownership.
2. One vote per user via the unique constraint; self-voting rejected; no
   anonymous voting.
3. Attribution stores only a chosen display-name snapshot — never email or last
   name. Anonymous publish stores no public identity; `ownerId` is retained
   server-side for moderation and never sent to the client.
4. Flagged interviews are excluded from every public query.
5. Recommendation runs server-side only; no cross-user data is exposed.
6. zod validation at every request boundary.

## Testing

- **Unit (pure, crafted literals):** `wilsonLowerBound` (boundary cases: 0 votes,
  all up, all down, small vs large n), `rankScore` anonymity down-weight,
  `buildProfile` decay, `scoreInterview` affinity, auto-flag threshold logic.
- **Integration (live, no mocks; test Clerk + DB creds):** vote → recompute →
  auto-flag at the 40%/n≥20 boundary; publish ownership enforcement; directory
  excludes flagged/private; recommended endpoint blends correctly.

## Handoff (DB)

The sandbox cannot reach Prisma Postgres (`P1001`). All schema, migration SQL,
seed script, and code are written here, but `prisma migrate`, the seed run, and
the live integration tests are **run by the user** on a connected machine — a
deliberate guard so migrations are never applied blindly from the sandbox.

## Out of scope (future slices)

- Admin moderation/review page for flagged templates (manual takedown now).
- Collaborative filtering (needs scale; content-based for now).
- Editing a published template / unpublish flow.
