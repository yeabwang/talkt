// Content-based recommendation scoring for the template directory.
// Uses only the current user's attempt history plus public directory rank.

/** Facets we profile on. Each contributes equally to affinity. */
export type Facet = "category" | "role" | "difficulty" | "language";

const FACETS: Facet[] = ["category", "role", "difficulty", "language"];

/** Half-life of attempt influence, in days. Activity older than this counts half as much. */
export const DECAY_HALF_LIFE_DAYS = 30;

/** Affinity vs rank mix for the personalized order. */
export const AFFINITY_WEIGHT = 0.6;
export const RANK_WEIGHT = 0.4;

const DAY_MS = 24 * 60 * 60 * 1000;

/** One past attempt's facets plus when it happened. */
export interface AttemptFacets {
  category?: string | null;
  role?: string | null;
  difficulty?: string | null;
  language?: string | null;
  takenAt: Date;
}

/** A candidate interview's facets (for scoring against a profile). */
export interface InterviewFacets {
  category?: string | null;
  role?: string | null;
  difficulty?: string | null;
  language?: string | null;
}

/** Per-facet map of value -> accumulated decayed weight, normalized to sum 1 within each facet. */
export type Profile = Record<Facet, Record<string, number>>;

function normalizeValue(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length ? trimmed : null;
}

function emptyProfile(): Profile {
  return { category: {}, role: {}, difficulty: {}, language: {} };
}

/**
 * Build a recency-weighted preference profile from a user's attempts. Each
 * attempt contributes weight `0.5 ^ (ageDays / halfLife)` to each of its facet
 * values; per-facet weights are then normalized to sum to 1. An empty history
 * yields an empty profile (every facet map empty) — the cold-start case.
 */
export function buildProfile(
  attempts: AttemptFacets[],
  now: Date = new Date(),
  halfLifeDays: number = DECAY_HALF_LIFE_DAYS,
): Profile {
  const profile = emptyProfile();

  for (const attempt of attempts) {
    const ageDays = Math.max(0, (now.getTime() - attempt.takenAt.getTime()) / DAY_MS);
    const weight = Math.pow(0.5, ageDays / halfLifeDays);
    for (const facet of FACETS) {
      const value = normalizeValue(attempt[facet]);
      if (!value) continue;
      profile[facet][value] = (profile[facet][value] ?? 0) + weight;
    }
  }

  for (const facet of FACETS) {
    const total = Object.values(profile[facet]).reduce((sum, w) => sum + w, 0);
    if (total > 0) {
      for (const key of Object.keys(profile[facet])) {
        profile[facet][key] /= total;
      }
    }
  }

  return profile;
}

/** True when the profile has no signal. */
export function isColdStart(profile: Profile): boolean {
  return FACETS.every((facet) => Object.keys(profile[facet]).length === 0);
}

/**
 * Affinity in [0,1] between a profile and an interview: the mean over facets of
 * the normalized weight the profile assigns to that interview's facet value.
 * Facets the profile has no signal on contribute 0. Cold-start profiles score 0.
 */
export function scoreInterview(profile: Profile, interview: InterviewFacets): number {
  if (isColdStart(profile)) return 0;

  let sum = 0;
  for (const facet of FACETS) {
    const value = normalizeValue(interview[facet]);
    if (!value) continue;
    sum += profile[facet][value] ?? 0;
  }
  return sum / FACETS.length;
}

/**
 * Blend a personalized affinity with the template's normalized directory rank.
 * `normalizedRank` is expected in [0,1] (rank scores mapped across the
 * directory). Returns a single comparable score for ordering.
 */
export function personalizedScore(affinity: number, normalizedRank: number): number {
  return AFFINITY_WEIGHT * affinity + RANK_WEIGHT * normalizedRank;
}

/** Map raw rank scores to [0,1] across the candidate set (max-normalization; all-equal -> 0). */
export function normalizeRanks(rankScores: number[]): number[] {
  const max = Math.max(0, ...rankScores);
  if (max <= 0) return rankScores.map(() => 0);
  return rankScores.map((r) => Math.max(0, r) / max);
}
