// POST /api/interviews/[id]/call — begin a call.
// Resolves a live interviewer voice (availability-checked, swapped if dead),
// opens an Attempt row, and returns the transient assistant config the browser
// hands to the Vapi Web SDK. The webhook later joins back via metadata.attemptId.
import { auth, currentUser } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

import { createAttempt } from "@/lib/db/attempts";
import { getInterview } from "@/lib/db/interviews";
import { ensureUser } from "@/lib/db/users";
import { resolveVoiceAgent } from "@/lib/db/voice-agents";
import { toLanguageCode } from "@/lib/language";
import { buildAssistant } from "@/lib/vapi";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  await ensureUser();

  const interview = await getInterview(id, userId);
  if (!interview) return Response.json({ error: "Interview not found" }, { status: 404 });

  const voice = await resolveVoiceAgent(interview.voice);
  const attemptId = await createAttempt(userId, interview.id);

  const clerk = await currentUser();
  const assistant = buildAssistant({
    interview,
    voice: { provider: voice.provider, voiceId: voice.voiceId },
    languageCode: toLanguageCode(interview.language),
    languageLabel: interview.language ?? "English",
    attemptId,
    interviewerName: voice.name,
    candidateFirstName: clerk?.firstName ?? undefined,
  });

  return Response.json({
    attemptId,
    publicKey: process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY ?? "",
    assistant,
  });
}
