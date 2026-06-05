// Interviewer TTS voice selection.
//
// Voices are NOT hardcoded per persona anymore — they're selected from a small
// catalog by language first, then persona tone. LiveKit Inference has no API to
// list/filter voices, so the catalog is static (the documented "suggested voices",
// docs.livekit.io/agents/models/tts, 2026-06-05). Re-confirm + extend at deploy.
//
// The backbone is Cartesia sonic-3: each persona maps to a tone-matched sonic-3
// voice, which is MULTILINGUAL — given a `language` hint it speaks the interview's
// language, so it covers every language out of the box. For languages where a
// native-provider voice is a clearly better fit, a per-language override replaces
// the default. The chosen language is always passed through to inference.TTS.

export interface VoiceChoice {
  model: string; // inference TTS model id, e.g. "cartesia/sonic-3"
  voice: string; // bare provider voice id (no model prefix)
  language?: string; // ISO 639-1 hint forwarded to inference.TTS (e.g. "en", "es")
}

const CARTESIA = "cartesia/sonic-3";

const DEFAULT_PERSONA = "adi";

// Per-persona default: a tone-matched Cartesia sonic-3 voice (multilingual). Tone
// pairs with the persona delivery cue in prompt.ts (adi=calm, ren=warm, kai=brisk,
// mira=patient).
const PERSONA_VOICE: Record<string, VoiceChoice> = {
  adi: { model: CARTESIA, voice: "5c5ad5e7-1020-476b-8b91-fdcbe9cc313c" }, // Daniela — calm, trusting
  ren: { model: CARTESIA, voice: "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc" }, // Jacqueline — confident, warm
  kai: { model: CARTESIA, voice: "a167e0f3-df7e-4d52-a9c3-f949145efdab" }, // Blake — energetic, brisk
  mira: { model: CARTESIA, voice: "f31cc6a7-c1e8-4764-980c-60a361443dd1" }, // Robyn — neutral, even, patient
};

// Language-native overrides, keyed by ISO 639-1 base language -> persona. Used
// when a provider has a voice native to that language that fits the persona better
// than the multilingual default. Personas absent here keep the default voice.
const LANGUAGE_OVERRIDES: Record<string, Partial<Record<string, VoiceChoice>>> = {
  // Spanish: Cartesia Daniela is already native (es-MX); richer native male voices
  // back the warmer/brisker personas.
  es: {
    ren: { model: "inworld/inworld-tts-1", voice: "Diego" }, // soothing, gentle Mexican male — warm
    kai: { model: "elevenlabs/eleven_turbo_v2_5", voice: "cjVigY5qzO86Huf0OWal" }, // smooth Mexican male — brisk
  },
};

/** ISO 639-1 base of a language code/tag ("es-MX" -> "es", "EN" -> "en"). */
function baseLang(languageCode: string): string {
  return languageCode.toLowerCase().split("-")[0];
}

/**
 * Resolve a persona + interview language to a concrete TTS voice. Falls back to
 * the persona's multilingual default (then `adi`) when no language override
 * applies, and always carries the language hint so the voice speaks it.
 */
export function selectVoice(persona: string, languageCode: string): VoiceChoice {
  const base = baseLang(languageCode);
  const override = LANGUAGE_OVERRIDES[base]?.[persona];
  const choice = override ?? PERSONA_VOICE[persona] ?? PERSONA_VOICE[DEFAULT_PERSONA];
  return { ...choice, language: languageCode || undefined };
}
