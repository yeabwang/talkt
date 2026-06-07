// Cache public, non-flagged directory rows; per-viewer vote overlays are resolved later.
import { revalidateTag, unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";
import { interviewRowSelect, type InterviewRow } from "@/lib/dto";

export const DIRECTORY_TAG = "directory";
export const DIRECTORY_TTL_SECONDS = 60;
/** Hard cap on directory rows read and served. */
export const DIRECTORY_MAX_ROWS = 200;

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
  // Next 16 requires the profile argument; "max" enables stale-while-revalidate.
  revalidateTag(DIRECTORY_TAG, "max");
}
