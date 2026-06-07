// Sanitizes transcript payloads before they reach grading.

export const MAX_TURNS = 400;
export const MAX_TURN_CHARS = 4000;

export interface Turn {
  role: "user" | "assistant";
  text: string;
}

export function sanitizeTranscript(raw: unknown): Turn[] {
  if (!Array.isArray(raw)) return [];
  const out: Turn[] = [];
  for (const item of raw) {
    if (out.length >= MAX_TURNS) break;
    if (!item || typeof item !== "object") continue;
    const rec = item as { role?: unknown; text?: unknown };
    const text = typeof rec.text === "string" ? rec.text.trim().slice(0, MAX_TURN_CHARS) : "";
    if (!text) continue;
    out.push({ role: rec.role === "user" ? "user" : "assistant", text });
  }
  return out;
}
