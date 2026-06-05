// Pure logic for the worker's session-ended callback (POST
// /api/internal/session-ended). Kept free of Prisma / the Trigger SDK so it is
// unit-testable with fakes; the route (app/api/internal/session-ended/route.ts)
// wires the real DB + Trigger client into these seams.
import { timingSafeEqual } from "node:crypto";

import { sanitizeTranscript, type Turn } from "@/lib/transcript";

export type Outcome = "completed" | "abandoned";

export interface SessionEndedBody {
  attemptId: string;
  transcript: Turn[];
  outcome: Outcome;
}

/** Constant-time secret match (avoids leaking length/prefix via timing). */
function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Authorize the callback. Mirrors the old webhook's posture: with a configured
 * secret the header must match (else 401); without one, fail closed in
 * production (503) but allow through in dev so local worker testing works.
 */
export function authorizeSession(
  provided: string | null,
  secret: string | undefined,
  isProd: boolean,
): "ok" | 401 | 503 {
  if (secret) return provided && constantTimeEqual(provided, secret) ? "ok" : 401;
  return isProd ? 503 : "ok";
}

/** Parse + validate the worker payload. Null on any malformed field. */
export function parseSessionEndedBody(raw: unknown): SessionEndedBody | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  if (typeof rec.attemptId !== "string" || !rec.attemptId) return null;
  if (rec.outcome !== "completed" && rec.outcome !== "abandoned") return null;
  return {
    attemptId: rec.attemptId,
    outcome: rec.outcome,
    transcript: sanitizeTranscript(rec.transcript),
  };
}

// Injectable dependencies so the decision logic can be tested with fakes for the
// DB and the Trigger client (no Prisma / Trigger import in the test path).
export interface SessionEndedDeps {
  findAttempt: (attemptId: string) => Promise<{ id: string; status: string } | null>;
  markAbandoned: (attemptId: string) => Promise<void>;
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

  await deps.triggerGrade({
    attemptId: attempt.id,
    transcript: body.transcript,
    idempotencyKey: `grade-${attempt.id}`,
  });
  return "graded";
}
