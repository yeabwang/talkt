import { defineConfig } from "@trigger.dev/sdk/v3";
import { prismaExtension } from "@trigger.dev/build/extensions/prisma";

export default defineConfig({
  project: "proj_wtrpaehegopjykiaewbc",
  runtime: "node",
  logLevel: "log",
  // Keep Prisma generation under our postinstall flow; Trigger bundles the client as external code.
  build: {
    extensions: [prismaExtension({ mode: "modern" })],
  },
  // Upper bound for long-running background work; individual tasks can set a lower value.
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
