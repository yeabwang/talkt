// Grading decision logic shared by the Vapi webhook route and tests.
import type { Turn } from "@/lib/transcript";

export type Outcome = "completed" | "abandoned";

export interface SessionEndedBody {
  attemptId: string;
  transcript: Turn[];
  outcome: Outcome;
}

// Injectable dependencies keep the core decision path unit-testable.
export interface SessionEndedDeps {
  findAttempt: (attemptId: string) => Promise<{ id: string; status: string } | null>;
  markAbandoned: (attemptId: string) => Promise<void>;
  markAnalyzing: (attemptId: string) => Promise<void>;
  markFailed: (attemptId: string) => Promise<void>;
  triggerGrade: (args: { attemptId: string; transcript: Turn[]; idempotencyKey: string }) => Promise<void>;
}

export type SessionEndedResult = "noop" | "abandoned" | "graded";

/**
 * Resolve the attempt, mark abandoned when appropriate, or trigger grading once.
 */
export async function processSessionEnded(body: SessionEndedBody, deps: SessionEndedDeps): Promise<SessionEndedResult> {
  const attempt = await deps.findAttempt(body.attemptId);
  if (!attempt || attempt.status !== "in_progress") return "noop";

  if (body.outcome === "abandoned") {
    await deps.markAbandoned(attempt.id);
    return "abandoned";
  }

  await deps.markAnalyzing(attempt.id);
  try {
    await deps.triggerGrade({
      attemptId: attempt.id,
      transcript: body.transcript,
      idempotencyKey: `grade-${attempt.id}`,
    });
  } catch (error) {
    await deps.markFailed(attempt.id);
    throw error;
  }
  return "graded";
}
