"use client";

import * as React from "react";

import { VOICES, interviewLanguage, type AppUser, type Interview } from "@/components/talkt/data";
import { AgentAvatar, Avatar, Icon, Waveform, Wordmark } from "@/components/talkt/primitives";

const ANSWER_WINDOW = 7600;
const CLOSING_TEXT = "That's everything I had. Thanks for talking it through - generating your feedback now.";

export function LiveInterviewScreen({
  interview,
  user,
  onEnd,
  onCancel,
}: {
  interview: Interview;
  user: AppUser;
  onEnd: () => void;
  onCancel: () => void;
}) {
  const questions = interview.questions;
  const total = questions.length;
  const voice = VOICES.find((item) => item.id === interview.voice) ?? VOICES[0];

  const [idx, setIdx] = React.useState(0);
  const [mode, setMode] = React.useState<"asking" | "answering" | "closing">("asking");
  const [typed, setTyped] = React.useState("");
  const [elapsed, setElapsed] = React.useState(0);
  const [micOn, setMicOn] = React.useState(true);
  const [showTranscript, setShowTranscript] = React.useState(false);

  const fullQuestion = mode === "closing" ? CLOSING_TEXT : questions[idx];
  const beginQuestion = React.useCallback(
    (nextIdx: number) => {
      setIdx(nextIdx);
      setMode(nextIdx >= total ? "closing" : "asking");
      setTyped("");
    },
    [total]
  );

  React.useEffect(() => {
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    if (mode !== "asking" && mode !== "closing") return;
    const closing = mode === "closing";
    const text = closing ? CLOSING_TEXT : questions[idx];
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setTyped(text.slice(0, index));
      if (index >= text.length) {
        window.clearInterval(timer);
        if (closing) {
          window.setTimeout(() => onEnd(), 1600);
        } else {
          window.setTimeout(() => setMode("answering"), 550);
        }
      }
    }, 26);
    return () => window.clearInterval(timer);
  }, [idx, mode, onEnd, questions]);

  React.useEffect(() => {
    if (mode !== "answering") return;
    const advance = window.setTimeout(() => beginQuestion(idx + 1), ANSWER_WINDOW);
    return () => window.clearTimeout(advance);
  }, [beginQuestion, mode, idx]);

  const skip = () => {
    if (mode === "answering") beginQuestion(idx + 1);
  };

  const aiSpeaking = mode === "asking" || mode === "closing";
  const youSpeaking = mode === "answering" && micOn;

  // Running conversation transcript shown in the right panel.
  const transcript = React.useMemo(() => {
    const turns: { who: string; role: "interviewer" | "you"; text: string }[] = [];
    const answered = Math.min(idx, total);
    for (let i = 0; i < answered; i += 1) {
      turns.push({ who: voice.name, role: "interviewer", text: questions[i] });
      turns.push({ who: user.name, role: "you", text: "[Spoken answer captured]" });
    }
    if (idx < total) {
      turns.push({ who: voice.name, role: "interviewer", text: questions[idx] });
      if (mode === "answering") turns.push({ who: user.name, role: "you", text: "Listening to your answer…" });
    }
    if (mode === "closing") turns.push({ who: voice.name, role: "interviewer", text: CLOSING_TEXT });
    return turns;
  }, [idx, total, mode, questions, voice.name, user.name]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <div className="flex items-center justify-between" style={{ padding: "14px 26px", borderBottom: "1px solid var(--border)", zIndex: 5 }}>
        <div className="flex items-center gap-3">
          <Wordmark size={18} />
          <div style={{ width: 1, height: 18, background: "var(--border)" }} />
          <span style={{ fontSize: 13, fontWeight: 500 }}>{interview.title}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="mono" style={{ fontSize: 13, color: "var(--foreground)" }}>
            {fmt(elapsed)}
          </span>
          <button
            type="button"
            onClick={() => setShowTranscript((shown) => !shown)}
            className="icon-btn"
            aria-label="Transcript"
            aria-expanded={showTranscript}
            style={{ width: 34, height: 34, background: showTranscript ? "var(--card)" : undefined, borderColor: showTranscript ? "var(--border-hover)" : undefined }}
          >
            <Icon name="list" size={16} />
          </button>
        </div>
      </div>

      <div style={{ height: 2, background: "var(--border)" }}>
        <div style={{ height: "100%", width: `${(Math.min(idx, total) / total) * 100}%`, background: "var(--foreground)", transition: "width var(--dur-base) var(--ease-out)" }} />
      </div>

      <div className="grow flex" style={{ minHeight: 0 }}>
        <div className="grow flex flex-col items-center justify-center" style={{ padding: "clamp(20px, 3vh, 34px) 24px", gap: 28, minWidth: 0, minHeight: 0 }}>
          <div className="talkt-live-tiles">
            <Tile
              active={aiSpeaking}
              speaking={aiSpeaking}
              name={voice.name}
              sub="Interviewer"
              status={mode === "closing" ? "Wrapping up" : aiSpeaking ? "Speaking" : "Listening"}
              avatar={<AgentAvatar size={96} active={aiSpeaking} />}
            />
            <Tile
              active={youSpeaking}
              speaking={youSpeaking}
              muted={!micOn}
              name={user.name}
              sub="You"
              status={!micOn ? "Muted" : youSpeaking ? "Speaking" : "Ready"}
              avatar={<Avatar name={user.name} size={96} />}
            />
          </div>

          <div className="text-center" style={{ maxWidth: 760, width: "100%" }}>
            <div className="flex items-center justify-center gap-3" style={{ marginBottom: 16 }}>
              <span className="mono-label">{mode === "closing" ? "Closing" : `Question ${idx + 1} of ${total}`}</span>
            </div>
            <p className="h2" style={{ fontWeight: 500, lineHeight: 1.32, minHeight: 64 }}>
              {typed}
              {aiSpeaking && typed.length < fullQuestion.length ? <span className="cursor-blink" /> : null}
            </p>
          </div>
        </div>

        {showTranscript ? (
          <aside className="fade-in no-scrollbar" style={{ width: 320, borderLeft: "1px solid var(--border)", background: "var(--sidebar)", overflowY: "auto", padding: "18px 20px" }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
              <span className="mono-label">Transcript</span>
              <button type="button" onClick={() => setShowTranscript(false)} className="icon-btn" style={{ width: 30, height: 30, border: 0 }} aria-label="Close transcript">
                <Icon name="x" size={15} />
              </button>
            </div>
            {transcript.length ? (
              <div className="flex-col" style={{ display: "flex", gap: 16 }}>
                {transcript.map((turn, index) => (
                  <div key={index}>
                    <div className="mono" style={{ fontSize: 11, color: turn.role === "interviewer" ? "var(--muted-foreground)" : "var(--dimmed)" }}>
                      {turn.who}
                    </div>
                    <p className="caption" style={{ margin: "3px 0 0", color: "var(--foreground)" }}>
                      {turn.text}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="caption" style={{ margin: 0 }}>
                The conversation transcript appears here as you talk.
              </p>
            )}
          </aside>
        ) : null}
      </div>

      <div className="flex items-center justify-center" style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", gap: 12, position: "relative" }}>
        <div className="flex items-center gap-2" style={{ position: "absolute", left: 26 }}>
          <span className="mono" style={{ fontSize: 11, color: "var(--dimmed)" }}>
            {interviewLanguage(interview)}
          </span>
        </div>

        <CtrlBtn icon={micOn ? "mic" : "mic-off"} on={micOn} danger={!micOn} onClick={() => setMicOn((value) => !value)} label="Toggle mic" />
        <button className="btn btn-danger" type="button" onClick={onCancel} style={{ width: 58, height: 48, padding: 0 }} aria-label="End call">
          <Icon name="phone" size={20} style={{ transform: "rotate(135deg)" }} />
        </button>

        <div className="flex items-center gap-3" style={{ position: "absolute", right: 26 }}>
          {mode === "answering" ? (
            <button type="button" onClick={skip} className="flex items-center gap-2 mono btn-ghost" style={{ height: 34, padding: "0 10px", fontSize: 11, cursor: "pointer", border: 0, background: "transparent", color: "var(--muted-foreground)" }}>
              Skip ahead <Icon name="chevron-right" size={14} />
            </button>
          ) : null}
          {mode === "asking" ? (
            <span className="mono" style={{ fontSize: 11, color: "var(--dimmed)" }}>
              Interviewer is speaking...
            </span>
          ) : null}
          {mode === "closing" ? (
            <span className="flex items-center gap-2 mono" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              <Icon name="loader" size={14} className="spin" /> Ending call
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Tile({
  active,
  speaking,
  name,
  sub,
  status,
  avatar,
  muted,
}: {
  active: boolean;
  speaking: boolean;
  name: string;
  sub: string;
  status: string;
  avatar: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div
      className="relative"
      style={{
        aspectRatio: "16/10",
        background: "var(--tile-bg)",
        border: `1px solid ${active ? "var(--foreground)" : "var(--border)"}`,
        borderRadius: "var(--radius-panel)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        boxShadow: active ? "var(--tile-active-shadow)" : "none",
        transition: "border-color var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out)",
      }}
    >
      <div className="bg-dot-grid" style={{ position: "absolute", inset: 0, opacity: active ? 0.6 : 0.28, transition: "opacity var(--dur-base)" }} />
      <div className="relative" style={{ display: "grid", placeItems: "center" }}>
        {speaking ? <span style={{ position: "absolute", width: 120, height: 120, borderRadius: "50%", animation: "ring-pulse 1.6s var(--ease-out) infinite", pointerEvents: "none" }} aria-hidden="true" /> : null}
        <div className="relative">{avatar}</div>
      </div>
      <div className="relative" style={{ height: 24 }}>
        {speaking ? (
          <Waveform active bars={20} height={24} color="var(--on-tile)" thin />
        ) : (
          <span className="mono" style={{ fontSize: 11, color: muted ? "var(--error)" : "var(--dimmed)" }}>
            {muted ? "muted" : "-"}
          </span>
        )}
      </div>

      <div className="relative" style={{ position: "absolute", bottom: 14, left: 16, display: "flex", alignItems: "center", gap: 8 }}>
        <span className="mono" style={{ fontSize: 12, color: "var(--on-tile)" }}>
          {name}
        </span>
        <span className="mono" style={{ fontSize: 10, color: "var(--on-tile)", opacity: 0.5 }}>
          {sub}
        </span>
      </div>
      <div className="relative" style={{ position: "absolute", bottom: 14, right: 16 }}>
        <span className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: active ? "var(--on-tile)" : "var(--dimmed)" }}>
          {status}
        </span>
      </div>
    </div>
  );
}

function CtrlBtn({ icon, on, danger, onClick, label, disabled }: { icon: string; on: boolean; danger?: boolean; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{
        width: 48,
        height: 48,
        display: "grid",
        placeItems: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        border: `1px solid ${danger ? "var(--error)" : "var(--border)"}`,
        background: danger ? "var(--error)" : "var(--card)",
        color: danger ? "var(--error-foreground)" : on ? "var(--foreground)" : "var(--muted-foreground)",
        opacity: disabled ? 0.4 : 1,
        transition: "all var(--dur-fast)",
      }}
    >
      <Icon name={icon} size={19} />
    </button>
  );
}

function fmt(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}
