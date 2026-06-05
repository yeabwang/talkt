"use client";

import * as React from "react";

import { type CallSession } from "@/components/talkt/api";
import { type AppUser, type Interview } from "@/components/talkt/data";
import { useLiveKitCall } from "@/components/talkt/use-livekit-call";
import { AgentAvatar, Avatar, Icon, Waveform, Wordmark } from "@/components/talkt/primitives";

// Words too generic to identify which question is being asked. English-only, but
// harmless for other languages (they just keep more tokens).
const QUESTION_STOPWORDS = new Set([
  "the", "and", "for", "you", "your", "what", "how", "why", "can", "could", "would", "tell", "about",
  "give", "with", "that", "this", "please", "describe", "explain", "walk", "through", "have", "are",
  "did", "does", "any", "his", "her", "their", "from", "into", "when", "where", "who", "which",
]);

// Significant tokens of a line, across scripts (keeps accents/non-latin).
function sigWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !QUESTION_STOPWORDS.has(w));
}

// How many core questions the interviewer has reached, in order. Advances only
// when an assistant turn carries enough of the next question's keywords — so
// follow-ups and acknowledgements don't push the bar, but moving to the next
// question does. Paraphrase may delay a step (under-counts, never over-counts).
function countQuestionsReached(assistantTexts: string[], questions: string[]): number {
  if (!questions.length) return 0;
  const qWords = questions.map(sigWords);
  let reached = 0;
  for (const text of assistantTexts) {
    if (reached >= questions.length) break;
    const target = qWords[reached];
    if (!target.length) {
      reached += 1;
      continue;
    }
    const spoken = new Set(sigWords(text));
    const hits = target.filter((w) => spoken.has(w)).length;
    if (hits / target.length >= 0.5) reached += 1;
  }
  return reached;
}

