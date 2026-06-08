// Single source of truth for the interview catalog: the languages an interview
// can run in, the interviewer personas (and which languages each can speak),
// the question categories, and the default scoring dimensions.
//
// Everything else derives from here — the builder, voice resolution, the seed,
// the library filters, the analyzer's default rubric — so there is exactly one
// place to add a language, a persona, or a category. Pure data + helpers, no
// secrets and no env, so it is safe to import from both client and server.

export interface LanguageDef {
  code: string; // ISO 639-1
  label: string; // display label
}

export interface PersonaDef {
  key: string; // voice-agent key: adi|ren|kai|mira
  name: string; // interviewer display name
  tone: string; // one-line tone shown in the UI
  // Character used to compose the interviewer system prompt — gives each persona
  // a distinct voice and presence rather than one generic interviewer.
  character: string;
  // ISO codes this persona can actually be voiced in. Drives language-gated
  // interviewer selection (not every voice speaks every language).
  languages: string[];
}

export interface DimensionDef {
  key: string;
  label: string;
  blurb: string;
}

// Each persona is offered only in the languages we've curated a voice for (see
// lib/vapi/voices.ts). The sets differ on purpose — not every interviewer is
// available in every language — and the offered language list below is their
// union. A language with no persona (e.g. Arabic today) is never shown.
const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  zh: "Mandarin",
  hi: "Hindi",
  ja: "Japanese",
  ar: "Arabic",
};

export const PERSONAS: PersonaDef[] = [
  {
    key: "adi",
    name: "Adi",
    tone: "Calm, measured",
    character:
      "a calm, measured senior interviewer who is unhurried and thoughtful, lets silence breathe, and never rushes a candidate who is thinking.",
    languages: ["en", "fr", "pt"],
  },
  {
    key: "ren",
    name: "Ren",
    tone: "Warm, direct",
    character:
      "a warm, direct interviewer who puts candidates at ease quickly, keeps the conversation natural and human, and is quietly encouraging without ever judging.",
    languages: ["en", "es", "pt", "hi"],
  },
  {
    key: "kai",
    name: "Kai",
    tone: "Brisk, precise",
    character:
      "a brisk, precise interviewer who keeps a crisp pace, wastes no words, and asks sharp, well-aimed follow-ups to get to the substance.",
    languages: ["en", "es", "de", "zh", "ja"],
  },
  {
    key: "mira",
    name: "Mira",
    tone: "Patient, probing",
    character:
      "a patient, probing interviewer who is gentle but digs for depth, leaves real space for the candidate to think, and follows a thread until it is fully explored.",
    languages: ["en", "fr", "de", "ja", "hi"],
  },
];

export const DEFAULT_PERSONA = PERSONAS[0].key;

// Offered languages = those at least one persona can speak. Ordered by the label
// map so the picker is stable.
export const LANGUAGES: LanguageDef[] = Object.keys(LANGUAGE_LABELS)
  .filter((code) => PERSONAS.some((p) => p.languages.includes(code)))
  .map((code) => ({ code, label: LANGUAGE_LABELS[code] }));

// Interview categories surfaced in the builder and library filters.
export const CATEGORIES = [
  "Engineering",
  "Product",
  "Design",
  "Data",
  "Business",
  "Sales",
  "Marketing",
  "Healthcare",
  "Finance",
  "General",
];

// Fallback scoring rubric when an interview has no per-interview dimensions
// (the builder normally picks 4-6 tuned to the role at generation time).
export const DIMENSIONS: DimensionDef[] = [
  { key: "communication", label: "Communication", blurb: "Clarity, concision, signposting" },
  { key: "structure", label: "Structure", blurb: "Frameworks, ordering, completeness" },
  { key: "depth", label: "Depth", blurb: "Substance, specifics, tradeoffs" },
  { key: "confidence", label: "Confidence", blurb: "Pace, conviction, recovery" },
];

const PERSONA_BY_KEY = new Map(PERSONAS.map((p) => [p.key, p]));
const LABEL_BY_CODE = new Map(LANGUAGES.map((l) => [l.code, l.label]));
const CODE_BY_LABEL = new Map(LANGUAGES.map((l) => [l.label.toLowerCase(), l.code]));

/** ISO code -> display label. Unknown/blank falls back to English. */
export function toLanguageLabel(code: string | null | undefined): string {
  if (!code) return "English";
  return LABEL_BY_CODE.get(code.trim().toLowerCase()) ?? LANGUAGE_LABELS[code.trim().toLowerCase()] ?? "English";
}

/**
 * Label-or-code -> ISO code. A known code passes through (so "fr" stays "fr"),
 * a known display label maps to its code, and anything else falls back to "en".
 */
export function toLanguageCode(label: string | null | undefined): string {
  if (!label) return "en";
  const t = label.trim().toLowerCase();
  if (LABEL_BY_CODE.has(t)) return t; // already a known ISO code
  return CODE_BY_LABEL.get(t) ?? "en";
}

/** Normalize a code-or-label into an ISO code (known codes pass through). */
function normalizeToCode(language: string | null | undefined): string {
  if (!language) return "en";
  const t = language.trim().toLowerCase();
  if (LABEL_BY_CODE.has(t)) return t; // already a known code
  return CODE_BY_LABEL.get(t) ?? "en"; // otherwise treat as a label
}

/** Resolve a persona by key, falling back to the default persona. */
export function getPersona(key: string | null | undefined): PersonaDef {
  if (key) {
    const found = PERSONA_BY_KEY.get(key.trim().toLowerCase());
    if (found) return found;
  }
  return PERSONA_BY_KEY.get(DEFAULT_PERSONA)!;
}

/**
 * The personas offered for a language, by ISO code or display label. Never
 * empty: if no persona declares the language we fall back to the full pool so a
 * call can always be voiced (resolveVapiVoice then uses the persona default).
 */
export function personasForLanguage(language: string | null | undefined): PersonaDef[] {
  const code = normalizeToCode(language);
  const matches = PERSONAS.filter((p) => p.languages.includes(code));
  return matches.length ? matches : PERSONAS;
}

/** The default persona for a language: the first one that can speak it. */
export function defaultPersonaForLanguage(language: string | null | undefined): PersonaDef {
  return personasForLanguage(language)[0];
}

/** Whether a persona can be offered for a language. */
export function personaSpeaksLanguage(personaKey: string, language: string | null | undefined): boolean {
  return personasForLanguage(language).some((p) => p.key === personaKey);
}
