"use client";

import * as React from "react";

import type { AppUser, Attempt, Interview } from "@/components/talkt/data";
import { Icon, SectionHeader, TalkTButton, categoryIcon, scoreColorVar } from "@/components/talkt/primitives";
import { CardGridSkeleton, HeroSkeleton } from "@/components/talkt/skeletons";
import type { TalkTRoute } from "@/components/talkt/app-shell";

export function DashboardScreen({
  user,
  navigate,
  startInterview,
  attempts,
  allInterviews,
  loading,
}: {
  user: AppUser;
  navigate: (route: TalkTRoute, params?: Record<string, unknown>) => void;
  startInterview: (interview: Interview) => void;
  attempts: Attempt[];
  allInterviews: Interview[];
  loading: boolean;
}) {
  const byId = React.useMemo(() => Object.fromEntries(allInterviews.map((interview) => [interview.id, interview])), [allInterviews]);
  const firstName = user.name.split(" ")[0] ?? user.name;
  const last = attempts[0];
  const lastInterview = last ? byId[last.interviewId] : undefined;
  const avg = attempts.length ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.overall, 0) / attempts.length) : 0;
  const trend = [...attempts].reverse().map((attempt) => attempt.overall);
  const rising = trend[trend.length - 1] >= trend[0];
  const recommend = byId.consult ?? allInterviews.find((interview) => interview.category === "Business");

  if (loading) {
    return (
      <div className="fade-up talkt-page">
        <div style={{ marginBottom: 26 }}>
          <span className="caption">Welcome back, {firstName}</span>
        </div>
        <div style={{ marginBottom: 44 }}>
          <HeroSkeleton />
        </div>
        <CardGridSkeleton count={3} />
      </div>
    );
  }

  return (
    <div className="fade-up talkt-page">
      <div className="flex items-center talkt-mobile-stack" style={{ marginBottom: 26, gap: 16 }}>
        <span className="caption">Welcome back, {firstName}</span>
      </div>

      <div className="card rounded-lg talkt-dashboard-hero" style={{ overflow: "hidden", marginBottom: 44 }}>
        <div className="relative" style={{ padding: 30, display: "flex", flexDirection: "column", minHeight: 248 }}>
          <Icon
            name={lastInterview ? categoryIcon(lastInterview.category) : "phone"}
            size={150}
            style={{ position: "absolute", right: -24, top: -18, color: "var(--foreground)", opacity: 0.035, pointerEvents: "none" }}
          />
          <div className="relative grow">
            <div className="mono-label" style={{ marginBottom: 16 }}>
              Resume · last practiced {last ? last.date : "-"}
            </div>
            <h1 className="h1-app" style={{ marginBottom: 8, maxWidth: 360 }}>
              {lastInterview ? lastInterview.title : "Start your first interview"}
            </h1>
            <p className="caption" style={{ maxWidth: 340 }}>
              {lastInterview ? lastInterview.subtitle : "Pick a template or build your own to begin."}
            </p>
          </div>
          <div className="relative flex items-center justify-between talkt-mobile-stack" style={{ marginTop: 28, gap: 16 }}>
            {last ? (
              <div className="flex items-baseline gap-2">
                <span className="stat-value" style={{ fontSize: 40, color: scoreColorVar(last.overall) }}>
                  {last.overall}
                </span>
                <span className="mono" style={{ fontSize: 11, color: "var(--dimmed)" }}>
                  /100 last
                </span>
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              {last ? (
                <TalkTButton variant="ghost" size="sm" onClick={() => navigate("results", { attemptId: last.id, interviewId: last.interviewId, fromHistory: true })}>
                  Feedback
                </TalkTButton>
              ) : null}
              <TalkTButton variant="primary" icon="phone" onClick={() => (lastInterview ? startInterview(lastInterview) : navigate("library"))}>
                {lastInterview ? "Start again" : "Browse"}
              </TalkTButton>
            </div>
          </div>
        </div>

        <div style={{ padding: 30, borderLeft: "1px solid var(--border)", background: "var(--surface-2)", display: "flex", flexDirection: "column" }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
            <span className="mono-label">Coach&apos;s note</span>
            {trend.length ? <Sparkline data={trend} /> : null}
          </div>
          {attempts.length ? (
            <p className="body" style={{ margin: 0, color: "var(--foreground)" }}>
              You&apos;re averaging <strong style={{ fontWeight: 600 }}>{avg}</strong> across {attempts.length} sessions and {rising ? "trending up" : "holding steady"}.
            </p>
          ) : (
            <p className="body" style={{ margin: 0, color: "var(--muted-foreground)" }}>
              Finish your first interview and your scores, trend, and a coaching note land here.
            </p>
          )}
          <div className="grow" />
          {recommend ? (
            <button
              type="button"
              onClick={() => navigate("detail", { interviewId: recommend.id })}
              className="card-hover flex items-center gap-3"
              style={{ marginTop: 22, padding: "12px 14px", border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", textAlign: "left", color: "inherit" }}
            >
              <Icon name={categoryIcon(recommend.category)} size={18} className="muted" />
              <div className="grow">
                <div className="mono-label" style={{ marginBottom: 2 }}>
                  Build depth
                </div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{recommend.title}</div>
              </div>
              <Icon name="arrow-right" size={16} className="muted" />
            </button>
          ) : null}
        </div>
      </div>

      <SectionHeader num="01" label="Start something new" />
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 1, background: "var(--border)", border: "1px solid var(--border)", marginBottom: 44 }}>
        <NewAction
          icon="sparkles"
          title="Build a custom interview"
          desc="Talk through your role and goals with the AI builder - it drafts a tailored question set live."
          cta="Build with AI"
          onClick={() => navigate("builder")}
          primary
        />
        <NewAction
          icon="grid"
          title="Browse the library"
          desc="40+ curated and community interviews across engineering, product, healthcare, sales and more."
          cta="Browse templates"
          onClick={() => navigate("library")}
        />
      </div>

      <SectionHeader num="02" label="All sessions" right={<span className="mono" style={{ fontSize: 11, color: "var(--dimmed)" }}>{attempts.length} attempts</span>} />
      {attempts.length ? (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          {attempts.map((attempt) => (
            <AttemptRow
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
      ) : (
        <div className="card rounded-lg" style={{ padding: 32, textAlign: "center", borderTop: "1px solid var(--border)" }}>
          <Icon name="phone" size={22} className="muted" style={{ margin: "0 auto 10px" }} />
          <p className="caption" style={{ margin: 0 }}>
            No sessions yet. Start an interview to see it here.
          </p>
        </div>
      )}
    </div>
  );
}

function NewAction({ icon, title, desc, cta, onClick, primary }: { icon: string; title: string; desc: string; cta: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card-hover"
      style={{
        background: primary ? "var(--surface-2)" : "var(--card)",
        padding: 28,
        cursor: "pointer",
        textAlign: "left",
        color: "inherit",
        border: 0,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        minHeight: 190,
      }}
    >
      <div style={{ width: 42, height: 42, display: "grid", placeItems: "center", border: "1px solid var(--border)" }}>
        <Icon name={icon} size={20} />
      </div>
      <div className="grow">
        <div className="h3" style={{ marginBottom: 6 }}>
          {title}
        </div>
        <div className="caption" style={{ maxWidth: 340 }}>
          {desc}
        </div>
      </div>
      <span className="flex items-center gap-2 mono" style={{ fontSize: 12, color: "var(--foreground)" }}>
        {cta} <Icon name="arrow-right" size={15} />
      </span>
    </button>
  );
}

function Sparkline({ data, width = 72, height = 26 }: { data: number[]; width?: number; height?: number }) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((value, index) => {
    // Single-point data has no span; pin x to the right edge instead of dividing by zero (NaN).
    const x = data.length > 1 ? (index / (data.length - 1)) * width : width;
    const y = height - ((value - min) / range) * (height - 4) - 2;
    return [x, y] as const;
  });
  const path = points.map((point, index) => `${index ? "L" : "M"}${point[0].toFixed(1)} ${point[1].toFixed(1)}`).join(" ");
  const lastPoint = points[points.length - 1];

  return (
    <svg width={width} height={height} style={{ overflow: "visible" }} aria-hidden="true">
      <path d={path} fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastPoint[0]} cy={lastPoint[1]} r="2.5" fill={scoreColorVar(data[data.length - 1])} />
    </svg>
  );
}

function AttemptRow({ attempt, interview, onOpen, onRetake }: { attempt: Attempt; interview?: Interview; onOpen: () => void; onRetake: () => void }) {
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
