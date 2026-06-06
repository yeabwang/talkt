// Persona → Vapi voice resolution. Ported from the worker's TTS catalog. Keyed
// by voice-agent key (adi/ren/kai/mira) with optional per-language overrides.
// Override the whole catalog at deploy time with VAPI_VOICE_CATALOG (JSON).
import { z } from "zod";

export interface VapiVoice {
  provider: string; // "cartesia" | "11labs" | "inworld" | ...
  voiceId: string;
}

const DEFAULT_PERSONA = "adi";

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

/** Resolve a persona + language to a Vapi voice. Language override wins; then the
 * persona's default voice; then the catalog's default persona. Throws if nothing
 * matches (a misconfiguration we want loud, not silent). */
export function resolveVapiVoice(
  persona: string,
  languageCode: string,
  env: Record<string, string | undefined> = process.env,
): VapiVoice {
  const catalog = parseCatalog(env);
  const key = personaKey(persona);

  for (const lang of languageKeys(languageCode)) {
    const v = catalog.languages?.[lang]?.[key];
    if (v) return v;
  }
  const fallbackPersona = personaKey(catalog.defaultPersona ?? DEFAULT_PERSONA);
  const voice = catalog.personas[key] ?? catalog.personas[fallbackPersona];
  if (!voice) throw new Error(`No Vapi voice configured for persona "${persona}".`);
  return voice;
}
