// LiveKit Inference model and TTS voice configuration.
//
// Model IDs encode the provider (for example, "openai/..." or "cartesia/...").
// Defaults keep local development working, while environment variables let each
// deployment choose providers, models, voices, and language behavior without a
// code change.
import { z } from "zod";

export interface TtsVoiceChoice {
  model: string;
  voice: string;
  language?: string;
}

export interface AgentModelConfig {
  stt: {
    model: string;
    language: string;
  };
  llm: {
    model: string;
  };
  tts: TtsVoiceChoice;
}

interface ResolveArgs {
  persona: string;
  languageCode: string;
}

type Env = Record<string, string | undefined>;

const DEFAULT_LLM_MODEL = "openai/gpt-5.3-chat-latest";
const DEFAULT_STT_MODEL = "auto";
const DEFAULT_TTS_MODEL = "cartesia/sonic-3";
const DEFAULT_PERSONA = "adi";

const voiceSchema = z
  .object({
    model: z.string().min(1).optional(),
    voice: z.string().min(1),
    language: z.string().min(1).optional(),
  })
  .strict();

const catalogSchema = z
  .object({
    defaultModel: z.string().min(1).optional(),
    defaultPersona: z.string().min(1).optional(),
    personas: z.record(z.string(), voiceSchema).optional(),
    languages: z.record(z.string(), z.record(z.string(), voiceSchema)).optional(),
  })
  .strict();

type RawVoice = z.infer<typeof voiceSchema>;
type VoiceCatalog = z.infer<typeof catalogSchema>;

// Documented suggested voices from LiveKit's TTS page. Keep this small and
// boring; production can replace the entire catalog with
// LIVEKIT_AGENT_TTS_VOICE_CATALOG when availability or voice taste changes.
const DEFAULT_TTS_VOICE_CATALOG: Required<VoiceCatalog> = {
  defaultModel: DEFAULT_TTS_MODEL,
  defaultPersona: DEFAULT_PERSONA,
  personas: {
    adi: { voice: "5c5ad5e7-1020-476b-8b91-fdcbe9cc313c" },
    ren: { voice: "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc" },
    kai: { voice: "a167e0f3-df7e-4d52-a9c3-f949145efdab" },
    mira: { voice: "f31cc6a7-c1e8-4764-980c-60a361443dd1" },
  },
  languages: {
    es: {
      ren: { model: "inworld/inworld-tts-1", voice: "Diego" },
      kai: { model: "elevenlabs/eleven_turbo_v2_5", voice: "cjVigY5qzO86Huf0OWal" },
    },
  },
};

function envValue(env: Env, key: string): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

function normalizeLanguage(languageCode: string): string {
  return languageCode.trim().replace("_", "-");
}

function languageKeys(languageCode: string): string[] {
  const normalized = normalizeLanguage(languageCode).toLowerCase();
  const base = normalized.split("-")[0];
  return normalized === base ? [normalized] : [normalized, base];
}

function personaKey(persona: string): string {
  return persona.trim().toLowerCase() || DEFAULT_PERSONA;
}

function parseVoiceCatalog(env: Env): VoiceCatalog {
  const raw = envValue(env, "LIVEKIT_AGENT_TTS_VOICE_CATALOG");
  if (!raw) return DEFAULT_TTS_VOICE_CATALOG;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`LIVEKIT_AGENT_TTS_VOICE_CATALOG must be valid JSON: ${err instanceof Error ? err.message : "parse failed"}`);
  }

  const result = catalogSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`LIVEKIT_AGENT_TTS_VOICE_CATALOG is invalid: ${result.error.issues.map((issue) => issue.message).join("; ")}`);
  }
  return result.data;
}

function withModel(voice: RawVoice, fallbackModel: string): TtsVoiceChoice {
  return {
    model: voice.model ?? fallbackModel,
    voice: voice.voice,
    language: voice.language,
  };
}

function resolveTtsLanguage(languageCode: string, env: Env, voiceLanguage?: string): string | undefined {
  const configured = envValue(env, "LIVEKIT_AGENT_TTS_LANGUAGE");
  if (!configured || configured === "job") return voiceLanguage ?? normalizeLanguage(languageCode);
  if (configured === "none") return voiceLanguage;
  return configured;
}

function resolveSttLanguage(languageCode: string, env: Env): string {
  const configured = envValue(env, "LIVEKIT_AGENT_STT_LANGUAGE");
  if (!configured || configured === "job") return normalizeLanguage(languageCode);
  return configured;
}

export function resolveLlmModel(env: Env = process.env): string {
  return envValue(env, "LIVEKIT_AGENT_LLM_MODEL") ?? DEFAULT_LLM_MODEL;
}

export function resolveAgentModelConfig(args: ResolveArgs, env: Env = process.env): AgentModelConfig {
  const llmModel = resolveLlmModel(env);
  const sttModel = envValue(env, "LIVEKIT_AGENT_STT_MODEL") ?? DEFAULT_STT_MODEL;
  const sttLanguage = resolveSttLanguage(args.languageCode, env);
  const forcedTtsVoice = envValue(env, "LIVEKIT_AGENT_TTS_VOICE");
  const configuredTtsModel = envValue(env, "LIVEKIT_AGENT_TTS_MODEL");

  let tts: TtsVoiceChoice | undefined;
  if (forcedTtsVoice) {
    tts = {
      model: configuredTtsModel ?? DEFAULT_TTS_MODEL,
      voice: forcedTtsVoice,
    };
  } else {
    const catalog = parseVoiceCatalog(env);
    const fallbackModel = configuredTtsModel ?? catalog.defaultModel ?? DEFAULT_TTS_MODEL;
    const persona = personaKey(args.persona);

    for (const key of languageKeys(args.languageCode)) {
      const languageVoice = catalog.languages?.[key]?.[persona];
      if (languageVoice) {
        tts = withModel(languageVoice, fallbackModel);
        break;
      }
    }

    const defaultPersona = personaKey(catalog.defaultPersona ?? DEFAULT_PERSONA);
    tts ??= catalog.personas?.[persona] ? withModel(catalog.personas[persona], fallbackModel) : undefined;
    tts ??= catalog.personas?.[defaultPersona] ? withModel(catalog.personas[defaultPersona], fallbackModel) : undefined;
  }

  if (!tts) {
    throw new Error(
      "No TTS voice configured. Set LIVEKIT_AGENT_TTS_VOICE or provide LIVEKIT_AGENT_TTS_VOICE_CATALOG with a matching persona/defaultPersona.",
    );
  }

  return {
    stt: { model: sttModel, language: sttLanguage },
    llm: { model: llmModel },
    tts: {
      ...tts,
      language: resolveTtsLanguage(args.languageCode, env, tts.language),
    },
  };
}
