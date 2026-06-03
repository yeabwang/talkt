// POST /api/vapi/webhook — Vapi server webhook (end-of-call-report only).
// On a finished call: persist the full transcript to Blob, move the attempt to
// `analyzing`, run DeepSeek analysis, store Feedback, flip to `ready`. Always
// returns 200 so Vapi doesn't retry; failures flip the attempt to `failed`.
import type { NextRequest } from "next/server";

import { analyzeTranscript } from "@/lib/analysis";
import { saveRawAnalysis, saveTranscript } from "@/lib/blob";
import { findAttemptForWebhook, markAnalyzing, markFailed, storeFeedback } from "@/lib/db/attempts";

const WEBHOOK_SECRET = process.env.VAPI_WEBHOOK_SECRET;

function str(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}

/** Pull a usable transcript string from the many shapes Vapi may send. */
function extractTranscript(message: Record<string, unknown>): { text: string; raw: unknown } {
  const artifact = (message.artifact ?? {}) as Record<string, unknown>;
  const text = str(message.transcript) ?? str(artifact.transcript);
  if (text) return { text, raw: artifact.messages ?? message.messages ?? text };

  const messages = (Array.isArray(artifact.messages) ? artifact.messages : message.messages) as
    | { role?: string; message?: string; content?: string }[]
    | undefined;
  if (Array.isArray(messages)) {
    const joined = messages
      .map((m) => `${m.role ?? "?"}: ${m.message ?? m.content ?? ""}`.trim())
      .filter(Boolean)
      .join("\n");
    return { text: joined, raw: messages };
  }
  return { text: "", raw: message };
}

export async function POST(req: NextRequest) {
  // Verify the shared secret Vapi echoes back from assistant.server.secret.
  if (WEBHOOK_SECRET) {
    const provided = req.headers.get("x-vapi-secret");
    if (provided !== WEBHOOK_SECRET) return new Response("Unauthorized", { status: 401 });
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
  // Idempotent: ignore duplicate reports for an already-processed attempt.
  if (attempt.status === "ready" || attempt.status === "analyzing") return Response.json({ ok: true });

  const { text, raw } = extractTranscript(message);

  try {
    const transcriptUrl = await saveTranscript(attempt.id, raw);
    await markAnalyzing(attempt.id, transcriptUrl);

    if (!text) {
      // Empty transcript (e.g. immediate hang-up) — nothing to score.
      await markFailed(attempt.id);
      return Response.json({ ok: true });
    }

    const result = await analyzeTranscript(attempt.interview, text);
    const rawUrl = await saveRawAnalysis(attempt.id, result);
    await storeFeedback(attempt.id, result, rawUrl);
  } catch {
    await markFailed(attempt.id);
  }

  return Response.json({ ok: true });
}
