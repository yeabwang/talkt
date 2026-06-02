"use client";

import * as React from "react";

import { LANGUAGES, VOICES, type Interview } from "@/components/talkt/data";
import type { TalkTRoute } from "@/components/talkt/app-shell";
import { AgentAvatar, Icon, SectionHeader, StatusDot, TalkTButton } from "@/components/talkt/primitives";

interface BuilderDraft {
  role: string;
  difficulty: string;
  focus: string[];
  count: number;
  minutes: number;
  voice: string;
  language: string;
  questions: string[] | null;
}

interface ThreadMessage {
  from: "ai" | "you";
  text: string;
  generating?: boolean;
}

interface BuilderStep {
  key: "role" | "difficulty" | "focus" | "length";
  question: string | ((draft: BuilderDraft) => string);
  chips: string[];
}

const STEPS: BuilderStep[] = [
  {
    key: "role",
    question: "I'll build you a custom interview. Let's start simple - what role or kind of interview do you want to practice?",
    chips: ["Engineering manager", "UX researcher", "Med school admissions", "Startup founder pitch"],
  },
  {
    key: "difficulty",
    question: (draft) => `Got it - ${draft.role}. What level or context should I pitch the questions at?`,
    chips: ["Entry level", "Senior", "Career switch", "First-time manager"],
  },
  {
    key: "focus",
    question: "What should we lean on? Pick a few themes - or tell me in your own words.",
    chips: ["Leadership", "Conflict", "Strategy", "Communication", "Technical depth"],
  },
  {
    key: "length",
    question: "How long should it run - short and sharp, or a full set?",
    chips: ["6 questions · ~20 min", "8 questions · ~25 min", "10 questions · ~30 min"],
  },
];

const initialDraft: BuilderDraft = {
  role: "",
  difficulty: "",
  focus: [],
  count: 8,
  minutes: 25,
  voice: "ren",
  language: "English",
  questions: null,
};

