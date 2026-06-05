import { describe, expect, it } from "vitest";

import type { InterviewJob } from "../src/job.js";
import { DELIVERY_CUES, firstMessage, systemPrompt } from "../src/prompt.js";

const base: InterviewJob = {
  attemptId: "att_1",
  interviewTitle: "Product manager",
  interviewerName: "Mira",
  persona: "mira",
  languageCode: "en",
  languageLabel: "English",
  questions: ["Q one alpha", "Q two beta", "Q three gamma"],
  maxDurationSeconds: 600,
};

describe("systemPrompt", () => {
  it("includes every question, numbered and in order", () => {
    const p = systemPrompt(base);
    expect(p).toContain("1. Q one alpha");
    expect(p).toContain("2. Q two beta");
    expect(p).toContain("3. Q three gamma");
    const i1 = p.indexOf("Q one alpha");
    const i2 = p.indexOf("Q two beta");
    const i3 = p.indexOf("Q three gamma");
    expect(i2).toBeGreaterThan(i1);
    expect(i3).toBeGreaterThan(i2);
  });

  it("includes the persona delivery cue", () => {
    expect(systemPrompt(base)).toContain(DELIVERY_CUES.mira);
  });

  it("names the interviewer, speaks the language, and keeps the never-reveal rule", () => {
    const p = systemPrompt(base);
    expect(p).toContain("You are Mira");
    expect(p).toContain("Speak entirely in English");
    expect(p).toMatch(/NEVER reveal/);
    expect(p).toContain("end_interview");
  });

  it("does not expose private wrap cues", () => {
    expect(systemPrompt(base)).not.toContain("[director]");
  });
});

describe("firstMessage", () => {
  it("greets by first name when present", () => {
    expect(firstMessage({ ...base, candidateFirstName: "Sam" })).toContain("Hi, Sam,");
  });

  it("omits the name when absent", () => {
    const m = firstMessage(base);
    expect(m.startsWith("Hi, thanks")).toBe(true);
    expect(m).toContain("Product manager");
  });
});
