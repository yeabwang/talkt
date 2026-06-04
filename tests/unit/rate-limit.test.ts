import assert from "node:assert/strict";
import { test } from "node:test";

import { createRateLimiter } from "../../lib/rate-limit";

test("allows up to the limit within a window, then denies", () => {
  const now = 1_000_000;
  const limiter = createRateLimiter({ limit: 3, windowMs: 1000, now: () => now });
  assert.equal(limiter.check("user-a").allowed, true);
  assert.equal(limiter.check("user-a").allowed, true);
  assert.equal(limiter.check("user-a").allowed, true);
  const denied = limiter.check("user-a");
  assert.equal(denied.allowed, false);
  assert.ok(denied.retryAfterMs > 0 && denied.retryAfterMs <= 1000);
});

test("separate keys have separate budgets", () => {
  const now = 5_000;
  const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: () => now });
  assert.equal(limiter.check("a").allowed, true);
  assert.equal(limiter.check("b").allowed, true);
  assert.equal(limiter.check("a").allowed, false);
});

test("window resets after it elapses", () => {
  let now = 0;
  const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: () => now });
  assert.equal(limiter.check("a").allowed, true);
  assert.equal(limiter.check("a").allowed, false);
  now += 1001;
  assert.equal(limiter.check("a").allowed, true);
});
