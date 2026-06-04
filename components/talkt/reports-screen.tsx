"use client";

import * as React from "react";

import type { Attempt, Interview } from "@/components/talkt/data";
import { Icon, SectionHeader, TalkTButton, categoryIcon, scoreColorVar } from "@/components/talkt/primitives";
import { ReportsListSkeleton } from "@/components/talkt/skeletons";
import type { TalkTRoute } from "@/components/talkt/app-shell";

// Every interview a user has run, as openable feedback reports.
export function ReportsScreen({
  navigate,
  startInterview,
  attempts,
  allInterviews,
  loading,
}: {
  navigate: (route: TalkTRoute, params?: Record<string, unknown>) => void;
  startInterview: (interview: Interview) => void;
  attempts: Attempt[];
  allInterviews: Interview[];
  loading: boolean;
}) {
  const byId = React.useMemo(() => Object.fromEntries(allInterviews.map((interview) => [interview.id, interview])), [allInterviews]);

  return (
    <div className="fade-up talkt-page">
      <div style={{ marginBottom: 26 }}>
        <h1 className="h1-app" style={{ marginBottom: 6 }}>
          Reports
        </h1>
        <p className="caption" style={{ margin: 0 }}>
          Every interview you&apos;ve practiced, with scored feedback.
        </p>
      </div>

      {loading ? (
        <ReportsListSkeleton rows={5} />
      ) : attempts.length ? (
        <>
          <SectionHeader num="01" label="All reports" right={<span className="mono" style={{ fontSize: 11, color: "var(--dimmed)" }}>{attempts.length} reports</span>} />
          <div style={{ borderTop: "1px solid var(--border)" }}>
            {attempts.map((attempt) => (
              <ReportRow
                key={attempt.id}
                attempt={attempt}
                interview={byId[attempt.interviewId]}
                onOpen={() => navigate("results", { attemptId: attempt.id, interviewId: attempt.interviewId, fromHistory: true })}
                onRetake={() => {
                  const interview = byId[attempt.interviewId];
                  if (interview) startInterview(interview);
                }}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="card rounded-lg" style={{ padding: 40, textAlign: "center" }}>
          <Icon name="file-text" size={24} className="muted" style={{ margin: "0 auto 12px" }} />
          <div className="h3" style={{ marginBottom: 6 }}>
            No reports yet
          </div>
          <p className="caption" style={{ maxWidth: 360, margin: "0 auto 18px" }}>
            Finish an interview and your scored feedback shows up here.
          </p>
          <TalkTButton variant="primary" icon="phone" onClick={() => navigate("library")}>
            Browse templates
          </TalkTButton>
        </div>
      )}
    </div>
  );
}

function ReportRow({ attempt, interview, onOpen, onRetake }: { attempt: Attempt; interview?: Interview; onOpen: () => void; onRetake: () => void }) {
  return (
    <div className="row" style={{ cursor: "pointer", borderBottom: "1px solid var(--border)" }} onClick={onOpen}>
      <div style={{ width: 36, height: 36, display: "grid", placeItems: "center", border: "1px solid var(--border)", flexShrink: 0 }}>
        <Icon name={interview ? categoryIcon(interview.category) : "file-text"} size={16} />
      </div>
      <div className="grow" style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 500 }}>{attempt.title}</div>
        <div className="mono" style={{ fontSize: 12, color: "var(--dimmed)", marginTop: 2 }}>
          {attempt.date} · {attempt.time} · {attempt.minutes} min
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="stat-value" style={{ fontSize: 22, color: scoreColorVar(attempt.overall) }}>
          {attempt.overall}
        </span>
        <button
          className="icon-btn"
          style={{ width: 34, height: 34 }}
          aria-label="Retake"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRetake();
          }}
        >
          <Icon name="repeat" size={15} />
        </button>
        <Icon name="chevron-right" size={17} className="muted" />
      </div>
    </div>
  );
}
