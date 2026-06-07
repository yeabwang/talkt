// GET /api/templates: public ranked directory with optional per-caller vote data.
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
