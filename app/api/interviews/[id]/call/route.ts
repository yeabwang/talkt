// POST /api/interviews/[id]/call: open an attempt and create an ephemeral Vapi assistant.
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

// Cost and abuse guard for assistant creation.
const callLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

function isLocalUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "::1";
  } catch {
    return false;
  }
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const decision = callLimiter.check(userId);
  if (!decision.allowed) return tooManyRequests(decision.retryAfterMs, "Too many requests. Please wait a moment.");

  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
  const privateKey = process.env.VAPI_PRIVATE_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const webhookUrl = process.env.VAPI_WEBHOOK_URL || appUrl;
  const webhookSecret = process.env.VAPI_WEBHOOK_SECRET;
  if (!publicKey || !privateKey || !appUrl || !webhookUrl || !webhookSecret) {
    console.error("[call] Vapi env not fully configured");
    return jsonError("Voice service is not configured.", 503);
  }
  if (process.env.NODE_ENV === "production" && (!webhookUrl || isLocalUrl(webhookUrl))) {
    console.error("[call] Vapi webhook URL must be public in production");
    return jsonError("Voice callback is not configured.", 503);
  }
  if (webhookUrl && isLocalUrl(webhookUrl)) {
    console.warn("[call] Vapi webhook URL is local; using Vapi call reconciliation fallback for grading");
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
    appUrl: webhookUrl,
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
