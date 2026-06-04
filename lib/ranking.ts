// Pure vote-ranking math for the template directory. No DB or framework deps —
// unit-tested with crafted literals (see tests/unit/ranking.test.ts).

/** z for a 95% confidence interval. */
export const WILSON_Z = 1.96;

/** Anonymous templates keep this fraction of their score (35% down-weight). Internal only. */
export const ANONYMITY_KEEP = 0.65;

/** Auto-flag guard: a template needs at least this many votes before takedown is possible. */
export const FLAG_MIN_VOTES = 20;

/** Auto-flag threshold: downvotes at or above this share of total votes triggers takedown. */
export const FLAG_DOWNVOTE_SHARE = 0.4;

/**
 * Wilson score lower bound of the upvote ratio at a 95% confidence interval.
 *
 * Ranks by the *quality* of votes, not the raw count: a 9/10 template can
 * outrank a 50/60 one only when the smaller sample justifies it, and brand-new
 * items are neither unfairly buried nor boosted. Returns 0 when there are no
 * votes. Result is in [0, 1].
 */
export function wilsonLowerBound(up: number, down: number, z: number = WILSON_Z): number {
  const upClamped = Math.max(0, up);
  const downClamped = Math.max(0, down);
  const n = upClamped + downClamped;
  if (n === 0) return 0;

  const phat = upClamped / n;
  const z2 = z * z;
  const numerator = phat + z2 / (2 * n) - z * Math.sqrt((phat * (1 - phat) + z2 / (4 * n)) / n);
  const denominator = 1 + z2 / n;
  return numerator / denominator;
}

/**
 * Directory rank score for a template: the Wilson lower bound, down-weighted
 * when the template was published anonymously. The penalty is intentionally not
 * surfaced anywhere in the UI or API.
 */
export function rankScore(up: number, down: number, anonymous: boolean): number {
  const base = wilsonLowerBound(up, down);
  return anonymous ? base * ANONYMITY_KEEP : base;
}

/**
 * Whether a template should be auto-flagged (hidden + queued for admin review).
 * Only once it has accumulated enough votes to judge fairly (the small-sample
 * guard), and only when downvotes dominate.
 */
export function shouldFlag(up: number, down: number): boolean {
  const n = Math.max(0, up) + Math.max(0, down);
  if (n < FLAG_MIN_VOTES) return false;
  return down / n >= FLAG_DOWNVOTE_SHARE;
}
