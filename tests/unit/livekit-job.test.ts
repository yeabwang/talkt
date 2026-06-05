import assert from "node:assert/strict";
import test from "node:test";

import type { Interview } from "@/components/talkt/data";
import { buildInterviewJob, type BuildInterviewJobArgs } from "@/lib/livekit/job";

function fakeInterview(overrides: Partial<Interview> = {}): Interview {
  return {
    id: "iv1",
    title: "Frontend engineer",
    subtitle: "",
    icon: "",
    category: "eng",
    difficulty: "mid",
    count: 0,
    minutes: 15,
    author: "",
    source: "",
    takes: 0,
    voice: "adi",
    blurb: "",
    questions: ["Tell me about a hard bug.", "How do you test?", "Walk me through a tradeoff."],
    ...overrides,
  };
}

function args(overrides: Partial<BuildInterviewJobArgs> = {}): BuildInterviewJobArgs {
  return {
    interview: fakeInterview(),
    persona: { key: "adi", name: "Adi" },
    languageCode: "en",
    languageLabel: "English",
    attemptId: "att_1",
    interviewerName: "Adi",
    candidateFirstName: "Sam",
    ...overrides,
  };
}

test("buildInterviewJob carries all questions in order", () => {
  const job = buildInterviewJob(args());
  assert.deepEqual(job.questions, [
    "Tell me about a hard bug.",
    "How do you test?",
    "Walk me through a tradeoff.",
  ]);
});

test("buildInterviewJob carries persona, name, and language", () => {
  const job = buildInterviewJob(args());
  assert.equal(job.attemptId, "att_1");
  assert.equal(job.interviewTitle, "Frontend engineer");
  assert.equal(job.persona, "adi");
  assert.equal(job.interviewerName, "Adi");
  assert.equal(job.languageCode, "en");
  assert.equal(job.languageLabel, "English");
  assert.equal(job.candidateFirstName, "Sam");
});

test("buildInterviewJob omits candidateFirstName when absent", () => {
  const job = buildInterviewJob(args({ candidateFirstName: undefined }));
  assert.equal("candidateFirstName" in job, false);
});

test("buildInterviewJob computes maxDurationSeconds = (minutes+2)*60", () => {
  assert.equal(buildInterviewJob(args({ interview: fakeInterview({ minutes: 15 }) })).maxDurationSeconds, 1020);
  assert.equal(buildInterviewJob(args({ interview: fakeInterview({ minutes: 30 }) })).maxDurationSeconds, 1920);
});

test("buildInterviewJob clamps maxDurationSeconds to [120, 3600]", () => {
  // Upper clamp: 100 min -> 6120 -> 3600.
  assert.equal(buildInterviewJob(args({ interview: fakeInterview({ minutes: 100 }) })).maxDurationSeconds, 3600);
  // Lower clamp: negative minutes -> below 120 -> 120.
  assert.equal(buildInterviewJob(args({ interview: fakeInterview({ minutes: -10 }) })).maxDurationSeconds, 120);
});
