// Persona key -> LiveKit Inference TTS voice. Static map; no availability polling
// (Inference voices are stable model strings, unlike the Vapi VoiceAgent cache).
//
// [VERIFY] Voice ids are documented Cartesia sonic-3 voices (docs.livekit.io,
// 2026-06-05). Re-confirm against the Inference voice catalog at deploy time and
// swap for closer tone matches if better fits exist.
export const TTS_MODEL = "cartesia/sonic-3";

// Each persona maps to a distinct voice whose tone matches the delivery cue in
// prompt.ts (adi=calm, ren=warm, kai=brisk, mira=patient).
export const voices: Record<string, string> = {
  adi: "5c5ad5e7-1020-476b-8b91-fdcbe9cc313c", // Daniela — calm, trusting
  ren: "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc", // Jacqueline — confident, warm
  kai: "a167e0f3-df7e-4d52-a9c3-f949145efdab", // Blake — energetic, brisk
  mira: "f31cc6a7-c1e8-4764-980c-60a361443dd1", // Robyn — neutral, even, patient
};

/** Resolve a persona key to a voice id, defaulting to adi for unknown keys. */
export function voiceFor(persona: string): string {
  return voices[persona] ?? voices.adi;
}
