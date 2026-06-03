// Attempt repository. The directory's recommendation profile is derived from a
// user's attempt history (which interviews, what level, what language).
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
