"use client";

import * as React from "react";

import { fetchAttemptStatus } from "@/components/talkt/api";
import { DIMENSIONS, buildFeedback, type Attempt, type Feedback, type FeedbackEvidence, type Interview, type QuestionFeedback } from "@/components/talkt/data";
import type { TalkTRoute } from "@/components/talkt/app-shell";
import { Icon, ScoreBar, ScoreRing, SectionHeader, TalkTButton, scoreColorVar } from "@/components/talkt/primitives";

const ANALYSIS_STEPS = [
  "Transcript received from call",
  "Scoring four dimensions",
  "Pulling evidence from your answers",
  "Drafting strengths and improvements",
];

// Score tier shown in place of a plain "ready" badge.
function scoreAward(score: number): { label: string; color: string } {
  if (score >= 85) return { label: "Gold · outstanding", color: "var(--success)" };
  if (score >= 75) return { label: "Silver · strong", color: "var(--success)" };
  if (score >= 60) return { label: "Bronze · solid", color: "var(--warn)" };
  return { label: "Keep practicing", color: "var(--muted-foreground)" };
}

export function ResultsScreen({
  interview,
  attempt,
  attemptId,
  navigate,
  startInterview,
  instant,
}: {
  interview: Interview;
  attempt?: Attempt | null;
  // Real DB attempt id for a just-finished call; when set, feedback is polled.
  attemptId?: string;
  navigate: (route: TalkTRoute, params?: Record<string, unknown>) => void;
  startInterview: (interview: Interview) => void;
  instant?: boolean;
}) {
  // History / preview path: synchronous mock feedback (DB-backed history isn't
  // wired yet). Live path (attemptId set): poll until analysis is ready.
  if (attemptId && !instant) {
    return <LiveResults interview={interview} attemptId={attemptId} navigate={navigate} startInterview={startInterview} />;
  }
  return <MockResults interview={interview} attempt={attempt} navigate={navigate} startInterview={startInterview} instant={instant} />;
}

