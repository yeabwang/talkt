import assert from "node:assert/strict";
import { test } from "node:test";

import { idle, loading, loaded, failed, isResolved, isPending } from "../../lib/loadable";

test("idle and loading are pending, not resolved", () => {
  assert.equal(isResolved(idle()), false);
  assert.equal(isResolved(loading()), false);
  assert.equal(isPending(idle()), true);
  assert.equal(isPending(loading()), true);
});

test("loaded carries data and is resolved", () => {
  const s = loaded([1, 2, 3]);
  assert.equal(isResolved(s), true);
  assert.equal(isPending(s), false);
  assert.deepEqual(s.status === "loaded" ? s.data : null, [1, 2, 3]);
});

test("failed is resolved (terminal) and carries a message", () => {
  const s = failed("boom");
  assert.equal(isResolved(s), true);
  assert.equal(s.status === "failed" ? s.error : "", "boom");
});
