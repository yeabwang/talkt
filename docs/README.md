# talkt documentation

Engineering documentation for **talkt** — an AI voice-interview platform. Start
with the [project README](../README.md) for a product overview; the pages below
go deep on how it's built.

## Index

| Doc | What it covers |
|---|---|
| [Architecture](architecture.md) | System overview, end-to-end request flows, module map |
| [Data model](data-model.md) | Prisma schema: models, relations, enums, indexes |
| [Voice interview](voice-interview.md) | Vapi call lifecycle, ephemeral assistants, webhook + reconciliation |
| [Grading](grading.md) | Transcript analysis and the durable `grade-attempt` task |
| [Directory & ranking](directory-ranking.md) | Voting, Wilson ranking, auto-flag, content-based recommender |
| [API reference](api-reference.md) | Every route handler: method, auth, request, response |
| [Caching](caching-strategy.md) | Cache keys, TTLs, invalidation rules, ownership boundaries |
| [Configuration](configuration.md) | Every environment variable and what it controls |
| [Development](development.md) | Local setup, scripts, testing, conventions |
| [Deployment](deployment.md) | Vercel deploy and a production go-live checklist |
| [Security](security.md) | Auth model, secret handling, rate limits, data handling |

### Design notes

| Doc | What it covers |
|---|---|
| [Templates directory design](design/templates-directory-design.md) | Design rationale for the public template directory |

## A note on Next.js

This project runs **Next.js 16**, which differs from older versions in ways that
matter (see [`AGENTS.md`](../AGENTS.md)). Two consequences you'll see throughout:

- The auth middleware lives in **`proxy.ts`**, not `middleware.ts`.
- Server caching uses **`unstable_cache`** (not the `use cache` directive, which
  requires `cacheComponents` — not enabled here). See [Caching](caching-strategy.md).

When changing framework-adjacent code, read the bundled docs under
`node_modules/next/dist/docs/` first.
