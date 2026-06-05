// POST /api/interviews/[id]/call — begin a call.
// Resolves the interviewer persona, opens an Attempt row, and mints a LiveKit
// session: a short-lived room-join token plus token-based dispatch of the
// `talkt-interviewer` worker (spec 15) into a deterministic per-attempt room.
// The browser (spec 17) joins the room with this token; the worker conducts the
// interview and POSTs the transcript back via /api/internal/session-ended.
import { auth, currentUser } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

import { notFound, tooManyRequests, unauthorized } from "@/lib/api";
import { createAttempt } from "@/lib/db/attempts";
import { getInterview } from "@/lib/db/interviews";
import { ensureUser } from "@/lib/db/users";
import { resolveVoiceAgent } from "@/lib/db/voice-agents";
import { toLanguageCode } from "@/lib/language";
import { buildInterviewJob } from "@/lib/livekit/job";
import { mintCallToken } from "@/lib/livekit/token";
import { createRateLimiter } from "@/lib/rate-limit";

// Starting a call dispatches a worker + opens an Attempt row. 10/min/user is well
// above real use and blocks rapid-fire abuse.
const callLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const decision = callLimiter.check(userId);
  if (!decision.allowed) return tooManyRequests(decision.retryAfterMs, "Too many requests. Please wait a moment.");

  const { id } = await ctx.params;
  await ensureUser();

  const interview = await getInterview(id, userId);
  if (!interview) return notFound("Interview not found");

  const voice = await resolveVoiceAgent(interview.voice);
  const attemptId = await createAttempt(userId, interview.id);

  // Deterministic room name — no DB round trip to reconstruct it later; the
  // attemptId is also the authoritative key carried in the dispatch metadata.
  const roomName = `attempt_${attemptId}`;

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

  const { token, serverUrl } = await mintCallToken({ userId, roomName, job });

  return Response.json({
    attemptId,
    serverUrl,
    token,
    roomName,
    interviewerName: voice.name,
  });
}
