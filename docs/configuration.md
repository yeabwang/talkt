# Configuration

All configuration is via environment variables. Copy [`.env.example`](../.env.example)
to `.env.local` and fill in real values — **never commit `.env.local`** (it is
git-ignored; only `.env.example` is tracked).

```bash
cp .env.example .env.local
```

## App

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | yes | Public base URL. Used as the default Vapi webhook base. |

## Clerk (auth)

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | yes | Clerk dashboard → API Keys |
| `CLERK_SECRET_KEY` | yes | **Secret.** Server-side. |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | yes | Default `/sign-in`. Also defines the public routes in `proxy.ts`. |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | yes | Default `/sign-up`. |

## Database (PostgreSQL + Prisma)

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | **Secret.** Pooled connection used by the app. |
| `DIRECT_URL` | yes | **Secret.** Direct (unpooled) connection for migrations. |

## Vercel Blob

| Variable | Required | Notes |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | yes | **Secret.** Stores raw analysis artifacts. |

## DeepSeek (LLM)
The builder and the grader read either the generic `LLM_*` names **or** the
`DEEPSEEK_*` names — whichever is set (`lib/llm.ts`).

| Variable | Required | Notes |
|---|---|---|
| `DEEPSEEK_API_KEY` (or `LLM_API_KEY`) | yes | **Secret.** |
| `DEEPSEEK_BASE_URL` (or `LLM_BASE_URL`) | no | Default `https://api.deepseek.com`. |
| `DEEPSEEK_MODEL` (or `LLM_MODEL`) | no | Default `deepseek-chat`. |

## Vapi (voice)

| Variable | Required | Notes |
|---|---|---|
| `VAPI_PRIVATE_KEY` | yes | **Secret.** Server-side: create/delete ephemeral assistants. |
| `NEXT_PUBLIC_VAPI_PUBLIC_KEY` | yes | Client-side: `@vapi-ai/web` call auth. |
| `VAPI_WEBHOOK_SECRET` | yes | **Secret.** Echoed back as `X-Vapi-Secret`; a missing value **fails closed in production**. |
| `VAPI_WEBHOOK_URL` | no | Public callback base. Required for real local webhooks (ngrok / Vapi CLI). Falls back to `NEXT_PUBLIC_APP_URL`; missed callbacks are repaired by reconciliation. |
| `VAPI_WEBHOOK_CREDENTIAL_ID` | no | Optional Vapi credential id for webhook auth. |
| `VAPI_MODEL_PROVIDER` | no | Default `openai`. Vapi-native model (billed by Vapi). |
| `VAPI_MODEL` | no | Default `gpt-4.1`. |
| `VAPI_TRANSCRIBER_PROVIDER` | no | Default `deepgram`. |
| `VAPI_TRANSCRIBER_MODEL` | no | Default `nova-3`. |
| <a id="vapi-voice"></a>`VAPI_VOICE_CATALOG` | no | JSON persona→voice catalog override (see `lib/vapi/voices.ts`). |

## Trigger.dev
Grading runs as a Trigger.dev task (`trigger/grade-attempt.ts`, config in
`trigger.config.ts`). Provide the Trigger.dev credentials per their CLI/dashboard
setup for your environment when deploying background jobs.

## Which values are secret?
Everything marked **Secret** above, plus all database/connection strings. The
`NEXT_PUBLIC_*` values are exposed to the browser **by design** (publishable keys
only) — never put a secret behind a `NEXT_PUBLIC_` name. See
[Security](security.md#secrets).
