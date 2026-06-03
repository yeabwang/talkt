"use client";

import * as React from "react";

import { persistBuiltInterview, publishInterview, type BuiltInterviewPayload } from "@/components/talkt/api";
import { LANGUAGES, VOICES, type AppUser, type Interview } from "@/components/talkt/data";
import type { TalkTRoute } from "@/components/talkt/app-shell";
import { AgentAvatar, Avatar, Icon, SectionHeader, StatusDot, TalkTButton } from "@/components/talkt/primitives";
import { PublishDialog } from "@/components/talkt/publish-dialog";

interface BuilderSummary {
  title: string;
  role: string;
  category: string;
  difficulty: string;
  blurb: string;
  focus: string[];
  minutes: number;
  count: number;
}

interface BuilderDimension {
  key: string;
  label: string;
}

interface BuilderTurn {
  response_text: string;
  suggestions_enabled: boolean;
  suggestion_type: "single" | "multi" | null;
  suggestions: string[];
  summary: BuilderSummary;
  ready: boolean;
  questions: string[];
  dimensions: BuilderDimension[];
}

interface ThreadMessage {
  from: "ai" | "you";
  text: string;
}

const EMPTY_SUMMARY: BuilderSummary = {
  title: "",
  role: "",
  category: "",
  difficulty: "",
  blurb: "",
  focus: [],
  minutes: 0,
  count: 0,
};

