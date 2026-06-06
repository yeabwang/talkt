import { strict as assert } from "node:assert";
import { test } from "node:test";

import { classifyOutcome, mapReport, verifyVapiSecret } from "@/lib/vapi/webhook";

test("verifyVapiSecret: match / mismatch / missing / prod-no-secret", () => {
  assert.equal(verifyVapiSecret("s", "s", true), "ok");
  assert.equal(verifyVapiSecret("x", "s", true), 401);
  assert.equal(verifyVapiSecret(null, "s", true), 401);
  assert.equal(verifyVapiSecret(null, undefined, true), 503);
  assert.equal(verifyVapiSecret(null, undefined, false), "ok");
});

test("mapReport extracts attemptId from assistant metadata + builds turns", () => {
  const r = mapReport({
    type: "end-of-call-report",
    assistant: { id: "as_1", metadata: { attemptId: "a1" } },
    call: { id: "c1", endedReason: "assistant-ended-call" },
    messages: [
      { role: "system", content: "ignore me" },
      { role: "bot", content: "Hi, question one?" },
      { role: "user", content: "Here is my answer." },
    ],
  });
  assert.equal(r.attemptId, "a1");
  assert.equal(r.assistantId, "as_1");
  assert.deepEqual(r.transcript, [
    { role: "assistant", text: "Hi, question one?" },
    { role: "user", text: "Here is my answer." },
  ]);
  assert.equal(r.outcome, "completed");
});

test("classifyOutcome: no user turns -> abandoned", () => {
  assert.equal(classifyOutcome([{ role: "assistant", text: "hi" }], "assistant-ended-call"), "abandoned");
});

test("classifyOutcome: early customer hangup -> abandoned even with answers", () => {
  const t = [
    { role: "assistant" as const, text: "Q1?" },
    { role: "user" as const, text: "partial answer" },
  ];
  assert.equal(classifyOutcome(t, "customer-ended-call"), "abandoned");
});

test("classifyOutcome: natural/time/silence end with answers -> completed", () => {
  const t = [
    { role: "assistant" as const, text: "Q1?" },
    { role: "user" as const, text: "answer" },
  ];
  assert.equal(classifyOutcome(t, "assistant-ended-call"), "completed");
  assert.equal(classifyOutcome(t, "exceeded-max-duration"), "completed");
  assert.equal(classifyOutcome(t, "silence-timed-out"), "completed");
});

test("mapReport falls back to call.assistantId when assistant.id absent", () => {
  const r = mapReport({ call: { assistantId: "as_9" }, messages: [] });
  assert.equal(r.assistantId, "as_9");
  assert.equal(r.attemptId, null);
  assert.equal(r.outcome, "abandoned");
});
