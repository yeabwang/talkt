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
});

test("wires the webhook URL (no double slash) + secret + serverMessages", () => {
  const a = buildVapiAssistant(job(), env);
  assert.equal(a.server.url, "https://talkt.app/api/vapi/webhook");
  assert.equal(a.server.secret, "whsec");
  assert.deepEqual(a.serverMessages, ["end-of-call-report"]);
});

test("carries the cap, the end-call tool, and attempt metadata", () => {
  const a = buildVapiAssistant(job({ maxDurationSeconds: 600 }), env);
  assert.equal(a.maxDurationSeconds, 600);
  assert.deepEqual(a.model.tools, [{ type: "endCall" }]);
  assert.deepEqual(a.metadata, { attemptId: "a1" });
});

test("resolves the persona + language voice", () => {
  const en = buildVapiAssistant(job({ persona: "adi", languageCode: "en" }), env);
  assert.deepEqual(en.voice, { provider: "cartesia", voiceId: "5c5ad5e7-1020-476b-8b91-fdcbe9cc313c" });
  const es = buildVapiAssistant(job({ persona: "kai", languageCode: "es" }), env);
  assert.deepEqual(es.voice, { provider: "11labs", voiceId: "cjVigY5qzO86Huf0OWal" });
  assert.equal(en.transcriber.language, "en");
});

test("model + transcriber are overridable via env", () => {
  const a = buildVapiAssistant(job(), { ...env, modelProvider: "openai", model: "gpt-4.1-mini", transcriberModel: "nova-2" });
  assert.equal(a.model.provider, "openai");
  assert.equal(a.model.model, "gpt-4.1-mini");
  assert.equal(a.transcriber.model, "nova-2");
});
