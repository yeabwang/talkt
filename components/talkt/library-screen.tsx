"use client";

import * as React from "react";

import { VOICES, interviewLanguage, type Interview } from "@/components/talkt/data";
import type { TalkTRoute } from "@/components/talkt/app-shell";
import { AgentAvatar, Icon, SectionHeader, TalkTButton, categoryIcon } from "@/components/talkt/primitives";

interface LibraryFilters {
  topic: string;
  language: string;
  length: string;
  difficulty: string;
  source: string;
}

const EMPTY_FILTERS: LibraryFilters = { topic: "All", language: "All", length: "All", difficulty: "All", source: "All" };
const LENGTH_OPTIONS = ["All", "Short", "Medium", "Long"];

function lengthBucket(minutes: number) {
  if (minutes <= 20) return "Short";
  if (minutes <= 27) return "Medium";
  return "Long";
}

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
  const [filters, setFilters] = React.useState<LibraryFilters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = React.useState(false);

  const options = React.useMemo(
    () => ({
      topic: ["All", ...Array.from(new Set(allInterviews.map((interview) => interview.category)))],
      language: ["All", ...Array.from(new Set(allInterviews.map(interviewLanguage)))],
      difficulty: ["All", ...Array.from(new Set(allInterviews.map((interview) => interview.difficulty)))],
      source: ["All", ...Array.from(new Set(allInterviews.map((interview) => interview.source)))],
      length: LENGTH_OPTIONS,
    }),
    [allInterviews]
  );

  const activeCount = Object.values(filters).filter((value) => value !== "All").length;

  const filtered = allInterviews.filter((interview) => {
    if (filters.topic !== "All" && interview.category !== filters.topic) return false;
    if (filters.language !== "All" && interviewLanguage(interview) !== filters.language) return false;
    if (filters.difficulty !== "All" && interview.difficulty !== filters.difficulty) return false;
    if (filters.source !== "All" && interview.source !== filters.source) return false;
    if (filters.length !== "All" && lengthBucket(interview.minutes) !== filters.length) return false;
    if (query !== "" && !`${interview.title}${interview.subtitle}${interview.blurb}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="fade-up talkt-page">
      <div style={{ marginBottom: 28 }}>
        <div className="mono-label" style={{ marginBottom: 8 }}>
          Interviews
        </div>
        <h1 className="h1-app">Pick an interview, or build one.</h1>
      </div>

      <div className="flex items-center gap-2" style={{ marginBottom: 22 }}>
        <div className="relative" style={{ flex: 1, minWidth: 0 }}>
          <Icon name="search" size={16} className="dimmed" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input className="field" placeholder="Search by role or topic" value={query} onChange={(event) => setQuery(event.target.value)} style={{ paddingLeft: 36 }} />
        </div>
        <button
          type="button"
          onClick={() => setFilterOpen((open) => !open)}
          className="btn btn-secondary"
          style={{ position: "relative", gap: 8, background: filterOpen ? "var(--card)" : undefined, borderColor: filterOpen ? "var(--border-hover)" : undefined }}
          aria-expanded={filterOpen}
        >
          <Icon name="filter" size={16} />
          Filter
          {activeCount ? (
            <span className="mono" style={{ minWidth: 18, height: 18, padding: "0 5px", display: "inline-grid", placeItems: "center", fontSize: 10, background: "var(--foreground)", color: "var(--background)" }}>
              {activeCount}
            </span>
          ) : null}
        </button>
      </div>

      {activeCount ? (
        <div className="flex items-center gap-2" style={{ marginBottom: 18, flexWrap: "wrap" }}>
          {Object.entries(filters)
            .filter(([, value]) => value !== "All")
            .map(([key, value]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilters((current) => ({ ...current, [key]: "All" }))}
                className="chip card-hover"
                style={{ cursor: "pointer", color: "var(--foreground)", gap: 6 }}
              >
                {value}
                <Icon name="x" size={12} />
              </button>
            ))}
          <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="mono" style={{ background: "none", border: 0, cursor: "pointer", fontSize: 11, color: "var(--muted-foreground)" }}>
            Clear all
          </button>
        </div>
      ) : null}

      <div className="stagger talkt-library-grid" style={{ background: "var(--border)", border: "1px solid var(--border)" }}>
        {filtered.map((interview) => (
          <TemplateCard key={interview.id} interview={interview} onOpen={() => navigate("detail", { interviewId: interview.id })} onStart={() => startInterview(interview)} />
        ))}
        {filtered.length % 2 === 1 ? <div style={{ background: "var(--background)" }} /> : null}
      </div>
      {filtered.length === 0 ? (
        <div className="caption" style={{ padding: 48, textAlign: "center" }}>
          No interviews match your filters.
        </div>
      ) : null}

      {filterOpen ? (
        <FilterPanel
          filters={filters}
          options={options}
          onChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
          onClear={() => setFilters(EMPTY_FILTERS)}
          onClose={() => setFilterOpen(false)}
        />
      ) : null}
    </div>
  );
}

function FilterPanel({
  filters,
  options,
  onChange,
  onClear,
  onClose,
}: {
  filters: LibraryFilters;
  options: Record<keyof LibraryFilters, string[]>;
  onChange: (key: keyof LibraryFilters, value: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const groups: { key: keyof LibraryFilters; label: string }[] = [
    { key: "topic", label: "Topic" },
    { key: "language", label: "Language" },
    { key: "length", label: "Length" },
    { key: "difficulty", label: "Difficulty" },
    { key: "source", label: "Source" },
  ];

  return (
    <aside className="fade-in talkt-filter-panel">
      <div className="flex items-center justify-between" style={{ padding: "0 6px 14px" }}>
        <span className="mono-label">Filters</span>
        <button type="button" onClick={onClose} className="icon-btn" style={{ width: 30, height: 30, border: 0 }} aria-label="Close filters">
          <Icon name="x" size={15} />
        </button>
      </div>

      <nav className="no-scrollbar flex-col" style={{ flex: 1, overflowY: "auto", gap: 1 }}>
        {groups.map((group) => (
          <React.Fragment key={group.key}>
            <div className="tt-nav-label">
              <span className="mono-label">{group.label}</span>
            </div>
            {options[group.key].map((value) => (
              <button
                key={value}
                type="button"
                className="tt-nav-item"
                data-active={filters[group.key] === value}
                onClick={() => onChange(group.key, value)}
              >
                <span className="tt-nav-text">{value}</span>
              </button>
            ))}
          </React.Fragment>
        ))}
      </nav>

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 12 }}>
        <TalkTButton variant="secondary" size="sm" className="btn-block" onClick={onClear}>
          Clear all
        </TalkTButton>
      </div>
    </aside>
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
            right={interview.custom ? <span className="mono" style={{ fontSize: 11, color: "var(--dimmed)" }}>Generated by AI builder</span> : undefined}
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
                  {interviewLanguage(interview)}
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
