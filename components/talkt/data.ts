export interface Voice {
  id: string;
  name: string;
  tone: string;
}

export interface AppUser {
  name: string;
  email: string;
  firstName?: string;
  // Clerk profile image URL (img.clerk.com); falls back to initials if absent.
  image?: string;
}

export interface Dimension {
  id: string;
  label: string;
  blurb: string;
}

export interface Interview {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  category: string;
  difficulty: string;
  count: number;
  minutes: number;
  author: string;
  source: string;
  takes: number;
  voice: string;
  blurb: string;
  questions: string[];
  custom?: boolean;
  role?: string;
  language?: string;
  focus?: string[];
  // Core grading criteria the AI builder picked for a custom interview.
  dimensions?: { key: string; label: string }[];

  // --- Directory / voting (populated when an interview comes from the API) ---
  upvotes?: number;
  downvotes?: number;
  // The signed-in caller's current vote on this interview: 1 up, -1 down, 0 none.
  myVote?: -1 | 0 | 1;
  // Public attribution; null/undefined when published anonymously (shown as "Community").
  authorName?: string | null;
  anonymous?: boolean;
  // True when the signed-in caller owns this interview (controls the Publish action).
  mine?: boolean;
  // True once the owner has published it to the public directory.
  published?: boolean;
}

export interface Attempt {
  id: string;
  interviewId: string;
  title: string;
  date: string;
  time: string;
  minutes: number;
  overall: number;
  voice: string;
}

export interface FeedbackEvidence {
  text: string;
  evidence: string;
}

export interface FeedbackDimension {
  id: string;
  score: number;
  note: string;
}

export interface QuestionFeedback {
  q: string;
  rating: number;
  critique: string;
  model: string;
}

export interface Feedback {
  overall: number;
  summary: string;
  dimensions: FeedbackDimension[];
  strengths: FeedbackEvidence[];
  improvements: FeedbackEvidence[];
  perQuestion: QuestionFeedback[];
}

// Languages a custom interview can be generated, conducted, and scored in.
export const LANGUAGES: string[] = ["English", "Spanish", "French", "German", "Portuguese", "Mandarin", "Hindi", "Arabic", "Japanese"];

// The language an interview runs in; templates default to English.
export function interviewLanguage(interview: Interview): string {
  return interview.language ?? "English";
}

export const VOICES: Voice[] = [
  { id: "adi", name: "Adi", tone: "Calm, measured" },
  { id: "ren", name: "Ren", tone: "Warm, direct" },
  { id: "kai", name: "Kai", tone: "Brisk, precise" },
  { id: "mira", name: "Mira", tone: "Patient, probing" },
];

export const DIMENSIONS: Dimension[] = [
  { id: "communication", label: "Communication", blurb: "Clarity, concision, signposting" },
  { id: "structure", label: "Structure", blurb: "Frameworks, ordering, completeness" },
  { id: "depth", label: "Depth", blurb: "Substance, specifics, tradeoffs" },
  { id: "confidence", label: "Confidence", blurb: "Pace, conviction, recovery" },
];


export interface UsageBreakdownRow {
  interviewId: string;
  title: string;
  attempts: number;
  minutes: number;
  tokens: number;
}

export interface UsageSummary {
  planLabel: string;
  minutes: number;
  minutesLimit: number;
  tokens: number;
  tokensLimit: number;
  interviews: number;
  estCost: number;
  costBudget: number;
  /* Minutes per session, oldest -> newest, for the over-time chart */
  trend: number[];
  breakdown: UsageBreakdownRow[];
}

