// POST /api/vapi/webhook — Vapi's end-of-call-report callback.
//
// Vapi runs the voice pipeline and produces the authoritative transcript. This
// endpoint maps the report to { attemptId, transcript, outcome }, then reuses the
// server-driven grading decision (lib/session-ended.ts) — the single grade
// trigger. It also deletes the ephemeral per-attempt assistant.
//
// Idempotent: grading collapses via the `grade-${attemptId}` key and the
// in_progress guard, so a retry/double-fire is harmless. Auth mirrors the old
// posture: with VAPI_WEBHOOK_SECRET set, either X-Vapi-Secret or
// Authorization: Bearer must match; in production a missing secret fails closed.
import { tasks } from "@trigger.dev/sdk";
import type { NextRequest } from "next/server";

import type { gradeAttempt } from "@/trigger/grade-attempt";
import { jsonError } from "@/lib/api";
import { findAttemptForWebhook, markAbandoned, markAnalyzing, markFailed } from "@/lib/db/attempts";
import { processSessionEnded, type SessionEndedDeps } from "@/lib/session-ended";
import { deleteAssistant } from "@/lib/vapi/server";
import { classifyOutcome, mapReport, verifyVapiRequest } from "@/lib/vapi/webhook";

const SECRET = process.env.VAPI_WEBHOOK_SECRET;

const deps: SessionEndedDeps = {
  findAttempt: async (attemptId) => {
    const a = await findAttemptForWebhook(attemptId, null);
    return a ? { id: a.id, status: a.status } : null;
  },
  markAbandoned,
  markAnalyzing,
  markFailed,
  triggerGrade: async ({ attemptId, transcript, idempotencyKey }) => {
    await tasks.trigger<typeof gradeAttempt>(
      "grade-attempt",
      { attemptId, transcript },
      { idempotencyKey, idempotencyKeyTTL: "1h" },
    );
  },
};

export async function POST(req: NextRequest) {
  const auth = verifyVapiRequest(
    {
      xVapiSecret: req.headers.get("x-vapi-secret"),
      authorization: req.headers.get("authorization"),
    },
    SECRET,
    process.env.NODE_ENV === "production",
  );
  if (auth === 401) return jsonError("Unauthorized", 401);
  if (auth === 503) {
    console.error("[vapi/webhook] VAPI_WEBHOOK_SECRET is not set — rejecting callback");
    return jsonError("Callback not configured", 503);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const message = (body as { message?: unknown })?.message;
  const type = (message as { type?: unknown } | undefined)?.type;
  // We only subscribe to end-of-call-report; ack anything else so Vapi stops.
  if (type !== "end-of-call-report") return Response.json({ ok: true });

  const report = mapReport(message);

  // Resolve the attempt (+ its interview) by metadata first, then by assistant id
  // (covers a missing metadata echo). The interview's question set drives the
  // grade-vs-abandon decision (>=50% answered).
  const resolved = await findAttemptForWebhook(report.attemptId, report.assistantId);
  if (resolved) {
    const outcome = classifyOutcome(report.transcript, resolved.interview.questions ?? [], report.endedReason);
    const result = await processSessionEnded({ attemptId: resolved.id, transcript: report.transcript, outcome }, deps);
    console.info("[vapi/webhook] processed end-of-call-report", {
      attemptId: resolved.id,
      assistantId: report.assistantId,
      outcome,
      result,
      transcriptTurns: report.transcript.length,
    });
  } else {
    console.warn("[vapi/webhook] end-of-call-report with no resolvable attempt");
  }

  if (report.assistantId) await deleteAssistant(report.assistantId);

  return Response.json({ ok: true });
}
