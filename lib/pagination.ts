// Pure, framework-free cursor pagination over an already-ordered, in-memory list.
// Used by the directory read: the cached directory rows are a bounded, rank-ordered
// set, so we page through them by id cursor rather than issuing per-page DB reads.
// Cursor pagination (not offset) is stable under insertion and cheap to slice.

/** Hard ceiling on page size — aligns with DIRECTORY_MAX_ROWS so one page can
 *  carry the whole bounded directory (preserves the client's instant filtering). */
export const MAX_PAGE_SIZE = 200;

export interface Page<T> {
  items: T[];
  /** id of the last item when more rows remain, else null (terminal page). */
  nextCursor: string | null;
}

/** Parse + clamp a requested page size to (0, MAX_PAGE_SIZE]; fall back when invalid. */
export function clampLimit(raw: unknown, fallback: number = MAX_PAGE_SIZE): number {
  const n =
    typeof raw === "string" ? Number.parseInt(raw, 10) : typeof raw === "number" ? raw : Number.NaN;
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.trunc(n), MAX_PAGE_SIZE);
}

/**
 * Slice `rows` after `cursor` (exclusive), up to `limit`. An unknown cursor
 * returns an empty terminal page rather than restarting from the top, so a stale
 * cursor can't silently re-serve the first page.
 */
export function paginateById<T extends { id: string }>(
  rows: readonly T[],
  cursor: string | null,
  limit: number,
): Page<T> {
  let start = 0;
  if (cursor) {
    const idx = rows.findIndex((r) => r.id === cursor);
    start = idx >= 0 ? idx + 1 : rows.length;
  }
  const items = rows.slice(start, start + limit);
  const hasMore = start + items.length < rows.length;
  const last = items[items.length - 1];
  return { items: [...items], nextCursor: hasMore && last ? last.id : null };
}
