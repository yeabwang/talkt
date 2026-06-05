import { describe, expect, it } from "vitest";

import { endReasonSchema, parseJob } from "../src/job";

const valid = {
  attemptId: "att_123",
  interviewTitle: "Frontend engineer",
  interviewerName: "Adi",
  persona: "adi",
  languageCode: "en",
  languageLabel: "English",
  questions: ["Tell me about a recent project.", "How do you manage component state?"],
  candidateFirstName: "Sam",
  maxDurationSeconds: 900,
};

describe("parseJob", () => {
  it("accepts a valid metadata string", () => {
    const job = parseJob(JSON.stringify(valid));
    expect(job.attemptId).toBe("att_123");
    expect(job.questions).toEqual(valid.questions);
    expect(job.candidateFirstName).toBe("Sam");
  });

  it("treats candidateFirstName as optional", () => {
    const { candidateFirstName, ...rest } = valid;
    const job = parseJob(JSON.stringify(rest));
    expect(job.candidateFirstName).toBeUndefined();
  });

  it("rejects missing attemptId", () => {
    const { attemptId, ...rest } = valid;
    expect(() => parseJob(JSON.stringify(rest))).toThrow(/Invalid job metadata/);
  });

  it("rejects empty questions", () => {
    expect(() => parseJob(JSON.stringify({ ...valid, questions: [] }))).toThrow(/Invalid job metadata/);
  });

  it("rejects a non-positive maxDurationSeconds", () => {
    expect(() => parseJob(JSON.stringify({ ...valid, maxDurationSeconds: 0 }))).toThrow();
  });

  it("rejects non-JSON", () => {
    expect(() => parseJob("not json {")).toThrow(/not valid JSON/);
  });
});

describe("endReasonSchema", () => {
  it("accepts completed and time", () => {
    expect(endReasonSchema.parse("completed")).toBe("completed");
    expect(endReasonSchema.parse("time")).toBe("time");
  });

  it("rejects a bad reason enum", () => {
    expect(() => endReasonSchema.parse("bailed")).toThrow();
  });
});
