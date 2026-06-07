export interface Voice {
  id: string;
  name: string;
  tone: string;
}

export interface AppUser {
  name: string;
  email: string;
  firstName?: string;
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
  dimensions?: { key: string; label: string }[];

  upvotes?: number;
  downvotes?: number;
  myVote?: -1 | 0 | 1;
  authorName?: string | null;
  anonymous?: boolean;
  mine?: boolean;
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

// Supported interview languages.
export const LANGUAGES: string[] = ["English", "Spanish", "French", "German", "Portuguese", "Mandarin", "Hindi", "Arabic", "Japanese"];

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
  /** Minutes per session, oldest to newest. */
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

// Runtime attempt history is loaded from the API.
export const ATTEMPTS: Attempt[] = [];
