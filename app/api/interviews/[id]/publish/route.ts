// POST /api/interviews/[id]/publish: publish an owned custom interview.
import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

import { badRequest, forbidden, notFound, unauthorized } from "@/lib/api";
import { publish } from "@/lib/db/interviews";
import { ensureUser } from "@/lib/db/users";
import { ValidationError, isRecord, optBool, optString } from "@/lib/validate";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const { id } = await ctx.params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  let displayName: string | undefined;
  let anonymous: boolean;
  try {
    if (!isRecord(raw)) throw new ValidationError("Body must be an object");
    anonymous = optBool(raw.anonymous, "anonymous") ?? false;
    // Anonymous publishing stores no public author credit.
    displayName = anonymous ? undefined : optString(raw.displayName, "displayName", 80);
  } catch (error) {
    if (error instanceof ValidationError) return badRequest(error.message);
    return badRequest("Invalid request");
  }

  await ensureUser();
  const result = await publish(id, userId, { displayName, anonymous });
  if (!result.ok) {
    return result.reason === "not_found" ? notFound(result.reason) : forbidden(result.reason);
  }
  return Response.json({ interview: result.interview });
}
