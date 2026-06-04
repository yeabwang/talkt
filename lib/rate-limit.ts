// In-memory fixed-window rate limiter for cost-bearing endpoints (LLM builder,
// call start). Per-process only — adequate as a first-line abuse guard on a
// single instance; swap for a shared store (Redis) if horizontally scaled.
// Pure core (injectable clock) so it is unit-testable.

export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  now?: () => number;
}

export interface RateDecision {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export function createRateLimiter({ limit, windowMs, now = Date.now }: RateLimiterOptions) {
  const buckets = new Map<string, Bucket>();

  function check(key: string): RateDecision {
    const t = now();
    const bucket = buckets.get(key);
    if (!bucket || t >= bucket.resetAt) {
      buckets.set(key, { count: 1, resetAt: t + windowMs });
      return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
    }
    if (bucket.count < limit) {
      bucket.count += 1;
      return { allowed: true, remaining: limit - bucket.count, retryAfterMs: 0 };
    }
    return { allowed: false, remaining: 0, retryAfterMs: bucket.resetAt - t };
  }

  return { check };
}
