// Converts a completed interview transcript into normalized feedback.
import type { Interview } from "@/components/talkt/data";
import { chatJSON, type ChatMessage } from "@/lib/llm";

export interface AnalysisDimensionScore {
  key: string;
  score: number; // 0-100
  note: string;
}

export interface AnalysisQuestion {
  questionId: string; // index-as-id or stored question id
  question: string;
  ratingScore: number; // 0-100
  critique: string;
  modelAnswer: string;
}

export interface AnalysisEvidence {
  text: string;
  evidence: string;
}

export interface AnalysisResult {
  overallScore: number; // 0-100
  summary: string;
  dimensionScores: AnalysisDimensionScore[];
  strengths: AnalysisEvidence[];
  improvements: AnalysisEvidence[];
  perQuestion: AnalysisQuestion[];
}

const DEFAULT_DIMENSIONS = [
  { key: "communication", label: "Communication" },
  { key: "structure", label: "Structure" },
  { key: "depth", label: "Depth" },
  { key: "confidence", label: "Confidence" },
];

function clampScore(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.min(100, Math.max(0, Math.round(v)));
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v.trim() : fallback;
}

function evidenceList(raw: unknown): AnalysisEvidence[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((e) => ({ text: str((e as { text?: unknown })?.text), evidence: str((e as { evidence?: unknown })?.evidence) }))
    .filter((e) => e.text);
}

/**
 * Analyze a transcript and return normalized feedback. The transcript may be the
 * full text or an array of {role, message} turns; both are stringified for the
 * model. Throws only if the LLM is unreachable after retries.
 */
export async function analyzeTranscript(interview: Interview, transcript: string): Promise<AnalysisResult> {
  const dims = interview.dimensions?.length ? interview.dimensions : DEFAULT_DIMENSIONS;
  const questions = interview.questions ?? [];
  const language = interview.language ?? "English";

  const dimList = dims.map((d) => `- ${d.key}: ${d.label}`).join("\n");
  const qList = questions.map((q, i) => `${i + 1}. ${q}`).join("\n");

  const system: ChatMessage = {
    role: "system",
    content: [
      "You are an expert interview coach. You receive a transcript of a spoken mock interview and return STRICT JSON feedback.",
      `Write all prose (summary, notes, critiques, model answers) in ${language}.`,
      "Score on a 0-100 scale. Be specific and concrete.",
      "Be concise — this is read quickly:",
      "- summary: 2 sentences max.",
      "- each dimension note: 1 sentence.",
      "- exactly 3 strengths and 3 improvements; each text 1 sentence, evidence a short quote/paraphrase.",
      "- per question: critique 1-2 sentences; modelAnswer 2-3 sentences (the shape of a strong answer, not an essay).",
      "",
      "Score exactly these dimensions (use the given keys):",
      dimList,
      "",
      "Return JSON with this exact shape:",
      `{
  "overallScore": number,
  "summary": string,
  "dimensionScores": [{ "key": string, "score": number, "note": string }],
  "strengths": [{ "text": string, "evidence": string }],
  "improvements": [{ "text": string, "evidence": string }],
  "perQuestion": [{ "questionId": string, "question": string, "ratingScore": number, "critique": string, "modelAnswer": string }]
}`,
      "Provide one perQuestion entry per question below, in order, using its 1-based index as questionId.",
    ].join("\n"),
  };

  const user: ChatMessage = {
    role: "user",
    content: [
      `Interview: ${interview.title}`,
      interview.role ? `Role: ${interview.role}` : "",
      `Difficulty: ${interview.difficulty}`,
      "",
      "Questions:",
      qList,
      "",
      "Transcript:",
      transcript.slice(0, 24000),
    ]
      .filter(Boolean)
      .join("\n"),
  };

  // Keep the response bounded; per-question feedback dominates token volume.
  const raw = await chatJSON<Record<string, unknown>>([system, user], { temperature: 0.2, maxTokens: 3500 });

  // Normalize all model output before it reaches storage or the UI.
  const dimScoresRaw = Array.isArray(raw.dimensionScores) ? raw.dimensionScores : [];
  const byKey = new Map<string, { score: number; note: string }>();
  for (const d of dimScoresRaw) {
    const key = str((d as { key?: unknown })?.key);
    if (key) byKey.set(key, { score: clampScore((d as { score?: unknown })?.score), note: str((d as { note?: unknown })?.note) });
  }
  const dimensionScores: AnalysisDimensionScore[] = dims.map((d) => ({
    key: d.key,
    score: byKey.get(d.key)?.score ?? 0,
    note: byKey.get(d.key)?.note ?? "",
  }));

  const perQuestionRaw = Array.isArray(raw.perQuestion) ? raw.perQuestion : [];
  const perQuestion: AnalysisQuestion[] = questions.map((q, i) => {
    const match = perQuestionRaw[i] as Record<string, unknown> | undefined;
    return {
      questionId: String(i + 1),
      question: q,
      ratingScore: clampScore(match?.ratingScore),
      critique: str(match?.critique),
      modelAnswer: str(match?.modelAnswer),
    };
  });

  const overall =
    clampScore(raw.overallScore) ||
    Math.round(dimensionScores.reduce((a, d) => a + d.score, 0) / Math.max(1, dimensionScores.length));

  return {
    overallScore: overall,
    summary: str(raw.summary),
    dimensionScores,
    strengths: evidenceList(raw.strengths),
    improvements: evidenceList(raw.improvements),
    perQuestion,
  };
}
