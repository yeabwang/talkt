// The dispatch-metadata contract: the pure-data job the call route hands to the
// LiveKit worker (spec 15) as the agent dispatch metadata. SINGLE SOURCE OF
// TRUTH — keep `InterviewJob` structurally identical to agent/src/job.ts's zod
// schema. This module builds the job; it deliberately does NOT assemble any
// prompt text — prompt/greeting/delivery-cue assembly lives in the worker so
// there is one place that knows the interviewer's voice.
import type { Interview } from "@/components/talkt/data";

/** Pure dispatch payload the worker parses + validates (mirror of agent/src/job.ts). */
export interface InterviewJob {
  attemptId: string;
  interviewTitle: string;
  interviewerName: string; // resolved persona display name (e.g. "Adi")
  persona: string; // voice-agent key: adi|ren|kai|mira
  languageCode: string; // ISO 639-1, e.g. "en"
  languageLabel: string; // display label for the prompt, e.g. "English"
  questions: string[]; // ordered interviewer script
  candidateFirstName?: string;
  maxDurationSeconds: number; // hard cap; worker enforces
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

/**
 * Build the dispatch job from the same inputs the old buildAssistant() took.
 * `maxDurationSeconds` preserves the previous cap math (estimated minutes + 2,
 * clamped to [120, 3600]).
 */
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
