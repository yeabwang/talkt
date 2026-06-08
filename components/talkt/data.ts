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

// Languages, voices, and dimensions all derive from the single source of truth
// (lib/catalog.ts) so adding one there updates the builder, filters, and seed.
import { DIMENSIONS as CATALOG_DIMENSIONS, LANGUAGES as CATALOG_LANGUAGES, PERSONAS } from "@/lib/catalog";

// Language labels a custom interview can be generated, conducted, and scored in.
export const LANGUAGES: string[] = CATALOG_LANGUAGES.map((l) => l.label);

// The language an interview runs in; templates default to English.
export function interviewLanguage(interview: Interview): string {
  return interview.language ?? "English";
}

export const VOICES: Voice[] = PERSONAS.map((p) => ({ id: p.key, name: p.name, tone: p.tone }));

export const DIMENSIONS: Dimension[] = CATALOG_DIMENSIONS.map((d) => ({ id: d.key, label: d.label, blurb: d.blurb }));


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

// Real attempt history + feedback come from the DB once wired; no mock seed.
export const ATTEMPTS: Attempt[] = [];
