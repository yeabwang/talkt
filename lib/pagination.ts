// Cursor pagination over a bounded, already-ordered in-memory list.

/** Hard ceiling on page size. */
export const MAX_PAGE_SIZE = 200;

export interface Page<T> {
  items: T[];
  /** Last item id when more rows remain. */
  nextCursor: string | null;
}

/** Parse and clamp a requested page size. */
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
