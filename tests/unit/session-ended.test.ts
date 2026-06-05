import assert from "node:assert/strict";
import { test } from "node:test";

import {
  authorizeSession,
  parseSessionEndedBody,
  processSessionEnded,
  type SessionEndedDeps,
} from "../../lib/session-ended";

// ── authorizeSession ─────────────────────────────────────────────────────────

test("authorize: configured secret + matching header → ok", () => {
  assert.equal(authorizeSession("s3cret", "s3cret", false), "ok");
  assert.equal(authorizeSession("s3cret", "s3cret", true), "ok");
});

test("authorize: configured secret + wrong/missing header → 401", () => {
  assert.equal(authorizeSession("nope", "s3cret", true), 401);
  assert.equal(authorizeSession(null, "s3cret", true), 401);
  assert.equal(authorizeSession("", "s3cret", false), 401);
});

test("authorize: missing secret fails closed in production (503), passes in dev", () => {
  assert.equal(authorizeSession("anything", undefined, true), 503);
  assert.equal(authorizeSession(null, undefined, true), 503);
  assert.equal(authorizeSession(null, undefined, false), "ok");
});

// ── parseSessionEndedBody ────────────────────────────────────────────────────

test("parse: accepts a valid payload and sanitizes the transcript", () => {
  const body = parseSessionEndedBody({
    attemptId: "att_1",
    outcome: "completed",
    transcript: [{ role: "user", text: "hi" }, null, { role: "bot", text: "" }],
  });
  assert.ok(body);
  assert.equal(body.attemptId, "att_1");
  assert.equal(body.outcome, "completed");
  assert.deepEqual(body.transcript, [{ role: "user", text: "hi" }]);
});

test("parse: rejects missing attemptId, bad outcome, and non-object", () => {
  assert.equal(parseSessionEndedBody({ outcome: "completed", transcript: [] }), null);
  assert.equal(parseSessionEndedBody({ attemptId: "", outcome: "completed" }), null);
  assert.equal(parseSessionEndedBody({ attemptId: "att_1", outcome: "done" }), null);
  assert.equal(parseSessionEndedBody("nope"), null);
  assert.equal(parseSessionEndedBody(null), null);
});

// ── processSessionEnded ──────────────────────────────────────────────────────

interface Spy {
  deps: SessionEndedDeps;
  abandoned: string[];
  graded: { attemptId: string; idempotencyKey: string }[];
}

function makeDeps(attempt: { id: string; status: string } | null): Spy {
  const abandoned: string[] = [];
  const graded: { attemptId: string; idempotencyKey: string }[] = [];
  return {
    abandoned,
    graded,
    deps: {
      findAttempt: async () => attempt,
      markAbandoned: async (id) => {
        abandoned.push(id);
      },
      triggerGrade: async ({ attemptId, idempotencyKey }) => {
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
  assert.equal(spy.graded.length, 0);
});

test("process: non-in_progress attempt → noop (idempotent)", async () => {
  const spy = makeDeps({ id: "att_1", status: "ready" });
  const result = await processSessionEnded({ attemptId: "att_1", outcome: "completed", transcript: [] }, spy.deps);
  assert.equal(result, "noop");
  assert.equal(spy.graded.length, 0);
});

test("process: abandoned outcome → marks abandoned, never grades", async () => {
  const spy = makeDeps({ id: "att_1", status: "in_progress" });
  const result = await processSessionEnded({ attemptId: "att_1", outcome: "abandoned", transcript: [] }, spy.deps);
  assert.equal(result, "abandoned");
  assert.deepEqual(spy.abandoned, ["att_1"]);
  assert.equal(spy.graded.length, 0);
});

test("process: completed outcome → triggers grade once with the per-attempt key", async () => {
  const spy = makeDeps({ id: "att_1", status: "in_progress" });
  const result = await processSessionEnded(
    { attemptId: "att_1", outcome: "completed", transcript: [{ role: "user", text: "hi" }] },
    spy.deps,
  );
  assert.equal(result, "graded");
  assert.equal(spy.graded.length, 1);
  assert.deepEqual(spy.graded[0], { attemptId: "att_1", idempotencyKey: "grade-att_1" });
  assert.equal(spy.abandoned.length, 0);
});
