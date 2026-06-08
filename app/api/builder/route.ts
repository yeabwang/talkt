import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

import { badRequest, jsonError, tooManyRequests, unauthorized } from "@/lib/api";
import { CATEGORIES } from "@/lib/catalog";
import { chatJSON, type ChatMessage } from "@/lib/llm";
import { createRateLimiter } from "@/lib/rate-limit";

// 20 builder turns/minute/user — generous for a conversation, caps LLM cost abuse.
const builderLimiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

// One builder turn. Always present so the client can bind every field; the
// `ready`/`questions`/`dimensions` payload fills in only on the final turn.
export interface BuilderSummary {
  title: string;
  role: string;
  category: string;
  difficulty: string;
  blurb: string;
  focus: string[];
  minutes: number;
  count: number;
}

export interface BuilderDimension {
  key: string;
  label: string;
}

export interface BuilderTurn {
  response_text: string;
  suggestions_enabled: boolean;
  suggestion_type: "single" | "multi" | null;
  suggestions: string[];
  summary: BuilderSummary;
  ready: boolean;
  questions: string[];
  dimensions: BuilderDimension[];
}

interface ClientMessage {
  from: "ai" | "you";
  text: string;
}

const SYSTEM_PROMPT = (language: string) => `You are TalkT's interview Builder — a warm, approachable guide who helps people curate a spoken mock interview they want to practice. Speak in a friendly, encouraging tone, never robotic. Keep each reply short (1-3 sentences).

LANGUAGE: Respond ENTIRELY in ${language}. Every field of text you produce — response_text, suggestions, question text, and dimension labels — must be written in ${language}.

YOUR JOB: Through a few back-and-forth turns, learn what interview the user wants: the role/kind of interview, the level/context, the themes to focus on, and how long it should run. Offer clickable suggestions to make this fast, but the user can always type their own answer instead.

You MUST reply with a single strict JSON object and NOTHING else, matching exactly:
{
  "response_text": string,                       // your warm reply to the user
  "suggestions_enabled": boolean,                // true if you offer clickable options this turn
  "suggestion_type": "single" | "multi" | null,  // "single": pick one; "multi": pick several; null if disabled
  "suggestions": string[],                       // 3-5 short options, or [] when disabled
  "summary": {                                   // best-known draft so far; use "" / 0 / [] for unknowns
    "title": string,                             // a concise interview title
    "role": string,
    "category": string,                          // one of: ${CATEGORIES.join(", ")}
    "difficulty": string,                        // e.g. Entry level, Mid, Senior, All levels
    "blurb": string,                             // ONE concise sentence describing what this interview practices (shown on its card)
    "focus": string[],                           // themes the interview leans on
    "minutes": number,                           // est. duration: 1.5-2 min per question (≈ round(count * 1.75)); 0 until known
    "count": number                              // number of questions; 0 until known
  },
  "ready": boolean,                              // true ONLY on the final turn, when questions are generated
  "questions": string[],                         // [] until ready, then the full ordered question set
  "dimensions": [{ "key": string, "label": string }]  // [] until ready, then 4-6 core grading criteria suited to this interview
}

RULES:
- Use "single" for mutually exclusive choices (level, length). Use "multi" for themes/focus the user can combine.
- Disable suggestions (suggestions_enabled=false, type=null, suggestions=[]) when a free-text answer fits better, e.g. the opening role question.
- Keep building summary as you learn more; never blank out a field you already know.
- When you have enough (role, level, focus, length), set ready=true and produce: a tuned, ordered question set spoken aloud in an interview (count questions, no numbering in the text), a minutes estimate budgeting 1.5-2 minutes per question including follow-ups (so minutes ≈ round(count * 1.75)), a fitting category, a polished one-sentence "blurb" describing the interview, and 4-6 dimensions — the core grading criteria for THIS interview (key is a lowercase slug, label is human-readable in ${language}).
- On the ready turn, response_text should warmly hand off ("Here's your set — start when you're ready."), and suggestions_enabled should be false.
- Output ONLY the JSON object. No markdown, no commentary.`;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const decision = builderLimiter.check(userId);
  if (!decision.allowed) return tooManyRequests(decision.retryAfterMs);

  let body: { messages?: ClientMessage[]; language?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const language = typeof body.language === "string" && body.language.trim() ? body.language.trim() : "English";
  const history = Array.isArray(body.messages) ? body.messages : [];

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT(language) },
    ...history
      .filter((m) => m && typeof m.text === "string")
      .map<ChatMessage>((m) => ({ role: m.from === "you" ? "user" : "assistant", content: m.text })),
  ];

  // Seed the very first turn so the model opens the conversation.
  if (history.length === 0) {
    messages.push({ role: "user", content: "(The user just opened the builder. Greet them and ask your first question.)" });
  }

  try {
    const raw = await chatJSON<Partial<BuilderTurn>>(messages, { temperature: 0.7 });
    return Response.json(normalizeTurn(raw));
  } catch (error) {
    console.error("[builder] LLM turn failed:", error);
    return jsonError("The builder is unavailable right now. Please try again.", 502);
  }
}

