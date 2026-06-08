// GET /api/attempts: owner-scoped graded attempt history.
import { auth } from "@clerk/nextjs/server";

import { unauthorized } from "@/lib/api";
import { listUserAttempts } from "@/lib/db/attempts";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const attempts = await listUserAttempts(userId);
  return Response.json({ attempts });
}
