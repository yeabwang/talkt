// GET  /api/attempts/[id] — poll attempt status (+ feedback once ready).
// PATCH /api/attempts/[id] — attach the Vapi call id when the browser's call
//        actually starts (defensive join key for the webhook). Both owner-scoped.
import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

import { notFound, unauthorized } from "@/lib/api";
import { attachCallId, getAttemptStatus } from "@/lib/db/attempts";
import { isRecord, optString } from "@/lib/validate";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const { id } = await ctx.params;
  const result = await getAttemptStatus(id, userId);
  if (!result) return notFound();
  return Response.json(result);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const { id } = await ctx.params;
  const raw = await req.json().catch(() => null);
  const callId = isRecord(raw) ? optString(raw.vapiCallId, "vapiCallId", 200) : undefined;
  if (callId) await attachCallId(id, userId, callId);
  return Response.json({ ok: true });
}
