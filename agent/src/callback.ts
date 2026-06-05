// The only bridge back to the app. The worker never imports Prisma or the Trigger
// SDK — it POSTs the authoritative transcript + outcome to an authenticated
// internal endpoint (spec 18), which makes the completed-vs-abandoned grading
// decision. The endpoint is idempotent, so retries and the close/shutdown
// double-fire are harmless.
import type { Turn } from "./transcript.js";

export type Outcome = "completed" | "abandoned";

export interface SessionEndedPayload {
  attemptId: string;
  transcript: Turn[];
  outcome: Outcome;
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * POST the session outcome to /api/internal/session-ended. Retries network
 * errors and 5xx with exponential backoff (3 attempts). 4xx is non-retryable
 * (bad payload / auth) and throws immediately after logging.
 */
export async function postSessionEnded(payload: SessionEndedPayload, attempts = 3): Promise<void> {
  const url = `${appUrl()}/api/internal/session-ended`;
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    console.error("[callback] INTERNAL_API_SECRET is not set — cannot authenticate callback");
  }

  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": secret ?? "",
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) return;
      // 4xx (except 429) won't fix on retry — fail fast.
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        throw new Error(`session-ended rejected: ${res.status} ${await safeText(res)}`);
      }
      lastErr = new Error(`session-ended failed: ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    if (i < attempts - 1) await sleep(500 * 2 ** i); // 500ms, 1s, ...
  }
  console.error(`[callback] giving up after ${attempts} attempts:`, lastErr);
  throw lastErr instanceof Error ? lastErr : new Error("session-ended failed");
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 200);
  } catch {
    return "";
  }
}
