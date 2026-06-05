import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Judged behavioral tests call the Inference LLM; give them room.
    testTimeout: 120_000,
    hookTimeout: 120_000,
    // Each behavioral test owns a session/LLM connection — don't run them
    // against each other in the same file.
    fileParallelism: false,
  },
});
