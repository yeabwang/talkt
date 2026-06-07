// Resolved interviewer script consumed by the Vapi assistant builder.
import type { Interview } from "@/components/talkt/data";

export interface InterviewJob {
  attemptId: string;
  interviewTitle: string;
  interviewerName: string;
  persona: string;
  languageCode: string;
  languageLabel: string;
  questions: string[];
  candidateFirstName?: string;
  maxDurationSeconds: number;
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

/** Build the job and clamp the Vapi duration cap. */
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
