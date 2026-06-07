import assert from "node:assert/strict";
import { test } from "node:test";

import {
  processSessionEnded,
  type SessionEndedDeps,
} from "../../lib/session-ended";

// ── processSessionEnded ──────────────────────────────────────────────────────

interface Spy {
  deps: SessionEndedDeps;
  abandoned: string[];
  analyzing: string[];
  failed: string[];
  graded: { attemptId: string; idempotencyKey: string }[];
}

function makeDeps(attempt: { id: string; status: string } | null, opts: { triggerFails?: boolean } = {}): Spy {
  const abandoned: string[] = [];
  const analyzing: string[] = [];
  const failed: string[] = [];
  const graded: { attemptId: string; idempotencyKey: string }[] = [];
  return {
    abandoned,
    analyzing,
    failed,
    graded,
    deps: {
      findAttempt: async () => attempt,
      markAbandoned: async (id) => {
        abandoned.push(id);
      },
      markAnalyzing: async (id) => {
        analyzing.push(id);
      },
      markFailed: async (id) => {
        failed.push(id);
      },
      triggerGrade: async ({ attemptId, idempotencyKey }) => {
        if (opts.triggerFails) throw new Error("trigger down");
        graded.push({ attemptId, idempotencyKey });
      },
    },
  };
}

test("process: unknown attempt → noop (no abandon, no grade)", async () => {
  const spy = makeDeps(null);
  const result = await processSessionEnded({ attemptId: "x", outcome: "completed", transcript: [] }, spy.deps);
  assert.equal(result, "noop");
  assert.equal(spy.abandoned.length, 0);
  assert.equal(spy.analyzing.length, 0);
  assert.equal(spy.graded.length, 0);
});

test("process: non-in_progress attempt → noop (idempotent)", async () => {
  const spy = makeDeps({ id: "att_1", status: "ready" });
  const result = await processSessionEnded({ attemptId: "att_1", outcome: "completed", transcript: [] }, spy.deps);
  assert.equal(result, "noop");
  assert.equal(spy.analyzing.length, 0);
  assert.equal(spy.graded.length, 0);
});

test("process: abandoned outcome → marks abandoned, never grades", async () => {
  const spy = makeDeps({ id: "att_1", status: "in_progress" });
  const result = await processSessionEnded({ attemptId: "att_1", outcome: "abandoned", transcript: [] }, spy.deps);
  assert.equal(result, "abandoned");
  assert.deepEqual(spy.abandoned, ["att_1"]);
  assert.equal(spy.analyzing.length, 0);
  assert.equal(spy.graded.length, 0);
});

test("process: completed outcome → triggers grade once with the per-attempt key", async () => {
  const spy = makeDeps({ id: "att_1", status: "in_progress" });
  const result = await processSessionEnded(
    { attemptId: "att_1", outcome: "completed", transcript: [{ role: "user", text: "hi" }] },
    spy.deps,
  );
  assert.equal(result, "graded");
  assert.deepEqual(spy.analyzing, ["att_1"]);
  assert.equal(spy.graded.length, 1);
  assert.deepEqual(spy.graded[0], { attemptId: "att_1", idempotencyKey: "grade-att_1" });
  assert.equal(spy.abandoned.length, 0);
  assert.equal(spy.failed.length, 0);
});

test("process: trigger enqueue failure marks attempt failed", async () => {
  const spy = makeDeps({ id: "att_1", status: "in_progress" }, { triggerFails: true });
  await assert.rejects(
    processSessionEnded({ attemptId: "att_1", outcome: "completed", transcript: [{ role: "user", text: "hi" }] }, spy.deps),
    /trigger down/,
  );
  assert.deepEqual(spy.analyzing, ["att_1"]);
  assert.deepEqual(spy.failed, ["att_1"]);
});
