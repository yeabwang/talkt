// Sync the Clerk identity into Postgres before writes that reference User.
import { currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";

/**
 * Ensure a User row exists for the signed-in Clerk user.
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
