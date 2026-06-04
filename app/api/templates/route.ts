// GET /api/templates — the public, ranked template directory. Auth is optional;
// when signed in, each interview carries the caller's own vote (myVote).
//
// Cursor-paginated: `?limit=<n>&cursor=<id>`. The default limit returns the whole
// bounded directory in one response (the client filters/searches client-side), so
// the common path is unchanged; pass limit/cursor to page a large catalog.
import { auth } from "@clerk/nextjs/server";

import { listDirectoryPage } from "@/lib/db/interviews";
import { clampLimit } from "@/lib/pagination";

export async function GET(req: Request) {
  const { userId } = await auth();
  const params = new URL(req.url).searchParams;
  const limit = clampLimit(params.get("limit"));
  const cursor = params.get("cursor");
  const page = await listDirectoryPage(userId ?? null, { limit, cursor });
  return Response.json({ interviews: page.items, nextCursor: page.nextCursor });
}
