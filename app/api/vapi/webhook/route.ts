// POST /api/vapi/webhook — Vapi server webhook (end-of-call-report only).
// Server-side fallback to the client-triggered grade: resolves the attempt and
// hands its transcript to the `grade-attempt` Trigger.dev task. The task is
// idempotent (status-guarded), so if the browser already kicked off grading this
// is a no-op. Always returns 200 so Vapi doesn't retry.
import { tasks } from "@trigger.dev/sdk";
import type { NextRequest } from "next/server";

import type { gradeAttempt } from "@/trigger/grade-attempt";
import { findAttemptForWebhook } from "@/lib/db/attempts";

const WEBHOOK_SECRET = process.env.VAPI_WEBHOOK_SECRET;

function str(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
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
    if (provided !== WEBHOOK_SECRET) return new Response("Unauthorized", { status: 401 });
  } else if (process.env.NODE_ENV === "production") {
    console.error("[vapi/webhook] VAPI_WEBHOOK_SECRET is not set — rejecting unverified webhook");
    return new Response("Webhook not configured", { status: 503 });
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
  // Idempotent: grading already done or in flight (likely the client beat us).
  if (attempt.status === "ready" || attempt.status === "analyzing") return Response.json({ ok: true });

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
