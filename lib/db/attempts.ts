// Attempt repository. The directory's recommendation profile is derived from a
// user's attempt history (which interviews, what level, what language). Also the
// call lifecycle: create on start, attach the Vapi call id, then move
// in_progress -> analyzing -> ready (or failed) as the webhook processes the
// transcript and writes Feedback.
import type { Interview as UiInterview } from "@/components/talkt/data";
import type { AnalysisResult } from "@/lib/analysis";
import { interviewRowSelect, toTemplateDTO, type InterviewRow } from "@/lib/dto";
import { prisma } from "@/lib/prisma";
import { toLanguageLabel } from "@/lib/language";
import type { AttemptFacets } from "@/lib/recommend";

/** Start an attempt row for a user taking an interview (status: in_progress). */
export async function createAttempt(userId: string, interviewId: string): Promise<string> {
  const attempt = await prisma.attempt.create({
    data: { userId, interviewId },
    select: { id: true },
  });
  return attempt.id;
}

/** Attach the Vapi call id once the browser reports the call has started. */
export async function attachCallId(attemptId: string, userId: string, vapiCallId: string): Promise<void> {
  // Scope to the owner so a leaked attempt id can't be hijacked.
  await prisma.attempt.updateMany({
    where: { id: attemptId, userId },
    data: { vapiCallId },
  });
}

/**
 * Resolve the attempt a webhook refers to — by metadata attemptId first, then by
 * the Vapi call id — and return it with its interview mapped to the UI shape the
 * analyzer consumes. Returns null when no match (or already terminal).
 */
export async function findAttemptForWebhook(
  attemptId: string | null,
  vapiCallId: string | null,
): Promise<{ id: string; status: string; interview: UiInterview } | null> {
  const where = attemptId ? { id: attemptId } : vapiCallId ? { vapiCallId } : null;
  if (!where) return null;
  const row = await prisma.attempt.findFirst({
    where,
    select: { id: true, status: true, interview: { select: interviewRowSelect } },
  });
  if (!row) return null;
  return { id: row.id, status: row.status, interview: toTemplateDTO(row.interview as InterviewRow) };
}

/** Move an attempt to `analyzing` and record the transcript artifact URL + end time. */
export async function markAnalyzing(attemptId: string, transcriptBlobUrl: string | null): Promise<void> {
  await prisma.attempt.update({
    where: { id: attemptId },
    data: { status: "analyzing", endedAt: new Date(), transcriptBlobUrl: transcriptBlobUrl ?? undefined },
  });
}

/** Persist feedback and flip the attempt to `ready` in one transaction. */
export async function storeFeedback(
  attemptId: string,
  result: AnalysisResult,
  rawBlobUrl: string | null,
): Promise<void> {
  const dimensionScores: Record<string, number> = {};
  for (const d of result.dimensionScores) dimensionScores[d.key] = d.score;
  // Prisma Json columns accept plain serializable values, not interface-typed
  // arrays; round-trip to strip the nominal type.
  const perQuestion = JSON.parse(JSON.stringify(result.perQuestion)) as object[];

  await prisma.$transaction([
    prisma.feedback.upsert({
      where: { attemptId },
      create: {
        attemptId,
        overallScore: result.overallScore,
        dimensionScores,
        strengths: result.strengths.map((s) => s.text),
        improvements: result.improvements.map((s) => s.text),
        perQuestion,
        rawBlobUrl: rawBlobUrl ?? undefined,
      },
      update: {
        overallScore: result.overallScore,
        dimensionScores,
        strengths: result.strengths.map((s) => s.text),
        improvements: result.improvements.map((s) => s.text),
        perQuestion,
        rawBlobUrl: rawBlobUrl ?? undefined,
      },
    }),
    prisma.attempt.update({ where: { id: attemptId }, data: { status: "ready" } }),
  ]);
}

/** Flag an attempt as failed (analysis or transcript handling threw). */
export async function markFailed(attemptId: string): Promise<void> {
  await prisma.attempt.update({ where: { id: attemptId }, data: { status: "failed" } }).catch(() => {});
}

/** UI feedback shape (components/talkt/data.ts Feedback), returned to the results poller. */
export interface AttemptStatusResult {
  status: "in_progress" | "analyzing" | "ready" | "failed";
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
  const dimScores = (fb.dimensionScores ?? {}) as Record<string, number>;
  const perQuestion = (Array.isArray(fb.perQuestion) ? fb.perQuestion : []) as {
    question?: string;
    ratingScore?: number;
    critique?: string;
    modelAnswer?: string;
  }[];

  return {
    status: "ready",
    overall: fb.overallScore,
    dimensions: Object.entries(dimScores).map(([id, score]) => ({ id, score, note: "" })),
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

/**
 * The facets of a user's past attempts, newest first, for buildProfile().
 * `takenAt` uses the attempt start time; language is returned as a display label.
 */
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
