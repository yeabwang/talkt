# Deployment

Target: Vercel for the Next.js app, Trigger.dev for grading, managed Postgres
for relational data.

## Steps

1. Provision services:
   - PostgreSQL with pooled and direct URLs
   - Clerk production app
   - Vapi project
   - DeepSeek API key
   - Vercel Blob store
   - Trigger.dev project
2. Set environment variables in Vercel and Trigger.dev. See
   [Configuration](configuration.md).
3. Apply database migrations:

   ```bash
   npm run db:migrate
   ```

   In CI, use `prisma migrate deploy`.

4. Seed once if this is a fresh environment:

   ```bash
   npm run db:seed
   ```

5. Deploy the app to Vercel.
6. Deploy the Trigger.dev project from `trigger.config.ts`.
7. Point Vapi at `POST /api/vapi/webhook`.

## Go-Live Checklist

- [ ] `DATABASE_URL` and `DIRECT_URL` point at the production database.
- [ ] Migrations are applied.
- [ ] Starter templates and voice personas are seeded if needed.
- [ ] Clerk keys are production keys.
- [ ] `NEXT_PUBLIC_APP_URL` is the production origin.
- [ ] `BLOB_READ_WRITE_TOKEN` is set.
- [ ] DeepSeek/LLM credentials are set.
- [ ] Vapi private and public keys are set.
- [ ] `VAPI_WEBHOOK_SECRET` is set.
- [ ] `VAPI_WEBHOOK_URL` is public and not `localhost`.
- [ ] `proxy.ts` allows Vapi to reach `/api/vapi/webhook`, or callbacks will be blocked before handler verification.
- [ ] Trigger.dev worker has `DATABASE_URL`, Blob, and LLM env.
- [ ] The web app has Trigger.dev credentials for `tasks.trigger`.
- [ ] Only publishable keys use `NEXT_PUBLIC_*`.

## Smoke Test

1. Sign in.
2. Build a custom interview.
3. Start a Vapi call.
4. Complete at least half the questions.
5. Confirm results show Trigger progress.
6. Confirm the attempt appears in Reports.

## Scaling Note

`lib/rate-limit.ts` and `lib/db/directory-cache.ts` are process-local. Move them
to a shared store, such as Redis, before horizontal scaling.
