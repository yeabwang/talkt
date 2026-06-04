// GET /api/templates — the public, ranked template directory. Auth is optional;
// when signed in, each interview carries the caller's own vote (myVote).
import { auth } from "@clerk/nextjs/server";

import { listDirectory } from "@/lib/db/interviews";

export async function GET() {
  const { userId } = await auth();
  const interviews = await listDirectory(userId ?? null);
  return Response.json({ interviews });
}
