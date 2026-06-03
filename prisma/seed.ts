// Seed the curated + community starter interviews into the directory.
//
// Run with: npm run db:seed  (after the migration is applied).
// Idempotent: upserts by the mock id so links stay stable across re-seeds.
import { TEMPLATES } from "../components/talkt/data";
import { toLanguageCode } from "../lib/language";
import { prisma } from "../lib/prisma";

async function main() {
  for (const t of TEMPLATES) {
    // Curated interviews are attributed to TalkT (no public author credit);
    // community-authored mock entries keep their author name as the credit.
    const authorName = t.author && t.author !== "TalkT" ? t.author : null;

    await prisma.interview.upsert({
      where: { id: t.id },
      create: {
        id: t.id,
        ownerId: null, // system template
        title: t.title,
        subtitle: t.subtitle,
        role: t.title, // gives the recommender a role facet to match on
        topic: t.category,
        difficulty: t.difficulty,
        blurb: t.blurb,
        minutes: t.minutes,
        focus: [],
        type: "template",
        visibility: "public",
        language: toLanguageCode(t.language ?? "English"),
        dimensions: [],
        questions: t.questions,
        voiceConfig: { voiceId: t.voice },
        authorName,
        anonymous: false,
      },
      update: {
        title: t.title,
        subtitle: t.subtitle,
        topic: t.category,
        difficulty: t.difficulty,
        blurb: t.blurb,
        minutes: t.minutes,
        questions: t.questions,
        voiceConfig: { voiceId: t.voice },
        authorName,
      },
    });
  }
  console.log(`Seeded ${TEMPLATES.length} interviews.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
