"use client";

// Client-side fetch helpers for the template directory APIs. Server logic lives
// in app/api/* + lib/db/*; these just shape requests and surface errors.

import type { Interview } from "@/components/talkt/data";

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

// ── Voice call (Vapi) ────────────────────────────────────────────────

/** Server-resolved call session: the attempt + the transient assistant config. */
export interface CallSession {
  attemptId: string;
  publicKey: string;
  assistant: unknown;
}

/** Begin a call: resolves the voice agent, opens an attempt, returns the assistant. */
export async function startCall(interviewId: string): Promise<CallSession> {
  const res = await fetch(`/api/interviews/${interviewId}/call`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) return asError(res);
  return (await res.json()) as CallSession;
}

/** Attach the live Vapi call id to the attempt (defensive webhook join key). */
export async function attachCallId(attemptId: string, vapiCallId: string): Promise<void> {
  await fetch(`/api/attempts/${attemptId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vapiCallId }),
  }).catch(() => {});
}

/** Feedback shape returned by the attempt poller once analysis is ready. */
export interface AttemptStatus {
  status: "in_progress" | "analyzing" | "ready" | "failed";
  overall?: number;
  summary?: string;
  dimensions?: { id: string; score: number; note: string }[];
  strengths?: { text: string; evidence: string }[];
  improvements?: { text: string; evidence: string }[];
  perQuestion?: { q: string; rating: number; critique: string; model: string }[];
}

/** Poll an attempt's analysis status. */
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