// Coerce the model output into a guaranteed-shaped turn so the client never
// has to defend against missing fields.
function normalizeTurn(raw: Partial<BuilderTurn>): BuilderTurn {
  const summaryIn = (raw.summary ?? {}) as Partial<BuilderSummary>;
  const questions = strList(raw.questions);
  const ready = Boolean(raw.ready) && questions.length > 0;

  const type = raw.suggestion_type === "single" || raw.suggestion_type === "multi" ? raw.suggestion_type : null;
  const suggestions = ready ? [] : strList(raw.suggestions).slice(0, 6);
  const suggestionsEnabled = Boolean(raw.suggestions_enabled) && !ready && suggestions.length > 0;

  let dimensions = (Array.isArray(raw.dimensions) ? raw.dimensions : [])
    .filter((d): d is BuilderDimension => Boolean(d) && typeof d.key === "string" && typeof d.label === "string")
    .map((d) => ({ key: slug(d.key), label: d.label.trim() }))
    .slice(0, 6);
  if (ready && dimensions.length < 4) dimensions = DEFAULT_DIMENSIONS;

  // Enforce the 1.5-2 min/question budget on the final set, regardless of what
  // the model guessed (estimates used to run wildly long vs. real call length).
  let minutes = clampNum(summaryIn.minutes, 0, 120);
  if (ready) {
    const lo = Math.ceil(questions.length * 1.5);
    const hi = Math.ceil(questions.length * 2);
    if (minutes < lo || minutes > hi) minutes = Math.round(questions.length * 1.75);
  }

  return {
    response_text: typeof raw.response_text === "string" ? raw.response_text : "",
    suggestions_enabled: suggestionsEnabled,
    suggestion_type: suggestionsEnabled ? type ?? "single" : null,
    suggestions: suggestionsEnabled ? suggestions : [],
    summary: {
      title: str(summaryIn.title),
      role: str(summaryIn.role),
      category: category(summaryIn.category),
      difficulty: str(summaryIn.difficulty),
      blurb: str(summaryIn.blurb),
      focus: strList(summaryIn.focus).slice(0, 6),
      minutes,
      count: ready ? questions.length : clampNum(summaryIn.count, 0, 30),
    },
    ready,
    questions: questions.slice(0, 30),
    dimensions,
  };
}

const DEFAULT_DIMENSIONS: BuilderDimension[] = [
  { key: "communication", label: "Communication" },
  { key: "structure", label: "Structure" },
  { key: "depth", label: "Depth" },
  { key: "confidence", label: "Confidence" },
];

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// Clamp the model's category to the catalog. A non-empty value outside CATEGORIES
// falls back to "General"; "" passes through so the summary doesn't show a
// category before one is actually settled (pre-ready turns).
function category(value: unknown): string {
  const c = str(value);
  if (!c) return "";
  return CATEGORIES.includes(c) ? c : "General";
}

function strList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => (typeof v === "string" ? v.trim() : "")).filter(Boolean);
}

function clampNum(value: unknown, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "criteria";
}
