// Dispatch-metadata contract shared with the app's lib/livekit/job.ts (spec 16).
// SINGLE SOURCE OF TRUTH — keep this schema structurally identical to the app's
// InterviewJob. The worker reads the script from dispatch metadata, so it never
// touches Postgres on the hot path. Reject malformed metadata rather than
// improvising a script.
import { z } from "zod";

export const interviewJobSchema = z.object({
  attemptId: z.string().min(1),
  interviewTitle: z.string().min(1),
  interviewerName: z.string().min(1), // resolved persona display name, e.g. "Adi"
  persona: z.string().min(1), // voice-agent key: adi|ren|kai|mira
  languageCode: z.string().min(1), // ISO 639-1, e.g. "en"
  languageLabel: z.string().min(1), // display label for the prompt, e.g. "English"
  questions: z.array(z.string().min(1)).min(1), // ordered interviewer script
  candidateFirstName: z.string().min(1).optional(),
  maxDurationSeconds: z.number().int().positive(), // hard cap; worker enforces
});

export type InterviewJob = z.infer<typeof interviewJobSchema>;

// The end_interview tool's `reason` argument. Lives here (pure module) so it's a
// single source of truth and unit-testable without importing the LiveKit SDK.
export const endReasonSchema = z.enum(["completed", "time"]);
export type EndReason = z.infer<typeof endReasonSchema>;

/**
 * Parse + validate the dispatch metadata string into an InterviewJob. Throws on
 * non-JSON or schema violations so the entrypoint can abort the job instead of
 * conducting a half-formed interview.
 */
export function parseJob(metadata: string): InterviewJob {
  let raw: unknown;
  try {
    raw = JSON.parse(metadata);
  } catch {
    throw new Error("Invalid job metadata: not valid JSON");
  }
  const result = interviewJobSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid job metadata: ${result.error.issues.map((i) => i.message).join("; ")}`);
  }
  return result.data;
}
