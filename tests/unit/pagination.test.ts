import assert from "node:assert/strict";
import { test } from "node:test";

import { clampLimit, paginateById, MAX_PAGE_SIZE } from "../../lib/pagination";

const rows = Array.from({ length: 10 }, (_, i) => ({ id: `r${i}` }));

test("first page returns the first `limit` items with a nextCursor", () => {
  const page = paginateById(rows, null, 3);
  assert.deepEqual(page.items.map((r) => r.id), ["r0", "r1", "r2"]);
  assert.equal(page.nextCursor, "r2");
});

test("cursor returns the items after it (exclusive)", () => {
  const page = paginateById(rows, "r2", 3);
  assert.deepEqual(page.items.map((r) => r.id), ["r3", "r4", "r5"]);
  assert.equal(page.nextCursor, "r5");
});

test("last page has a null nextCursor", () => {
  const page = paginateById(rows, "r6", 5);
  assert.deepEqual(page.items.map((r) => r.id), ["r7", "r8", "r9"]);
  assert.equal(page.nextCursor, null);
});

test("a limit covering everything yields no nextCursor", () => {
  const page = paginateById(rows, null, 100);
  assert.equal(page.items.length, 10);
  assert.equal(page.nextCursor, null);
});

test("unknown cursor yields an empty terminal page", () => {
  const page = paginateById(rows, "nope", 3);
  assert.deepEqual(page.items, []);
  assert.equal(page.nextCursor, null);
});

test("clampLimit floors invalid input to the fallback", () => {
  assert.equal(clampLimit(null), MAX_PAGE_SIZE);
  assert.equal(clampLimit("abc"), MAX_PAGE_SIZE);
  assert.equal(clampLimit("0"), MAX_PAGE_SIZE);
  assert.equal(clampLimit("-5"), MAX_PAGE_SIZE);
});

test("clampLimit caps at MAX_PAGE_SIZE and parses valid input", () => {
  assert.equal(clampLimit("30"), 30);
  assert.equal(clampLimit(String(MAX_PAGE_SIZE + 500)), MAX_PAGE_SIZE);
  assert.equal(clampLimit("12.9"), 12);
});
