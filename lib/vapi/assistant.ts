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
const NOVA_3_LANGUAGE_BY_CODE: Record<string, string> = {
  en: "en",
  "en-us": "en-US",
  "en-au": "en-AU",
  "en-gb": "en-GB",
  "en-in": "en-IN",
  "en-nz": "en-NZ",
  de: "de",
  "de-ch": "de-CH",
  nl: "nl",
  "nl-be": "nl-BE",
  sv: "sv",
  "sv-se": "sv-SE",
  da: "da",
  "da-dk": "da-DK",
  es: "es",
  "es-419": "es-419",
  fr: "fr",
  "fr-ca": "fr-CA",
  pt: "pt",
  "pt-br": "pt-BR",
  "pt-pt": "pt-PT",
  it: "it",
  tr: "tr",
  no: "no",
  id: "id",
  be: "be",
  bg: "bg",
  bn: "bn",
  bs: "bs",
  ca: "ca",
  cs: "cs",
  et: "et",
  fi: "fi",
  el: "el",
  fa: "fa",
  he: "he",
  hi: "hi",
  hr: "hr",
  hu: "hu",
  ja: "ja",
  kn: "kn",
  ko: "ko",
  "ko-kr": "ko-KR",
  lv: "lv",
  lt: "lt",
  mk: "mk",
  mr: "mr",
  ms: "ms",
  pl: "pl",
  ro: "ro",
  ru: "ru",
  sk: "sk",
  sl: "sl",
  sr: "sr",
  ta: "ta",
  te: "te",
  tl: "tl",
  uk: "uk",
  ur: "ur",
  vi: "vi",
  multi: "multi",
};

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

function vapiTranscriberLanguage(languageCode: string, transcriberModel: string): string {
  const requested = languageCode.trim().replace(/_/g, "-") || "en";
  if (transcriberModel.trim().toLowerCase() !== "nova-3") return requested;

  const nova3Language = NOVA_3_LANGUAGE_BY_CODE[requested.toLowerCase()];
  return nova3Language ?? "multi";
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
    transcriber: {
      provider: env.transcriberProvider,
      model: env.transcriberModel,
      language: vapiTranscriberLanguage(job.languageCode, env.transcriberModel),
    },
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
