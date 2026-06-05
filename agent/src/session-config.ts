import type { voice } from "@livekit/agents";

import type { TtsVoiceChoice } from "./model-config.js";

export const INTERVIEW_AUDIO_FORMAT = {
  sampleRate: 16000,
  numChannels: 1,
} as const;

export function createInterviewTtsOptions(tts: TtsVoiceChoice) {
  return {
    model: tts.model,
    voice: tts.voice,
    language: tts.language,
    sampleRate: INTERVIEW_AUDIO_FORMAT.sampleRate,
  };
}

export function createInterviewRoomOutputOptions(): Partial<voice.RoomOutputOptions> {
  return {
    audioSampleRate: INTERVIEW_AUDIO_FORMAT.sampleRate,
    audioNumChannels: INTERVIEW_AUDIO_FORMAT.numChannels,
  };
}

type TurnHandling = NonNullable<voice.AgentSessionOptions["turnHandling"]>;
type TurnDetection = NonNullable<TurnHandling["turnDetection"]>;

export function createInterviewTurnHandling(turnDetection: TurnDetection): TurnHandling {
  return {
    turnDetection,
    endpointing: {
      mode: "fixed",
      minDelay: 900,
      maxDelay: 4000,
    },
    interruption: {
      enabled: true,
      minDuration: 650,
      minWords: 1,
    },
    preemptiveGeneration: { enabled: false },
  };
}
