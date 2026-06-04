import { defineConfig } from "@trigger.dev/sdk/v3";
import { prismaExtension } from "@trigger.dev/build/extensions/prisma";

export default defineConfig({
  project: "proj_wtrpaehegopjykiaewbc",
  runtime: "node",
  logLevel: "log",
  // Prisma 7 (prisma-client provider + @prisma/adapter-pg): modern mode marks
  // @prisma/client external and relies on our own `prisma generate` (postinstall)
  // for the TS client. No-op in dev, which reuses the locally generated client.
  build: {
    extensions: [prismaExtension({ mode: "modern" })],
  },
  // The max compute seconds a task is allowed to run. If the task run exceeds this duration, it will be stopped.
  // You can override this on an individual task.
  // See https://trigger.dev/docs/runs/max-duration
  maxDuration: 3600,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["trigger"],
});
