// Language helpers. The catalog (lib/catalog.ts) is the single source of truth
// for the language set and its labels; this module just re-exports the boundary
// converters so existing `@/lib/language` imports keep working.
export { toLanguageLabel, toLanguageCode } from "@/lib/catalog";
