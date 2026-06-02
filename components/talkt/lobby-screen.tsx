"use client";

import * as React from "react";

import { VOICES, interviewLanguage, type AppUser, type Interview } from "@/components/talkt/data";
import type { TalkTRoute } from "@/components/talkt/app-shell";
import { AgentAvatar, Avatar, Icon, StatusDot, TalkTButton, Waveform, Wordmark } from "@/components/talkt/primitives";

export function LobbyScreen({
  interview,
  user,
  navigate,
  onJoin,
}: {
  interview: Interview;
  user: AppUser;
  navigate: (route: TalkTRoute, params?: Record<string, unknown>) => void;
  onJoin: () => void;
}) {
  const [micOn, setMicOn] = React.useState(true);
  const [camOn, setCamOn] = React.useState(false);
  const [phase, setPhase] = React.useState<"ready" | "connecting">("ready");
  const [connectStep, setConnectStep] = React.useState(0);
  const voice = VOICES.find((item) => item.id === interview.voice) ?? VOICES[0];
  const connectMessages = ["Requesting microphone", "Connecting to TalkT", `${voice.name} is joining`, "Starting interview"];

  const join = () => {
    setPhase("connecting");
    let index = 0;
    const tick = () => {
      setConnectStep(index);
      index += 1;
      if (index <= connectMessages.length) {
        window.setTimeout(tick, index === connectMessages.length ? 700 : 620);
      } else {
        onJoin();
      }
    };
    tick();
  };

  return (
    <div className="relative bg-grid-lines" style={{ minHeight: "100vh", background: "var(--background)", display: "flex", flexDirection: "column" }}>
      <div className="noise-overlay" style={{ opacity: 0.07 }} />

      <div className="relative flex items-center justify-between" style={{ padding: "18px 28px" }}>
        <Wordmark size={20} />
        <button type="button" onClick={() => navigate("detail", { interviewId: interview.id })} className="icon-btn" aria-label="Leave" disabled={phase === "connecting"}>
          <Icon name="x" size={18} />
        </button>
      </div>

      <div className="relative grow flex items-center justify-center" style={{ padding: "20px 28px 60px" }}>
        <div className="talkt-lobby-grid">
          <div>
            <div
              className="relative"
              style={{
                aspectRatio: "16/9",
                background: "var(--tile-bg)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-panel)",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div className="bg-dot-grid" style={{ position: "absolute", inset: 0, opacity: 0.5 }} />
              {phase === "connecting" ? (
                <div className="relative text-center fade-in">
                  <div style={{ marginBottom: 18, display: "flex", justifyContent: "center" }}>
                    <AgentAvatar size={64} active />
                  </div>
                  <div className="flex items-center justify-center gap-2 mono" style={{ color: "var(--on-tile)", fontSize: 13 }}>
                    <Icon name="loader" size={15} className="spin" /> {connectMessages[Math.min(connectStep, connectMessages.length - 1)]}
                    <span className="cursor-blink" />
                  </div>
                </div>
              ) : (
                <div className="relative text-center">
                  <Avatar name={user.name} size={84} />
                  <div className="mono" style={{ marginTop: 16, fontSize: 13, color: "var(--on-tile)" }}>
                    {user.name}
                  </div>
                  <div style={{ height: 34, marginTop: 16, display: "flex", justifyContent: "center" }}>
                    {micOn ? (
                      <Waveform active bars={20} height={26} color="var(--on-tile)" thin />
                    ) : (
                      <span className="mono" style={{ fontSize: 11, color: "var(--dimmed)" }}>
                        Microphone off
                      </span>
                    )}
                  </div>
                </div>
              )}

              {phase === "ready" ? (
                <div style={{ position: "absolute", bottom: 14, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 10 }}>
                  <TileToggle on={micOn} onIcon="mic" offIcon="mic-off" onClick={() => setMicOn((value) => !value)} label="mic" />
                  <TileToggle on={camOn} onIcon="video" offIcon="video-off" onClick={() => setCamOn((value) => !value)} label="camera" />
                  <button className="icon-btn" type="button" style={{ background: "var(--tile-control-bg)", borderColor: "var(--tile-control-border)", color: "var(--on-tile)", borderRadius: 0 }} aria-label="Settings">
                    <Icon name="settings" size={17} />
                  </button>
                </div>
              ) : null}
            </div>

          </div>

          <div className="text-center">
            <div className="mono-label" style={{ marginBottom: 14 }}>
              Ready to join?
            </div>
            <h1 className="h1-app" style={{ marginBottom: 6 }}>
              {interview.title}
            </h1>
            <p className="caption" style={{ marginBottom: 26 }}>
              {interview.count} questions · ~{interview.minutes} min
            </p>

            <div className="card rounded-lg" style={{ padding: 16, marginBottom: 22, textAlign: "left" }}>
              <div className="flex items-center gap-3">
                <AgentAvatar size={40} />
                <div className="grow">
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{voice.name} · TalkT interviewer</div>
                  <div className="caption">{interviewLanguage(interview)}</div>
                </div>
                <span className="flex items-center gap-2 mono" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                  <StatusDot color="var(--warn)" pulse /> Waiting
                </span>
              </div>
            </div>

            <TalkTButton variant="primary" size="lg" icon="phone" className="btn-block" onClick={join} disabled={phase === "connecting"}>
              {phase === "connecting" ? "Joining..." : "Join now"}
            </TalkTButton>
            <button type="button" onClick={() => navigate("detail", { interviewId: interview.id })} disabled={phase === "connecting"} className="btn btn-ghost btn-block" style={{ marginTop: 8 }}>
              Not yet - back to setup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TileToggle({ on, onIcon, offIcon, onClick, label }: { on: boolean; onIcon: string; offIcon: string; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        width: 40,
        height: 40,
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        border: `1px solid ${on ? "var(--tile-control-border)" : "var(--error)"}`,
        background: on ? "var(--tile-control-bg)" : "var(--error)",
        color: on ? "var(--on-tile)" : "var(--error-foreground)",
        borderRadius: 0,
        transition: "all var(--dur-fast)",
      }}
    >
      <Icon name={on ? onIcon : offIcon} size={17} />
    </button>
  );
}

