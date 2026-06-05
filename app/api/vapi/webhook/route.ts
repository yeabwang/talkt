// POST /api/vapi/webhook — Vapi server webhook (end-of-call-report only).
// Server-side fallback to the client-triggered grade: resolves the attempt and
// hands its transcript to the `grade-attempt` Trigger.dev task. The task is
// idempotent (status-guarded), so if the browser already kicked off grading this
// is a no-op. Always returns 200 so Vapi doesn't retry.
import { tasks } from "@trigger.dev/sdk";
import type { NextRequest } from "next/server";

import type { gradeAttempt } from "@/trigger/grade-attempt";
import { jsonError } from "@/lib/api";
import { findAttemptForWebhook, markAbandoned } from "@/lib/db/attempts";

const WEBHOOK_SECRET = process.env.VAPI_WEBHOOK_SECRET;

function str(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}

// endedReason values that mean the interview reached a real finish (vs. the
// candidate bailing): Vapi ended it for the assistant/time, not the customer.
const COMPLETION_REASONS = ["max-duration", "assistant-ended", "assistant-said-end", "assistant-forwarded"];
function isCompletionReason(reason: string | null): boolean {
  if (!reason) return false;
  const r = reason.toLowerCase();
  return COMPLETION_REASONS.some((p) => r.includes(p));
}

// True when the end-of-call report shows the assistant invoked the end_interview
// tool — the unambiguous natural-completion signal (the customer-ended client
// stop we do for that path can't be told apart by endedReason alone).
function calledEndInterview(value: unknown, depth = 0): boolean {
  if (depth > 6 || !value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((v) => calledEndInterview(v, depth + 1));
  const rec = value as Record<string, unknown>;
  if (rec.name === "end_interview") return true;
  const fn = rec.function;
  if (fn && typeof fn === "object" && (fn as Record<string, unknown>).name === "end_interview") return true;
  return Object.values(rec).some((v) => calledEndInterview(v, depth + 1));
}

/** Normalize the many transcript shapes Vapi may send into {role, text} turns. */
function extractTurns(message: Record<string, unknown>): { role: string; text: string }[] {
  const artifact = (message.artifact ?? {}) as Record<string, unknown>;
  const messages = (Array.isArray(artifact.messages) ? artifact.messages : message.messages) as
    | { role?: string; message?: string; content?: string }[]
    | undefined;
  if (Array.isArray(messages)) {
    return messages
      .map((m) => ({ role: m.role === "user" ? "user" : "assistant", text: (m.message ?? m.content ?? "").trim() }))
      .filter((t) => t.text);
  }
  const text = str(message.transcript) ?? str(artifact.transcript);
  return text ? [{ role: "assistant", text }] : [];
}

export async function POST(req: NextRequest) {
  // Verify the shared secret Vapi echoes back from assistant.server.secret. In
  // production a missing secret is a misconfiguration, not a bypass — fail closed.
  if (WEBHOOK_SECRET) {
    const provided = req.headers.get("x-vapi-secret");
    if (provided !== WEBHOOK_SECRET) return jsonError("Unauthorized", 401);
  } else if (process.env.NODE_ENV === "production") {
    console.error("[vapi/webhook] VAPI_WEBHOOK_SECRET is not set — rejecting unverified webhook");
    return jsonError("Webhook not configured", 503);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: true });
  }

  const message = (body.message ?? body) as Record<string, unknown>;
  if (message.type !== "end-of-call-report") return Response.json({ ok: true });

  const call = (message.call ?? {}) as Record<string, unknown>;
  const callAssistant = (call.assistant ?? message.assistant ?? {}) as Record<string, unknown>;
  const metadata = (call.metadata ?? callAssistant.metadata ?? {}) as Record<string, unknown>;
  const attemptId = str(metadata.attemptId);
  const vapiCallId = str(call.id);

  const attempt = await findAttemptForWebhook(attemptId, vapiCallId);
  if (!attempt) return Response.json({ ok: true });
  // Not `in_progress` → already graded/in flight (client beat us) or already
  // marked `abandoned`. Nothing to do.
  if (attempt.status !== "in_progress") return Response.json({ ok: true });

  // Grade only interviews that actually completed: the assistant invoked
  // end_interview, or Vapi ended it for time. A candidate mid-call hang-up has
  // neither signal — mark it abandoned and never score it. This is independent
  // of the client's abandon PATCH, so a lost/late PATCH can't slip a partial in.
  const endedReason = str(message.endedReason) ?? str(call.endedReason);
  if (!calledEndInterview(message) && !isCompletionReason(endedReason)) {
    await markAbandoned(attempt.id);
    return Response.json({ ok: true });
  }

  const transcript = extractTurns(message);
  // Same idempotency key as the client path — if the browser already triggered
  // grading for this attempt, this collapses into that run (no double grade).
  await tasks.trigger<typeof gradeAttempt>(
    "grade-attempt",
    { attemptId: attempt.id, transcript },
    { idempotencyKey: `grade-${attempt.id}`, idempotencyKeyTTL: "1h" },
  );

  return Response.json({ ok: true });
}
