// Standalone DB connectivity check. Loads .env.local, then dynamically
// imports the client so env is set before the singleton initializes.
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { prisma } = await import("../lib/db");
  const counts = {
    users: await prisma.user.count(),
    interviews: await prisma.interview.count(),
    attempts: await prisma.attempt.count(),
    feedback: await prisma.feedback.count(),
  };
  console.log("DB OK:", JSON.stringify(counts));
}

main().catch((e) => {
  console.error("DB FAIL:", e.message);
  process.exit(1);
});
