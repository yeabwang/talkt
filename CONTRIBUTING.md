# Contributing to talkt

Thanks for your interest in improving talkt! This guide covers the basics.

## Getting started

See [`docs/development.md`](docs/development.md) for full local setup. In short:

```bash
npm install
cp .env.example .env.local   # fill in values — docs/configuration.md
npm run db:migrate && npm run db:seed
npm run dev
```

## Before you open a PR

1. **Read the bundled Next docs.** This is Next.js 16; APIs differ from older
   versions (see [`AGENTS.md`](AGENTS.md)). Check `node_modules/next/dist/docs/`
   before changing framework-adjacent code.
2. **Keep pure logic pure.** Ranking, recommend, validation, transcript, and the
   Vapi payload builders avoid Prisma/SDK/network imports so they stay unit-testable.
   Add a test in `tests/unit/` for new logic.
3. **Run the checks.**
   ```bash
   npm run lint
   npm test
   npm run build
   ```
4. **Respect the security boundaries.** Don't import server modules into client
   components; route inputs go through `lib/validate.ts`; never expose a secret behind
   `NEXT_PUBLIC_*`. See [`docs/security.md`](docs/security.md).

## Pull requests

- Branch from `dev`. Keep PRs focused and reasonably small.
- Use clear, conventional commit messages (e.g. `feat:`, `fix:`, `docs:`).
- Describe what changed and why; link any related issue.
- Update docs when behavior or configuration changes.

## Reporting issues

- **Bugs / features:** open a GitHub issue with steps to reproduce or a clear
  description.
- **Security vulnerabilities:** do **not** open a public issue — follow
  [`SECURITY.md`](SECURITY.md).

## Code of conduct

Be respectful and constructive. Assume good faith.
