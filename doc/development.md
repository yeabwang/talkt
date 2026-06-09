# Development

## Prerequisites

- Node.js 20+
- PostgreSQL
- Clerk, Vapi, DeepSeek, Trigger.dev, and Vercel Blob credentials

## Setup

```bash
npm install
cp .env.example .env.local
npm run db:migrate
npm run db:seed
npm run dev
```

Run the Trigger.dev worker when testing grading:

```bash
npx trigger.dev dev
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |
| `npm test` | Unit tests through `tsx --test` |
| `npm run ui:check` | UI prototype check |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:generate` | Generate `lib/generated/prisma` |
| `npm run db:seed` | Seed templates and personas |
| `npm run db:check` | Check database connectivity/schema |
| `npm run db:studio` | Prisma Studio |

## Testing

Unit tests live in `tests/unit/` and use the Node test runner through `tsx`.

Pure modules should stay free of Prisma, SDK, and network imports so they can be
tested with literal inputs. Current suites cover ranking, recommendations,
pagination, rate limiting, validation, transcripts, session-end decisions, DTOs,
loadable state, and Vapi helpers.

Run:

```bash
npm test
```

## Local Voice

Vapi cannot call `localhost`.

- For real callbacks, set `VAPI_WEBHOOK_URL` to a public tunnel.
- Without a tunnel, use the normal browser grading path and status polling
  reconciliation.

## Next.js 16

Before changing framework code, read the relevant file under
`node_modules/next/dist/docs/`.

Repo-specific notes:

- Middleware file is `proxy.ts`.
- Dynamic route params are promises in handlers.
- Server directory caching uses `unstable_cache`.

## Conventions

- Route handlers validate input, enforce auth/ownership, then delegate to `lib/*`.
- Do not import server-only modules into client components.
- Use `lib/dto.ts` for database-to-client shapes.
- Use `lib/validate.ts` for boundary validation.
- Use `lib/rate-limit.ts` on cost-bearing routes.
- Keep business logic out of components.

## Layout

```text
app/            Pages and API route handlers
components/     Feature screens and UI primitives
lib/            Server logic, integrations, pure helpers
prisma/         Schema, migrations, seed data
trigger/        Trigger.dev tasks
tests/unit/     Unit tests
doc/            Developer docs
proxy.ts        Clerk middleware
```
