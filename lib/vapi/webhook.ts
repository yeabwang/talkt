// Pure logic for the Vapi end-of-call-report webhook. Kept free of Prisma / the
// Trigger SDK / network so it is unit-testable; the route wires the real deps.
import { timingSafeEqual } from "node:crypto";

import { sanitizeTranscript, type Turn } from "@/lib/transcript";

export type Outcome = "completed" | "abandoned";

// Reasons that mean the candidate (or a setup failure) ended the call before a
// real interview happened — never scored. Everything else with answers is graded.
const ABANDON_REASONS = new Set<string>([
  "customer-ended-call",
  "customer-did-not-answer",
  "customer-did-not-give-microphone-permission",
  "customer-busy",
  "assistant-error",
  "pipeline-error",
  "no-transcript",
]);

/** Constant-time compare of the X-Vapi-Secret header against our shared secret.
 * Mirrors the old worker-callback posture: with a secret set, the header must
 * match (else reject); without one, allow in dev only. */
export function verifyVapiSecret(provided: string | null, secret: string | undefined, isProd: boolean): "ok" | 401 | 503 {
  if (secret) {
    if (!provided) return 401;
    const a = Buffer.from(provided);
    const b = Buffer.from(secret);
    return a.length === b.length && timingSafeEqual(a, b) ? "ok" : 401;
  }
  return isProd ? 503 : "ok";
}

interface ReportMessage {
  role?: unknown;
  content?: unknown;
  message?: unknown; // some payloads use `message` instead of `content`
}

export interface ParsedReport {
  attemptId: string | null;
  assistantId: string | null;
  transcript: Turn[];
  outcome: Outcome;
}

function turnsFromMessages(messages: unknown): Turn[] {
  if (!Array.isArray(messages)) return [];
  const raw = messages
    .map((m): { role: string; text: string } | null => {
      const rec = m as ReportMessage;
      const role = rec.role === "user" ? "user" : rec.role === "assistant" || rec.role === "bot" ? "assistant" : null;
      if (!role) return null; // drop system / tool / function rows
      const text = typeof rec.content === "string" ? rec.content : typeof rec.message === "string" ? rec.message : "";
      return { role, text };
    })
    .filter((t): t is { role: string; text: string } => t !== null);
  return sanitizeTranscript(raw);
}

/** Classify the call. Abandoned when there is no candidate speech, or the end
 * reason is an early customer hangup / setup failure. Completed otherwise. */
export function classifyOutcome(transcript: Turn[], endedReason: string | undefined): Outcome {
  const userTurns = transcript.filter((t) => t.role === "user").length;
  if (userTurns === 0) return "abandoned";
  if (endedReason && ABANDON_REASONS.has(endedReason)) return "abandoned";
  return "completed";
}

/** Map a Vapi `end-of-call-report` message object to attempt id + transcript +
 * outcome. `msg` is `body.message`. */
export function mapReport(msg: unknown): ParsedReport {
  const m = (msg ?? {}) as Record<string, unknown>;
  const assistant = (m.assistant ?? {}) as Record<string, unknown>;
  const call = (m.call ?? {}) as Record<string, unknown>;
  const assistantMeta = (assistant.metadata ?? {}) as Record<string, unknown>;
  const callMeta = (call.metadata ?? {}) as Record<string, unknown>;

  const attemptId =
    (typeof assistantMeta.attemptId === "string" && assistantMeta.attemptId) ||
    (typeof callMeta.attemptId === "string" && callMeta.attemptId) ||
    null;
  const assistantId =
    (typeof assistant.id === "string" && assistant.id) ||
    (typeof call.assistantId === "string" && call.assistantId) ||
    null;

  const transcript = turnsFromMessages(m.messages ?? (m.artifact as Record<string, unknown>)?.messages);
  const endedReason = typeof call.endedReason === "string" ? call.endedReason : undefined;

  return { attemptId, assistantId, transcript, outcome: classifyOutcome(transcript, endedReason) };
}
