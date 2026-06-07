# Deployment

talkt targets **Vercel** (Next.js 16). Background grading runs on **Trigger.dev**.
The database is any managed **PostgreSQL** (a pooled + a direct URL).

## Steps

1. **Provision services**
   - PostgreSQL (e.g. Neon / Supabase / RDS) — get a **pooled** and a **direct** URL.
   - Clerk application (production instance).
   - Vapi project (private + public keys).
   - DeepSeek API key.
   - Vercel Blob store (read/write token).
   - Trigger.dev project.

2. **Configure environment variables** in the Vercel project (and Trigger.dev) per
   [Configuration](configuration.md). Mark secrets as secret; set `NEXT_PUBLIC_*`
   values for the production domain.

3. **Database**
   ```bash
   npm run db:migrate     # or `prisma migrate deploy` in CI
   npm run db:seed        # first deploy only
   ```

4. **Deploy** the app to Vercel (the build runs `next build`; `postinstall` runs
   `prisma generate`).

5. **Deploy the Trigger.dev task** (`grade-attempt`) per the Trigger.dev CLI for your
   environment.

6. **Point Vapi at the webhook.** Ensure `VAPI_WEBHOOK_URL` (or `NEXT_PUBLIC_APP_URL`)
   resolves to your public domain so `POST /api/vapi/webhook` is reachable.

## Production go-live checklist

- [ ] `VAPI_WEBHOOK_SECRET` is **set** (a missing secret makes the webhook fail
      closed → grading won't run).
- [ ] The webhook URL is **public** (not `localhost`); the call route refuses to
      start otherwise in production.
- [ ] `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) both set; migrations applied.
- [ ] Clerk keys are the **production** instance keys.
- [ ] `BLOB_READ_WRITE_TOKEN` set (raw analysis storage).
- [ ] DeepSeek / Vapi keys set; Vapi model + transcriber defaults reviewed for
      cost/latency.
- [ ] Trigger.dev task deployed and reachable.
- [ ] No secrets in client bundles — only publishable keys live behind `NEXT_PUBLIC_*`.

## Scaling note
The in-process **rate limiter** (`lib/rate-limit.ts`) and the **directory cache**
(`lib/db/directory-cache.ts`) are per-instance. They're fine for a single instance;
for horizontal scaling, move both to a shared store (e.g. Redis). See
[Caching](caching-strategy.md#follow-ups).
