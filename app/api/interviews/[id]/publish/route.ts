// POST /api/interviews/[id]/publish — make the caller's custom interview public
// in the directory. Enforces ownership. Body: { displayName?, anonymous }.
import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

import { publish } from "@/lib/db/interviews";
import { ensureUser } from "@/lib/db/users";
import { ValidationError, isRecord, optBool, optString } from "@/lib/validate";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { id } = await ctx.params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let displayName: string | undefined;
  let anonymous: boolean;
  try {
    if (!isRecord(raw)) throw new ValidationError("Body must be an object");
    anonymous = optBool(raw.anonymous, "anonymous") ?? false;
    // Author is credited by their own name by default; when no display name is
    // supplied, publish() falls back to the owner's stored account name.
    displayName = anonymous ? undefined : optString(raw.displayName, "displayName", 80);
  } catch (error) {
    if (error instanceof ValidationError) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  await ensureUser();
  const result = await publish(id, userId, { displayName, anonymous });
  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : 403;
    return Response.json({ error: result.reason }, { status });
  }
  return Response.json({ interview: result.interview });
}
