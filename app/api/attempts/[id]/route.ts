// GET /api/attempts/[id] — poll attempt status (+ feedback once ready).
// Owner-scoped. The completed-vs-abandoned decision and grading are driven
// server-side by the worker's session-ended callback, so there is no longer a
// client PATCH (attach call id / abandon) — the results screen just polls here.
import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

import { notFound, unauthorized } from "@/lib/api";
import { getAttemptStatus } from "@/lib/db/attempts";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const { id } = await ctx.params;
  const result = await getAttemptStatus(id, userId);
  if (!result) return notFound();
  return Response.json(result);
}
