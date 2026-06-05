import { describe, expect, it } from "vitest";

import { resolveAgentModelConfig, resolveLlmModel } from "../src/model-config.js";

const catalog = {
  defaultModel: "cartesia/base",
  defaultPersona: "adi",
  personas: {
    adi: { voice: "adi-default" },
    ren: { voice: "ren-default" },
  },
  languages: {
    es: {
      ren: { model: "elevenlabs/es-model", voice: "ren-es" },
    },
    "pt-br": {
      adi: { model: "rime/br-model", voice: "adi-pt-br", language: "pt-BR" },
    },
  },
};

describe("resolveAgentModelConfig", () => {
  it("selects a language-specific persona voice before the default persona voice", () => {
    const config = resolveAgentModelConfig(
      { persona: "ren", languageCode: "es-MX" },
      { LIVEKIT_AGENT_TTS_VOICE_CATALOG: JSON.stringify(catalog) },
    );

    expect(config.tts).toEqual({
      model: "elevenlabs/es-model",
      voice: "ren-es",
      language: "es-MX",
    });
  });

  it("falls back to the persona voice and uses the interview language for STT/TTS", () => {
    const config = resolveAgentModelConfig(
      { persona: "ren", languageCode: "fr" },
      { LIVEKIT_AGENT_TTS_VOICE_CATALOG: JSON.stringify(catalog) },
    );

    expect(config.stt).toEqual({ model: "auto", language: "fr" });
    expect(config.tts).toEqual({
      model: "cartesia/base",
      voice: "ren-default",
      language: "fr",
    });
  });

  it("lets env force all model/provider IDs and one global TTS voice", () => {
    const config = resolveAgentModelConfig(
      { persona: "adi", languageCode: "ja" },
      {
        LIVEKIT_AGENT_LLM_MODEL: "xai/grok-4-1-fast-non-reasoning",
        LIVEKIT_AGENT_STT_MODEL: "deepgram/nova-3",
        LIVEKIT_AGENT_STT_LANGUAGE: "multi",
        LIVEKIT_AGENT_TTS_MODEL: "xai/tts-1",
        LIVEKIT_AGENT_TTS_VOICE: "Eve",
        LIVEKIT_AGENT_TTS_LANGUAGE: "none",
      },
    );

    expect(config.llm.model).toBe("xai/grok-4-1-fast-non-reasoning");
    expect(config.stt).toEqual({ model: "deepgram/nova-3", language: "multi" });
    expect(config.tts).toEqual({ model: "xai/tts-1", voice: "Eve", language: undefined });
  });

  it("honors exact locale voice overrides before base-language overrides", () => {
    const config = resolveAgentModelConfig(
      { persona: "adi", languageCode: "pt-BR" },
      { LIVEKIT_AGENT_TTS_VOICE_CATALOG: JSON.stringify(catalog) },
    );

    expect(config.tts).toEqual({
      model: "rime/br-model",
      voice: "adi-pt-br",
      language: "pt-BR",
    });
  });

  it("throws a clear error for invalid TTS catalog JSON", () => {
    expect(() =>
      resolveAgentModelConfig(
        { persona: "adi", languageCode: "en" },
        { LIVEKIT_AGENT_TTS_VOICE_CATALOG: "{not-json}" },
      ),
    ).toThrow(/must be valid JSON/);
  });
});

describe("resolveLlmModel", () => {
  it("uses the env LLM model when present", () => {
    expect(resolveLlmModel({ LIVEKIT_AGENT_LLM_MODEL: "openai/gpt-5.5" })).toBe("openai/gpt-5.5");
  });
});
