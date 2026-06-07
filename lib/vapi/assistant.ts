// Builds the Vapi assistant payload from an InterviewJob and environment config.
import type { InterviewJob } from "@/lib/vapi/job";
import { firstMessage, systemPrompt } from "@/lib/vapi/prompt";
import { resolveVapiVoice } from "@/lib/vapi/voices";

// SDK compatibility note: end calls are model tools, while maxDurationSeconds is
// the hard cap enforced by Vapi.
export interface AssistantPayload {
  name: string;
  firstMessage: string;
  firstMessageMode: "assistant-speaks-first";
  firstMessageInterruptionsEnabled: false;
  maxDurationSeconds: number;
  clientMessages: ["transcript", "speech-update", "status-update", "assistant.speechStarted"];
  model: {
    provider: string;
    model: string;
    temperature: number;
    messages: { role: "system"; content: string }[];
    tools: { type: "endCall" }[];
  };
  modelOutputInMessagesEnabled: true;
  voice: { provider: string; voiceId: string };
  transcriber: { provider: string; model: string; language: string };
  // Turn-taking patience prevents interruptions during thoughtful pauses.
  startSpeakingPlan:
    | { waitSeconds: number; smartEndpointingPlan: { provider: "livekit" } }
    | {
        waitSeconds: number;
        transcriptionEndpointingPlan: { onPunctuationSeconds: number; onNoPunctuationSeconds: number; onNumberSeconds: number };
      };
  stopSpeakingPlan: {
    numWords: number;
    voiceSeconds: number;
    backoffSeconds: number;
    acknowledgementPhrases: string[];
    interruptionPhrases: string[];
  };
  server: {
    url: string;
    timeoutSeconds: number;
    credentialId?: string;
    headers?: { "X-Vapi-Secret": string };
  };
  serverMessages: ["end-of-call-report"];
  endCallPhrases: string[];
  metadata: { attemptId: string };
}

// Tuned for interview answers where candidates pause while thinking aloud.
const START_WAIT_SECONDS = 0.8;
const PATIENT_NO_PUNCTUATION_SECONDS = 2.2;
const WEBHOOK_TIMEOUT_SECONDS = 20;

export interface BuildAssistantEnv {
  appUrl: string;
  webhookSecret: string;
  webhookCredentialId?: string;
  modelProvider: string;
  model: string;
  transcriberProvider: string;
  transcriberModel: string;
  voiceEnv?: Record<string, string | undefined>;
}

export function buildVapiAssistant(job: InterviewJob, env: BuildAssistantEnv): AssistantPayload {
  const voice = resolveVapiVoice(job.persona, job.languageCode, env.voiceEnv);
  const isEnglish = job.languageCode.trim().toLowerCase().startsWith("en");
  const server = env.webhookCredentialId
    ? {
        url: `${env.appUrl.replace(/\/$/, "")}/api/vapi/webhook`,
        timeoutSeconds: WEBHOOK_TIMEOUT_SECONDS,
        credentialId: env.webhookCredentialId,
      }
    : {
        url: `${env.appUrl.replace(/\/$/, "")}/api/vapi/webhook`,
        timeoutSeconds: WEBHOOK_TIMEOUT_SECONDS,
        headers: { "X-Vapi-Secret": env.webhookSecret },
      };
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
    // Vapi caps assistant names at 40 characters.
    name: `talkt-${job.attemptId}`.slice(0, 40),
    firstMessage: firstMessage(job),
    firstMessageMode: "assistant-speaks-first",
    firstMessageInterruptionsEnabled: false,
    maxDurationSeconds: job.maxDurationSeconds,
    clientMessages: ["transcript", "speech-update", "status-update", "assistant.speechStarted"],
    model: {
      provider: env.modelProvider,
      model: env.model,
      temperature: 0.4,
      messages: [{ role: "system", content: systemPrompt(job) }],
      tools: [{ type: "endCall" }],
    },
    modelOutputInMessagesEnabled: true,
    voice,
    transcriber: { provider: env.transcriberProvider, model: env.transcriberModel, language: job.languageCode },
    startSpeakingPlan,
    stopSpeakingPlan: {
      numWords: 1,
      voiceSeconds: 0.25,
      backoffSeconds: 1,
      acknowledgementPhrases: ["okay", "yeah", "right", "mm-hmm", "uh-huh", "got it", "thanks"],
      interruptionPhrases: ["stop", "pause", "wait", "actually", "no", "hold on"],
    },
    server,
    serverMessages: ["end-of-call-report"],
    endCallPhrases: ["you'll see it in a moment. Take care."],
    metadata: { attemptId: job.attemptId },
  };
}
