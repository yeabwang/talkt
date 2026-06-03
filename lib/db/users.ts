// User sync: mirror the Clerk identity into a thin Postgres row on first need.
import { currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";

/**
 * Ensure a User row exists for the signed-in Clerk user, returning its id.
 * Upserts name/email from Clerk so the row stays fresh. Call from any
 * authenticated server path before writing rows that reference the user.
 * Returns null when there is no signed-in user.
 */
export async function ensureUser(): Promise<string | null> {
  const clerk = await currentUser();
  if (!clerk) return null;

  const email = clerk.primaryEmailAddress?.emailAddress ?? null;
  const name = clerk.fullName ?? clerk.firstName ?? clerk.username ?? null;

  await prisma.user.upsert({
    where: { id: clerk.id },
    create: { id: clerk.id, email, name },
    update: { email, name },
  });

  return clerk.id;
}
