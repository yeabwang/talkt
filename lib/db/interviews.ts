// Interview repository for directory reads, builder persistence, and publishing.
import type { Interview as UiInterview } from "@/components/talkt/data";
import { cachedDirectoryRows, revalidateDirectory } from "@/lib/db/directory-cache";
import { prisma } from "@/lib/prisma";
import { interviewRowSelect, toTemplateDTO, type InterviewRow, type ViewerContext } from "@/lib/dto";
import { toLanguageCode } from "@/lib/language";
import { paginateById, type Page } from "@/lib/pagination";
import { rankScore } from "@/lib/ranking";

/** Fetch the caller's votes for a set of interviews. */
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
 * Public directory ordered by rank, with the caller's vote attached.
 */
export async function listDirectory(viewerId: string | null): Promise<UiInterview[]> {
  const rows = await cachedDirectoryRows();
  const myVotes = await votesByViewer(viewerId, rows.map((r) => r.id));
  return rows.map((row) =>
    toTemplateDTO(row, {
      myVote: myVotes.get(row.id) ?? 0,
      mine: viewerId != null && row.ownerId === viewerId,
    }),
  );
}

/**
 * Cursor-paginated directory slice with per-viewer votes resolved for that page.
 */
export async function listDirectoryPage(
  viewerId: string | null,
  opts: { limit: number; cursor: string | null },
): Promise<Page<UiInterview>> {
  const rows = await cachedDirectoryRows();
  const page = paginateById(rows, opts.cursor, opts.limit);
  const myVotes = await votesByViewer(viewerId, page.items.map((r) => r.id));
  const items = page.items.map((row) =>
    toTemplateDTO(row, {
      myVote: myVotes.get(row.id) ?? 0,
      mine: viewerId != null && row.ownerId === viewerId,
    }),
  );
  return { items, nextCursor: page.nextCursor };
}

/**
 * Fetch one interview visible to the caller, including their private owned rows.
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
  language?: string;
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
  revalidateDirectory();
  return { ok: true, interview: toTemplateDTO(row as InterviewRow, { mine: true, myVote: 0 }) };
}
