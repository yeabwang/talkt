// Vercel Blob artifact storage. The raw analysis output (the full structured
// feedback) is kept here as a private artifact; Postgres only stores its URL.
// The call transcript is NOT persisted here — it lives in the grading task's run
// payload (replayed on retry) and is discarded with the run.
// Server-only (uses BLOB_READ_WRITE_TOKEN).
import { put } from "@vercel/blob";

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

/**
 * Persist the raw analysis payload as a private artifact and return its URL.
 * Returns null when Blob isn't configured (the structured Feedback row is still
 * the source of truth, so the grade isn't lost).
 */
export async function saveRawAnalysis(attemptId: string, raw: unknown): Promise<string | null> {
  if (!TOKEN) return null;
  const blob = await put(
    `analysis/${attemptId}.json`,
    JSON.stringify(raw),
    { access: "private", contentType: "application/json", token: TOKEN, allowOverwrite: true },
  );
  return blob.url;
}
