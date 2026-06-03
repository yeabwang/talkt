// Interview repository: directory reads, single fetch, builder persistence,
// and publishing. All reads go through the DTO seam so callers never see
// ownerId or other users' data.
import type { Interview as UiInterview } from "@/components/talkt/data";
import { prisma } from "@/lib/prisma";
import { interviewRowSelect, toTemplateDTO, type InterviewRow, type ViewerContext } from "@/lib/dto";
import { toLanguageCode } from "@/lib/language";
import { rankScore } from "@/lib/ranking";

/** Fetch the caller's votes for a set of interviews -> { interviewId: 1 | -1 }. */
async function votesByViewer(viewerId: string | null, interviewIds: string[]): Promise<Map<string, -1 | 1>> {
  const map = new Map<string, -1 | 1>();
  if (!viewerId || interviewIds.length === 0) return map;
  const rows = await prisma.vote.findMany({
    where: { userId: viewerId, interviewId: { in: interviewIds } },
    select: { interviewId: true, value: true },
  });
  for (const r of rows) map.set(r.interviewId, r.value === -1 ? -1 : 1);
  return map;
}

/**
 * The public directory: visible (public, not flagged) interviews ordered by
 * directory rank, with the caller's own vote attached. Includes seeded
 * templates and published community customs.
 */
export async function listDirectory(viewerId: string | null): Promise<UiInterview[]> {
  const rows = await prisma.interview.findMany({
    where: { visibility: "public", flagged: false },
    select: interviewRowSelect,
    orderBy: [{ rankScore: "desc" }, { createdAt: "desc" }],
  });
  const myVotes = await votesByViewer(viewerId, rows.map((r) => r.id));
  return rows.map((row) =>
    toTemplateDTO(row as InterviewRow, {
      myVote: myVotes.get(row.id) ?? 0,
      mine: viewerId != null && row.ownerId === viewerId,
    }),
  );
}

/**
 * A single interview the caller is allowed to see: any public non-flagged one,
 * or one they own (private/flagged included). Returns null otherwise.
 */
export async function getInterview(id: string, viewerId: string | null): Promise<UiInterview | null> {
  const row = await prisma.interview.findUnique({ where: { id }, select: interviewRowSelect });
  if (!row) return null;

  const mine = viewerId != null && row.ownerId === viewerId;
  const visible = row.visibility === "public" && !row.flagged;
  if (!visible && !mine) return null;

  const myVotes = await votesByViewer(viewerId, [id]);
  const viewer: ViewerContext = { myVote: myVotes.get(id) ?? 0, mine };
  return toTemplateDTO(row as InterviewRow, viewer);
}

/** Input for persisting a builder-generated interview. */
export interface BuilderInterviewInput {
  title: string;
  subtitle?: string;
  role?: string;
  category?: string;
  difficulty?: string;
  blurb?: string;
  minutes?: number;
  focus?: string[];
  language?: string; // display label; converted to ISO for storage
  voiceId?: string;
  questions: string[];
  dimensions?: { key: string; label: string }[];
}

/** Persist a builder-generated interview as the user's private custom interview. */
export async function createFromBuilder(ownerId: string, input: BuilderInterviewInput): Promise<UiInterview> {
  const row = await prisma.interview.create({
    data: {
      ownerId,
      title: input.title,
      subtitle: input.subtitle ?? null,
      role: input.role ?? null,
      topic: input.category ?? null,
      difficulty: input.difficulty ?? null,
      blurb: input.blurb ?? null,
      minutes: input.minutes ?? null,
      focus: input.focus ?? [],
      type: "custom",
      visibility: "private",
      language: toLanguageCode(input.language),
      dimensions: input.dimensions ?? [],
      questions: input.questions,
      voiceConfig: input.voiceId ? { voiceId: input.voiceId } : undefined,
    },
    select: interviewRowSelect,
  });
  return toTemplateDTO(row as InterviewRow, { mine: true, myVote: 0 });
}

export type PublishResult =
  | { ok: true; interview: UiInterview }
  | { ok: false; reason: "not_found" | "forbidden" };

/**
 * Publish a custom interview to the public directory. Enforces ownership.
 * `displayName` is the public credit; when `anonymous`, no name is stored and
 * the rank carries the anonymity down-weight.
 */
export async function publish(
  id: string,
  ownerId: string,
  opts: { displayName?: string; anonymous: boolean },
): Promise<PublishResult> {
  const existing = await prisma.interview.findUnique({
    where: { id },
    select: { ownerId: true, upvotes: true, downvotes: true },
  });
  if (!existing) return { ok: false, reason: "not_found" };
  if (existing.ownerId !== ownerId) return { ok: false, reason: "forbidden" };

  const anonymous = opts.anonymous;
  const row = await prisma.interview.update({
    where: { id },
    data: {
      visibility: "public",
      publishedAt: new Date(),
      anonymous,
      authorName: anonymous ? null : opts.displayName ?? null,
      rankScore: rankScore(existing.upvotes, existing.downvotes, anonymous),
    },
    select: interviewRowSelect,
  });
  return { ok: true, interview: toTemplateDTO(row as InterviewRow, { mine: true, myVote: 0 }) };
}
