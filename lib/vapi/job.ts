// The interview "job": the resolved, ordered interviewer script the assistant
// builder consumes. Ported from the old lib/livekit/job.ts — same fields, minus
// anything LiveKit-specific. Pure data; no SDK imports.
import type { Interview } from "@/components/talkt/data";

export interface InterviewJob {
  attemptId: string;
  interviewTitle: string;
  interviewerName: string; // resolved persona display name (e.g. "Adi")
  persona: string; // voice-agent key: adi|ren|kai|mira
  languageCode: string; // ISO 639-1, e.g. "en"
  languageLabel: string; // display label for the prompt, e.g. "English"
  questions: string[]; // ordered interviewer script
  candidateFirstName?: string;
  maxDurationSeconds: number; // hard cap; Vapi enforces via assistant.maxDurationSeconds
}

export interface BuildInterviewJobArgs {
  interview: Interview;
  persona: { key: string; name: string };
  languageCode: string;
  languageLabel: string;
  attemptId: string;
  interviewerName: string;
  candidateFirstName?: string;
}

/** Build the job. `maxDurationSeconds` preserves the previous cap math
 * (estimated minutes + 2, clamped to [120, 3600]). */
export function buildInterviewJob(args: BuildInterviewJobArgs): InterviewJob {
  const { interview, persona, languageCode, languageLabel, attemptId, interviewerName, candidateFirstName } = args;
  return {
    attemptId,
    interviewTitle: interview.title,
    interviewerName,
    persona: persona.key,
    languageCode,
    languageLabel,
    questions: interview.questions ?? [],
    ...(candidateFirstName ? { candidateFirstName } : {}),
    maxDurationSeconds: Math.min(3600, Math.max(120, ((interview.minutes || 15) + 2) * 60)),
  };
}
