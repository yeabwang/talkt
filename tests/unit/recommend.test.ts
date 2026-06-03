import assert from "node:assert/strict";
import { test } from "node:test";

import {
  AFFINITY_WEIGHT,
  RANK_WEIGHT,
  buildProfile,
  isColdStart,
  normalizeRanks,
  personalizedScore,
  scoreInterview,
  type AttemptFacets,
} from "../../lib/recommend";

const NOW = new Date("2026-06-03T00:00:00.000Z");

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
}

test("buildProfile: empty history is cold start", () => {
  const profile = buildProfile([], NOW);
  assert.equal(isColdStart(profile), true);
  assert.equal(scoreInterview(profile, { category: "Engineering" }), 0);
});

test("buildProfile: per-facet weights normalize to 1", () => {
  const attempts: AttemptFacets[] = [
    { category: "Engineering", difficulty: "Mid", language: "English", role: "Frontend", takenAt: daysAgo(1) },
    { category: "Product", difficulty: "Senior", language: "English", role: "PM", takenAt: daysAgo(2) },
  ];
  const profile = buildProfile(attempts, NOW);
  for (const facet of ["category", "role", "difficulty", "language"] as const) {
    const total = Object.values(profile[facet]).reduce((s, w) => s + w, 0);
    assert.ok(Math.abs(total - 1) < 1e-9, `${facet} sums to ${total}`);
  }
  // Single shared language => weight 1 on it.
  assert.ok(Math.abs(profile.language.english - 1) < 1e-9);
});

test("buildProfile: recent attempts dominate older ones (decay)", () => {
  const attempts: AttemptFacets[] = [
    { category: "Engineering", takenAt: daysAgo(0) }, // recent
    { category: "Healthcare", takenAt: daysAgo(120) }, // 4 half-lives old
  ];
  const profile = buildProfile(attempts, NOW);
  assert.ok(profile.category.engineering > profile.category.healthcare);
});

test("buildProfile: values are case/space-insensitive", () => {
  const profile = buildProfile([{ category: "  Engineering  ", takenAt: daysAgo(1) }], NOW);
  assert.ok("engineering" in profile.category);
});

test("scoreInterview: best-matching interview scores higher", () => {
  const attempts: AttemptFacets[] = [
    { category: "Engineering", role: "Frontend", difficulty: "Mid", language: "English", takenAt: daysAgo(1) },
    { category: "Engineering", role: "Frontend", difficulty: "Mid", language: "English", takenAt: daysAgo(3) },
  ];
  const profile = buildProfile(attempts, NOW);
  const match = scoreInterview(profile, { category: "Engineering", role: "Frontend", difficulty: "Mid", language: "English" });
  const miss = scoreInterview(profile, { category: "Sales", role: "AE", difficulty: "Senior", language: "Spanish" });
  assert.ok(match > miss);
  assert.ok(match > 0 && match <= 1);
  assert.equal(miss, 0);
});

test("personalizedScore: blends 0.6 affinity / 0.4 rank", () => {
  assert.equal(AFFINITY_WEIGHT, 0.6);
  assert.equal(RANK_WEIGHT, 0.4);
  assert.ok(Math.abs(personalizedScore(1, 0) - 0.6) < 1e-12);
  assert.ok(Math.abs(personalizedScore(0, 1) - 0.4) < 1e-12);
  assert.ok(Math.abs(personalizedScore(0.5, 0.5) - 0.5) < 1e-12);
});

test("normalizeRanks: max-normalizes to [0,1]", () => {
  assert.deepEqual(normalizeRanks([0.2, 0.4, 0.8]), [0.25, 0.5, 1]);
  assert.deepEqual(normalizeRanks([0, 0, 0]), [0, 0, 0]);
});
