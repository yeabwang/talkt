// Cache public, non-flagged directory rows; per-viewer vote overlays are resolved later.
import { revalidateTag, unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";
import { interviewRowSelect, type InterviewRow } from "@/lib/dto";

export const DIRECTORY_TAG = "directory";
export const DIRECTORY_TTL_SECONDS = 60;
/** Hard cap on directory rows read and served. */
export const DIRECTORY_MAX_ROWS = 200;

// Immediate expiry, not "max" (stale-while-revalidate). Publish/vote happen in a
// Route Handler doing read-your-own-writes: the mutating user must see the new
// row on the *next* directory read, not after a second background refresh. "max"
// served the stale list first, so a freshly published template did not appear.
// updateTag() would be ideal but is Server-Action-only; { expire: 0 } is the
// documented Route Handler equivalent. See docs/caching-strategy.md.
export const DIRECTORY_REVALIDATE_PROFILE = { expire: 0 } as const;

/** Cached public directory rows without per-viewer data. */
export const cachedDirectoryRows = unstable_cache(
  async (): Promise<InterviewRow[]> => {
    const rows = await prisma.interview.findMany({
      where: { visibility: "public", flagged: false },
      select: interviewRowSelect,
      orderBy: [{ rankScore: "desc" }, { createdAt: "desc" }],
      take: DIRECTORY_MAX_ROWS,
    });
    return rows as InterviewRow[];
  },
  ["directory-rows"],
  { tags: [DIRECTORY_TAG], revalidate: DIRECTORY_TTL_SECONDS },
);

/** Invalidate the cached directory after a mutation that changes its contents. */
export function revalidateDirectory(): void {
  // Immediate expiry so the mutating user sees their write on the next read.
  revalidateTag(DIRECTORY_TAG, DIRECTORY_REVALIDATE_PROFILE);
}
