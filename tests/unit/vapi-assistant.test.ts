import { strict as assert } from "node:assert";
import { test } from "node:test";

import { buildVapiAssistant, type BuildAssistantEnv } from "@/lib/vapi/assistant";
import type { InterviewJob } from "@/lib/vapi/job";

const env: BuildAssistantEnv = {
  appUrl: "https://talkt.app/",
  webhookSecret: "whsec",
  modelProvider: "google",
  model: "gemini-2.5-flash",
  transcriberProvider: "deepgram",
  transcriberModel: "nova-3",
};

function job(overrides: Partial<InterviewJob> = {}): InterviewJob {
  return {
    attemptId: "a1",
    interviewTitle: "Systems Design",
    interviewerName: "Adi",
    persona: "adi",
    languageCode: "en",
    languageLabel: "English",
    questions: ["Q1?", "Q2?"],
    maxDurationSeconds: 1020,
    ...overrides,
  };
}

test("builds a Vapi-native model assistant with system prompt + first message", () => {
  const a = buildVapiAssistant(job(), env);
  assert.equal(a.model.provider, "google");
  assert.equal(a.model.model, "gemini-2.5-flash");
  assert.equal(a.transcriber.provider, "deepgram");
  assert.equal(a.transcriber.model, "nova-3");
  assert.match(a.model.messages[0].content, /You are Adi/);
  assert.match(a.firstMessage, /Let's jump straight in\. Q1\?/);
  assert.equal(a.firstMessageMode, "assistant-speaks-first");
  assert.equal(a.firstMessageInterruptionsEnabled, false);
  assert.equal(a.modelOutputInMessagesEnabled, true);
  assert.deepEqual(a.clientMessages, ["transcript", "speech-update", "status-update", "assistant.speechStarted"]);
});

test("wires the webhook URL (no double slash) + secret + serverMessages", () => {
  const a = buildVapiAssistant(job(), env);
  assert.equal(a.server.url, "https://talkt.app/api/vapi/webhook");
  assert.deepEqual(a.server.headers, { "X-Vapi-Secret": "whsec" });
  assert.equal(a.server.timeoutSeconds, 20);
  assert.deepEqual(a.serverMessages, ["end-of-call-report"]);
});

test("uses a Vapi credential id for webhook auth when configured", () => {
  const a = buildVapiAssistant(job(), { ...env, webhookCredentialId: "cred_123" });
  assert.equal(a.server.credentialId, "cred_123");
  assert.equal(a.server.headers, undefined);
});

test("assistant name stays within Vapi's 40-char limit even for a full cuid", () => {
  // Prisma cuid() is 25 chars; `talkt-interview-<cuid>` (41) used to 400.
  const a = buildVapiAssistant(job({ attemptId: "clz1234567890abcdefghijkl" }), env);
  assert.ok(a.name.length <= 40, `name too long: ${a.name.length}`);
});

test("carries the cap, the end-call tool, and attempt metadata", () => {
  const a = buildVapiAssistant(job({ maxDurationSeconds: 600 }), env);
  assert.equal(a.maxDurationSeconds, 600);
  assert.deepEqual(a.model.tools, [{ type: "endCall" }]);
  assert.deepEqual(a.endCallPhrases, ["you'll see it in a moment. Take care."]);
  assert.deepEqual(a.metadata, { attemptId: "a1" });
});

test("resolves the persona + language voice and speaks the interview language", () => {
  // Cartesia base voice now carries the multilingual model + language param.
  const en = buildVapiAssistant(job({ persona: "adi", languageCode: "en" }), env);
  assert.deepEqual(en.voice, { provider: "cartesia", voiceId: "5c5ad5e7-1020-476b-8b91-fdcbe9cc313c", model: "sonic-3", language: "en" });
  // A native per-language override (Spanish for Kai) passes through unchanged.
  const es = buildVapiAssistant(job({ persona: "kai", languageCode: "es" }), env);
  assert.deepEqual(es.voice, { provider: "11labs", voiceId: "cjVigY5qzO86Huf0OWal" });
  // Other languages: the Cartesia voice is told to speak them (the fixed bug).
  const fr = buildVapiAssistant(job({ persona: "adi", languageCode: "fr" }), env);
  assert.equal(fr.voice.language, "fr");
  assert.equal(fr.voice.model, "sonic-3");
  assert.equal(en.transcriber.language, "en");
});

test("English uses LiveKit smart endpointing; other languages use patient transcription timeouts", () => {
  const en = buildVapiAssistant(job({ languageCode: "en" }), env);
  assert.deepEqual(en.startSpeakingPlan, { waitSeconds: 0.8, smartEndpointingPlan: { provider: "livekit" } });
  assert.equal(en.stopSpeakingPlan.numWords, 1);
  assert.ok(en.stopSpeakingPlan.acknowledgementPhrases.includes("okay"));

  const plan = buildVapiAssistant(job({ languageCode: "es" }), env).startSpeakingPlan;
  assert.ok("transcriptionEndpointingPlan" in plan, "non-English should use transcription endpointing");
  if ("transcriptionEndpointingPlan" in plan) {
    assert.equal(plan.waitSeconds, 0.8);
    assert.ok(plan.transcriptionEndpointingPlan.onNoPunctuationSeconds >= 2);
  }
});

test("model + transcriber are overridable via env", () => {
  const a = buildVapiAssistant(job(), { ...env, modelProvider: "openai", model: "gpt-4.1-mini", transcriberModel: "nova-2" });
  assert.equal(a.model.provider, "openai");
  assert.equal(a.model.model, "gpt-4.1-mini");
  assert.equal(a.transcriber.model, "nova-2");
});
