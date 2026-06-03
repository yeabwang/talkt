// Push the curated TalkT interview templates into the DB.
//
// Run with: npm run db:seed  (after the migration is applied).
// Idempotent: upserts by id so links stay stable across re-seeds.
//
// All templates are published under the "TalkT" name (authorName = null, which
// the DTO renders as "TalkT") and made public so they appear in the directory.
//
// Loads .env.local first, then dynamically imports the Prisma client so
// DATABASE_URL is set before the singleton initializes (same as db-check.ts).
import { config } from "dotenv";
config({ path: ".env.local" });

import { SEED_TEMPLATES } from "./seed-data";
import { toLanguageCode } from "../lib/language";

async function main() {
  const { prisma } = await import("../lib/prisma");
  const { ensureVoiceAgents } = await import("../lib/db/voice-agents");
  const now = new Date();

  for (const t of SEED_TEMPLATES) {
    const data = {
      title: t.title,
      subtitle: t.subtitle,
      role: t.role,
      topic: t.category,
      difficulty: t.difficulty,
      blurb: t.blurb,
      minutes: t.minutes,
      focus: [] as string[],
      type: "template" as const,
      visibility: "public" as const,
      language: toLanguageCode("English"),
      dimensions: [],
      questions: t.questions,
      voiceConfig: { voiceId: t.voice },
      authorName: null, // null -> credited as "TalkT"
      anonymous: false,
      publishedAt: now,
    };

    await prisma.interview.upsert({
      where: { id: t.id },
      create: { id: t.id, ownerId: null, ...data },
      update: data,
    });
  }

  await ensureVoiceAgents();

  console.log(`Seeded ${SEED_TEMPLATES.length} TalkT templates and ensured default voice agents.`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
