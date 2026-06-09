# Documentation

Developer docs for TalkT. Start with the repo [README](../README.md), then use
the page that matches the code you are touching.

| Doc | Use it for |
| --- | --- |
| [Architecture](architecture.md) | Boundaries, modules, runtime flow |
| [API reference](api-reference.md) | Route handlers, auth, payloads |
| [Data model](data-model.md) | Prisma models, relations, indexes |
| [Voice interview](voice-interview.md) | Vapi assistant setup and callbacks |
| [Grading](grading.md) | Trigger.dev task and DeepSeek analysis |
| [Directory ranking](directory-ranking.md) | Publishing, votes, rank, recommendations |
| [Caching](caching-strategy.md) | Directory cache, TTL, invalidation |
| [Configuration](configuration.md) | Environment variables |
| [Development](development.md) | Local setup, scripts, conventions |
| [Deployment](deployment.md) | Vercel and Trigger.dev release checklist |
| [Security](security.md) | Auth, secrets, validation, data handling |

## Next.js 16 Notes

- Middleware is `proxy.ts`, not `middleware.ts`.
- Route params are awaited in dynamic handlers.
- This repo uses `unstable_cache`; `use cache` is not enabled because
  `cacheComponents` is not enabled.
- Read `node_modules/next/dist/docs/` before framework changes.