export const USAGE: UsageSummary = {
  planLabel: "Free plan",
  minutes: 112,
  minutesLimit: 300,
  tokens: 248_000,
  tokensLimit: 500_000,
  interviews: 5,
  estCost: 3.1,
  costBudget: 10,
  trend: [27, 23, 21, 24, 17],
  breakdown: [
    { interviewId: "fe-react", title: "Frontend engineer", attempts: 2, minutes: 47, tokens: 104_000 },
    { interviewId: "consult", title: "Consulting case", attempts: 1, minutes: 27, tokens: 61_000 },
    { interviewId: "pm-sense", title: "Product manager", attempts: 1, minutes: 21, tokens: 46_000 },
    { interviewId: "behavioral", title: "Behavioral & leadership", attempts: 1, minutes: 17, tokens: 37_000 },
  ],
};

export const ATTEMPTS: Attempt[] = [
  { id: "a1", interviewId: "behavioral", title: "Behavioral & leadership", date: "2026-06-01", time: "14:32", minutes: 17, overall: 82, voice: "adi" },
  { id: "a2", interviewId: "fe-react", title: "Frontend engineer", date: "2026-05-29", time: "09:14", minutes: 24, overall: 74, voice: "kai" },
  { id: "a3", interviewId: "pm-sense", title: "Product manager", date: "2026-05-27", time: "18:05", minutes: 21, overall: 68, voice: "ren" },
  { id: "a4", interviewId: "fe-react", title: "Frontend engineer", date: "2026-05-22", time: "11:40", minutes: 23, overall: 61, voice: "kai" },
  { id: "a5", interviewId: "consult", title: "Consulting case", date: "2026-05-18", time: "20:11", minutes: 27, overall: 79, voice: "kai" },
];

export function buildFeedback(interview: Interview): Feedback {
  return {
    overall: 78,
    summary:
      "Strong, well-paced answers with clear structure. You lose points when you reach for a generic framework instead of a specific story - the interviewer can hear the difference. Tightening your openings and naming concrete numbers would move you from good to memorable.",
    dimensions: [
      { id: "communication", score: 84, note: 'Clear and concise. Almost no filler. Signposting ("three things") landed well.' },
      { id: "structure", score: 80, note: "Good frameworks, but two answers buried the conclusion at the end instead of leading with it." },
      { id: "depth", score: 71, note: "Solid, though a few answers stayed at the level of principle without a concrete example." },
      { id: "confidence", score: 77, note: "Steady pace. One recovery after a stumble was handled gracefully; one fade-out at the end of an answer." },
    ],
    strengths: [
      { text: "Led most answers with a one-line thesis before the detail - easy to follow.", evidence: '"There were three problems, and the database was the real one."' },
      { text: "Quantified impact without prompting.", evidence: '"Cut p95 latency from 1.4s to 230ms."' },
      { text: "Recovered cleanly when you lost the thread mid-answer instead of trailing off.", evidence: '"Let me restart that - the cleaner version is..."' },
    ],
    improvements: [
      { text: "Two answers used a textbook framework where a specific story would land harder.", evidence: 'Q4 - opened with "there are four types of..." instead of what you actually did.' },
      { text: "You tend to end answers softly. Close with the outcome, not a qualifier.", evidence: '"...but it kind of depends." Land it.' },
      { text: "Watch the pace when you're confident - two answers sped up and clipped detail.", evidence: "Q2 ran 40s; the interviewer wanted the tradeoff you skipped." },
    ],
    perQuestion: interview.questions.map((q, index) => {
      const ratings = [82, 74, 68, 88, 60, 79, 71, 76];
      const rating = ratings[index % ratings.length];
      return {
        q,
        rating,
        critique:
          rating >= 80
            ? "Tight and specific. You led with the answer and backed it with a concrete example - exactly the shape an interviewer wants."
            : rating >= 70
              ? "Good substance, but the structure wandered. Lead with your conclusion, then give the two reasons that matter most."
              : "You stayed at the level of principle. Anchor this in one real situation - what you did, the number, and what you'd change.",
        model:
          "Open with a one-line answer. Give the situation in a sentence, the specific action you took, and the measurable result. Close by naming the tradeoff you accepted - that signals seniority.",
      };
    }),
  };
}
