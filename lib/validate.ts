// Tiny hand-rolled boundary validators. The codebase does not use a schema lib
// (see app/api/builder/route.ts, which coerces by hand); these helpers keep API
// route handlers terse while still rejecting malformed input before it reaches
// the DB layer.

/** Thrown by parsers below; route handlers translate this to a 400. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Required non-empty trimmed string. */
export function reqString(value: unknown, field: string, maxLen = 2000): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError(`"${field}" must be a non-empty string`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLen) throw new ValidationError(`"${field}" is too long`);
  return trimmed;
}

/** Optional trimmed string -> string | undefined (blank becomes undefined). */
export function optString(value: unknown, field: string, maxLen = 2000): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new ValidationError(`"${field}" must be a string`);
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > maxLen) throw new ValidationError(`"${field}" is too long`);
  return trimmed;
}

export function optBool(value: unknown, field: string): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "boolean") throw new ValidationError(`"${field}" must be a boolean`);
  return value;
}

/** Array of non-empty strings, each trimmed; caps length to avoid abuse. */
export function stringArray(value: unknown, field: string, maxItems = 50): string[] {
  if (!Array.isArray(value)) throw new ValidationError(`"${field}" must be an array`);
  const out = value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean)
    .slice(0, maxItems);
  return out;
}
