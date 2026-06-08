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

// ── Interview progress (shared by the live UI progress bar and the grading
// decision, so both count "questions reached" the same way) ─────────────────

// Words too generic to identify which question is being asked. English-only, but
// harmless for other languages (they just keep more tokens).
const QUESTION_STOPWORDS = new Set([
  "the", "and", "for", "you", "your", "what", "how", "why", "can", "could", "would", "tell", "about",
  "give", "with", "that", "this", "please", "describe", "explain", "walk", "through", "have", "are",
  "did", "does", "any", "his", "her", "their", "from", "into", "when", "where", "who", "which",
]);

/** Significant tokens of a line, across scripts (keeps accents/non-latin). */
function sigWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !QUESTION_STOPWORDS.has(w));
}

/**
 * How many core questions the interviewer reached, in order. Advances only when
 * an assistant turn carries enough of the next question's keywords — so follow-ups
 * and acknowledgements don't push the count, but moving to the next question does.
 * Paraphrase may delay a step (under-counts, never over-counts).
 */
export function questionsReached(assistantTexts: string[], questions: string[]): number {
  if (!questions.length) return 0;
  const qWords = questions.map(sigWords);
  let reached = 0;
  for (const text of assistantTexts) {
    if (reached >= questions.length) break;
    const target = qWords[reached];
    if (!target.length) {
      reached += 1;
      continue;
    }
    const spoken = new Set(sigWords(text));
    const hits = target.filter((w) => spoken.has(w)).length;
    if (hits / target.length >= 0.5) reached += 1;
  }
  return reached;
}

/**
 * Whether at least `threshold` (default half) of the question set was answered.
 * Uses questions reached (which only advances after the candidate responds) as
 * the proxy. With no question list, any substantive candidate turn counts.
 */
export function answeredAtLeastHalf(transcript: Turn[], questions: string[], threshold = 0.5): boolean {
  const userTurns = transcript.filter((t) => t.role === "user" && t.text.trim()).length;
  if (userTurns === 0) return false;
  if (!questions.length) return true;
  const assistantTexts = transcript.filter((t) => t.role === "assistant").map((t) => t.text);
  return questionsReached(assistantTexts, questions) / questions.length >= threshold;
}
