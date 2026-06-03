// Vercel Blob artifact storage. Bulky call artifacts (full transcript, raw
// analysis output) live here, not in Postgres — the DB only keeps the blob URL.
// Server-only (uses BLOB_READ_WRITE_TOKEN).
import { put } from "@vercel/blob";

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

/**
 * Persist a call's full transcript as a JSON artifact and return its public URL.
 * Returns null when Blob isn't configured so the caller can degrade (analysis
 * can still run from the in-memory transcript) instead of failing the webhook.
 */
export async function saveTranscript(attemptId: string, transcript: unknown): Promise<string | null> {
  if (!TOKEN) return null;
  const blob = await put(
    `transcripts/${attemptId}.json`,
    JSON.stringify(transcript),
    { access: "public", contentType: "application/json", token: TOKEN, allowOverwrite: true },
  );
  return blob.url;
}

/** Persist the raw analysis payload alongside the transcript. Returns null when unconfigured. */
export async function saveRawAnalysis(attemptId: string, raw: unknown): Promise<string | null> {
  if (!TOKEN) return null;
  const blob = await put(
    `analysis/${attemptId}.json`,
    JSON.stringify(raw),
    { access: "public", contentType: "application/json", token: TOKEN, allowOverwrite: true },
  );
  return blob.url;
}
