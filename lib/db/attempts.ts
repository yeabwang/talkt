// Attempt repository for call lifecycle, grading status, history, and recommendation facets.
import type { Interview as UiInterview } from "@/components/talkt/data";
import type { AnalysisResult } from "@/lib/analysis";
import { interviewRowSelect, toTemplateDTO, type InterviewRow } from "@/lib/dto";
import { prisma } from "@/lib/prisma";
import { toLanguageLabel } from "@/lib/language";
import type { AttemptFacets } from "@/lib/recommend";

/** Start an in-progress attempt row. */
export async function createAttempt(userId: string, interviewId: string): Promise<string> {
  const attempt = await prisma.attempt.create({
    data: { userId, interviewId },
    select: { id: true },
  });
  return attempt.id;
}

/** Stamp the Vapi assistant id (and optionally call id) onto an attempt. */
export async function storeVapiIds(
  attemptId: string,
  ids: { assistantId?: string; callId?: string },
): Promise<void> {
  await prisma.attempt.update({
    where: { id: attemptId },
    data: {
      ...(ids.assistantId ? { vapiAssistantId: ids.assistantId } : {}),
      ...(ids.callId ? { vapiCallId: ids.callId } : {}),
    },
  });
}

/**
 * Resolve a Vapi callback or grading task to an attempt and its interview.
 */
export async function findAttemptForWebhook(
  attemptId: string | null,
  vapiAssistantId: string | null,
): Promise<{ id: string; status: string; interview: UiInterview } | null> {
  const where = attemptId ? { id: attemptId } : vapiAssistantId ? { vapiAssistantId } : null;
  if (!where) return null;
  const row = await prisma.attempt.findFirst({
    where,
    select: { id: true, status: true, interview: { select: interviewRowSelect } },
  });
  if (!row) return null;
  return { id: row.id, status: row.status, interview: toTemplateDTO(row.interview as InterviewRow) };
}

/** Owner-scoped lightweight row for repairing a missed Vapi callback. */
export async function findAttemptForReconcile(
  attemptId: string,
  userId: string,
): Promise<{ id: string; status: string; vapiAssistantId: string | null; vapiCallId: string | null; startedAt: Date } | null> {
  return await prisma.attempt.findFirst({
    where: { id: attemptId, userId },
    select: { id: true, status: true, vapiAssistantId: true, vapiCallId: true, startedAt: true },
  });
}

/**
 * Mark an in-progress attempt abandoned without clobbering completed callbacks.
 */
export async function markAbandoned(attemptId: string): Promise<void> {
  await prisma.attempt
    .updateMany({ where: { id: attemptId, status: "in_progress" }, data: { status: "abandoned", endedAt: new Date() } })
    .catch(() => {});
}

/** Move an attempt to `analyzing` and stamp the end time. */
export async function markAnalyzing(attemptId: string): Promise<void> {
  await prisma.attempt.update({
    where: { id: attemptId },
    data: { status: "analyzing", endedAt: new Date() },
  });
}

/** Persist feedback and flip the attempt to `ready` in one transaction. */
export async function storeFeedback(
  attemptId: string,
  result: AnalysisResult,
  rawBlobUrl: string | null,
): Promise<void> {
  // Keep the per-dimension note beside its score for the report UI.
  const dimensionScores: Record<string, { score: number; note: string }> = {};
  for (const d of result.dimensionScores) dimensionScores[d.key] = { score: d.score, note: d.note };
  // Prisma Json columns require plain serializable values.
  const perQuestion = JSON.parse(JSON.stringify(result.perQuestion)) as object[];

  const data = {
    overallScore: result.overallScore,
    summary: result.summary,
    dimensionScores,
    strengths: result.strengths.map((s) => s.text),
    improvements: result.improvements.map((s) => s.text),
    perQuestion,
    rawBlobUrl: rawBlobUrl ?? undefined,
  };

  await prisma.$transaction([
    prisma.feedback.upsert({
      where: { attemptId },
      create: { attemptId, ...data },
      update: data,
    }),
    prisma.attempt.update({ where: { id: attemptId }, data: { status: "ready" } }),
  ]);
}

