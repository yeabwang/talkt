import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const expectedPages = [
  "app/dashboard/page.tsx",
  "app/templates/page.tsx",
  "app/templates/[id]/page.tsx",
  "app/builder/page.tsx",
  "app/reports/page.tsx",
  "app/results/page.tsx",
  "app/results/[attemptId]/page.tsx",
  "app/interviews/[id]/page.tsx",
  "app/interviews/[id]/live/page.tsx",
  "app/usage/page.tsx",
  "app/settings/page.tsx",
];

test("platform screens have real App Router page files", () => {
  const missing = expectedPages.filter((file) => !existsSync(path.join(process.cwd(), file)));
  assert.deepEqual(missing, []);
});

test("root redirects into the routed dashboard instead of owning the whole app shell", () => {
  const rootPage = path.join(process.cwd(), "app/page.tsx");
  const text = existsSync(rootPage) ? readFileSync(rootPage, "utf8") : "";
  assert.match(text, /redirect\(["']\/dashboard["']\)/);
});
