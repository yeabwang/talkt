// Server-side Vercel Blob storage for private grading artifacts.
import { put } from "@vercel/blob";

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

/**
 * Persist raw analysis as a private artifact. Returns null when Blob is not configured.
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
