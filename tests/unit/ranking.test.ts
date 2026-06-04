import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ANONYMITY_KEEP,
  FLAG_MIN_VOTES,
  rankScore,
  shouldFlag,
  wilsonLowerBound,
} from "../../lib/ranking";

test("wilsonLowerBound: no votes scores zero", () => {
  assert.equal(wilsonLowerBound(0, 0), 0);
});

test("wilsonLowerBound: stays within [0,1]", () => {
  for (const [up, down] of [
    [1, 0],
    [0, 1],
    [10, 10],
    [500, 3],
    [3, 500],
  ] as const) {
    const s = wilsonLowerBound(up, down);
    assert.ok(s >= 0 && s <= 1, `score ${s} out of range for ${up}/${down}`);
  }
});

test("wilsonLowerBound: large confident sample outranks tiny perfect sample", () => {
  // 1/1 is 100% up but uncertain; 200/210 is lower ratio but far more certain.
  assert.ok(wilsonLowerBound(200, 10) > wilsonLowerBound(1, 0));
});

test("wilsonLowerBound: more upvotes at equal ratio raises the lower bound", () => {
  // Same 90% ratio, bigger sample => higher (more certain) lower bound.
  assert.ok(wilsonLowerBound(90, 10) > wilsonLowerBound(9, 1));
});

test("wilsonLowerBound: downvotes lower the score", () => {
  assert.ok(wilsonLowerBound(50, 50) < wilsonLowerBound(50, 5));
});

test("rankScore: anonymous applies the 35% down-weight", () => {
  const up = 80;
  const down = 20;
  const open = rankScore(up, down, false);
  const anon = rankScore(up, down, true);
  assert.equal(open, wilsonLowerBound(up, down));
  assert.ok(Math.abs(anon - open * ANONYMITY_KEEP) < 1e-12);
  assert.ok(anon < open);
});

test("shouldFlag: never flags below the small-sample guard", () => {
  // 100% downvotes but only 19 votes — under the n>=20 guard.
  assert.equal(FLAG_MIN_VOTES, 20);
  assert.equal(shouldFlag(0, 19), false);
});

test("shouldFlag: flags at the 40% downvote share once n>=20", () => {
  // 12 up / 8 down = 20 votes, 40% down — at the boundary, flags.
  assert.equal(shouldFlag(12, 8), true);
  // 13 up / 7 down = 20 votes, 35% down — below threshold, no flag.
  assert.equal(shouldFlag(13, 7), false);
});

test("shouldFlag: heavy downvotes with enough volume flags", () => {
  assert.equal(shouldFlag(10, 40), true);
});
