// POST /api/interviews/[id]/vote — cast (1 / -1) or clear (0) the caller's vote.
// Returns fresh tallies + the caller's current vote only; never voter identities.
import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

import { ensureUser } from "@/lib/db/users";
import { castVote } from "@/lib/db/votes";
import { ValidationError, isRecord } from "@/lib/validate";

function parseValue(raw: unknown): -1 | 0 | 1 {
  if (!isRecord(raw)) throw new ValidationError("Body must be an object");
  const v = raw.value;
  if (v === 1 || v === -1 || v === 0) return v;
  throw new ValidationError('"value" must be 1, -1, or 0');
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { id } = await ctx.params;

  let value: -1 | 0 | 1;
  try {
    value = parseValue(await req.json().catch(() => null));
  } catch (error) {
    if (error instanceof ValidationError) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  await ensureUser();
  const result = await castVote(userId, id, value);
  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : result.reason === "forbidden" ? 403 : 409;
    return Response.json({ error: result.reason }, { status });
  }
  return Response.json({
    upvotes: result.upvotes,
    downvotes: result.downvotes,
    myVote: result.myVote,
    flagged: result.flagged,
  });
}
