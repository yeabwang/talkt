"use client";

import * as React from "react";
import { useRealtimeRun } from "@trigger.dev/react-hooks";

import { fetchAttemptStatus, gradeAttempt, type AttemptStatus, type CallTurn } from "@/components/talkt/api";
import { DIMENSIONS, type Attempt, type Feedback, type FeedbackEvidence, type Interview, type QuestionFeedback } from "@/components/talkt/data";
import type { TalkTRoute } from "@/components/talkt/app-shell";
import { Icon, ScoreBar, ScoreRing, SectionHeader, TalkTButton, scoreColorVar } from "@/components/talkt/primitives";
import type { GradeStep, gradeAttempt as gradeAttemptTask } from "@/trigger/grade-attempt";

// Score tier shown in place of a plain "ready" badge.
function scoreAward(score: number): { label: string; color: string } {
  if (score >= 85) return { label: "Gold · outstanding", color: "var(--success)" };
  if (score >= 75) return { label: "Silver · strong", color: "var(--success)" };
  if (score >= 60) return { label: "Bronze · solid", color: "var(--warn)" };
  return { label: "Keep practicing", color: "var(--muted-foreground)" };
}

// Map the API's ready status payload to the UI Feedback shape.
function toFeedback(status: AttemptStatus): Feedback {
  return {
    overall: status.overall ?? 0,
    summary: status.summary ?? "",
    dimensions: (status.dimensions ?? []).map((d) => ({ id: d.id, score: d.score, note: d.note })),
    strengths: status.strengths ?? [],
    improvements: status.improvements ?? [],
    perQuestion: status.perQuestion ?? [],
  };
}

export function ResultsScreen({
  interview,
  attemptId,
  transcript,
  navigate,
  startInterview,
}: {
  interview: Interview;
  // Real DB attempt id.
  attemptId?: string;
  // Present only for a just-finished call: the captured transcript. When set, we
  // trigger grading and stream progress via Realtime. When absent (a report
  // opened from history), we just read the stored status.
  transcript?: CallTurn[];
  navigate: (route: TalkTRoute, params?: Record<string, unknown>) => void;
  startInterview: (interview: Interview) => void;
}) {
  if (attemptId && transcript) {
    return <GradedResults interview={interview} attemptId={attemptId} transcript={transcript} navigate={navigate} startInterview={startInterview} />;
  }
  if (attemptId) {
    return <LiveResults interview={interview} attemptId={attemptId} navigate={navigate} startInterview={startInterview} />;
  }
  // No attempt to show (stale/direct nav) — there is no mock report to render.
  return <ScoringFailed interview={interview} navigate={navigate} startInterview={startInterview} />;
}

/**
 * Fresh-call path: trigger grading once with the captured transcript, then stream
 * progress from the durable run via Realtime. The run is durable — the user can
 * leave and the report still appears in Reports — so this screen is just a live
 * view of work already guaranteed to finish.
 */
function GradedResults({
  interview,
  attemptId,
  transcript,
  navigate,
  startInterview,
}: {
  interview: Interview;
  attemptId: string;
  transcript: CallTurn[];
  navigate: (route: TalkTRoute, params?: Record<string, unknown>) => void;
  startInterview: (interview: Interview) => void;
}) {
  const [handle, setHandle] = React.useState<{ runId: string; publicAccessToken: string } | null>(null);
  const [terminal, setTerminal] = React.useState<"abandoned" | "failed" | "ready" | "poll" | null>(null);
  const triggeredRef = React.useRef(false);

  React.useEffect(() => {
    if (triggeredRef.current) return;
    triggeredRef.current = true;
    let active = true;
    void (async () => {
      try {
        const result = await gradeAttempt(attemptId, transcript);
        if (!active) return;
        if (result.status === "grading") setHandle({ runId: result.runId, publicAccessToken: result.publicAccessToken });
        else if (result.status === "analyzing") setTerminal("poll"); // trigger unavailable — fall back to polling
        else setTerminal(result.status);
      } catch {
        if (active) setTerminal("poll"); // network hiccup — let the poller take over
      }
    })();
    return () => {
      active = false;
    };
  }, [attemptId, transcript]);

  if (terminal === "abandoned" || terminal === "failed") return <ScoringFailed interview={interview} navigate={navigate} startInterview={startInterview} />;
  if (terminal === "ready" || terminal === "poll") return <LiveResults interview={interview} attemptId={attemptId} navigate={navigate} startInterview={startInterview} />;
  if (handle) return <RealtimeGrade interview={interview} attemptId={attemptId} handle={handle} navigate={navigate} startInterview={startInterview} />;
  return <GradingScreen interview={interview} step="received" navigate={navigate} />;
}

const GRADE_STEPS: { key: GradeStep; label: string }[] = [
  { key: "received", label: "Transcript received" },
  { key: "scoring", label: "Scoring your answers" },
  { key: "saving", label: "Saving your report" },
  { key: "done", label: "Report ready" },
];

/** Subscribes to the durable grade run and drives the step checklist from its
 * streamed metadata. On completion, loads the stored feedback and renders it. */
