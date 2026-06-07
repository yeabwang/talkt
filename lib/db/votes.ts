// Vote repository with atomic tally recompute, rank update, and auto-flagging.
import { revalidateDirectory } from "@/lib/db/directory-cache";
import { prisma } from "@/lib/prisma";
import { rankScore, shouldFlag } from "@/lib/ranking";

export type CastVoteResult =
  | { ok: true; upvotes: number; downvotes: number; myVote: -1 | 0 | 1; flagged: boolean }
  | { ok: false; reason: "not_found" | "forbidden" | "not_votable" };

/**
 * Cast, flip, or clear the caller's vote on a public interview.
 */
export async function castVote(userId: string, interviewId: string, value: -1 | 0 | 1): Promise<CastVoteResult> {
  const result = await prisma.$transaction(async (tx): Promise<CastVoteResult> => {
    const interview = await tx.interview.findUnique({
      where: { id: interviewId },
      select: { ownerId: true, anonymous: true, flagged: true, visibility: true },
    });
    if (!interview) return { ok: false, reason: "not_found" };
    if (interview.ownerId === userId) return { ok: false, reason: "forbidden" };
    if (interview.visibility !== "public" || interview.flagged) return { ok: false, reason: "not_votable" };

    if (value === 0) {
      await tx.vote.deleteMany({ where: { userId, interviewId } });
    } else {
      await tx.vote.upsert({
        where: { userId_interviewId: { userId, interviewId } },
        create: { userId, interviewId, value },
        update: { value },
      });
    }

    const [upvotes, downvotes] = await Promise.all([
      tx.vote.count({ where: { interviewId, value: 1 } }),
      tx.vote.count({ where: { interviewId, value: -1 } }),
    ]);

    const newlyFlagged = !interview.flagged && shouldFlag(upvotes, downvotes);
    await tx.interview.update({
      where: { id: interviewId },
      data: {
        upvotes,
        downvotes,
        rankScore: rankScore(upvotes, downvotes, interview.anonymous),
        ...(newlyFlagged ? { flagged: true, flaggedAt: new Date() } : {}),
      },
    });

    return { ok: true, upvotes, downvotes, myVote: value, flagged: interview.flagged || newlyFlagged };
  });
  if (result.ok) revalidateDirectory();
  return result;
}