export function LiveInterviewScreen({
  interview,
  user,
  session,
  camStream,
  onEnd,
  onCancel,
}: {
  interview: Interview;
  user: AppUser;
  session: CallSession;
  camStream: MediaStream | null;
  // Grading is server-driven now (the worker owns the transcript), so end only
  // carries the attempt id — the results screen polls its status.
  onEnd: (attemptId: string) => void;
  onCancel: () => void;
}) {
  const call = useLiveKitCall();
  const [elapsed, setElapsed] = React.useState(0);
  const [showTranscript, setShowTranscript] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const startedRef = React.useRef(false);

  // Total core questions, for the question-driven progress bar.
  const totalQuestions = interview.questions?.length || interview.count || 1;

  // Kick off the call once (StrictMode double-invoke guard). Joins the room
  // minted server-side; the worker is dispatched into it by the same token.
  React.useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void call.start(session.serverUrl, session.token);
  }, [call, session]);

  // Attach + tear down the local self-view stream owned by this screen.
  React.useEffect(() => {
    if (camStream && videoRef.current) videoRef.current.srcObject = camStream;
    return () => {
      if (camStream) camStream.getTracks().forEach((t) => t.stop());
    };
  }, [camStream]);

  // Elapsed clock runs while the call is active.
  React.useEffect(() => {
    if (call.status !== "active") return;
    const timer = window.setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => window.clearInterval(timer);
  }, [call.status]);

  // Closing countdown shown before handoff (null until the call ends naturally).
  const [countdown, setCountdown] = React.useState<number | null>(null);

  // Decide the closing path once the line drops, then drive it with a timer.
  const endedHandledRef = React.useRef(false);
  React.useEffect(() => {
    if (call.status !== "ended" || endedHandledRef.current) return;
    endedHandledRef.current = true;

    if (call.endedManually) {
      // Candidate hung up mid-interview. The worker classifies this as abandoned
      // server-side (no end_interview before disconnect), so we just bounce to the
      // dashboard after a brief beat — no client abandon call.
      const timer = window.setTimeout(onCancel, 1500);
      return () => window.clearTimeout(timer);
    }

    // Natural (end_interview) or time-cap completion — a short visible countdown
    // (3..2..1) instead of an abrupt cut, then route to results (which polls the
    // server-graded status; the worker already owns the transcript).
    let remaining = 3;
    const tick = window.setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        window.clearInterval(tick);
        onEnd(session.attemptId);
      }
    }, 1000);
    return () => window.clearInterval(tick);
  }, [call.status, call.endedManually, onCancel, onEnd, session.attemptId]);

  const aiSpeaking = call.assistantSpeaking;
  const youSpeaking = call.userSpeaking && !call.muted;

  // Settled turn-by-turn view: drop partials, merge consecutive same-speaker
  // fragments so each turn is one block (no broken half-sentences).
  const conversation = React.useMemo(() => {
    const blocks: { role: "assistant" | "user"; text: string }[] = [];
    for (const turn of call.turns) {
      if (!turn.final || !turn.text.trim()) continue;
      const last = blocks[blocks.length - 1];
      if (last && last.role === turn.role) last.text = `${last.text} ${turn.text}`.trim();
      else blocks.push({ role: turn.role, text: turn.text.trim() });
    }
    return blocks;
  }, [call.turns]);

  // Progress tracks how far through the question set the interviewer has gotten,
  // not elapsed time (interviews finish well before the cap). Advances when the
  // interviewer reaches the next core question — not on every user turn, which
  // over-counted follow-ups and filled the bar on question one.
  const reached = React.useMemo(
    () => countQuestionsReached(conversation.filter((b) => b.role === "assistant").map((b) => b.text), interview.questions ?? []),
    [conversation, interview.questions],
  );
  const progress = Math.min(100, (reached / totalQuestions) * 100);

  // Keep the transcript pinned to the newest turn.
  const transcriptEndRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (showTranscript) transcriptEndRef.current?.scrollIntoView({ block: "end" });
  }, [conversation, showTranscript]);

  const endCall = () => call.stop(true);

  if (call.status === "ended") {
    return (
      <div style={{ minHeight: "100vh", background: "var(--background)", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div className="text-center fade-in" style={{ maxWidth: 420 }}>
          {call.endedManually ? (
            <>
              <Icon name="phone" size={26} style={{ color: "var(--muted-foreground)", transform: "rotate(135deg)" }} />
              <h2 className="h2" style={{ margin: "16px 0 8px" }}>
                Interview ended
              </h2>
              <p className="caption">You ended early — this attempt won&apos;t be scored.</p>
            </>
          ) : (
            <>
              <div className="stat-value" style={{ fontSize: 56, lineHeight: 1, color: "var(--foreground)" }}>
                {Math.max(0, countdown ?? 3)}
              </div>
              <h2 className="h2" style={{ margin: "16px 0 8px" }}>
                Wrapping up your interview
              </h2>
              <p className="caption">Preparing your results…</p>
            </>
          )}
        </div>
      </div>
    );
  }

  if (call.status === "error") {
    return (
      <div style={{ minHeight: "100vh", background: "var(--background)", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div className="text-center" style={{ maxWidth: 420 }}>
          <Icon name="mic-off" size={28} style={{ color: "var(--error)" }} />
          <h2 className="h2" style={{ margin: "16px 0 8px" }}>
            Couldn&apos;t connect the call
          </h2>
          <p className="caption" style={{ marginBottom: 22 }}>
            {call.error ?? "The voice service is unavailable. Please try again."}
          </p>
          <button className="btn btn-secondary" type="button" onClick={onCancel}>
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

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
        </div>
      </div>

      {/* Question-driven progress (see `progress`). */}
      <div style={{ height: 2, background: "var(--border)" }}>
        <div style={{ height: "100%", width: `${progress}%`, background: "var(--foreground)", transition: "width var(--dur-base) var(--ease-out)" }} />
      </div>

      {call.status === "active" && call.noInputDetected ? (
        <div
          className="fade-in flex items-center justify-center gap-2"
          role="alert"
          style={{ padding: "10px 16px", background: "var(--error)", color: "var(--error-foreground)", fontSize: 13, fontWeight: 500, zIndex: 6 }}
        >
          <Icon name="mic-off" size={15} />
          {call.muted
            ? "You're muted — tap the mic to unmute so the interviewer can hear you."
            : "We're not hearing you. Check your microphone and that the browser has mic access."}
        </div>
      ) : null}

      <div className="grow flex" style={{ minHeight: 0 }}>
        <div className="grow flex flex-col items-center justify-center" style={{ padding: "clamp(20px, 3vh, 34px) 24px", gap: 28, minWidth: 0, minHeight: 0 }}>
          <div className="talkt-live-tiles">
            <Tile
              active={aiSpeaking}
              speaking={aiSpeaking}
              name={session.interviewerName || "Interviewer"}
              sub="Interviewer"
              avatar={<AgentAvatar size={96} active={aiSpeaking} />}
            />
            <Tile
              active={youSpeaking}
              speaking={youSpeaking}
              muted={call.muted}
              name={user.name}
              sub="You"
              avatar={camStream ? <SelfView videoRef={videoRef} /> : <Avatar name={user.name} src={user.image} size={96} />}
            />
          </div>
        </div>

        {showTranscript ? (
          <aside className="fade-in no-scrollbar" style={{ width: 320, minHeight: 0, borderLeft: "1px solid var(--border)", background: "var(--sidebar)", overflowY: "auto", padding: "18px 20px" }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
              <span className="mono-label">Transcript</span>
              <button type="button" onClick={() => setShowTranscript(false)} className="icon-btn" style={{ width: 30, height: 30, border: 0 }} aria-label="Close transcript">
                <Icon name="x" size={15} />
              </button>
            </div>
            {conversation.length ? (
              <div className="flex-col" style={{ display: "flex", gap: 16 }}>
                {conversation.map((turn, index) => (
                  <div key={index}>
                    <div className="mono" style={{ fontSize: 11, color: turn.role === "assistant" ? "var(--muted-foreground)" : "var(--dimmed)" }}>
                      {turn.role === "assistant" ? session.interviewerName || "Interviewer" : user.name}
                    </div>
                    <p className="caption" style={{ margin: "3px 0 0", color: "var(--foreground)" }}>
                      {turn.text}
                    </p>
                  </div>
                ))}
                <div ref={transcriptEndRef} />
              </div>
            ) : (
              <p className="caption" style={{ margin: 0 }}>
                The conversation transcript appears here, turn by turn, as you talk.
              </p>
            )}
          </aside>
        ) : null}
      </div>

      <div className="flex items-center justify-center" style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", gap: 12, position: "relative" }}>
        <CtrlBtn icon={call.muted ? "mic-off" : "mic"} on={!call.muted} danger={call.muted} onClick={call.toggleMute} label="Toggle mic" />
        <CtrlBtn icon="captions" on={showTranscript} onClick={() => setShowTranscript((value) => !value)} label={showTranscript ? "Hide transcript" : "Show transcript"} />
        <button className="btn btn-danger" type="button" onClick={endCall} style={{ width: 58, height: 48, padding: 0 }} aria-label="End call">
          <Icon name="phone" size={20} style={{ transform: "rotate(135deg)" }} />
        </button>

        <div className="flex items-center gap-3" style={{ position: "absolute", right: 26 }}>
          {call.status === "connecting" ? (
            <span className="flex items-center gap-2 mono" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              <Icon name="loader" size={14} className="spin" /> Connecting
            </span>
          ) : aiSpeaking ? (
            <span className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              Interviewer is speaking...
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SelfView({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement | null> }) {
  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover", transform: "scaleX(-1)" }}
    />
  );
}

function Tile({
  active,
  speaking,
  name,
  sub,
  avatar,
  muted,
}: {
  active: boolean;
  speaking: boolean;
  name: string;
  sub: string;
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
