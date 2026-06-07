// POST /api/interviews/[id]/call — begin a call.
// Resolves the interviewer persona, opens an Attempt row, builds the full
// assistant config in code, and creates an EPHEMERAL Vapi assistant server-side
// (private key). Only the assistant id + public key reach the browser, so the
// system prompt and interview questions never leave the server. The browser
// (@vapi-ai/web) starts the call with the assistant id; Vapi runs the pipeline
// and POSTs the transcript back to /api/vapi/webhook.
import { auth, currentUser } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

import { jsonError, notFound, tooManyRequests, unauthorized } from "@/lib/api";
import { createAttempt, markFailed, storeVapiIds } from "@/lib/db/attempts";
import { getInterview } from "@/lib/db/interviews";
import { ensureUser } from "@/lib/db/users";
import { resolveVoiceAgent } from "@/lib/db/voice-agents";
import { toLanguageCode } from "@/lib/language";
import { createRateLimiter } from "@/lib/rate-limit";
import { buildVapiAssistant } from "@/lib/vapi/assistant";
import { buildInterviewJob } from "@/lib/vapi/job";
import { createAssistant, deleteAssistant } from "@/lib/vapi/server";

// Starting a call creates an ephemeral assistant + opens an Attempt row. 10/min/user
// is well above real use and blocks rapid-fire abuse.
const callLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const decision = callLimiter.check(userId);
  if (!decision.allowed) return tooManyRequests(decision.retryAfterMs, "Too many requests. Please wait a moment.");

  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
  const privateKey = process.env.VAPI_PRIVATE_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const webhookSecret = process.env.VAPI_WEBHOOK_SECRET;
  if (!publicKey || !privateKey || !appUrl || !webhookSecret) {
    console.error("[call] Vapi env not fully configured");
    return jsonError("Voice service is not configured.", 503);
  }

  const { id } = await ctx.params;
  await ensureUser();

  const interview = await getInterview(id, userId);
  if (!interview) return notFound("Interview not found");

  const voice = await resolveVoiceAgent(interview.voice);
  const attemptId = await createAttempt(userId, interview.id);

  const clerk = await currentUser();
  const job = buildInterviewJob({
    interview,
    persona: { key: voice.key, name: voice.name },
    languageCode: toLanguageCode(interview.language),
    languageLabel: interview.language ?? "English",
    attemptId,
    interviewerName: voice.name,
    candidateFirstName: clerk?.firstName ?? undefined,
  });

  const assistantPayload = buildVapiAssistant(job, {
    appUrl,
    webhookSecret,
    webhookCredentialId: process.env.VAPI_WEBHOOK_CREDENTIAL_ID,
    modelProvider: process.env.VAPI_MODEL_PROVIDER || "openai",
    model: process.env.VAPI_MODEL || "gpt-4.1",
    transcriberProvider: process.env.VAPI_TRANSCRIBER_PROVIDER || "deepgram",
    transcriberModel: process.env.VAPI_TRANSCRIBER_MODEL || "nova-3",
  });

  let assistantId: string;
  try {
    assistantId = await createAssistant(assistantPayload);
  } catch (err) {
    console.error("[call] Vapi assistant create failed:", err);
    await markFailed(attemptId);
    return jsonError("Could not start the interview. Please try again.", 502);
  }

  try {
    await storeVapiIds(attemptId, { assistantId });
  } catch (err) {
    console.error("[call] Vapi assistant id store failed:", err);
    await markFailed(attemptId);
    await deleteAssistant(assistantId);
    return jsonError("Could not start the interview. Please try again.", 502);
  }

  return Response.json({
    attemptId,
    assistantId,
    publicKey,
    interviewerName: voice.name,
  });
}
