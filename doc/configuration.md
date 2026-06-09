# Configuration

Copy the template and fill local values:

```bash
cp .env.example .env.local
```

Never commit `.env.local`.

## App

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | yes | Public app base URL. Used as default Vapi webhook base. |

## Clerk

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | yes | Browser-safe Clerk key |
| `CLERK_SECRET_KEY` | yes | Server-only |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | yes | Default `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | yes | Default `/sign-up` |

`proxy.ts` uses the sign-in and sign-up URLs as its current public matcher.

## Database

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | App runtime connection. Pooled Postgres or `prisma+postgres://`. |
| `DIRECT_URL` | yes | Direct connection for migrations. |

`lib/prisma.ts` uses Prisma Accelerate for `prisma+postgres://`; otherwise it
uses `@prisma/adapter-pg`.

## Blob

| Variable | Required | Notes |
| --- | --- | --- |
| `BLOB_READ_WRITE_TOKEN` | yes | Stores raw DeepSeek analysis output. |

## DeepSeek / LLM

The code accepts either `LLM_*` or `DEEPSEEK_*`.

| Variable | Required | Default |
| --- | --- | --- |
| `LLM_API_KEY` or `DEEPSEEK_API_KEY` | yes | none |
| `LLM_BASE_URL` or `DEEPSEEK_BASE_URL` | no | `https://api.deepseek.com` |
| `LLM_MODEL` or `DEEPSEEK_MODEL` | no | `deepseek-chat` |

## Vapi

| Variable | Required | Notes |
| --- | --- | --- |
| `VAPI_PRIVATE_KEY` | yes | Server-side assistant create/delete |
| `NEXT_PUBLIC_VAPI_PUBLIC_KEY` | yes | Browser call auth |
| `VAPI_WEBHOOK_SECRET` | yes | Callback secret; missing value fails closed in production |
| `VAPI_WEBHOOK_URL` | no | Public callback base. Falls back to `NEXT_PUBLIC_APP_URL`. |
| `VAPI_WEBHOOK_CREDENTIAL_ID` | no | Optional Vapi credential id for callback auth |
| `VAPI_MODEL_PROVIDER` | no | Default `openai` |
| `VAPI_MODEL` | no | Default `gpt-4.1` |
| `VAPI_TRANSCRIBER_PROVIDER` | no | Default `deepgram` |
| `VAPI_TRANSCRIBER_MODEL` | no | Default `nova-3` |
| `VAPI_VOICE_CATALOG` | no | JSON persona voice override |

Production rejects local webhook URLs.

## Trigger.dev

The web app calls `tasks.trigger` and `auth.createPublicToken`; the worker runs
`trigger/grade-attempt.ts`.

Set Trigger.dev credentials through the Trigger CLI, dashboard, or environment.
The SDK uses `TRIGGER_SECRET_KEY` and optional `TRIGGER_API_URL` when not already
configured by the runtime.

The worker also needs the app runtime env used by grading:

- `DATABASE_URL`
- `BLOB_READ_WRITE_TOKEN`
- `LLM_*` or `DEEPSEEK_*`

## Public vs Secret

Only `NEXT_PUBLIC_*` values are intended for the browser. Treat everything else
as secret unless the provider explicitly marks it publishable.
