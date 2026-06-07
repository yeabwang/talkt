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
  // Turn-taking patience. Keeps the interviewer from cutting in when the
  // candidate pauses to think or uses filler words (replaces the old LiveKit
  // endpointing config). English uses LiveKit smart (model-based) endpointing;
  // other languages (where smart endpointing isn't supported) fall back to
  // generous transcription-silence timeouts.
  startSpeakingPlan:
    | { waitSeconds: number; smartEndpointingPlan: { provider: "livekit" } }
    | {
        waitSeconds: number;
        transcriptionEndpointingPlan: { onPunctuationSeconds: number; onNoPunctuationSeconds: number; onNumberSeconds: number };
      };
  server: { url: string; secret: string };
  serverMessages: ["end-of-call-report"];
  metadata: { attemptId: string };
}

// How long the interviewer waits after the candidate seems to stop. Higher =
// more patient. Tuned for "thinking out loud" interview cadence.
const START_WAIT_SECONDS = 0.8;
const PATIENT_NO_PUNCTUATION_SECONDS = 2.2; // wait this long on a trailing pause

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
  const isEnglish = job.languageCode.trim().toLowerCase().startsWith("en");
  const startSpeakingPlan: AssistantPayload["startSpeakingPlan"] = isEnglish
    ? { waitSeconds: START_WAIT_SECONDS, smartEndpointingPlan: { provider: "livekit" } }
    : {
        waitSeconds: START_WAIT_SECONDS,
        transcriptionEndpointingPlan: {
          onPunctuationSeconds: 0.4,
          onNoPunctuationSeconds: PATIENT_NO_PUNCTUATION_SECONDS,
          onNumberSeconds: 0.6,
        },
      };
  return {
    // Vapi caps assistant name at 40 chars; `talkt-<cuid>` stays well under.
    name: `talkt-${job.attemptId}`.slice(0, 40),
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
    startSpeakingPlan,
    server: { url: `${env.appUrl.replace(/\/$/, "")}/api/vapi/webhook`, secret: env.webhookSecret },
    serverMessages: ["end-of-call-report"],
    metadata: { attemptId: job.attemptId },
  };
}
