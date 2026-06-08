import assert from "node:assert/strict";
import { test } from "node:test";

import { DIRECTORY_TAG, DIRECTORY_TTL_SECONDS, DIRECTORY_REVALIDATE_PROFILE } from "../../lib/db/directory-cache";

test("directory cache tag is stable", () => {
  assert.equal(DIRECTORY_TAG, "directory");
});

test("directory TTL is a short, sane window", () => {
  assert.ok(DIRECTORY_TTL_SECONDS > 0 && DIRECTORY_TTL_SECONDS <= 300);
});

// Regression: publish/vote run in a Route Handler doing read-your-own-writes.
// "max" (stale-while-revalidate) served the stale list first, so a just-published
// template did not appear on the next directory read. The profile must expire
// immediately so the next read is fresh. Guard against reverting to "max".
test("directory revalidation expires immediately (read-your-own-writes)", () => {
  assert.notEqual(DIRECTORY_REVALIDATE_PROFILE, "max");
  assert.deepEqual(DIRECTORY_REVALIDATE_PROFILE, { expire: 0 });
});
