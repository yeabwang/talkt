import type { voice } from "@livekit/agents";

import type { TtsVoiceChoice } from "./model-config.js";

export const INTERVIEW_AUDIO_FORMAT = {
  sampleRate: 16000,
  numChannels: 1,
} as const;

// Issue 3 backstop. LiveKit flips the candidate's state to "away" after a short
// silence (userAwayTimeout). This is how long we then wait — once before a spoken
// check-in, once more before closing — so a candidate who finished, or drifted off
// without hanging up, still gets graded instead of hanging until the hard cap.
// Kept comfortably long so a candidate who is merely thinking is never cut off.
// Env-tunable (LIVEKIT_AGENT_AWAY_GRACE_MS).
export function resolveAwayGraceMs(env: Record<string, string | undefined> = process.env): number {
  const raw = Number(env.LIVEKIT_AGENT_AWAY_GRACE_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 20_000;
}

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
