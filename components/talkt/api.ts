"use client";

// Client-side fetch helpers for the template directory APIs. Server logic lives
// in app/api/* + lib/db/*; these just shape requests and surface errors.

import type { Attempt, Interview } from "@/components/talkt/data";

async function asError(res: Response): Promise<never> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  throw new Error(data?.error ?? `Request failed (${res.status})`);
}

/** Fetch the ranked public directory. */
export async function fetchDirectory(): Promise<Interview[]> {
  const res = await fetch("/api/templates", { headers: { Accept: "application/json" } });
  if (!res.ok) return asError(res);
  const data = (await res.json()) as { interviews: Interview[] };
  return data.interviews;
}

/** Fetch the signed-in user's graded attempt history (newest first). */
export async function fetchAttempts(): Promise<Attempt[]> {
  const res = await fetch("/api/attempts", { headers: { Accept: "application/json" } });
  if (!res.ok) return asError(res);
  const data = (await res.json()) as { attempts: Attempt[] };
  return data.attempts;
}

/** Fetch the personalized ("For you") order. Requires auth. */
export async function fetchRecommended(): Promise<Interview[]> {
  const res = await fetch("/api/templates/recommended", { headers: { Accept: "application/json" } });
  if (!res.ok) return asError(res);
  const data = (await res.json()) as { interviews: Interview[] };
  return data.interviews;
}

/** The fields needed to persist a builder-generated interview. */
export interface BuiltInterviewPayload {
  title: string;
  subtitle?: string;
  role?: string;
  category?: string;
  difficulty?: string;
  blurb?: string;
  minutes?: number;
  focus?: string[];
  language?: string;
  voiceId?: string;
  questions: string[];
  dimensions?: { key: string; label: string }[];
}

/** Persist a built interview as the caller's private custom interview. */
export async function persistBuiltInterview(payload: BuiltInterviewPayload): Promise<Interview> {
  const res = await fetch("/api/interviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return asError(res);
  const data = (await res.json()) as { interview: Interview };
  return data.interview;
}

// ── Voice call (LiveKit) ─────────────────────────────────────────────

/**
 * Server-resolved call session: the attempt plus the LiveKit join details. The
 * browser (spec 17) connects to `serverUrl` with `token`; the interviewer worker
 * is dispatched into `roomName` by the same token.
 */
export interface CallSession {
  attemptId: string;
  serverUrl: string; // LIVEKIT_URL the browser dials
  token: string; // short-lived room-join JWT
  roomName: string; // deterministic "attempt_<id>"
  // Resolved voice persona name, shown on the interviewer tile.
  interviewerName: string;
}

/** Begin a call: resolves the persona, opens an attempt, returns the LiveKit session. */
export async function startCall(interviewId: string): Promise<CallSession> {
  const res = await fetch(`/api/interviews/${interviewId}/call`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) return asError(res);
  return (await res.json()) as CallSession;
}

/** Feedback shape returned by the attempt poller once analysis is ready. */
export interface AttemptStatus {
  status: "in_progress" | "analyzing" | "ready" | "failed" | "abandoned";
  overall?: number;
  summary?: string;
  dimensions?: { id: string; score: number; note: string }[];
  strengths?: { text: string; evidence: string }[];
  improvements?: { text: string; evidence: string }[];
  perQuestion?: { q: string; rating: number; critique: string; model: string }[];
}

/** Poll an attempt's analysis status. Grading is server-driven (the worker's
 * session-ended callback triggers it), so the results screen just polls this. */
export async function fetchAttemptStatus(attemptId: string): Promise<AttemptStatus> {
  const res = await fetch(`/api/attempts/${attemptId}`, { headers: { Accept: "application/json" } });
  if (!res.ok) return asError(res);
  return (await res.json()) as AttemptStatus;
}

/** Publish an already-persisted interview to the public directory. */
export async function publishInterview(
  id: string,
  opts: { displayName?: string; anonymous: boolean },
): Promise<Interview> {
  const res = await fetch(`/api/interviews/${id}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (!res.ok) return asError(res);
  const data = (await res.json()) as { interview: Interview };
  return data.interview;
}
