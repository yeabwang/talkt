import { strict as assert } from "node:assert";
import { test } from "node:test";

import { classifyOutcome, mapCallRecord, mapReport, verifyVapiRequest, verifyVapiSecret } from "@/lib/vapi/webhook";

test("verifyVapiSecret: match / mismatch / missing / prod-no-secret", () => {
  assert.equal(verifyVapiSecret("s", "s", true), "ok");
  assert.equal(verifyVapiSecret("x", "s", true), 401);
  assert.equal(verifyVapiSecret(null, "s", true), 401);
  assert.equal(verifyVapiSecret(null, undefined, true), 503);
  assert.equal(verifyVapiSecret(null, undefined, false), "ok");
});

test("verifyVapiRequest accepts either X-Vapi-Secret or bearer auth", () => {
  assert.equal(verifyVapiRequest({ xVapiSecret: "s", authorization: null }, "s", true), "ok");
  assert.equal(verifyVapiRequest({ xVapiSecret: null, authorization: "Bearer s" }, "s", true), "ok");
  assert.equal(verifyVapiRequest({ xVapiSecret: null, authorization: "Bearer wrong" }, "s", true), 401);
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

test("mapReport reads current artifact messages and top-level endedReason", () => {
  const r = mapReport({
    type: "end-of-call-report",
    endedReason: "assistant-ended-call",
    metadata: { attemptId: "a2" },
    call: { assistantId: "as_2" },
    artifact: {
      messages: [
        { role: "assistant", message: "Q1?" },
        { role: "user", message: "Answer." },
      ],
    },
  });
  assert.equal(r.attemptId, "a2");
  assert.equal(r.assistantId, "as_2");
  assert.deepEqual(r.transcript, [
    { role: "assistant", text: "Q1?" },
    { role: "user", text: "Answer." },
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

test("classifyOutcome: customer hangup after the assistant closes -> completed", () => {
  const t = [
    { role: "assistant" as const, text: "Final question?" },
    { role: "user" as const, text: "Final answer." },
    { role: "assistant" as const, text: "That's everything from me. Your feedback is being prepared now. Take care." },
  ];
  assert.equal(classifyOutcome(t, "customer-ended-call"), "completed");
});

test("classifyOutcome: report handoff phrase marks a post-close hangup completed", () => {
  const t = [
    { role: "assistant" as const, text: "Final question?" },
    { role: "user" as const, text: "Final answer." },
    { role: "assistant" as const, text: "That's the interview complete. Your report is being prepared now, and you'll see it in a moment. Take care." },
  ];
  assert.equal(classifyOutcome(t, "customer-ended-call"), "completed");
});

test("mapReport falls back to call.assistantId when assistant.id absent", () => {
  const r = mapReport({ call: { assistantId: "as_9" }, messages: [] });
  assert.equal(r.assistantId, "as_9");
  assert.equal(r.attemptId, null);
  assert.equal(r.outcome, "abandoned");
});

test("mapCallRecord maps an ended Vapi call into a report", () => {
  const r = mapCallRecord(
    {
      id: "call_1",
      assistantId: "as_1",
      status: "ended",
      endedReason: "assistant-ended-call",
      messages: [
        { role: "bot", message: "Q1?" },
        { role: "user", message: "Answer." },
      ],
    },
    "att_1",
  );
  assert.ok(r);
  assert.equal(r.attemptId, "att_1");
  assert.equal(r.assistantId, "as_1");
  assert.equal(r.outcome, "completed");
  assert.deepEqual(r.transcript, [
    { role: "assistant", text: "Q1?" },
    { role: "user", text: "Answer." },
  ]);
});

test("mapCallRecord can parse transcript text when structured messages are absent", () => {
  const r = mapCallRecord(
    {
      assistantId: "as_1",
      status: "ended",
      endedReason: "assistant-ended-call",
      transcript: "AI: Q1?\nUser: Answer.",
    },
    "att_1",
  );
  assert.ok(r);
  assert.equal(r.outcome, "completed");
  assert.deepEqual(r.transcript, [
    { role: "assistant", text: "Q1?" },
    { role: "user", text: "Answer." },
  ]);
});

test("mapCallRecord ignores active Vapi calls", () => {
  assert.equal(mapCallRecord({ status: "in-progress" }, "att_1"), null);
});
