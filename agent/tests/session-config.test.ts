import { describe, expect, it } from "vitest";

import {
  createInterviewRoomOutputOptions,
  createInterviewTtsOptions,
  createInterviewTurnHandling,
  INTERVIEW_AUDIO_FORMAT,
  resolveAwayGraceMs,
} from "../src/session-config.js";

describe("interview session config", () => {
  it("pins TTS and room output to the same mono PCM format", () => {
    const ttsOptions = createInterviewTtsOptions({
      model: "cartesia/sonic-3",
      voice: "voice-id",
      language: "en",
    });
    const outputOptions = createInterviewRoomOutputOptions();

    expect(ttsOptions).toMatchObject({
      model: "cartesia/sonic-3",
      voice: "voice-id",
      language: "en",
      sampleRate: INTERVIEW_AUDIO_FORMAT.sampleRate,
    });
    expect(outputOptions).toMatchObject({
      audioSampleRate: INTERVIEW_AUDIO_FORMAT.sampleRate,
      audioNumChannels: INTERVIEW_AUDIO_FORMAT.numChannels,
    });
  });

  it("uses patient endpointing and disables preemptive generation for interviews", () => {
    const turnHandling = createInterviewTurnHandling("vad");

    expect(turnHandling.turnDetection).toBe("vad");
    expect(turnHandling.preemptiveGeneration).toEqual({ enabled: false });
    expect(turnHandling.endpointing).toEqual({
      mode: "fixed",
      minDelay: 900,
      maxDelay: 4000,
    });
    expect(turnHandling.interruption).toMatchObject({
      enabled: true,
      minDuration: 650,
      minWords: 1,
    });
  });

  it("defaults the away-backstop grace to a generous window, env-overridable", () => {
    expect(resolveAwayGraceMs({})).toBe(20_000);
    expect(resolveAwayGraceMs({ LIVEKIT_AGENT_AWAY_GRACE_MS: "45000" })).toBe(45_000);
    // Garbage / non-positive falls back to the default rather than disabling the backstop.
    expect(resolveAwayGraceMs({ LIVEKIT_AGENT_AWAY_GRACE_MS: "nope" })).toBe(20_000);
    expect(resolveAwayGraceMs({ LIVEKIT_AGENT_AWAY_GRACE_MS: "0" })).toBe(20_000);
  });
});