/** Flag an attempt as failed (analysis threw or transcript was empty). */
export async function markFailed(attemptId: string): Promise<void> {
  await prisma.attempt.update({ where: { id: attemptId }, data: { status: "failed" } }).catch(() => {});
}

/** UI feedback shape (components/talkt/data.ts Feedback), returned to the results poller. */
export interface AttemptStatusResult {
  status: "in_progress" | "analyzing" | "ready" | "failed" | "abandoned";
  overall?: number;
  summary?: string;
  dimensions?: { id: string; score: number; note: string }[];
  strengths?: { text: string; evidence: string }[];
  improvements?: { text: string; evidence: string }[];
  perQuestion?: { q: string; rating: number; critique: string; model: string }[];
}

/** Poll an attempt's status (+ feedback once ready). Owner-scoped. Null if not theirs. */
export async function getAttemptStatus(attemptId: string, userId: string): Promise<AttemptStatusResult | null> {
  const row = await prisma.attempt.findFirst({
    where: { id: attemptId, userId },
    select: {
      status: true,
      feedback: {
        select: {
          overallScore: true,
          summary: true,
          dimensionScores: true,
          strengths: true,
          improvements: true,
          perQuestion: true,
        },
      },
    },
  });
  if (!row) return null;
  if (row.status !== "ready" || !row.feedback) return { status: row.status };

  const fb = row.feedback;
  // Tolerate older rows written as { [key]: number }.
  const dimScores = (fb.dimensionScores ?? {}) as Record<string, number | { score?: number; note?: string }>;
  const perQuestion = (Array.isArray(fb.perQuestion) ? fb.perQuestion : []) as {
    question?: string;
    ratingScore?: number;
    critique?: string;
    modelAnswer?: string;
  }[];

  return {
    status: "ready",
    overall: fb.overallScore,
    summary: fb.summary,
    dimensions: Object.entries(dimScores).map(([id, v]) => ({
      id,
      score: typeof v === "number" ? v : v.score ?? 0,
      note: typeof v === "number" ? "" : v.note ?? "",
    })),
    strengths: fb.strengths.map((text) => ({ text, evidence: "" })),
    improvements: fb.improvements.map((text) => ({ text, evidence: "" })),
    perQuestion: perQuestion.map((p) => ({
      q: p.question ?? "",
      rating: p.ratingScore ?? 0,
      critique: p.critique ?? "",
      model: p.modelAnswer ?? "",
    })),
  };
}

/** A scored attempt in the user's history, shaped for the UI (data.ts Attempt). */
export interface UserAttempt {
  id: string;
  interviewId: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  minutes: number;
  overall: number;
  voice: string;
}

/** The user's graded attempts, newest first. */
export async function listUserAttempts(userId: string): Promise<UserAttempt[]> {
  const rows = await prisma.attempt.findMany({
    where: { userId, status: "ready", feedback: { isNot: null } },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      interviewId: true,
      startedAt: true,
      endedAt: true,
      interview: { select: { title: true, minutes: true, voiceConfig: true } },
      feedback: { select: { overallScore: true } },
    },
  });

  return rows.map((r) => {
    const started = r.startedAt;
    const minutes = r.endedAt
      ? Math.max(1, Math.round((r.endedAt.getTime() - started.getTime()) / 60000))
      : r.interview.minutes ?? 0;
    const vc = (r.interview.voiceConfig ?? {}) as { voiceId?: string };
    return {
      id: r.id,
      interviewId: r.interviewId,
      title: r.interview.title,
      date: started.toISOString().slice(0, 10),
      time: started.toISOString().slice(11, 16),
      minutes,
      overall: Math.round(r.feedback?.overallScore ?? 0),
      voice: vc.voiceId ?? "adi",
    };
  });
}

/** Attempt facets for the recommendation profile, newest first. */
export async function listAttemptFacets(userId: string): Promise<AttemptFacets[]> {
  const rows = await prisma.attempt.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
    select: {
      startedAt: true,
      interview: { select: { topic: true, role: true, difficulty: true, language: true } },
    },
  });
  return rows.map((r) => ({
    category: r.interview.topic,
    role: r.interview.role,
    difficulty: r.interview.difficulty,
    language: toLanguageLabel(r.interview.language),
    takenAt: r.startedAt,
  }));
}
