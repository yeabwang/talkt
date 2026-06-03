// ISO 639-1 <-> display-label mapping for the languages a TalkT interview can
// run in. The DB stores ISO codes (Interview.language); the UI works in labels
// (see components/talkt/data.ts LANGUAGES). Convert at the boundary.

const LABEL_BY_CODE: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  zh: "Mandarin",
  hi: "Hindi",
  ar: "Arabic",
  ja: "Japanese",
};

const CODE_BY_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(LABEL_BY_CODE).map(([code, label]) => [label.toLowerCase(), code]),
);

/** ISO code -> display label. Unknown/blank codes fall back to English. */
export function toLanguageLabel(code: string | null | undefined): string {
  if (!code) return "English";
  return LABEL_BY_CODE[code.trim().toLowerCase()] ?? "English";
}

/** Display label -> ISO code. Unknown/blank labels fall back to "en". */
export function toLanguageCode(label: string | null | undefined): string {
  if (!label) return "en";
  return CODE_BY_LABEL[label.trim().toLowerCase()] ?? "en";
}
