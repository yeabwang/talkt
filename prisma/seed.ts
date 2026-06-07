// Seed curated TalkT templates into the public directory.
// Idempotent: upserts by id so template links stay stable across reseeds.
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
      dimensions: t.dimensions,
      questions: t.questions,
      voiceConfig: { voiceId: t.voice },
      authorName: null,
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
