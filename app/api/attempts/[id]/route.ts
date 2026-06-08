// GET /api/attempts/[id]: owner-scoped status polling with feedback once ready.
import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

import { notFound, unauthorized } from "@/lib/api";
import { getAttemptStatus } from "@/lib/db/attempts";
import { reconcileAttemptFromVapi } from "@/lib/vapi/reconcile";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const { id } = await ctx.params;
  try {
    await reconcileAttemptFromVapi(id, userId);
  } catch (err) {
    console.warn("[attempts] Vapi reconcile failed", { attemptId: id, err });
  }

  const result = await getAttemptStatus(id, userId);
  if (!result) return notFound();
  return Response.json(result);
}