/** Polls the attempt status endpoint until analysis is ready, then renders feedback. */
function LiveResults({
  interview,
  attemptId,
  navigate,
  startInterview,
}: {
  interview: Interview;
  attemptId: string;
  navigate: (route: TalkTRoute, params?: Record<string, unknown>) => void;
  startInterview: (interview: Interview) => void;
}) {
  const [feedback, setFeedback] = React.useState<Feedback | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    let timer: number | undefined;
    let attempts = 0;
    // ~3 min ceiling (60 × 3s). End-of-call report + LLM analysis lands well
    // within this; if it doesn't (e.g. webhook never reached us), stop polling
    // and surface the failure instead of looping forever.
    const MAX_ATTEMPTS = 60;

    const poll = async () => {
      try {
        const status = await fetchAttemptStatus(attemptId);
        if (!active) return;
        if (status.status === "ready") {
          setFeedback({
            overall: status.overall ?? 0,
            summary: status.summary ?? "",
            dimensions: (status.dimensions ?? []).map((d) => ({ id: d.id, score: d.score, note: d.note })),
            strengths: status.strengths ?? [],
            improvements: status.improvements ?? [],
            perQuestion: status.perQuestion ?? [],
          });
          return;
        }
        if (status.status === "failed") {
          setFailed(true);
          return;
        }
      } catch {
        /* transient — keep polling */
      }
      attempts += 1;
      if (attempts >= MAX_ATTEMPTS) {
        if (active) setFailed(true);
        return;
      }
      timer = window.setTimeout(poll, 3000);
    };
    void poll();

    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [attemptId]);

  if (failed) {
    return (
      <div className="bg-grid relative" style={{ minHeight: "calc(100vh - var(--header-h))", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div className="relative text-center" style={{ maxWidth: 420 }}>
          <Icon name="trending-up" size={26} className="muted" />
          <h2 className="h2" style={{ margin: "16px 0 8px" }}>
            We couldn&apos;t score this attempt
          </h2>
          <p className="caption" style={{ marginBottom: 22 }}>
            The call was too short to analyze, or analysis failed. Try the interview again.
          </p>
          <div className="flex items-center justify-center gap-3">
            <TalkTButton variant="secondary" icon="arrow-left" onClick={() => navigate("dashboard")}>
              Back to dashboard
            </TalkTButton>
            <TalkTButton variant="primary" icon="repeat" onClick={() => startInterview(interview)}>
              Retake
            </TalkTButton>
          </div>
        </div>
      </div>
    );
  }

  if (!feedback) return <Analyzing />;
  return <FeedbackReady interview={interview} attempt={null} feedback={feedback} navigate={navigate} startInterview={startInterview} />;
}

/** Mock/preview feedback (history opens, instant preview). */
function MockResults({
  interview,
  attempt,
  navigate,
  startInterview,
  instant,
}: {
  interview: Interview;
  attempt?: Attempt | null;
  navigate: (route: TalkTRoute, params?: Record<string, unknown>) => void;
  startInterview: (interview: Interview) => void;
  instant?: boolean;
}) {
  const [state, setState] = React.useState<"analyzing" | "ready">(instant ? "ready" : "analyzing");
  const feedback = React.useMemo(() => {
    const built = buildFeedback(interview);
    return attempt ? { ...built, overall: attempt.overall } : built;
  }, [interview, attempt]);

  if (state === "analyzing") return <Analyzing onReady={() => setState("ready")} />;
  return <FeedbackReady interview={interview} attempt={attempt} feedback={feedback} navigate={navigate} startInterview={startInterview} />;
}

function Analyzing({ onReady }: { onReady?: () => void }) {
  const [done, setDone] = React.useState(0);

  React.useEffect(() => {
    if (done >= ANALYSIS_STEPS.length) {
      // Live path (no onReady): hold on the last step until feedback arrives.
      if (!onReady) return;
      const timer = window.setTimeout(onReady, 650);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => setDone((value) => value + 1), 720 + done * 120);
    return () => window.clearTimeout(timer);
  }, [done, onReady]);

  return (
    <div className="bg-grid relative" style={{ minHeight: "calc(100vh - var(--header-h))", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
      <div className="vignette" />
      <div className="relative text-center" style={{ maxWidth: 420, width: "100%" }}>
        <div className="flex items-center justify-center gap-2" style={{ marginBottom: 22 }}>
          <Icon name="loader" size={18} className="spin muted" />
          <span className="mono-label" style={{ color: "var(--foreground)" }}>
            Analyzing<span className="cursor-blink" />
          </span>
        </div>
        <h2 className="h2" style={{ marginBottom: 8 }}>
          Scoring your interview
        </h2>
        <p className="caption" style={{ marginBottom: 32 }}>
          Server-side analysis. This usually takes a few seconds.
        </p>

        <div className="card rounded-lg" style={{ padding: 6, textAlign: "left" }}>
          {ANALYSIS_STEPS.map((step, index) => (
            <div key={step} className="flex items-center gap-3" style={{ padding: "12px 14px", borderBottom: index < ANALYSIS_STEPS.length - 1 ? "1px solid var(--border)" : "none", opacity: index <= done ? 1 : 0.4, transition: "opacity var(--dur-base)" }}>
              {index < done ? (
                <Icon name="check" size={16} style={{ color: "var(--success)" }} />
              ) : index === done ? (
                <Icon name="loader" size={16} className="spin muted" />
              ) : (
                <span style={{ width: 16, height: 16, border: "1px solid var(--border)", borderRadius: "50%", display: "inline-block" }} />
              )}
              <span style={{ fontSize: 13.5, color: index <= done ? "var(--foreground)" : "var(--muted-foreground)" }}>{step}</span>
            </div>
          ))}
        </div>
        <p className="mono" style={{ marginTop: 18, fontSize: 11, color: "var(--dimmed)" }}>
          Robust parsing · retries on partial responses
        </p>
      </div>
    </div>
  );
}

function FeedbackReady({
  interview,
  attempt,
  feedback,
  navigate,
  startInterview,
}: {
  interview: Interview;
  attempt?: Attempt | null;
  feedback: Feedback;
  navigate: (route: TalkTRoute, params?: Record<string, unknown>) => void;
  startInterview: (interview: Interview) => void;
}) {
  const date = attempt ? `${attempt.date} · ${attempt.time}` : "2026-06-02 · 14:58";
  const minutes = attempt ? attempt.minutes : interview.minutes;
  const award = scoreAward(feedback.overall);

  return (
    <div className="fade-up talkt-page" style={{ paddingTop: 40 }}>
      <div className="flex items-center justify-between talkt-mobile-stack" style={{ marginBottom: 30, gap: 16 }}>
        <div>
          <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
            <span className="flex items-center gap-2 mono-label" style={{ color: award.color }}>
              <Icon name="award" size={14} /> {award.label}
            </span>
          </div>
          <h1 className="h1-app" style={{ marginBottom: 8 }}>
            {interview.title}
          </h1>
          <div className="mono" style={{ fontSize: 12, color: "var(--dimmed)" }}>
            {date} · {minutes} min interview · {interview.count} questions
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TalkTButton variant="secondary" icon="file-text">
            Export
          </TalkTButton>
          <TalkTButton variant="primary" icon="repeat" onClick={() => startInterview(interview)}>
            Retake
          </TalkTButton>
        </div>
      </div>

      <div className="card rounded-lg talkt-results-overall" style={{ padding: 32, gap: 40, alignItems: "center", marginBottom: 14 }}>
        <div className="text-center">
          <ScoreRing value={feedback.overall} size={140} label="Overall" />
          <div className="mono" style={{ marginTop: 14, fontSize: 11, color: "var(--dimmed)" }}>
            out of 100
          </div>
        </div>
        <div>
          <div className="mono-label" style={{ marginBottom: 12 }}>
            Summary
          </div>
          <p className="body-lg" style={{ margin: 0, color: "var(--foreground)" }}>
            {feedback.summary}
          </p>
        </div>
      </div>

      <SectionHeader num="01" label="Dimension scores" />
      <div className="talkt-results-dimensions" style={{ background: "var(--border)", border: "1px solid var(--border)", marginBottom: 40 }}>
        {feedback.dimensions.map((dimension) => {
          const meta = DIMENSIONS.find((item) => item.id === dimension.id);
          const custom = interview.dimensions?.find((d) => d.key === dimension.id);
          const label = meta?.label ?? custom?.label ?? dimension.id;
          return (
            <div key={dimension.id} style={{ background: "var(--card)", padding: 22 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                <div>
                  <div className="h3">{label}</div>
                  <div className="caption" style={{ fontSize: 12 }}>
                    {meta?.blurb ?? dimension.note ?? ""}
                  </div>
                </div>
                <span className="stat-value" style={{ fontSize: 30, color: scoreColorVar(dimension.score) }}>
                  {dimension.score}
                </span>
              </div>
              <ScoreBar value={dimension.score} />
              <p className="caption" style={{ marginTop: 12, marginBottom: 0 }}>
                {dimension.note}
              </p>
            </div>
          );
        })}
      </div>

      <SectionHeader num="02" label="What stood out" />
      <div className="talkt-results-evidence" style={{ marginBottom: 40 }}>
        <EvidenceList title="Strengths" icon="thumbs-up" color="var(--success)" items={feedback.strengths} showEvidence={false} />
        <EvidenceList title="Improvements" icon="trending-up" color="var(--warn)" items={feedback.improvements} showEvidence={false} />
      </div>

      <SectionHeader num="03" label="Per-question analysis" right={<span className="mono" style={{ fontSize: 11, color: "var(--dimmed)" }}>{feedback.perQuestion.length} questions</span>} />
      <div style={{ border: "1px solid var(--border)" }}>
        {feedback.perQuestion.map((question, index) => (
          <QuestionAnalysis key={`${question.q}-${index}`} question={question} index={index} last={index === feedback.perQuestion.length - 1} />
        ))}
      </div>

      <div className="flex items-center justify-center gap-3" style={{ marginTop: 40, flexWrap: "wrap" }}>
        <TalkTButton variant="secondary" icon="arrow-left" onClick={() => navigate("dashboard")}>
          Back to dashboard
        </TalkTButton>
        <TalkTButton variant="primary" icon="repeat" onClick={() => startInterview(interview)}>
          Retake interview
        </TalkTButton>
      </div>
    </div>
  );
}

function EvidenceList({ title, icon, color, items, showEvidence = true }: { title: string; icon: string; color: string; items: FeedbackEvidence[]; showEvidence?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
        <Icon name={icon} size={16} style={{ color }} />
        <span className="h3">{title}</span>
      </div>
      <div className="flex-col">
        {items.map((item, index) => (
          <div key={item.text} style={{ padding: "16px 0", borderBottom: index < items.length - 1 ? "1px solid var(--border)" : "none" }}>
            <div className="flex gap-3" style={{ alignItems: "baseline" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0, marginTop: 7 }} />
              <div>
                <p className="body" style={{ margin: 0, color: "var(--foreground)" }}>
                  {item.text}
                </p>
                {showEvidence ? (
                  <p className="mono" style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted-foreground)", paddingLeft: 12, borderLeft: "2px solid var(--border)", lineHeight: 1.5 }}>
                    {item.evidence}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuestionAnalysis({ question, index, last }: { question: QuestionFeedback; index: number; last: boolean }) {
  const [open, setOpen] = React.useState(index === 0);

  return (
    <div style={{ borderBottom: last ? "none" : "1px solid var(--border)" }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          width: "100%",
          padding: "18px 22px",
          background: open ? "var(--card)" : "transparent",
          border: 0,
          cursor: "pointer",
          textAlign: "left",
          color: "inherit",
          transition: "background var(--dur-fast)",
        }}
      >
        <span className="mono" style={{ fontSize: 12, color: "var(--dimmed)", width: 22, flexShrink: 0 }}>
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="grow body" style={{ color: "var(--foreground)", fontWeight: 500 }}>
          {question.q}
        </span>
        <span className="stat-value" style={{ fontSize: 20, color: scoreColorVar(question.rating) }}>
          {question.rating}
        </span>
        <Icon name="chevron-down" size={17} className="muted" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform var(--dur-fast)" }} />
      </button>
      {open ? (
        <div className="fade-in" style={{ padding: "4px 22px 22px 60px" }}>
          <div style={{ marginBottom: 18 }}>
            <div className="mono-label" style={{ marginBottom: 8 }}>
              Critique
            </div>
            <p className="body" style={{ margin: 0, color: "var(--foreground)" }}>
              {question.critique}
            </p>
          </div>
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", padding: 16 }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
              <Icon name="sparkles" size={14} className="muted" />
              <span className="mono-label">Suggested answer</span>
            </div>
            <p className="body" style={{ margin: 0, color: "var(--muted-foreground)" }}>
              {question.model}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
