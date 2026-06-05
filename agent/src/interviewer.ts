// The interviewer agent (voice.Agent subclass) and its end_interview tool.
//
// The tool is the natural-completion path: the model calls it once, after saying
// goodbye, to end the interview. The worker-side time cap (index.ts) is the
// second path and reuses the same onEnd callback so both converge on one close.
import { llm, voice } from "@livekit/agents";
import { z } from "zod";

import { type EndReason, endReasonSchema, type InterviewJob } from "./job.js";
import { systemPrompt } from "./prompt.js";

export type { EndReason };

/**
 * Build the `end_interview` function tool. `onEnd` is a closure the entrypoint
 * owns: it records the reason and closes the session (guarding double-close
 * against the time-cap path).
 */
export function createEndInterviewTool(onEnd: (reason: EndReason) => Promise<void>) {
  return llm.tool({
    description: "Call this once, immediately after saying goodbye, to end the interview.",
    parameters: z.object({
      reason: endReasonSchema.describe("Why the interview ended."),
    }),
    execute: async ({ reason }) => {
      setTimeout(() => {
        void onEnd(reason).catch((err) => {
          console.error("[interviewer] failed to close interview:", err);
        });
      }, 0);
      return "The interview has ended.";
    },
  });
}

export class InterviewerAgent extends voice.Agent {
  constructor(job: InterviewJob, onEnd: (reason: EndReason) => Promise<void>) {
    super({
      instructions: systemPrompt(job),
      tools: { end_interview: createEndInterviewTool(onEnd) },
    });
  }
}
