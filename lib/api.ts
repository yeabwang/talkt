// Shared API response helpers with a consistent { error } body.

export function jsonError(message: string, status: number, headers?: HeadersInit): Response {
  return Response.json({ error: message }, headers ? { status, headers } : { status });
}

export function unauthorized(): Response {
  return jsonError("Unauthorized", 401);
}

export function badRequest(message: string): Response {
  return jsonError(message, 400);
}

export function notFound(message = "Not found"): Response {
  return jsonError(message, 404);
}

export function forbidden(message = "Forbidden"): Response {
  return jsonError(message, 403);
}

/** 429 with a Retry-After header derived from the limiter's retry window. */
export function tooManyRequests(retryAfterMs: number, message = "Too many requests. Please slow down."): Response {
  return jsonError(message, 429, { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) });
}
