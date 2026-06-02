import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const requiredFiles = [
  "components/talkt/data.ts",
  "components/talkt/primitives.tsx",
  "components/talkt/app-shell.tsx",
  "components/talkt/dashboard-screen.tsx",
  "components/talkt/library-screen.tsx",
  "components/talkt/builder-screen.tsx",
  "components/talkt/lobby-screen.tsx",
  "components/talkt/live-screen.tsx",
  "components/talkt/results-screen.tsx",
  "components/talkt/talkt-app.tsx",
];

const requiredCopies = [
  "Practice the interview out loud.",
  "Build interview",
  "Practice log",
  "Pick an interview, or build one.",
  "AI builder",
  "Ready to join?",
  "THE INTERVIEWER MOVES ON WHEN YOU PAUSE",
  "Feedback ready",
];

const missingFiles = requiredFiles.filter((file) => !existsSync(join(root, file)));

const pagePath = join(root, "app/page.tsx");
const page = existsSync(pagePath) ? readFileSync(pagePath, "utf8") : "";
const missingPageCopy = ["TalkTApp"].filter((copy) => !page.includes(copy));

const sourceText = requiredFiles
  .filter((file) => existsSync(join(root, file)))
  .map((file) => readFileSync(join(root, file), "utf8"))
  .join("\n");

const missingCopies = requiredCopies.filter((copy) => !sourceText.includes(copy));

if (missingFiles.length || missingPageCopy.length || missingCopies.length) {
  if (missingFiles.length) {
    console.error("Missing TalkT UI files:");
    for (const file of missingFiles) console.error(`- ${file}`);
  }
  if (missingPageCopy.length) {
    console.error("Root route is missing expected copy/import:");
    for (const copy of missingPageCopy) console.error(`- ${copy}`);
  }
  if (missingCopies.length) {
    console.error("TalkT UI source is missing expected workflow copy:");
    for (const copy of missingCopies) console.error(`- ${copy}`);
  }
  process.exit(1);
}

console.log("TalkT UI prototype check passed.");
