# Development

## Prerequisites
- **Node.js 20+**
- A **PostgreSQL** database (local or hosted)
- Accounts / API keys: Clerk, Vapi, DeepSeek, Trigger.dev, Vercel Blob

## Setup

```bash
npm install                 # also runs `prisma generate` (postinstall)
cp .env.example .env.local  # fill in real values — see docs/configuration.md
npm run db:migrate          # apply migrations
npm run db:seed             # seed templates + voice personas
npm run dev                 # http://localhost:3000
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run lint` | ESLint (`eslint.config.mjs`) |
| `npm test` | Unit tests — `tsx --test tests/unit/*.test.ts` |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:generate` | Regenerate the Prisma client (`lib/generated/prisma`) |
| `npm run db:seed` | Seed data |
| `npm run db:studio` | Prisma Studio |
| `npm run db:check` | Sanity-check DB connection/schema (`scripts/db-check.ts`) |
| `npm run ui:check` | UI prototype check (`scripts/ui-prototype-check.ts`) |

## Testing
Unit tests use the **Node test runner** via `tsx` and live in `tests/unit/`. They
cover the pure-logic modules — ranking, recommend, pagination, validate, transcript,
session-ended, dto, loadable, and the Vapi assistant/prompt/webhook builders. These
modules are kept free of Prisma / SDK / network imports specifically so they can be
tested with crafted literals (no DB or mocks required).

```bash
npm test
```

When you add logic to a pure module, add a test beside it. When you touch a route or
a `lib/db/*` repository, keep the pure parts pure and push side effects to the edges
so they stay testable.

## Local voice
Vapi cannot reach `localhost`. Either set `VAPI_WEBHOOK_URL` to a public tunnel
(ngrok / Vapi CLI) for real webhooks, or rely on the default reconciliation fallback.
See [Voice interview](voice-interview.md#local-development--reconciliation).

## Conventions
- **Read the bundled Next docs first.** This is Next.js 16 — APIs differ from older
  versions (see [`AGENTS.md`](../AGENTS.md)). Consult `node_modules/next/dist/docs/`
  before writing framework-adjacent code.
- **Auth middleware is `proxy.ts`**, not `middleware.ts`.
- **Server-only secrets.** Never import server modules (`lib/llm`, `lib/analysis`,
  `lib/vapi/server`, `lib/db/*`) into client components. The DB→client privacy seam
  is `lib/dto.ts`.
- **Validate at the edge.** Route inputs go through `lib/validate.ts`; cost-bearing
  routes go through `lib/rate-limit.ts`.

## Project layout
```
app/            App Router — pages + /api route handlers
components/     talkt/ feature screens + ui/ shadcn primitives
lib/            Server logic: db/, vapi/, llm, analysis, ranking, recommend, …
prisma/         Schema, migrations, seed
trigger/        Trigger.dev tasks
tests/unit/     Unit tests
docs/           Documentation
proxy.ts        Clerk auth middleware
```
