// POST /api/attempts/[id]/grade — client-driven grade trigger.
//
// The browser holds the live transcript, so at call end it posts it here. We
// decide grade-vs-abandon (>=50% of questions answered, whoever ended the call),
// trigger the durable grade-attempt task, and hand back the run id + a read-scoped
// public token so the results screen can stream progress via Realtime. The task
// is durable: if the user leaves, it still finishes and the report appears in
// Reports. Idempotent with the Vapi webhook via the `grade-${id}` key.
import { auth as clerkAuth } from "@clerk/nextjs/server";
import { auth as triggerAuth, tasks } from "@trigger.dev/sdk";
import type { NextRequest } from "next/server";

import { badRequest, notFound, unauthorized } from "@/lib/api";
import { findAttemptForGrading, markAbandoned, markAnalyzing } from "@/lib/db/attempts";
import { sanitizeTranscript } from "@/lib/transcript";
import type { gradeAttempt } from "@/trigger/grade-attempt";
import { classifyOutcome } from "@/lib/vapi/webhook";

export type GradeResponse =
  | { status: "grading"; runId: string; publicAccessToken: string }
  | { status: "ready" | "abandoned" | "failed" | "analyzing" };

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await clerkAuth();
  if (!userId) return unauthorized();

  const { id } = await ctx.params;

  let body: { transcript?: unknown };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const transcript = sanitizeTranscript(body.transcript);

  const attempt = await findAttemptForGrading(id, userId);
  if (!attempt) return notFound("Attempt not found");

  // Terminal states: nothing to do, just report them back.
  if (attempt.status === "ready" || attempt.status === "abandoned" || attempt.status === "failed") {
    return Response.json({ status: attempt.status } satisfies GradeResponse);
  }

  // Fresh attempt: decide whether the call earned a grade.
  if (attempt.status === "in_progress") {
    const outcome = classifyOutcome(transcript, attempt.interview.questions ?? [], undefined);
    if (outcome === "abandoned") {
      await markAbandoned(id);
      return Response.json({ status: "abandoned" } satisfies GradeResponse);
    }
    await markAnalyzing(id);
  }

  // Trigger (idempotent) and mint a read-scoped token for the run so the client
  // can subscribe. A webhook race that already triggered returns the same run.
  try {
    const handle = await tasks.trigger<typeof gradeAttempt>(
      "grade-attempt",
      { attemptId: id, transcript },
      { idempotencyKey: `grade-${id}`, idempotencyKeyTTL: "1h" },
    );
    const publicAccessToken = await triggerAuth.createPublicToken({
      scopes: { read: { runs: [handle.id] } },
      expirationTime: "1h",
    });
    return Response.json({ status: "grading", runId: handle.id, publicAccessToken } satisfies GradeResponse);
  } catch (error) {
    // Trigger unreachable/misconfigured: leave the attempt analyzing so the
    // results screen falls back to polling (the webhook/reconcile path can still
    // complete it). Don't fail the call end over a transient trigger error.
    console.error("[attempts/grade] trigger failed:", error);
    return Response.json({ status: "analyzing" } satisfies GradeResponse);
  }
}