export function BuilderScreen({
  navigate,
  startInterview,
  user,
}: {
  navigate: (route: TalkTRoute, params?: Record<string, unknown>) => void;
  startInterview: (interview: Interview) => void;
  user: AppUser;
}) {
  const [thread, setThread] = React.useState<ThreadMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [turn, setTurn] = React.useState<BuilderTurn | null>(null);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [language, setLanguage] = React.useState("English");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [publishError, setPublishError] = React.useState<string | null>(null);
  const [published, setPublished] = React.useState(false);
  const [starting, setStarting] = React.useState(false);
  // The persisted (private) DB row for this built interview, created once and
  // shared by Start and Publish.
  const persistedRef = React.useRef<Interview | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const threadRef = React.useRef<ThreadMessage[]>(thread);
  threadRef.current = thread;
  const openedRef = React.useRef(false);

  const summary = turn?.summary ?? EMPTY_SUMMARY;
  const ready = Boolean(turn?.ready);
  const questions = turn?.questions ?? [];

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread, sending]);

  const send = React.useCallback(
    async (text: string | null) => {
      const trimmed = text?.trim() ?? "";
      const nextThread: ThreadMessage[] = trimmed ? [...threadRef.current, { from: "you", text: trimmed }] : threadRef.current;

      setError(null);
      setSelected([]);
      setTurn((current) => (current ? { ...current, suggestions_enabled: false, suggestions: [] } : current));
      if (trimmed) setThread(nextThread);
      setInput("");
      setSending(true);

      try {
        const response = await fetch("/api/builder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: nextThread, language }),
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? `Builder error (${response.status})`);
        }
        const data = (await response.json()) as BuilderTurn;
        setTurn(data);
        if (data.response_text) setThread((messages) => [...messages, { from: "ai", text: data.response_text }]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      } finally {
        setSending(false);
      }
    },
    [language],
  );

  // Open the conversation once on mount. Guard against React StrictMode's
  // double-invoked mount effect (dev) firing two opener requests.
  React.useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    void send(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const suggestionType = turn?.suggestion_type ?? "single";
  const showSuggestions = Boolean(turn?.suggestions_enabled) && !sending && !ready;

  const toggleSelected = (option: string) => {
    setSelected((current) => (current.includes(option) ? current.filter((item) => item !== option) : [...current, option]));
  };

  const submitMulti = () => {
    if (!selected.length) return;
    void send(selected.join(", "));
  };

  const buildPayload = React.useCallback((): BuiltInterviewPayload => {
    const qs = turn?.questions ?? [];
    const role = summary.role || summary.title || "Custom interview";
    return {
      title: summary.title || `${role} (custom)`,
      subtitle: "Built with the AI builder",
      role: summary.role || undefined,
      category: summary.category || "Custom",
      difficulty: summary.difficulty || "All levels",
      blurb: summary.blurb || "Generated from your brief in the builder.",
      minutes: summary.minutes || Math.max(15, qs.length * 3),
      focus: summary.focus,
      language,
      voiceId: pickVoice(role),
      questions: qs,
      dimensions: turn?.dimensions ?? [],
    };
  }, [summary, language, turn]);

  // Persist the built interview as a private DB row exactly once. Both Start and
  // Publish funnel through here so they operate on the same row.
  const ensurePersisted = React.useCallback(async (): Promise<Interview> => {
    if (persistedRef.current) return persistedRef.current;
    const saved = await persistBuiltInterview(buildPayload());
    persistedRef.current = saved;
    return saved;
  }, [buildPayload]);

  // Local-only interview used if persistence fails (e.g. DB unreachable), so the
  // user can still run it without a DB row.
  const localInterview = React.useCallback((): Interview => {
    const qs = turn?.questions ?? [];
    const role = summary.role || summary.title || "Custom interview";
    return {
      id: `custom-${Date.now()}`,
      title: summary.title || `${role} (custom)`,
      subtitle: "Built with the AI builder",
      icon: "sparkles",
      category: summary.category || "Custom",
      difficulty: summary.difficulty || "All levels",
      count: qs.length,
      minutes: summary.minutes || Math.max(15, qs.length * 3),
      author: "You",
      source: "Custom",
      takes: 0,
      voice: pickVoice(role),
      language,
      custom: true,
      blurb: summary.blurb || "Generated from your brief in the builder.",
      questions: qs,
      focus: summary.focus,
      dimensions: turn?.dimensions ?? [],
    };
  }, [summary, language, turn]);

  // Start saves the interview as private (giving it a real DB row), then opens
  // the lobby. Falls back to a local-only interview if persistence fails.
  const startBuiltInterview = async () => {
    if (!turn || !ready || starting) return;
    setStarting(true);
    try {
      startInterview(await ensurePersisted());
    } catch {
      startInterview(localInterview());
    } finally {
      setStarting(false);
    }
  };

  const onConfirmPublish = async (opts: { displayName?: string; anonymous: boolean }) => {
    setPublishing(true);
    setPublishError(null);
    try {
      const saved = await ensurePersisted();
      await publishInterview(saved.id, opts);
      setPublished(true);
      setDialogOpen(false);
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : "Could not publish. Try again.");
    } finally {
      setPublishing(false);
    }
  };

  const inputDisabled = sending || ready;

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
          <div className="flex-col" style={{ gap: 28, maxWidth: 620, margin: "0 auto" }}>
            {thread.map((message, index) => (
              <Bubble key={`${message.from}-${index}`} message={message} user={user} />
            ))}
            {sending ? <TypingBubble /> : null}
            {error ? (
              <div className="flex items-center gap-2" style={{ fontSize: 13, color: "var(--danger, #e5484d)" }}>
                <Icon name="alert-triangle" size={15} /> {error}
                <button type="button" className="mono-label" style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => void send(null)}>
                  Retry
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div style={{ padding: "16px 28px", borderTop: "1px solid var(--border)" }}>
          <div style={{ maxWidth: 620, margin: "0 auto" }}>
            {showSuggestions ? (
              <div className="flex items-center gap-2" style={{ marginBottom: 12, flexWrap: "wrap" }}>
                {turn!.suggestions.map((option) => {
                  const active = selected.includes(option);
                  if (suggestionType === "multi") {
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => toggleSelected(option)}
                        className="chip card-hover flex items-center gap-2"
                        style={{
                          height: 30,
                          cursor: "pointer",
                          color: active ? "var(--background)" : "var(--foreground)",
                          background: active ? "var(--foreground)" : undefined,
                          borderColor: active ? "var(--foreground)" : undefined,
                        }}
                      >
                        {active ? <Icon name="check" size={13} /> : null}
                        {option}
                      </button>
                    );
                  }
                  return (
                    <button key={option} type="button" onClick={() => void send(option)} className="chip card-hover" style={{ height: 30, cursor: "pointer", color: "var(--foreground)" }}>
                      {option}
                    </button>
                  );
                })}
                {suggestionType === "multi" ? (
                  <TalkTButton variant="secondary" size="sm" icon="check" disabled={!selected.length} onClick={submitMulti}>
                    Submit{selected.length ? ` (${selected.length})` : ""}
                  </TalkTButton>
                ) : null}
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <input
                className="field"
                placeholder={ready ? "Your set is ready - start on the right" : "Type your answer..."}
                value={input}
                disabled={inputDisabled}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && input.trim()) void send(input);
                }}
              />
              <TalkTButton variant="primary" icon="send" onClick={() => void send(input)} disabled={inputDisabled || !input.trim()} style={{ paddingInline: 14 }} aria-label="Send" />
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
          <select className="field" value={language} onChange={(event) => setLanguage(event.target.value)} disabled={ready} style={{ appearance: "auto" }}>
            {LANGUAGES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <p className="caption" style={{ marginTop: 7, fontSize: 12 }}>
            The builder, questions, the interview, and your report use this language.
          </p>
        </div>

        <div className="card rounded-lg" style={{ padding: 18, marginBottom: 18 }}>
          <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
            <div style={{ width: 38, height: 38, display: "grid", placeItems: "center", border: "1px solid var(--border)" }}>
              <Icon name="sparkles" size={18} />
            </div>
            <div className="grow">
              <div className="h3">{summary.title || summary.role || "Untitled interview"}</div>
              <div className="caption">{[summary.category, summary.difficulty].filter(Boolean).join(" · ") || "Level -"}</div>
            </div>
          </div>
          <div className="flex-col" style={{ gap: 0 }}>
            <DraftRow label="Language" value={language} />
            <DraftRow label="Focus" value={summary.focus.length ? summary.focus.join(" · ") : "-"} />
            <DraftRow label="Questions" value={ready ? questions.length : summary.count || "-"} />
            <DraftRow label="Duration" value={summary.minutes ? `~${summary.minutes} min` : "-"} />
            <DraftRow label="Interviewer" value={summary.role ? `${VOICES.find((voice) => voice.id === pickVoice(summary.role))?.name ?? "-"} · assigned` : "Auto-assigned"} last />
          </div>
        </div>

        {!ready ? (
          <p className="caption" style={{ textAlign: "center" }}>
            Chat with the builder on the left. It will draft a tuned set when it has enough to go on.
          </p>
        ) : null}

        {ready ? (
          <div className="fade-up">
            {turn!.dimensions.length ? (
              <>
                <SectionHeader num="03" label="Grading criteria" />
                <div className="flex items-center" style={{ flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
                  {turn!.dimensions.map((dimension) => (
                    <span key={dimension.key} className="chip" style={{ height: 28 }}>
                      {dimension.label}
                    </span>
                  ))}
                </div>
              </>
            ) : null}

            <SectionHeader num={turn!.dimensions.length ? "04" : "03"} label="Generated set" />
            <ol style={{ listStyle: "none", margin: "0 0 18px", padding: 0 }}>
              {questions.map((question, index) => (
                <li key={question} className="flex gap-3" style={{ padding: "11px 0", borderBottom: "1px solid var(--border)", alignItems: "baseline" }}>
                  <span className="mono" style={{ fontSize: 11, color: "var(--dimmed)", width: 20, flexShrink: 0 }}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span style={{ fontSize: 13.5 }}>{question}</span>
                </li>
              ))}
            </ol>
            <div className="flex-col gap-2">
              <TalkTButton variant="primary" size="lg" icon="phone" className="btn-block" disabled={starting} onClick={() => void startBuiltInterview()}>
                {starting ? "Saving..." : "Start interview"}
              </TalkTButton>
              {published ? (
                <span className="chip btn-block flex items-center justify-center" style={{ gap: 6, height: 40 }}>
                  <Icon name="check" size={13} /> Published to directory
                </span>
              ) : (
                <TalkTButton variant="secondary" icon="shield" className="btn-block" onClick={() => setDialogOpen(true)}>
                  Publish to directory
                </TalkTButton>
              )}
              <TalkTButton variant="ghost" className="btn-block" onClick={() => navigate("library")}>
                Save & exit
              </TalkTButton>
            </div>
          </div>
        ) : null}
      </div>

      {dialogOpen ? (
        <PublishDialog
          defaultName={user.name ?? user.firstName ?? ""}
          busy={publishing}
          error={publishError}
          onConfirm={(opts) => void onConfirmPublish(opts)}
          onClose={() => setDialogOpen(false)}
        />
      ) : null}
    </div>
  );
}

function Bubble({ message, user }: { message: ThreadMessage; user: AppUser }) {
  const you = message.from === "you";
  return (
    <div className="fade-up flex" style={{ gap: 12, flexDirection: you ? "row-reverse" : "row", alignItems: "flex-start" }}>
      {you ? <Avatar name={user.name} src={user.image} size={30} /> : <AgentAvatar size={30} />}
      <div
        style={{
          maxWidth: "78%",
          padding: "13px 17px",
          fontSize: 14,
          lineHeight: 1.65,
          border: "1px solid var(--border)",
          background: you ? "var(--foreground)" : "var(--card)",
          color: you ? "var(--background)" : "var(--foreground)",
        }}
      >
        {message.text}
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

// Deterministic voice pick so the same role keeps the same interviewer.
function pickVoice(role: string): string {
  if (!role) return "ren";
  return VOICES[role.length % VOICES.length].id;
}
