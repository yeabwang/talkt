export interface Voice {
  id: string;
  name: string;
  tone: string;
}

export interface AppUser {
  name: string;
  email: string;
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

export const TEMPLATES: Interview[] = [
  {
    id: "fe-react",
    title: "Frontend engineer",
    subtitle: "React · TypeScript · systems",
    icon: "code",
    category: "Engineering",
    difficulty: "Mid-Senior",
    count: 8,
    minutes: 25,
    author: "TalkT",
    source: "Curated",
    takes: 4120,
    voice: "kai",
    blurb: "Component design, state, performance, and a small system-design prompt.",
    questions: [
      "Walk me through how you'd structure a large React app for a team of ten.",
      "When would you reach for a global store over local state, and what are the costs?",
      "A list of 10,000 rows is janky on scroll. How do you diagnose and fix it?",
      "Explain the tradeoffs between server components and client components.",
      "How do you keep a design system's components accessible by default?",
      "Describe a bug you fixed that taught you something about the platform.",
      "Design the data flow for a collaborative cursor feature.",
      "What's your approach to testing a complex form?",
    ],
  },
  {
    id: "pm-sense",
    title: "Product manager",
    subtitle: "Product sense · prioritization",
    icon: "target",
    category: "Product",
    difficulty: "All levels",
    count: 7,
    minutes: 22,
    author: "TalkT",
    source: "Curated",
    takes: 3380,
    voice: "ren",
    blurb: "Product judgment, metrics, and stakeholder tradeoffs - no whiteboard needed.",
    questions: [
      "Pick a product you use daily. What would you change first, and why?",
      "How would you measure success for a feature that has no obvious metric?",
      "Two teams want the same engineer. How do you decide?",
      "Walk me through how you'd size a new market opportunity.",
      "A launch is flat after two weeks. What do you look at?",
      "How do you say no to a senior stakeholder's pet feature?",
      "Describe a decision you made with incomplete data.",
    ],
  },
  {
    id: "behavioral",
    title: "Behavioral & leadership",
    subtitle: "STAR · ownership · conflict",
    icon: "message-square",
    category: "General",
    difficulty: "All levels",
    count: 6,
    minutes: 18,
    author: "TalkT",
    source: "Curated",
    takes: 6210,
    voice: "adi",
    blurb: "The questions every interview asks, rehearsed until they're sharp.",
    questions: [
      "Tell me about a time you disagreed with a manager.",
      "Describe a project that failed. What did you own?",
      "When did you have to influence without authority?",
      "Tell me about a time you received hard feedback.",
      "How do you handle a teammate who isn't pulling their weight?",
      "What's a risk you took that didn't pay off?",
    ],
  },
  {
    id: "nurse",
    title: "Registered nurse",
    subtitle: "Clinical scenarios · patient care",
    icon: "activity",
    category: "Healthcare",
    difficulty: "Entry-Mid",
    count: 7,
    minutes: 20,
    author: "M. Okafor",
    source: "Community",
    takes: 980,
    voice: "mira",
    blurb: "Triage judgment, communication under pressure, and ethics scenarios.",
    questions: [
      "A patient refuses a medication you believe they need. What do you do?",
      "Describe how you prioritize four patients at the start of a shift.",
      "How do you de-escalate an angry family member?",
      "Tell me about a time you caught a mistake before it reached a patient.",
      "Walk me through your handoff at end of shift.",
      "How do you stay composed during a code?",
      "What would you do if you saw a colleague cut a corner on hygiene?",
    ],
  },
  {
    id: "consult",
    title: "Consulting case",
    subtitle: "Market entry · profitability",
    icon: "trending-up",
    category: "Business",
    difficulty: "Senior",
    count: 5,
    minutes: 28,
    author: "TalkT",
    source: "Curated",
    takes: 1740,
    voice: "kai",
    blurb: "A spoken case with structure, math out loud, and a recommendation.",
    questions: [
      "A coffee chain's profits are down 15%. Where do you start?",
      "Should a regional grocer launch a private-label line?",
      "Estimate the number of electric scooters needed for a mid-size city.",
      "A client wants to enter the meal-kit market. Walk me through your approach.",
      "Synthesize: what's your recommendation and the top risk?",
    ],
  },
  {
    id: "sales",
    title: "Account executive",
    subtitle: "Discovery · objection handling",
    icon: "headphones",
    category: "Sales",
    difficulty: "Mid",
    count: 6,
    minutes: 18,
    author: "D. Reyes",
    source: "Community",
    takes: 1290,
    voice: "ren",
    blurb: "Role-play discovery calls and handle the objections you fear most.",
    questions: [
      "Sell me on a tool I just said I don't have budget for.",
      "Walk me through your discovery process on a cold first call.",
      "A champion goes quiet for three weeks. What's your play?",
      "How do you handle 'we're already using a competitor'?",
      "Tell me about the largest deal you closed and what almost killed it.",
      "How do you forecast a quarter you're behind on?",
    ],
  },
  {
    id: "ux",
    title: "Product designer",
    subtitle: "Portfolio · critique · craft",
    icon: "palette",
    category: "Design",
    difficulty: "Mid-Senior",
    count: 6,
    minutes: 22,
    author: "TalkT",
    source: "Curated",
    takes: 2050,
    voice: "adi",
    blurb: "Talk through your process, defend a decision, and critique a flow live.",
    questions: [
      "Walk me through one project end to end - your role, not the team's.",
      "Describe a design decision you'd make differently now.",
      "How do you handle a stakeholder who 'just doesn't like it'?",
      "Critique the onboarding of an app you used recently.",
      "How do you know when a design is done?",
      "How do you balance consistency with the right exception?",
    ],
  },
  {
    id: "ds",
    title: "Data scientist",
    subtitle: "Stats · ML · experiment design",
    icon: "bar-chart",
    category: "Engineering",
    difficulty: "Mid-Senior",
    count: 7,
    minutes: 26,
    author: "TalkT",
    source: "Curated",
    takes: 1610,
    voice: "mira",
    blurb: "Reason out loud about experiments, models, and messy real-world data.",
    questions: [
      "Explain p-values to a skeptical executive.",
      "Your model's offline metric is great but online it's flat. Why?",
      "How would you design an A/B test for a low-traffic feature?",
      "When is a simpler model the right call over a more accurate one?",
      "Walk me through handling severe class imbalance.",
      "How do you detect and explain data leakage?",
      "A stakeholder wants a number you can't get cleanly. What do you do?",
    ],
  },
];

export const CUSTOM_INTERVIEWS: Interview[] = [
  {
    id: "custom-eng-mgr",
    title: "Engineering manager (custom)",
    subtitle: "Built with the AI builder",
    icon: "sparkles",
    category: "Custom",
    difficulty: "Senior",
    count: 6,
    minutes: 24,
    author: "You",
    source: "Custom",
    takes: 2,
    voice: "ren",
    custom: true,
    blurb: "Generated from your brief: first-time EM, 30-person org, growth focus.",
    questions: [
      "How do you run a one-on-one with an underperforming senior engineer?",
      "Walk me through your first 90 days managing a team you didn't build.",
      "How do you balance shipping with paying down technical debt?",
      "Describe how you'd grow a strong IC who doesn't want to manage.",
      "A project is two months late. How do you communicate up?",
      "How do you set goals for a team in an ambiguous quarter?",
    ],
  },
];

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