function RealtimeGrade({
  interview,
  attemptId,
  handle,
  navigate,
  startInterview,
}: {
  interview: Interview;
  attemptId: string;
  handle: { runId: string; publicAccessToken: string };
  navigate: (route: TalkTRoute, params?: Record<string, unknown>) => void;
  startInterview: (interview: Interview) => void;
}) {
  const [feedback, setFeedback] = React.useState<Feedback | null>(null);
  const [failed, setFailed] = React.useState(false);
  const { run, error } = useRealtimeRun<typeof gradeAttemptTask>(handle.runId, {
    accessToken: handle.publicAccessToken,
  });

  const step = (run?.metadata?.step as GradeStep | undefined) ?? "received";
  const status = run?.status;

  React.useEffect(() => {
    if (status !== "COMPLETED") return;
    let active = true;
    void (async () => {
      try {
        const result = await fetchAttemptStatus(attemptId);
        if (!active) return;
        if (result.status === "ready") setFeedback(toFeedback(result));
        else setFailed(true);
      } catch {
        if (active) setFailed(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [status, attemptId]);

  const runFailed = error != null || (status != null && ["FAILED", "CRASHED", "CANCELED", "SYSTEM_FAILURE", "TIMED_OUT", "INTERRUPTED"].includes(status));

  if (failed || runFailed) return <ScoringFailed interview={interview} navigate={navigate} startInterview={startInterview} />;
  if (feedback) return <FeedbackReady interview={interview} attempt={null} feedback={feedback} navigate={navigate} startInterview={startInterview} />;
  return <GradingScreen interview={interview} step={step} navigate={navigate} />;
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
  const [attemptStatus, setAttemptStatus] = React.useState<AttemptStatus["status"]>("in_progress");

  React.useEffect(() => {
    let active = true;
    let timer: number | undefined;
    let attempts = 0;
    // ~3 min ceiling (60 × 3s). The worker's session-ended callback + LLM analysis
    // lands well within this; if it doesn't (e.g. the callback never reached us),
    // stop polling and surface the failure instead of looping forever.
    const MAX_ATTEMPTS = 60;

    const poll = async () => {
      try {
        const status = await fetchAttemptStatus(attemptId);
        if (!active) return;
        setAttemptStatus(status.status);
        if (status.status === "ready") {
          setFeedback(toFeedback(status));
          return;
        }
        if (status.status === "failed" || status.status === "abandoned") {
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

  if (failed) return <ScoringFailed interview={interview} navigate={navigate} startInterview={startInterview} />;
  if (!feedback) return <GradingScreen interview={interview} step={attemptStatus === "analyzing" ? "scoring" : "received"} navigate={navigate} />;
  return <FeedbackReady interview={interview} attempt={null} feedback={feedback} navigate={navigate} startInterview={startInterview} />;
}

/** Live grading view: a step checklist driven by the run's progress. The work is
 * durable, so the user is told they can leave and find the report in Reports. */
function GradingScreen({
  interview,
  step,
  navigate,
}: {
  interview: Interview;
  step: GradeStep;
  navigate: (route: TalkTRoute, params?: Record<string, unknown>) => void;
}) {
  const currentIndex = GRADE_STEPS.findIndex((s) => s.key === step);
  return (
    <div className="bg-grid relative" style={{ minHeight: "calc(100vh - var(--header-h))", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
      <div className="relative fade-in" style={{ maxWidth: 420, width: "100%" }}>
        <div className="text-center" style={{ marginBottom: 28 }}>
          <h2 className="h2" style={{ margin: "0 0 6px" }}>
            Grading your interview
          </h2>
          <p className="caption" style={{ margin: 0 }}>
            {interview.title}
          </p>
        </div>

        <div className="card rounded-lg" style={{ padding: 8 }}>
          {GRADE_STEPS.map((s, index) => {
            const done = index < currentIndex;
            const active = index === currentIndex;
            return (
              <div key={s.key} className="flex items-center gap-3" style={{ padding: "12px 14px" }}>
                <span
                  style={{
                    width: 22,
                    height: 22,
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    border: `1px solid ${done || active ? "var(--foreground)" : "var(--border)"}`,
                    borderRadius: "50%",
                    color: done ? "var(--background)" : "var(--foreground)",
                    background: done ? "var(--foreground)" : "transparent",
                  }}
                >
                  {done ? <Icon name="check" size={12} /> : active ? <Icon name="loader" size={12} className="spin" /> : null}
                </span>
                <span
                  className={active || done ? "body" : "caption"}
                  style={{ color: active || done ? "var(--foreground)" : "var(--dimmed)", fontWeight: active ? 500 : 400 }}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        <p className="caption" style={{ textAlign: "center", margin: "18px 0 16px" }}>
          You can leave this page — we&apos;ll have your report waiting in Reports.
        </p>
        <div className="flex items-center justify-center">
          <TalkTButton variant="secondary" icon="arrow-left" onClick={() => navigate("dashboard")}>
            Back to dashboard
          </TalkTButton>
        </div>
      </div>
    </div>
  );
}

/** Shared "couldn't score this attempt" terminal state. */
function ScoringFailed({
  interview,
  navigate,
  startInterview,
}: {
  interview: Interview;
  navigate: (route: TalkTRoute, params?: Record<string, unknown>) => void;
  startInterview: (interview: Interview) => void;
}) {
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
