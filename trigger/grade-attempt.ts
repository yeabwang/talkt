// Durable grading task for completed interviews.
// Results are written to the attempt row; the UI polls for readiness.
import { AbortTaskRunError, logger, metadata, task } from "@trigger.dev/sdk";

import { analyzeTranscript } from "@/lib/analysis";
import { saveRawAnalysis } from "@/lib/blob";
import { findAttemptForWebhook, markAnalyzing, markFailed, storeFeedback } from "@/lib/db/attempts";

export interface GradeAttemptPayload {
  attemptId: string;
  transcript: { role: string; text: string }[];
}

/** Grading step metadata, in order. */
export type GradeStep = "received" | "scoring" | "saving" | "done";

/** Flatten captured turns for the analyzer. */
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

    // Idempotent retry: another trigger already completed grading.
    if (attempt.status === "ready") {
      metadata.set("step", "done" satisfies GradeStep);
      return { status: "ready" as const, alreadyGraded: true };
    }

    const text = turnsToText(transcript);
    if (!text) {
      // Empty transcripts are terminal and should not retry.
      await markFailed(attemptId);
      throw new AbortTaskRunError("Transcript was empty");
    }

    // Transcript stays in the task payload; persisted output is structured feedback.
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
