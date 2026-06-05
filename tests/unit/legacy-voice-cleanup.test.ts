import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const files = [
  "skills-lock.json",
  "prisma/migrations/20260601154213_init/migration.sql",
  "prisma/migrations/20260605120000_livekit_grading_cutover/migration.sql",
];

const retiredProviderPattern = new RegExp(`\\b${"va"}${"pi"}\\b`, "i");

test("repo setup no longer references the retired voice provider", () => {
  const offenders = files.flatMap((file) => {
    const text = readFileSync(path.join(process.cwd(), file), "utf8");
    return retiredProviderPattern.test(text) ? [file] : [];
  });

  assert.deepEqual(offenders, []);
});
