import { strict as assert } from "node:assert";
import { test } from "node:test";

import type { InterviewJob } from "@/lib/vapi/job";
import { DELIVERY_CUES, firstMessage, systemPrompt } from "@/lib/vapi/prompt";

const job: InterviewJob = {
  attemptId: "a1",
  interviewTitle: "Systems Design",
  interviewerName: "Adi",
  persona: "adi",
  languageCode: "en",
  languageLabel: "English",
  questions: ["Tell me about a system you scaled.", "How do you handle caching?"],
  candidateFirstName: "Sam",
  maxDurationSeconds: 1020,
};

test("systemPrompt embeds title, language, persona cue, and numbered questions", () => {
  const p = systemPrompt(job);
  assert.match(p, /You are Adi, the interviewer for "Systems Design"/);
  assert.match(p, /Speak entirely in English/);
  assert.ok(p.includes(DELIVERY_CUES.adi));
  assert.match(p, /1\. Tell me about a system you scaled\./);
  assert.match(p, /2\. How do you handle caching\?/);
});

test("systemPrompt no longer mentions the end_interview tool", () => {
  assert.doesNotMatch(systemPrompt(job), /end_interview/);
});

test("firstMessage greets by name and asks question one", () => {
  assert.equal(
    firstMessage(job),
    "Hi, Sam, thanks for joining — I'm Adi, and I'll be interviewing you about Systems Design today. Let's jump straight in. Tell me about a system you scaled.",
  );
});
