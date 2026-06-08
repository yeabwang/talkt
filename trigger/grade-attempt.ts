// Durable grading task. The completed interview's transcript is graded here
// (one DeepSeek call) instead of inline in the request, so the trigger returns
// immediately. Triggered from POST /api/attempts/[id]/grade (client, with the
// captured transcript) and from the Vapi webhook/reconcile fallback; idempotent
// via the `grade-${attemptId}` key. Progress is published to run metadata
// (`step`) and streamed to the results screen via Realtime.
import { AbortTaskRunError, logger, metadata, task } from "@trigger.dev/sdk";

import { analyzeTranscript } from "@/lib/analysis";
import { saveRawAnalysis } from "@/lib/blob";
import { findAttemptForWebhook, markAnalyzing, markFailed, storeFeedback } from "@/lib/db/attempts";

export interface GradeAttemptPayload {
  attemptId: string;
  transcript: { role: string; text: string }[];
}

/** The grading steps streamed to the UI, in order. */
export type GradeStep = "received" | "scoring" | "saving" | "done";

/** Flatten the captured turns into the text the analyzer scores. */
function turnsToText(transcript: { role: string; text: string }[]): string {
  return transcript
    .map((t) => `${t.role === "user" ? "user" : "assistant"}: ${(t.text ?? "").trim()}`)
    .filter((line) => line.length > "assistant: ".length)
    .join("\n");
}

export const gradeAttempt = task({
  id: "grade-attempt",
  maxDuration: 300, // 5 min ceiling for the whole grade
  retry: { maxAttempts: 3, factor: 2, minTimeoutInMs: 1_000, maxTimeoutInMs: 15_000 },
  run: async (payload: GradeAttemptPayload) => {
    const { attemptId, transcript } = payload;
    metadata.set("step", "received" satisfies GradeStep);

    const attempt = await findAttemptForWebhook(attemptId, null);
    if (!attempt) throw new AbortTaskRunError(`Attempt ${attemptId} not found`);

    // Idempotent: another trigger (webhook race / retry) already graded this.
    if (attempt.status === "ready") {
      metadata.set("step", "done" satisfies GradeStep);
      return { status: "ready" as const, alreadyGraded: true };
    }

    const text = turnsToText(transcript);
    if (!text) {
      // Empty transcript (immediate hang-up) — nothing to score. Don't retry.
      await markFailed(attemptId);
      throw new AbortTaskRunError("Transcript was empty");
    }

    // No transcript blob: the raw transcript lives in this run's payload (Trigger
    // replays it on retry), so we never persist it to our storage. The durable
    // record is the structured Feedback + the raw-analysis blob.
    await markAnalyzing(attemptId);

    metadata.set("step", "scoring" satisfies GradeStep);
    const result = await analyzeTranscript(attempt.interview, text);

    metadata.set("step", "saving" satisfies GradeStep);
    const rawUrl = await saveRawAnalysis(attemptId, result);
    await storeFeedback(attemptId, result, rawUrl);

    metadata.set("step", "done" satisfies GradeStep);
    logger.info("Graded attempt", { attemptId, overallScore: result.overallScore });
    return { status: "ready" as const, overallScore: result.overallScore };
  },
});
