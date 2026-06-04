"use client";

import * as React from "react";

import { attachCallId, type CallSession } from "@/components/talkt/api";
import { interviewLanguage, type AppUser, type Interview } from "@/components/talkt/data";
import { useVapiCall } from "@/components/talkt/use-vapi-call";
import { AgentAvatar, Avatar, Icon, Waveform, Wordmark } from "@/components/talkt/primitives";

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
  onEnd: (attemptId: string, transcript: { role: string; text: string }[]) => void;
  onCancel: () => void;
}) {
  const call = useVapiCall();
  const [elapsed, setElapsed] = React.useState(0);
  const [showTranscript, setShowTranscript] = React.useState(false);
  const [captionsOn, setCaptionsOn] = React.useState(true);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const startedRef = React.useRef(false);

  const estTotal = Math.max(60, (interview.minutes || 15) * 60);

  // Kick off the call once (StrictMode double-invoke guard).
  React.useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void call.start(session.publicKey, session.assistant);
  }, [call, session]);

  // Persist the Vapi call id as a defensive webhook join key.
  React.useEffect(() => {
    if (call.callId) void attachCallId(session.attemptId, call.callId);
  }, [call.callId, session.attemptId]);

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

  // Natural or user-initiated end -> hand the attempt + captured transcript to
  // the results screen, which grades it in one call (no poll loop / webhook wait).
  const turnsRef = React.useRef(call.turns);
  React.useEffect(() => {
    turnsRef.current = call.turns;
  }, [call.turns]);

  React.useEffect(() => {
    if (call.status === "ended") {
      const transcript = turnsRef.current.map((t) => ({ role: t.role, text: t.text }));
      onEnd(session.attemptId, transcript);
    }
  }, [call.status, onEnd, session.attemptId]);

  const aiSpeaking = call.assistantSpeaking;
  const youSpeaking = call.userSpeaking && !call.muted;

  const lastAssistant = React.useMemo(() => {
    for (let i = call.turns.length - 1; i >= 0; i -= 1) if (call.turns[i].role === "assistant") return call.turns[i].text;
    return "";
  }, [call.turns]);

  const endCall = () => call.stop();

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
        <div style={{ height: "100%", width: `${Math.min(100, (elapsed / estTotal) * 100)}%`, background: "var(--foreground)", transition: "width var(--dur-base) var(--ease-out)" }} />
      </div>

      <div className="grow flex" style={{ minHeight: 0 }}>
        <div className="grow flex flex-col items-center justify-center" style={{ padding: "clamp(20px, 3vh, 34px) 24px", gap: 28, minWidth: 0, minHeight: 0 }}>
          <div className="talkt-live-tiles">
            <Tile
              active={aiSpeaking}
              speaking={aiSpeaking}
              name="Interviewer"
              sub="TalkT"
              status={call.status === "connecting" ? "Connecting" : aiSpeaking ? "Speaking" : "Listening"}
              avatar={<AgentAvatar size={96} active={aiSpeaking} />}
            />
            <Tile
              active={youSpeaking}
              speaking={youSpeaking}
              muted={call.muted}
              name={user.name}
              sub="You"
              status={call.muted ? "Muted" : youSpeaking ? "Speaking" : "Ready"}
              avatar={camStream ? <SelfView videoRef={videoRef} /> : <Avatar name={user.name} size={96} />}
            />
          </div>

          {captionsOn ? (
            <div className="text-center" style={{ maxWidth: 760, width: "100%" }}>
              <div className="flex items-center justify-center gap-3" style={{ marginBottom: 16 }}>
                <span className="mono-label">{aiSpeaking ? "Interviewer" : youSpeaking ? "You" : "Live"}</span>
              </div>
              <p style={{ fontSize: "clamp(16px, 1.9vw, 20px)", fontWeight: 500, letterSpacing: "-0.01em", lineHeight: 1.4, minHeight: 40, margin: 0 }}>
                {lastAssistant || (call.status === "connecting" ? "Connecting…" : "Listening…")}
                {aiSpeaking ? <span className="cursor-blink" /> : null}
              </p>
            </div>
          ) : null}
        </div>

        {showTranscript ? (
          <aside className="fade-in no-scrollbar" style={{ width: 320, borderLeft: "1px solid var(--border)", background: "var(--sidebar)", overflowY: "auto", padding: "18px 20px" }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
              <span className="mono-label">Transcript</span>
              <button type="button" onClick={() => setShowTranscript(false)} className="icon-btn" style={{ width: 30, height: 30, border: 0 }} aria-label="Close transcript">
                <Icon name="x" size={15} />
              </button>
            </div>
            {call.turns.length ? (
              <div className="flex-col" style={{ display: "flex", gap: 16 }}>
                {call.turns.map((turn, index) => (
                  <div key={index}>
                    <div className="mono" style={{ fontSize: 11, color: turn.role === "assistant" ? "var(--muted-foreground)" : "var(--dimmed)" }}>
                      {turn.role === "assistant" ? "Interviewer" : user.name}
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
          <span className="mono" style={{ fontSize: 11, color: "var(--foreground)" }}>
            {interviewLanguage(interview)}
          </span>
        </div>

        <CtrlBtn icon={call.muted ? "mic-off" : "mic"} on={!call.muted} danger={call.muted} onClick={call.toggleMute} label="Toggle mic" />
        <CtrlBtn icon="captions" on={captionsOn} onClick={() => setCaptionsOn((value) => !value)} label={captionsOn ? "Hide captions" : "Show captions"} />
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
