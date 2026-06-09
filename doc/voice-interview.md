# Voice Interview

Voice calls run through Vapi. The server owns the assistant prompt, question set,
private key, and webhook secret. The browser receives only the assistant id and
public key.

## Lifecycle

```text
POST /api/interviews/:id/call
  -> create Attempt
  -> create ephemeral Vapi assistant
  -> browser starts @vapi-ai/web
  -> browser posts transcript to /api/attempts/:id/grade
  -> Vapi webhook/reconcile may also trigger grading
```

## Start Call Route

Source: [`app/api/interviews/[id]/call/route.ts`](../app/api/interviews/[id]/call/route.ts).

`POST /api/interviews/:id/call` does the following:

1. Requires a Clerk session.
2. Rate limits to 10 calls/min/user.
3. Checks Vapi env: public key, private key, app URL, webhook URL, webhook secret.
4. Rejects local webhook URLs in production.
5. Ensures the Clerk user exists in Postgres.
6. Loads the interview with owner/visibility rules.
7. Resolves the interviewer persona and voice.
8. Creates an `Attempt`.
9. Builds and creates an ephemeral Vapi assistant.
10. Stores the assistant id on the attempt.
11. Returns `{ attemptId, assistantId, publicKey, interviewerName }`.

On Vapi failure, the attempt is marked `failed`; any created assistant is deleted
when possible.

## Assistant Payload

Sources:

- [`lib/vapi/job.ts`](../lib/vapi/job.ts)
- [`lib/vapi/assistant.ts`](../lib/vapi/assistant.ts)
- [`lib/vapi/prompt.ts`](../lib/vapi/prompt.ts)
- [`lib/vapi/voices.ts`](../lib/vapi/voices.ts)

The assistant includes:

- first message and system prompt
- stored interview questions
- persisted persona key
- language-specific voice config
- Vapi model and transcriber config
- turn-taking plans
- `endCall` tool
- max duration cap
- webhook URL and auth header
- metadata with `attemptId`

## Turn Handling

The Vapi config favors interview-style pauses:

- Assistant speaks first.
- English uses smart endpointing.
- Other languages use patient transcription endpointing.
- Stop-speaking rules reduce false interruptions.
- The assistant ends via the `endCall` tool, with max duration as fallback.

The browser hook is `components/talkt/use-vapi-call.ts`. It captures transcript
turns for the primary grading route.

## Webhook Fallback

Source: [`app/api/vapi/webhook/route.ts`](../app/api/vapi/webhook/route.ts).

The handler:

- verifies `X-Vapi-Secret` or `Authorization: Bearer`
- fails closed in production if `VAPI_WEBHOOK_SECRET` is missing
- maps Vapi report payloads with `mapReport`
- classifies completed vs abandoned with the half-answered rule
- triggers `grade-attempt` idempotently
- deletes the ephemeral assistant

Current caveat: `proxy.ts` protects all non-auth routes. Add a public exception
for `/api/vapi/webhook` before depending on Vapi server callbacks in production.

## Local Development

Vapi cannot call `localhost`.

Options:

- Set `VAPI_WEBHOOK_URL` to a public tunnel for real callbacks.
- Skip the tunnel and rely on reconciliation. `GET /api/attempts/:id` calls
  `reconcileAttemptFromVapi`, reads the completed Vapi call record, maps it like
  a webhook report, and triggers the same grade task.

Fresh browser calls still use `POST /api/attempts/:id/grade` as the primary path.

## Voice Personas

Persona definitions live in `lib/catalog.ts` and seed records in `VoiceAgent`.
Provider voice ids are resolved per language in `lib/vapi/voices.ts`.

Override the catalog with `VAPI_VOICE_CATALOG`.
