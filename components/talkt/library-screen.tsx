"use client";

import * as React from "react";

import { VOICES, type Interview } from "@/components/talkt/data";
import type { TalkTRoute } from "@/components/talkt/app-shell";
import { AgentAvatar, Icon, SectionHeader, TalkTButton, categoryIcon } from "@/components/talkt/primitives";

export function LibraryScreen({
  navigate,
  startInterview,
  allInterviews,
}: {
  navigate: (route: TalkTRoute, params?: Record<string, unknown>) => void;
  startInterview: (interview: Interview) => void;
  allInterviews: Interview[];
}) {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState("All");
  const categories = ["All", ...Array.from(new Set(allInterviews.map((interview) => interview.category)))];
  const filtered = allInterviews.filter(
    (interview) =>
      (category === "All" || interview.category === category) &&
      (query === "" || `${interview.title}${interview.subtitle}${interview.blurb}`.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="fade-up talkt-page">
      <div className="flex items-center justify-between talkt-mobile-stack" style={{ marginBottom: 28, gap: 16 }}>
        <div>
          <div className="mono-label" style={{ marginBottom: 8 }}>
            Interviews
          </div>
          <h1 className="h1-app">Pick an interview, or build one.</h1>
        </div>
        <TalkTButton variant="primary" icon="sparkles" onClick={() => navigate("builder")}>
          Build custom
        </TalkTButton>
      </div>

      <div className="flex items-center gap-3" style={{ marginBottom: 22, flexWrap: "wrap" }}>
        <div className="relative" style={{ flex: "1 1 240px", minWidth: 200 }}>
          <Icon name="search" size={16} className="dimmed" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input className="field" placeholder="Search by role or topic" value={query} onChange={(event) => setQuery(event.target.value)} style={{ paddingLeft: 36 }} />
        </div>
        <div className="flex items-center gap-1" style={{ flexWrap: "wrap" }}>
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className="mono"
              style={{
                height: 32,
                padding: "0 12px",
                fontSize: 12,
                cursor: "pointer",
                border: `1px solid ${category === item ? "var(--border-hover)" : "var(--border)"}`,
                background: category === item ? "var(--card)" : "transparent",
                color: category === item ? "var(--foreground)" : "var(--muted-foreground)",
                transition: "all var(--dur-fast)",
              }}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="stagger talkt-library-grid" style={{ background: "var(--border)", border: "1px solid var(--border)" }}>
        {filtered.map((interview) => (
          <TemplateCard key={interview.id} interview={interview} onOpen={() => navigate("detail", { interviewId: interview.id })} onStart={() => startInterview(interview)} />
        ))}
        {filtered.length % 2 === 1 ? <div style={{ background: "var(--background)" }} /> : null}
      </div>
      {filtered.length === 0 ? (
        <div className="caption" style={{ padding: 48, textAlign: "center" }}>
          {`No interviews match "${query}".`}
        </div>
      ) : null}
    </div>
  );
}

function TemplateCard({ interview, onOpen, onStart }: { interview: Interview; onOpen: () => void; onStart: () => void }) {
  return (
    <div className="card-hover" style={{ background: "var(--card)", padding: 22, display: "flex", flexDirection: "column", gap: 16, minHeight: 196 }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div style={{ width: 38, height: 38, display: "grid", placeItems: "center", border: "1px solid var(--border)" }}>
            <Icon name={categoryIcon(interview.category)} size={18} />
          </div>
          <div>
            <div className="mono" style={{ fontSize: 11, color: "var(--dimmed)" }}>
              {interview.category}
            </div>
            <div className="mono" style={{ fontSize: 11, color: "var(--dimmed)" }}>
              {interview.difficulty}
            </div>
          </div>
        </div>
        <span className="chip">{interview.source}</span>
      </div>
      <div className="grow">
        <button type="button" onClick={onOpen} className="h3" style={{ background: "none", border: 0, padding: 0, cursor: "pointer", color: "var(--foreground)", textAlign: "left", display: "block" }}>
          {interview.title}
        </button>
        <div className="caption" style={{ marginTop: 4 }}>
          {interview.blurb}
        </div>
      </div>
      <div className="flex items-center justify-between talkt-mobile-stack" style={{ gap: 12 }}>
        <span className="mono" style={{ fontSize: 11, color: "var(--dimmed)" }}>
          {interview.count} questions · ~{interview.minutes} min
        </span>
        <div className="flex items-center gap-2">
          <TalkTButton variant="ghost" size="sm" onClick={onOpen}>
            Details
          </TalkTButton>
          <TalkTButton variant="secondary" size="sm" icon="phone" onClick={onStart}>
            Start
          </TalkTButton>
        </div>
      </div>
    </div>
  );
}

export function InterviewDetailScreen({
  interview,
  navigate,
  startInterview,
}: {
  interview: Interview;
  navigate: (route: TalkTRoute, params?: Record<string, unknown>) => void;
  startInterview: (interview: Interview) => void;
}) {
  const [difficulty, setDifficulty] = React.useState("listed");
  const voice = VOICES.find((item) => item.id === interview.voice) ?? VOICES[0];
  const howItRuns = [
    { icon: "phone", title: "Join a voice call", desc: "A browser call opens - no phone number, no scheduling." },
    { icon: "message-square", title: `Answer ${interview.count} questions aloud`, desc: "Your interviewer asks in real time and follows up." },
    { icon: "file-text", title: "Get scored feedback", desc: "Structured scores and per-question notes within seconds." },
  ];

  return (
    <div className="fade-up talkt-page" style={{ paddingTop: 32 }}>
      <button type="button" onClick={() => navigate("library")} className="flex items-center gap-2 mono" style={{ background: "none", border: 0, cursor: "pointer", color: "var(--muted-foreground)", fontSize: 12, marginBottom: 26 }}>
        <Icon name="arrow-left" size={15} /> All interviews
      </button>

      <div className="flex items-center gap-2" style={{ marginBottom: 18, flexWrap: "wrap" }}>
        <span className="chip">{interview.category}</span>
        <span className="chip">{interview.source}</span>
        <span className="chip">{interview.difficulty}</span>
      </div>
      <h1 className="h1-app" style={{ marginBottom: 10, maxWidth: 620 }}>
        {interview.title}
      </h1>
      <p className="body-lg muted" style={{ maxWidth: 560, marginBottom: 26 }}>
        {interview.blurb}
      </p>

      <div className="flex items-center" style={{ gap: 0, marginBottom: 40, flexWrap: "wrap", border: "1px solid var(--border)" }}>
        <Meta label="Questions" value={interview.count} />
        <Meta label="Duration" value={`~${interview.minutes} min`} border />
        <Meta label="Format" value="Voice call" border />
        <Meta label="Taken" value={`${interview.takes.toLocaleString()}x`} border />
      </div>

      <div className="talkt-two-col">
        <div>
          <SectionHeader num="01" label="How it runs" />
          <div style={{ display: "grid", gap: 1, background: "var(--border)", border: "1px solid var(--border)", marginBottom: 40 }}>
            {howItRuns.map((step, index) => (
              <div key={step.title} className="flex items-center gap-4" style={{ background: "var(--card)", padding: "16px 18px" }}>
                <span className="mono" style={{ fontSize: 12, color: "var(--dimmed)", width: 16 }}>
                  {index + 1}
                </span>
                <Icon name={step.icon} size={18} className="muted" />
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{step.title}</div>
                  <div className="caption" style={{ fontSize: 12.5 }}>
                    {step.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <SectionHeader
            num="02"
            label="Question set"
            right={<span className="mono" style={{ fontSize: 11, color: "var(--dimmed)" }}>{interview.custom ? "Generated by AI builder" : "Ordered · adapts live"}</span>}
          />
          <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {interview.questions.map((question, index) => (
              <li key={question} className="flex gap-4" style={{ padding: "14px 0", borderBottom: "1px solid var(--border)", alignItems: "baseline" }}>
                <span className="mono" style={{ fontSize: 12, color: "var(--dimmed)", width: 22, flexShrink: 0 }}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="body">{question}</span>
              </li>
            ))}
          </ol>
        </div>

        <div style={{ position: "sticky", top: 80 }}>
          <div className="card rounded-lg" style={{ padding: 24 }}>
            <div className="mono-label" style={{ marginBottom: 18 }}>
              Your session
            </div>

            <div style={{ marginBottom: 22 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                <span className="caption" style={{ color: "var(--foreground)", fontWeight: 500 }}>
                  Interviewer
                </span>
                <span className="chip" style={{ height: 20, fontSize: 10 }}>
                  Assigned
                </span>
              </div>
              <div className="flex items-center gap-3" style={{ padding: 12, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
                <AgentAvatar size={40} />
                <div className="grow">
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{voice.name}</div>
                  <div className="caption" style={{ fontSize: 12 }}>
                    {voice.tone} · TalkT
                  </div>
                </div>
                <Icon name="volume" size={16} className="muted" />
              </div>
            </div>

            <div style={{ marginBottom: 22 }}>
              <span className="caption" style={{ color: "var(--foreground)", fontWeight: 500, display: "block", marginBottom: 8 }}>
                Intensity
              </span>
              <div className="flex" style={{ gap: 1, background: "var(--border)", border: "1px solid var(--border)" }}>
                {[
                  ["easier", "Easier"],
                  ["listed", "As listed"],
                  ["harder", "Harder"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDifficulty(key)}
                    className="mono"
                    style={{
                      flex: 1,
                      height: 34,
                      fontSize: 11,
                      cursor: "pointer",
                      border: 0,
                      background: difficulty === key ? "var(--surface-2)" : "var(--card)",
                      color: difficulty === key ? "var(--foreground)" : "var(--muted-foreground)",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <TalkTButton variant="primary" size="lg" icon="phone" className="btn-block" onClick={() => startInterview(interview)}>
              Start interview
            </TalkTButton>
            <p className="caption" style={{ marginTop: 12, textAlign: "center" }}>
              Opens a browser voice call. End any time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value, border }: { label: string; value: React.ReactNode; border?: boolean }) {
  return (
    <div style={{ padding: "16px 22px", borderLeft: border ? "1px solid var(--border)" : "none", flex: 1, minWidth: 120 }}>
      <div className="mono-label" style={{ marginBottom: 8 }}>
        {label}
      </div>
      <div className="stat-value" style={{ fontSize: 22 }}>
        {value}
      </div>
    </div>
  );
}
