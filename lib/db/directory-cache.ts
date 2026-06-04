// Caching seam for the public directory rows. The row set (public, non-flagged,
// rank-ordered) is identical for every viewer — only the per-viewer vote overlay
// differs — so we cache the row read and invalidate it on the mutations that can
// change directory contents or order. cacheComponents is NOT enabled, so
// unstable_cache + revalidateTag is the right primitive (see docs/caching-strategy.md).
import { revalidateTag, unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";
import { interviewRowSelect, type InterviewRow } from "@/lib/dto";

export const DIRECTORY_TAG = "directory";
export const DIRECTORY_TTL_SECONDS = 60;

/** Cached read of the public directory rows (no per-viewer data). */
export const cachedDirectoryRows = unstable_cache(
  async (): Promise<InterviewRow[]> => {
    const rows = await prisma.interview.findMany({
      where: { visibility: "public", flagged: false },
      select: interviewRowSelect,
      orderBy: [{ rankScore: "desc" }, { createdAt: "desc" }],
    });
    return rows as InterviewRow[];
  },
  ["directory-rows"],
  { tags: [DIRECTORY_TAG], revalidate: DIRECTORY_TTL_SECONDS },
);

/** Invalidate the cached directory after a mutation that changes its contents. */
export function revalidateDirectory(): void {
  // Two-arg form: single-arg revalidateTag is deprecated in Next 16 (heed AGENTS.md
  // deprecation notice). "max" = stale-while-revalidate on next directory visit.
  revalidateTag(DIRECTORY_TAG, "max");
}
