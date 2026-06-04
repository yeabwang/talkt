// GET /api/attempts — the signed-in user's graded attempt history (newest first)
// for the Reports list and dashboard. Owner-scoped; only `ready` attempts.
import { auth } from "@clerk/nextjs/server";

import { unauthorized } from "@/lib/api";
import { listUserAttempts } from "@/lib/db/attempts";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const attempts = await listUserAttempts(userId);
  return Response.json({ attempts });
}
