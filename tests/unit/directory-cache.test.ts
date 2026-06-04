import assert from "node:assert/strict";
import { test } from "node:test";

import { DIRECTORY_TAG, DIRECTORY_TTL_SECONDS } from "../../lib/db/directory-cache";

test("directory cache tag is stable", () => {
  assert.equal(DIRECTORY_TAG, "directory");
});

test("directory TTL is a short, sane window", () => {
  assert.ok(DIRECTORY_TTL_SECONDS > 0 && DIRECTORY_TTL_SECONDS <= 300);
});
