import "server-only";

import { tasks } from "@trigger.dev/sdk";

import type { gradeAttempt } from "@/trigger/grade-attempt";
import { findAttemptForReconcile, findAttemptForWebhook, markAbandoned, markAnalyzing, markFailed, storeVapiIds } from "@/lib/db/attempts";
import { processSessionEnded, type SessionEndedDeps } from "@/lib/session-ended";
import { deleteAssistant, listCallsForAssistant, type VapiCallRecord } from "@/lib/vapi/server";
import { mapCallRecord } from "@/lib/vapi/webhook";

const RECONCILE_AFTER_MS = 10_000;

export type VapiReconcileResult =
  | "not-found"
  | "not-needed"
  | "too-new"
  | "missing-assistant"
  | "call-not-ended"
  | "unusable-call"
  | "abandoned"
  | "graded"
  | "noop";

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

function stringField(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function endedCall(calls: VapiCallRecord[]): VapiCallRecord | null {
  return calls.find((call) => stringField(call.status) === "ended") ?? null;
}

export async function reconcileAttemptFromVapi(attemptId: string, userId: string, now = new Date()): Promise<VapiReconcileResult> {
  const attempt = await findAttemptForReconcile(attemptId, userId);
  if (!attempt) return "not-found";
  if (attempt.status !== "in_progress") return "not-needed";
  if (!attempt.vapiAssistantId) return "missing-assistant";
  if (now.getTime() - attempt.startedAt.getTime() < RECONCILE_AFTER_MS) return "too-new";

  const call = endedCall(await listCallsForAssistant(attempt.vapiAssistantId));
  if (!call) return "call-not-ended";

  const report = mapCallRecord(call, attempt.id);
  if (!report) return "unusable-call";

  const callId = stringField(call.id);
  if (callId && callId !== attempt.vapiCallId) {
    await storeVapiIds(attempt.id, { callId });
  }

  const result = await processSessionEnded({ attemptId: attempt.id, transcript: report.transcript, outcome: report.outcome }, deps);
  console.info("[vapi/reconcile] processed ended call", {
    attemptId: attempt.id,
    callId,
    assistantId: report.assistantId,
    outcome: report.outcome,
    result,
    transcriptTurns: report.transcript.length,
  });

  if (report.assistantId) await deleteAssistant(report.assistantId);
  return result;
}
