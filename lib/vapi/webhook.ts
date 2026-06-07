// Pure parsing and verification helpers for Vapi end-of-call reports.
import { timingSafeEqual } from "node:crypto";

import { sanitizeTranscript, type Turn } from "@/lib/transcript";

export type Outcome = "completed" | "abandoned";

// Setup and pipeline failures are treated as abandoned attempts.
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

/** Verify the legacy X-Vapi-Secret header. Allows missing secrets only outside production. */
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
  message?: unknown;
  transcript?: unknown;
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
      if (!role) return null;
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

function assistantClosed(transcript: Turn[]): boolean {
  const lastAssistant = [...transcript].reverse().find((t) => t.role === "assistant")?.text.toLowerCase() ?? "";
  return /\b(that'?s (everything|the interview complete)|interview is complete|feedback'?s being|feedback is being|report'?s being|report is being|being prepared|prepared now|you'?ll see it in a moment)\b/.test(lastAssistant);
}

/** Classify whether a call produced a scoreable interview. */
export function classifyOutcome(transcript: Turn[], endedReason: string | undefined): Outcome {
  const userTurns = transcript.filter((t) => t.role === "user").length;
  if (userTurns === 0) return "abandoned";
  if (endedReason && ABANDON_REASONS.has(endedReason)) return "abandoned";
  if (endedReason === "customer-ended-call" && !assistantClosed(transcript)) return "abandoned";
  return "completed";
}

/** Map a Vapi end-of-call report to the internal attempt outcome. */
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

  return { attemptId, assistantId, transcript, outcome: classifyOutcome(transcript, endedReason) };
}

/** Map a Vapi call record into the same shape as webhook reports. */
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
