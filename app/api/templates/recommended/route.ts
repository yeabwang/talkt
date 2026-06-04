// GET /api/templates/recommended — the directory re-ordered for the signed-in
// user: a recency-weighted content profile (from their attempt history) blended
// with each template's directory rank. Cold start falls back to pure rank.
import { auth } from "@clerk/nextjs/server";

import { unauthorized } from "@/lib/api";
import { listAttemptFacets } from "@/lib/db/attempts";
import { listDirectory } from "@/lib/db/interviews";
import { ensureUser } from "@/lib/db/users";
import { rankScore } from "@/lib/ranking";
import {
  buildProfile,
  normalizeRanks,
  personalizedScore,
  scoreInterview,
} from "@/lib/recommend";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return unauthorized();
  await ensureUser();

  const [attempts, interviews] = await Promise.all([listAttemptFacets(userId), listDirectory(userId)]);
  const profile = buildProfile(attempts);

  const ranks = normalizeRanks(
    interviews.map((i) => rankScore(i.upvotes ?? 0, i.downvotes ?? 0, i.anonymous ?? false)),
  );

  const ordered = interviews
    .map((interview, index) => {
      const affinity = scoreInterview(profile, {
        category: interview.category,
        role: interview.role,
        difficulty: interview.difficulty,
        language: interview.language,
      });
      return { interview, score: personalizedScore(affinity, ranks[index]) };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.interview);

  return Response.json({ interviews: ordered });
}
