// Pure grading-decision logic shared by the Vapi end-of-call webhook (POST
// /api/vapi/webhook). Kept free of Prisma / the Trigger SDK so it is unit-testable
// with fakes; the route wires the real DB + Trigger client into these seams.
// (Header verification + report→body mapping live in lib/vapi/webhook.ts.)
import type { Turn } from "@/lib/transcript";

export type Outcome = "completed" | "abandoned";

export interface SessionEndedBody {
  attemptId: string;
  transcript: Turn[];
  outcome: Outcome;
}

// Injectable dependencies so the decision logic can be tested with fakes for the
// DB and the Trigger client (no Prisma / Trigger import in the test path).
export interface SessionEndedDeps {
  findAttempt: (attemptId: string) => Promise<{ id: string; status: string } | null>;
  markAbandoned: (attemptId: string) => Promise<void>;
  markAnalyzing: (attemptId: string) => Promise<void>;
  markFailed: (attemptId: string) => Promise<void>;
  triggerGrade: (args: { attemptId: string; transcript: Turn[]; idempotencyKey: string }) => Promise<void>;
}

export type SessionEndedResult = "noop" | "abandoned" | "graded";

/**
 * Core decision, free of HTTP/auth: resolve the attempt, no-op on unknown or
 * non-`in_progress` (already handled — idempotent), mark abandoned, or trigger
 * grading exactly once with the per-attempt idempotency key.
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
