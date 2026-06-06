// Pure builder: InterviewJob -> Vapi assistant create payload. No SDK/network
// import so it is unit-testable. The model + transcriber are Vapi-native (billed
// by Vapi, no provider key); the webhook URL + secret and the model/transcriber
// selection come from env; everything else is derived from the job.
import type { InterviewJob } from "@/lib/vapi/job";
import { firstMessage, systemPrompt } from "@/lib/vapi/prompt";
import { resolveVapiVoice } from "@/lib/vapi/voices";

// NOTE (verified against installed @vapi-ai/server-sdk@1.2.0):
// - CreateAssistantDto has NO `endCallFunctionEnabled` and NO `silenceTimeoutSeconds`.
// - The model ends the call via an end-call TOOL: model.tools = [{ type: "endCall" }]
//   (GoogleModel.tools accepts it). The hard cap stays maxDurationSeconds; Vapi's
//   default silence handling replaces the old away-backstop.
export interface AssistantPayload {
  name: string;
  firstMessage: string;
  firstMessageMode: "assistant-speaks-first";
  maxDurationSeconds: number;
  model: {
    provider: string; // e.g. "google" | "openai"
    model: string; // e.g. "gemini-2.5-flash"
    temperature: number;
    messages: { role: "system"; content: string }[];
    tools: { type: "endCall" }[];
  };
  voice: { provider: string; voiceId: string };
  transcriber: { provider: string; model: string; language: string };
  server: { url: string; secret: string };
  serverMessages: ["end-of-call-report"];
  metadata: { attemptId: string };
}

export interface BuildAssistantEnv {
  appUrl: string; // NEXT_PUBLIC_APP_URL
  webhookSecret: string; // VAPI_WEBHOOK_SECRET
  modelProvider: string; // VAPI_MODEL_PROVIDER (default "google")
  model: string; // VAPI_MODEL (default "gemini-2.5-flash")
  transcriberProvider: string; // VAPI_TRANSCRIBER_PROVIDER (default "deepgram")
  transcriberModel: string; // VAPI_TRANSCRIBER_MODEL (default "nova-3")
  voiceEnv?: Record<string, string | undefined>; // for resolveVapiVoice (defaults to process.env)
}

export function buildVapiAssistant(job: InterviewJob, env: BuildAssistantEnv): AssistantPayload {
  const voice = resolveVapiVoice(job.persona, job.languageCode, env.voiceEnv);
  return {
    name: `talkt-interview-${job.attemptId}`,
    firstMessage: firstMessage(job),
    firstMessageMode: "assistant-speaks-first",
    maxDurationSeconds: job.maxDurationSeconds,
    model: {
      provider: env.modelProvider,
      model: env.model,
      temperature: 0.4,
      messages: [{ role: "system", content: systemPrompt(job) }],
      tools: [{ type: "endCall" }],
    },
    voice,
    transcriber: { provider: env.transcriberProvider, model: env.transcriberModel, language: job.languageCode },
    server: { url: `${env.appUrl.replace(/\/$/, "")}/api/vapi/webhook`, secret: env.webhookSecret },
    serverMessages: ["end-of-call-report"],
    metadata: { attemptId: job.attemptId },
  };
}
