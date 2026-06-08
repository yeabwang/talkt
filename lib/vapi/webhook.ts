// Pure logic for the Vapi end-of-call-report webhook. Kept free of Prisma / the
// Trigger SDK / network so it is unit-testable; the route wires the real deps.
import { timingSafeEqual } from "node:crypto";

import { answeredAtLeastHalf, sanitizeTranscript, type Turn } from "@/lib/transcript";

export type Outcome = "completed" | "abandoned";

// Reasons that mean setup/pipeline failed before a real interview happened — no
// usable transcript, so never gradable regardless of answered ratio.
const ABANDON_REASONS = new Set<string>([
  "customer-did-not-answer",
  "customer-did-not-give-microphone-permission",
  "customer-busy",
  "assistant-error",
  "pipeline-error",
  "no-transcript",
]);

function safeSecretMatch(provided: string | null, secret: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

function bearerToken(authorization: string | null): string | null {
  if (!authorization) return null;
  const [scheme, token] = authorization.split(/\s+/, 2);
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

/** Constant-time compare of the legacy X-Vapi-Secret header against our shared
 * secret. Mirrors the worker-callback posture: with a secret set, the header
 * must match (else reject); without one, allow in dev only. */
export function verifyVapiSecret(provided: string | null, secret: string | undefined, isProd: boolean): "ok" | 401 | 503 {
  if (secret) {
    return safeSecretMatch(provided, secret) ? "ok" : 401;
  }
  return isProd ? 503 : "ok";
}

export function verifyVapiRequest(
  headers: { xVapiSecret: string | null; authorization: string | null },
  secret: string | undefined,
  isProd: boolean,
): "ok" | 401 | 503 {
  if (!secret) return isProd ? 503 : "ok";
  if (safeSecretMatch(headers.xVapiSecret, secret)) return "ok";
  if (safeSecretMatch(bearerToken(headers.authorization), secret)) return "ok";
  return 401;
}

interface ReportMessage {
  role?: unknown;
  content?: unknown;
  message?: unknown; // some payloads use `message` instead of `content`
  transcript?: unknown;
}

export interface ParsedReport {
  attemptId: string | null;
  assistantId: string | null;
  transcript: Turn[];
  // Raw Vapi end reason; the outcome is decided by the caller via classifyOutcome,
  // which needs the interview's question set (not available at parse time).
  endedReason: string | undefined;
}

function turnsFromMessages(messages: unknown): Turn[] {
  if (!Array.isArray(messages)) return [];
  const raw = messages
    .map((m): { role: string; text: string } | null => {
      const rec = m as ReportMessage;
      const role = rec.role === "user" ? "user" : rec.role === "assistant" || rec.role === "bot" ? "assistant" : null;
      if (!role) return null; // drop system / tool / function rows
      const text = textFrom(rec.content) || textFrom(rec.message) || textFrom(rec.transcript);
      return { role, text };
    })
    .filter((t): t is { role: string; text: string } => t !== null);
  return sanitizeTranscript(raw);
}

function textFrom(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textFrom).filter(Boolean).join(" ");
  if (!value || typeof value !== "object") return "";
  const rec = value as { text?: unknown; content?: unknown };
  return textFrom(rec.text) || textFrom(rec.content);
}

function messagesFromTranscript(transcript: unknown): ReportMessage[] {
  if (typeof transcript !== "string") return [];
  return transcript
    .split(/\r?\n/)
    .map((line): ReportMessage | null => {
      const match = line.match(/^\s*(ai|assistant|bot|user|customer)\s*:\s*(.+)\s*$/i);
      if (!match) return null;
      const speaker = match[1].toLowerCase();
      return { role: speaker === "user" || speaker === "customer" ? "user" : "assistant", message: match[2] };
    })
    .filter((m): m is ReportMessage => m !== null);
}

/**
 * Classify the call into completed (grade it) vs abandoned (discard). The call
 * is graded when at least half the questions were answered — regardless of who
 * ended it (the interviewer closing or the candidate hanging up). Setup/pipeline
 * failures with no usable transcript are always abandoned.
 */
export function classifyOutcome(transcript: Turn[], questions: string[], endedReason: string | undefined): Outcome {
  if (endedReason && ABANDON_REASONS.has(endedReason)) return "abandoned";
  return answeredAtLeastHalf(transcript, questions) ? "completed" : "abandoned";
}

/** Map a Vapi `end-of-call-report` message object to attempt id + transcript +
 * outcome. `msg` is `body.message`. */
export function mapReport(msg: unknown): ParsedReport {
  const m = (msg ?? {}) as Record<string, unknown>;
  const assistant = (m.assistant ?? {}) as Record<string, unknown>;
  const call = (m.call ?? {}) as Record<string, unknown>;
  const assistantMeta = (assistant.metadata ?? {}) as Record<string, unknown>;
  const callMeta = (call.metadata ?? {}) as Record<string, unknown>;
  const messageMeta = (m.metadata ?? {}) as Record<string, unknown>;
  const artifact = (m.artifact ?? {}) as Record<string, unknown>;

  const attemptId =
    (typeof assistantMeta.attemptId === "string" && assistantMeta.attemptId) ||
    (typeof callMeta.attemptId === "string" && callMeta.attemptId) ||
    (typeof messageMeta.attemptId === "string" && messageMeta.attemptId) ||
    null;
  const assistantId =
    (typeof assistant.id === "string" && assistant.id) ||
    (typeof call.assistantId === "string" && call.assistantId) ||
    null;

  const transcript = turnsFromMessages(m.messages ?? artifact.messages ?? artifact.messagesOpenAIFormatted);
  const endedReason = typeof m.endedReason === "string" ? m.endedReason : typeof call.endedReason === "string" ? call.endedReason : undefined;

  return { attemptId, assistantId, transcript, endedReason };
}

/** Map a completed Vapi `/call` record into the same shape as an
 * end-of-call-report. This repairs local development runs where the assistant
 * server URL points at localhost and Vapi cannot deliver the webhook. */
export function mapCallRecord(call: unknown, attemptId: string | null): ParsedReport | null {
  const c = (call ?? {}) as Record<string, unknown>;
  const status = typeof c.status === "string" ? c.status : undefined;
  if (status && status !== "ended") return null;

  const assistantId = typeof c.assistantId === "string" ? c.assistantId : null;
  const endedReason = typeof c.endedReason === "string" ? c.endedReason : undefined;
  const artifact = (c.artifact ?? {}) as Record<string, unknown>;
  const messages = c.messages ?? artifact.messages ?? artifact.messagesOpenAIFormatted ?? messagesFromTranscript(c.transcript);

  return mapReport({
    metadata: attemptId ? { attemptId } : undefined,
    assistant: assistantId ? { id: assistantId } : undefined,
    call: { assistantId, endedReason },
    endedReason,
    messages,
  });
}
