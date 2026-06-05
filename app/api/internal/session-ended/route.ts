// POST /api/internal/session-ended — the LiveKit interviewer worker's callback.
//
// The worker produces the authoritative transcript and classifies the call, so
// the completed-vs-abandoned decision and the grade trigger now live here. This
// endpoint is the only grade trigger, eliminating client/server races and
// provider-specific end-reason heuristics.
//
// Idempotent by design: the worker fires this from both the session `close` event
// and an `addShutdownCallback` backstop, and retries on 5xx. Unknown / already-
// handled attempts return 200, and grading collapses into one run via the
// `grade-${attemptId}` idempotency key, so a double-fire is harmless.
//
// The decision logic + auth/parse seams are pure and live in lib/session-ended.ts
// (unit-tested in tests/unit/session-ended.test.ts); this file wires the real
// Prisma + Trigger client into them.
import { tasks } from "@trigger.dev/sdk";
import type { NextRequest } from "next/server";

import type { gradeAttempt } from "@/trigger/grade-attempt";
import { jsonError } from "@/lib/api";
import { findAttemptForWebhook, markAbandoned } from "@/lib/db/attempts";
import {
  authorizeSession,
  parseSessionEndedBody,
  processSessionEnded,
  type SessionEndedDeps,
} from "@/lib/session-ended";

const SECRET = process.env.INTERNAL_API_SECRET;

const deps: SessionEndedDeps = {
  findAttempt: async (attemptId) => {
    const a = await findAttemptForWebhook(attemptId, null);
    return a ? { id: a.id, status: a.status } : null;
  },
  markAbandoned,
  triggerGrade: async ({ attemptId, transcript, idempotencyKey }) => {
    await tasks.trigger<typeof gradeAttempt>(
      "grade-attempt",
      { attemptId, transcript },
      { idempotencyKey, idempotencyKeyTTL: "1h" },
    );
  },
};

export async function POST(req: NextRequest) {
  const auth = authorizeSession(req.headers.get("x-internal-secret"), SECRET, process.env.NODE_ENV === "production");
  if (auth === 401) return jsonError("Unauthorized", 401);
  if (auth === 503) {
    console.error("[internal/session-ended] INTERNAL_API_SECRET is not set — rejecting callback");
    return jsonError("Callback not configured", 503);
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const body = parseSessionEndedBody(raw);
  if (!body) return jsonError("Invalid payload", 400);

  // Always 200 on handled cases so the worker's retry doesn't storm.
  await processSessionEnded(body, deps);
  return Response.json({ ok: true });
}
