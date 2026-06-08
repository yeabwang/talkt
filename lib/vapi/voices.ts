// Persona → Vapi voice resolution: the server-side *realization* of a persona as
// a concrete TTS voice id, with optional per-language overrides. Persona keys and
// language availability are the catalog's job (lib/catalog.ts); this maps each to
// an actual voice. Override the whole catalog at deploy time with
// VAPI_VOICE_CATALOG (JSON).
import { z } from "zod";

import { DEFAULT_PERSONA } from "@/lib/catalog";

export interface VapiVoice {
  provider: string; // "cartesia" | "11labs" | "inworld" | ...
  voiceId: string;
  // Cartesia is one multilingual voice driven by a language param + model; we set
  // both so the voice actually speaks the interview language. Native per-language
  // overrides (Inworld/ElevenLabs) are already the right language, so they omit these.
  model?: string;
  language?: string;
}

// Cartesia model that covers our full offered language set (sonic-3 = 40+ langs).
const CARTESIA_MULTILINGUAL_MODEL = "sonic-3";

const voiceSchema = z.object({ provider: z.string().min(1), voiceId: z.string().min(1) }).strict();
const catalogSchema = z
  .object({
    defaultPersona: z.string().min(1).optional(),
    personas: z.record(z.string(), voiceSchema),
    languages: z.record(z.string(), z.record(z.string(), voiceSchema)).optional(),
  })
  .strict();

type VoiceCatalog = z.infer<typeof catalogSchema>;

// Default catalog. Cartesia voice UUIDs carried over from the LiveKit config.
const DEFAULT_CATALOG: VoiceCatalog = {
  defaultPersona: DEFAULT_PERSONA,
  personas: {
    adi: { provider: "cartesia", voiceId: "5c5ad5e7-1020-476b-8b91-fdcbe9cc313c" },
    ren: { provider: "cartesia", voiceId: "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc" },
    kai: { provider: "cartesia", voiceId: "a167e0f3-df7e-4d52-a9c3-f949145efdab" },
    mira: { provider: "cartesia", voiceId: "f31cc6a7-c1e8-4764-980c-60a361443dd1" },
  },
  languages: {
    es: {
      ren: { provider: "inworld", voiceId: "Diego" },
      kai: { provider: "11labs", voiceId: "cjVigY5qzO86Huf0OWal" },
    },
  },
};

function parseCatalog(env: Record<string, string | undefined>): VoiceCatalog {
  const raw = env.VAPI_VOICE_CATALOG?.trim();
  if (!raw) return DEFAULT_CATALOG;
  const parsed = catalogSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(`VAPI_VOICE_CATALOG is invalid: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
  }
  return parsed.data;
}

function personaKey(p: string): string {
  return p.trim().toLowerCase() || DEFAULT_PERSONA;
}

function languageKeys(code: string): string[] {
  const norm = code.trim().replace("_", "-").toLowerCase();
  const base = norm.split("-")[0];
  return norm === base ? [norm] : [norm, base];
}

// Attach the spoken language to a Cartesia voice (one multilingual voice, driven
// by the language param). Native per-language override voices already render the
// right language, so they pass through untouched.
function decorate(voice: VapiVoice, baseCode: string): VapiVoice {
  if (voice.provider !== "cartesia") return voice;
  return { ...voice, model: voice.model ?? CARTESIA_MULTILINGUAL_MODEL, language: baseCode };
}

/** Resolve a persona + language to a Vapi voice. A native per-language override
 * wins; otherwise the persona's Cartesia voice speaks the requested language.
 * Falls back to the default persona, then throws on total misconfiguration. */
export function resolveVapiVoice(
  persona: string,
  languageCode: string,
  env: Record<string, string | undefined> = process.env,
): VapiVoice {
  const catalog = parseCatalog(env);
  const key = personaKey(persona);
  const baseCode = languageKeys(languageCode).at(-1) ?? "en";

  for (const lang of languageKeys(languageCode)) {
    const v = catalog.languages?.[lang]?.[key];
    if (v) return decorate(v, baseCode);
  }
  const fallbackPersona = personaKey(catalog.defaultPersona ?? DEFAULT_PERSONA);
  const voice = catalog.personas[key] ?? catalog.personas[fallbackPersona];
  if (!voice) throw new Error(`No Vapi voice configured for persona "${persona}".`);
  return decorate(voice, baseCode);
}
