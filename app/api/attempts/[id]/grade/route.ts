// POST /api/attempts/[id]/grade — kick off grading.
//
// Grading no longer runs inline here. We verify ownership, hand the captured
// transcript to the `grade-attempt` Trigger.dev task, and return the run id +
// a read-scoped public token so the browser can stream progress via Realtime
// and unblock the request immediately. The task is idempotent (status-guarded),
// so this is safe to call once when the call ends.
import { auth } from "@clerk/nextjs/server";
import { auth as triggerAuth, tasks } from "@trigger.dev/sdk";
import type { NextRequest } from "next/server";

import type { gradeAttempt } from "@/trigger/grade-attempt";
import { findOwnedAttempt } from "@/lib/db/attempts";
import { sanitizeTranscript } from "@/lib/transcript";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  // Owner check before we trigger — the task itself trusts its caller.
  const attempt = await findOwnedAttempt(id, userId);
  if (!attempt) return Response.json({ error: "Not found" }, { status: 404 });
  if (attempt.status === "ready") return Response.json({ status: "ready" });

  const body = (await req.json().catch(() => null)) as { transcript?: unknown } | null;
  const transcript = sanitizeTranscript(body?.transcript);

  // Idempotency key = attempt: a concurrent webhook trigger collapses into this
  // same run instead of grading twice.
  const handle = await tasks.trigger<typeof gradeAttempt>(
    "grade-attempt",
    { attemptId: id, transcript },
    { idempotencyKey: `grade-${id}`, idempotencyKeyTTL: "1h" },
  );

  // Read-only token scoped to just this run, for the client Realtime hook.
  const publicAccessToken = await triggerAuth.createPublicToken({
    scopes: { read: { runs: [handle.id] } },
    expirationTime: "1h",
  });

  return Response.json({ runId: handle.id, publicAccessToken });
}
