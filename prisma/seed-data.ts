// Server-only seed source for the curated TalkT interview templates. These are
// pushed into the DB by prisma/seed.ts and published under the "TalkT" name;
// the app reads them dynamically from the API, not from this array.

export interface SeedTemplate {
  id: string;
  title: string;
  subtitle: string;
  role: string;
  category: string;
  difficulty: string;
  blurb: string;
  minutes: number;
  voice: string;
  questions: string[];
}

export const SEED_TEMPLATES: SeedTemplate[] = [
  {
    id: "fe-react",
    title: "Frontend engineer",
    subtitle: "React · TypeScript · systems",
    role: "Frontend engineer",
    category: "Engineering",
    difficulty: "Mid-Senior",
    blurb: "Component design, state, performance, and a small system-design prompt.",
    minutes: 25,
    voice: "kai",
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
    role: "Product manager",
    category: "Product",
    difficulty: "All levels",
    blurb: "Product judgment, metrics, and stakeholder tradeoffs - no whiteboard needed.",
    minutes: 22,
    voice: "ren",
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
    role: "Behavioral",
    category: "General",
    difficulty: "All levels",
    blurb: "The questions every interview asks, rehearsed until they're sharp.",
    minutes: 18,
    voice: "adi",
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
    role: "Registered nurse",
    category: "Healthcare",
    difficulty: "Entry-Mid",
    blurb: "Triage judgment, communication under pressure, and ethics scenarios.",
    minutes: 20,
    voice: "mira",
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
    role: "Management consultant",
    category: "Business",
    difficulty: "Senior",
    blurb: "A spoken case with structure, math out loud, and a recommendation.",
    minutes: 28,
    voice: "kai",
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
    role: "Account executive",
    category: "Sales",
    difficulty: "Mid",
    blurb: "Role-play discovery calls and handle the objections you fear most.",
    minutes: 18,
    voice: "ren",
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
    role: "Product designer",
    category: "Design",
    difficulty: "Mid-Senior",
    blurb: "Talk through your process, defend a decision, and critique a flow live.",
    minutes: 22,
    voice: "adi",
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
    role: "Data scientist",
    category: "Engineering",
    difficulty: "Mid-Senior",
    blurb: "Reason out loud about experiments, models, and messy real-world data.",
    minutes: 26,
    voice: "mira",
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
