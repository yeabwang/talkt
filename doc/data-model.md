# Data Model

Source of truth: [`prisma/schema.prisma`](../prisma/schema.prisma).

Prisma 7 writes the generated client to `lib/generated/prisma` through the
`prisma-client` generator. Runtime access goes through `lib/prisma.ts`.

## Storage Split

| Storage | Holds |
| --- | --- |
| PostgreSQL | Users, interviews, attempts, votes, voice personas, feedback |
| Vercel Blob | Raw DeepSeek analysis output |
| Trigger.dev payload | Raw transcript during grading and retry |

Raw transcripts are not persisted to application storage.

## Models

### `User`

Thin profile row keyed by Clerk user id.

| Field | Notes |
| --- | --- |
| `id` | Clerk user id, primary key |
| `email` | Optional, unique |
| `name` | Optional |

Deletes cascade to interviews, attempts, and votes.

### `Interview`

Reusable interview definition.

| Field | Notes |
| --- | --- |
| `ownerId` | Null for system templates |
| `type` | `template` or `custom` |
| `visibility` | `public` or `private` |
| `language` | ISO code, default `en` |
| `questions` | Ordered question JSON |
| `dimensions` | Builder-selected scoring dimensions |
| `voiceConfig` | JSON, currently `{ voiceId }` |
| `publishedAt`, `authorName`, `anonymous` | Directory attribution |
| `upvotes`, `downvotes`, `rankScore` | Denormalized directory rank |
| `flagged`, `flaggedAt` | Auto-takedown state |

Important indexes:

- `[ownerId]`
- `[type, visibility]`
- `[flagged, visibility, type, rankScore]`

### `Vote`

One vote per user per interview.

| Field | Notes |
| --- | --- |
| `value` | `1` or `-1` |
| `@@unique([userId, interviewId])` | Enforces one vote |
| `[interviewId]` | Supports tally updates |

Votes are toggleable and clearable through the vote API.

### `Attempt`

One run of an interview.

| Field | Notes |
| --- | --- |
| `status` | `in_progress`, `analyzing`, `ready`, `failed`, `abandoned` |
| `vapiCallId` | Optional Vapi call id, unique |
| `vapiAssistantId` | Ephemeral Vapi assistant id |
| `startedAt`, `endedAt` | Timing |
| `transcriptBlobUrl` | Legacy/optional; normal flow does not persist transcripts |

Indexes:

- `[interviewId]`
- `[userId, status, startedAt]` for history
- `[userId, startedAt]` for recommendation facets

### `Feedback`

One structured grade per attempt.

| Field | Notes |
| --- | --- |
| `attemptId` | Unique |
| `overallScore` | 0 to 100 |
| `summary` | Short report summary |
| `dimensionScores` | JSON keyed to `Interview.dimensions` |
| `strengths`, `improvements` | String arrays |
| `perQuestion` | JSON question-level critique |
| `rawBlobUrl` | Raw DeepSeek output in Blob |

### `VoiceAgent`

UI persona record.

| Field | Notes |
| --- | --- |
| `key` | Persona key, for example `adi` |
| `name` | Display name |
| `tone` | UI tone label |
| `language` | Seed/default language |

Actual provider voice ids are resolved in `lib/vapi/voices.ts`, not stored here.

## Enums

- `InterviewType`: `template`, `custom`
- `Visibility`: `public`, `private`
- `AttemptStatus`: `in_progress`, `analyzing`, `ready`, `failed`, `abandoned`

## Migration And Seed

```bash
npm run db:migrate
npm run db:generate
npm run db:seed
```

Seed data lives in `prisma/seed.ts` and `prisma/seed-data.ts`.