export function BuilderScreen({
  navigate,
  startInterview,
}: {
  navigate: (route: TalkTRoute, params?: Record<string, unknown>) => void;
  startInterview: (interview: Interview) => void;
}) {
  const [thread, setThread] = React.useState<ThreadMessage[]>([
    {
      from: "ai",
      text: "I'll build you a custom interview. Let's start simple - what role or kind of interview do you want to practice?",
    },
  ]);
  const [step, setStep] = React.useState(0);
  const [draft, setDraft] = React.useState<BuilderDraft>(initialDraft);
  const [input, setInput] = React.useState("");
  const [thinking, setThinking] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread, thinking, generating]);

  const pushAI = React.useCallback((text: string, delay = 650) => {
    setThinking(true);
    window.setTimeout(() => {
      setThinking(false);
      setThread((messages) => [...messages, { from: "ai", text }]);
    }, delay);
  }, []);

  const handleSend = (value?: string) => {
    const text = (value ?? input).trim();
    if (!text || step >= STEPS.length) return;

    const current = STEPS[step];
    const nextDraft = applyStep(draft, current, text);
    const nextStep = step + 1;

    setThread((messages) => [...messages, { from: "you", text }]);
    setDraft(nextDraft);
    setInput("");
    setStep(nextStep);

    window.setTimeout(() => {
      if (nextStep < STEPS.length) {
        const next = STEPS[nextStep];
        pushAI(typeof next.question === "function" ? next.question(nextDraft) : next.question);
      } else {
        pushAI("That's everything I need. Review the plan on the right - generate the set when you're ready.", 700);
      }
    }, 50);
  };

  const generate = () => {
    setGenerating(true);
    setThread((messages) => [...messages, { from: "ai", text: "Generating a question set from your brief...", generating: true }]);

    window.setTimeout(() => {
      const questions = generateQuestions(draft);
      setDraft((current) => ({ ...current, questions }));
      setGenerating(false);
      setThread((messages) => [
        ...messages,
        {
          from: "ai",
          text: `Drafted ${questions.length} questions tuned to ${draft.role.toLowerCase()}${draft.focus.length ? `, weighted toward ${draft.focus.join(", ").toLowerCase()}` : ""}. Reorder or start when ready.`,
        },
      ]);
    }, 1900);
  };

  const startBuiltInterview = () => {
    if (!draft.questions) return;
    startInterview({
      id: `custom-${Date.now()}`,
      title: `${draft.role} (custom)`,
      subtitle: "Built with the AI builder",
      icon: "sparkles",
      category: "Custom",
      difficulty: draft.difficulty || "All levels",
      count: draft.questions.length,
      minutes: draft.minutes,
      author: "You",
      source: "Custom",
      takes: 0,
      voice: draft.voice,
      language: draft.language,
      custom: true,
      blurb: "Generated from your brief in the builder.",
      questions: draft.questions,
    });
  };

  const currentStep = STEPS[step];

  return (
    <div className="fade-up talkt-builder-layout">
      <div style={{ display: "flex", flexDirection: "column", borderRight: "1px solid var(--border)", minHeight: 0 }}>
        <div className="flex items-center gap-3" style={{ padding: "16px 28px", borderBottom: "1px solid var(--border)" }}>
          <AgentAvatar size={34} active />
          <div className="grow">
            <div style={{ fontWeight: 500, fontSize: 14 }}>AI builder</div>
            <div className="flex items-center gap-2 mono" style={{ fontSize: 11, color: "var(--success)" }}>
              <StatusDot color="var(--success)" pulse /> In session
            </div>
          </div>
          <span className="mono-label">02 · Build</span>
        </div>

        <div ref={scrollRef} className="no-scrollbar" style={{ flex: 1, overflowY: "auto", padding: 28, minHeight: 0 }}>
          <div className="flex-col gap-4" style={{ maxWidth: 620, margin: "0 auto" }}>
            {thread.map((message, index) => (
              <Bubble key={`${message.from}-${index}`} message={message} />
            ))}
            {thinking ? <TypingBubble /> : null}
          </div>
        </div>

        <div style={{ padding: "16px 28px", borderTop: "1px solid var(--border)" }}>
          <div style={{ maxWidth: 620, margin: "0 auto" }}>
            {currentStep && step < STEPS.length ? (
              <div className="flex items-center gap-2" style={{ marginBottom: 12, flexWrap: "wrap" }}>
                {currentStep.chips.map((chip) => (
                  <button key={chip} type="button" onClick={() => handleSend(chip)} className="chip card-hover" style={{ height: 30, cursor: "pointer", color: "var(--foreground)" }}>
                    {chip}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <input
                className="field"
                placeholder={step < STEPS.length ? "Type your answer..." : "The plan is ready - generate on the right"}
                value={input}
                disabled={step >= STEPS.length}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSend();
                }}
              />
              <TalkTButton variant="primary" icon="send" onClick={() => handleSend()} disabled={step >= STEPS.length || !input.trim()} style={{ paddingInline: 14 }} aria-label="Send" />
            </div>
          </div>
        </div>
      </div>

      <div className="no-scrollbar" style={{ overflowY: "auto", padding: "28px 26px", background: "var(--sidebar)" }}>
        <div className="mono-label" style={{ marginBottom: 18 }}>
          Interview draft
        </div>

        <div style={{ marginBottom: 18 }}>
          <span className="mono-label" style={{ display: "block", marginBottom: 8 }}>
            Language
          </span>
          <select
            className="field"
            value={draft.language}
            onChange={(event) => setDraft((current) => ({ ...current, language: event.target.value }))}
            style={{ appearance: "auto" }}
          >
            {LANGUAGES.map((language) => (
              <option key={language} value={language}>
                {language}
              </option>
            ))}
          </select>
          <p className="caption" style={{ marginTop: 7, fontSize: 12 }}>
            Questions, the interview, and your report use this language.
          </p>
        </div>

        <div className="card rounded-lg" style={{ padding: 18, marginBottom: 18 }}>
          <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
            <div style={{ width: 38, height: 38, display: "grid", placeItems: "center", border: "1px solid var(--border)" }}>
              <Icon name="sparkles" size={18} />
            </div>
            <div className="grow">
              <div className="h3">{draft.role || "Untitled interview"}</div>
              <div className="caption">{draft.difficulty || "Level -"}</div>
            </div>
          </div>
          <div className="flex-col" style={{ gap: 0 }}>
            <DraftRow label="Language" value={draft.language} />
            <DraftRow label="Focus" value={draft.focus.length ? draft.focus.join(" · ") : "-"} />
            <DraftRow label="Questions" value={draft.questions ? draft.questions.length : draft.count} />
            <DraftRow label="Duration" value={`~${draft.minutes} min`} />
            <DraftRow label="Interviewer" value={draft.role ? `${VOICES.find((voice) => voice.id === draft.voice)?.name ?? "-"} · assigned` : "Auto-assigned"} last />
          </div>
        </div>

        {!draft.questions ? (
          <TalkTButton variant="primary" icon="sparkles" className="btn-block" disabled={step < STEPS.length || generating} onClick={generate}>
            {generating ? "Generating..." : "Generate question set"}
          </TalkTButton>
        ) : null}
        {step < STEPS.length && !generating ? (
          <p className="caption" style={{ marginTop: 12, textAlign: "center" }}>
            Answer the builder&apos;s questions to unlock generation.
          </p>
        ) : null}

        {generating ? (
          <div className="card rounded-lg" style={{ padding: 18, marginTop: 4 }}>
            <div className="flex items-center gap-2 mono" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              <Icon name="loader" size={15} className="spin" /> Drafting questions<span className="cursor-blink" />
            </div>
          </div>
        ) : null}

        {draft.questions ? (
          <div className="fade-up">
            <SectionHeader num="03" label="Generated set" />
            <ol style={{ listStyle: "none", margin: "0 0 18px", padding: 0 }}>
              {draft.questions.map((question, index) => (
                <li key={question} className="flex gap-3" style={{ padding: "11px 0", borderBottom: "1px solid var(--border)", alignItems: "baseline" }}>
                  <span className="mono" style={{ fontSize: 11, color: "var(--dimmed)", width: 20, flexShrink: 0 }}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span style={{ fontSize: 13.5 }}>{question}</span>
                </li>
              ))}
            </ol>
            <div className="flex-col gap-2">
              <TalkTButton variant="primary" size="lg" icon="phone" className="btn-block" onClick={startBuiltInterview}>
                Start interview
              </TalkTButton>
              <div className="flex gap-2">
                <TalkTButton variant="secondary" icon="refresh" className="grow" onClick={generate}>
                  Regenerate
                </TalkTButton>
                <TalkTButton variant="ghost" className="grow" onClick={() => navigate("library")}>
                  Save & exit
                </TalkTButton>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Bubble({ message }: { message: ThreadMessage }) {
  const you = message.from === "you";
  return (
    <div className="fade-up flex" style={{ gap: 12, flexDirection: you ? "row-reverse" : "row" }}>
      {!you ? <AgentAvatar size={30} /> : null}
      <div
        style={{
          maxWidth: "78%",
          padding: "11px 14px",
          fontSize: 14,
          lineHeight: 1.55,
          border: "1px solid var(--border)",
          background: you ? "var(--foreground)" : "var(--card)",
          color: you ? "var(--background)" : "var(--foreground)",
        }}
      >
        {message.generating ? (
          <span className="flex items-center gap-2 mono" style={{ fontSize: 12 }}>
            <Icon name="loader" size={14} className="spin" />
            {message.text}
          </span>
        ) : (
          message.text
        )}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="fade-in flex" style={{ gap: 12 }}>
      <AgentAvatar size={30} />
      <div style={{ padding: "13px 16px", border: "1px solid var(--border)", background: "var(--card)", display: "flex", gap: 5, alignItems: "center" }}>
        {[0, 1, 2].map((index) => (
          <span key={index} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--dimmed)", animation: `pulse-dot 1.2s ease-in-out ${index * 180}ms infinite` }} />
        ))}
      </div>
    </div>
  );
}

function DraftRow({ label, value, last }: { label: string; value: React.ReactNode; last?: boolean }) {
  return (
    <div className="flex items-center justify-between" style={{ padding: "10px 0", borderBottom: last ? "none" : "1px solid var(--border)" }}>
      <span className="mono-label">{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, textAlign: "right", maxWidth: 200 }}>{value}</span>
    </div>
  );
}

function applyStep(draft: BuilderDraft, step: BuilderStep, value: string): BuilderDraft {
  const next = { ...draft };
  if (step.key === "role") {
    next.role = value;
    next.voice = VOICES[value.length % VOICES.length].id;
  } else if (step.key === "difficulty") {
    next.difficulty = value;
  } else if (step.key === "focus") {
    next.focus = value
      .split(/,|·/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 4);
  } else if (step.key === "length") {
    const questionMatch = value.match(/(\d+)\s*questions/i);
    const minuteMatch = value.match(/(\d+)\s*min/i);
    next.count = questionMatch ? Number(questionMatch[1]) : 8;
    next.minutes = minuteMatch ? Number(minuteMatch[1]) : 25;
  }
  return next;
}

function generateQuestions(draft: BuilderDraft) {
  const role = draft.role || "the role";
  const pools = [
    `Tell me about a time your work as ${role.toLowerCase()} didn't go to plan. What did you own?`,
    `Walk me through how you'd approach your first month as ${role.toLowerCase()}.`,
    `What does great look like in this role, and how would you measure it?`,
    `Describe a hard tradeoff you've made. What did you give up, and why?`,
    "How do you handle disagreement with someone more senior than you?",
    "Tell me about a decision you made with incomplete information.",
    "What's a skill you're deliberately working on right now?",
    "Walk me through a project end to end - your part, not the team's.",
    "How do you prioritize when everything feels urgent?",
    "What would your last team say is hardest about working with you?",
  ];
  const focused = draft.focus.map((focus) => `On ${focus.toLowerCase()}: give me a specific example where it made the difference.`);
  return [...focused, ...pools].slice(0, draft.count || 8);
}
