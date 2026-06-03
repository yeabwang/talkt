"use client";

import * as React from "react";

import { startCall, type CallSession } from "@/components/talkt/api";
import { interviewLanguage, type AppUser, type Interview } from "@/components/talkt/data";
import type { TalkTRoute } from "@/components/talkt/app-shell";
import { AgentAvatar, Avatar, Icon, StatusDot, TalkTButton, Waveform, Wordmark } from "@/components/talkt/primitives";

type MicState = "idle" | "requesting" | "granted" | "denied";

export function LobbyScreen({
  interview,
  user,
  navigate,
  onJoin,
}: {
  interview: Interview;
  user: AppUser;
  navigate: (route: TalkTRoute, params?: Record<string, unknown>) => void;
  // Hands the live screen the server-resolved call session + the optional local
  // camera stream (self-view only; video is never sent to the interviewer).
  onJoin: (session: CallSession, camStream: MediaStream | null) => void;
}) {
  const [micState, setMicState] = React.useState<MicState>("requesting");
  const [micOn, setMicOn] = React.useState(true);
  const [camOn, setCamOn] = React.useState(false);
  const [phase, setPhase] = React.useState<"ready" | "connecting" | "error">("ready");
  const [error, setError] = React.useState<string | null>(null);

  const camStreamRef = React.useRef<MediaStream | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  // Ask for microphone authorization up front so the permission prompt isn't a
  // surprise mid-join. We only need the grant; the preview stream is released
  // immediately so it doesn't hold the device while Vapi acquires it.
  React.useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        stream.getTracks().forEach((t) => t.stop());
        if (!cancelled) setMicState("granted");
      })
      .catch(() => {
        if (!cancelled) setMicState("denied");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Acquire / release the local camera as the toggle flips. Local self-view only.
  React.useEffect(() => {
    let cancelled = false;
    if (camOn) {
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          camStreamRef.current = stream;
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch(() => {
          if (!cancelled) setCamOn(false);
        });
    } else if (camStreamRef.current) {
      camStreamRef.current.getTracks().forEach((t) => t.stop());
      camStreamRef.current = null;
    }
    return () => {
      cancelled = true;
    };
  }, [camOn]);

  // Release the camera if we leave the lobby without joining.
  React.useEffect(() => {
    return () => {
      if (camStreamRef.current) camStreamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const join = async () => {
    if (micState === "denied") {
      setError("Microphone access is required. Enable it in your browser and reload.");
      return;
    }
    setPhase("connecting");
    setError(null);
    try {
      const session = await startCall(interview.id);
      // Hand the camera stream to the live screen (or null when off). We hand off
      // ownership; the live screen is responsible for stopping it.
      const cam = camStreamRef.current;
      camStreamRef.current = null;
      onJoin(session, cam);
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "Couldn't start the interview. Try again.");
    }
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

              {/* Local camera self-view (audio-only call; video stays in the browser). */}
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: camOn ? "block" : "none", transform: "scaleX(-1)" }}
              />

              {phase === "connecting" ? (
                <div className="relative text-center fade-in">
                  <div style={{ marginBottom: 18, display: "flex", justifyContent: "center" }}>
                    <AgentAvatar size={64} active />
                  </div>
                  <div className="flex items-center justify-center gap-2 mono" style={{ color: "var(--on-tile)", fontSize: 13 }}>
                    <Icon name="loader" size={15} className="spin" /> Connecting to TalkT
                    <span className="cursor-blink" />
                  </div>
                </div>
              ) : camOn ? null : (
                <div className="relative text-center">
                  <Avatar name={user.name} size={84} />
                  <div className="mono" style={{ marginTop: 16, fontSize: 13, color: "var(--on-tile)" }}>
                    {user.name}
                  </div>
                  <div style={{ height: 34, marginTop: 16, display: "flex", justifyContent: "center" }}>
                    {micOn && micState === "granted" ? (
                      <Waveform active bars={20} height={26} color="var(--on-tile)" thin />
                    ) : (
                      <span className="mono" style={{ fontSize: 11, color: "var(--dimmed)" }}>
                        {micState === "denied" ? "Microphone blocked" : micState === "requesting" ? "Requesting microphone…" : "Microphone off"}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {phase !== "connecting" ? (
                <div style={{ position: "absolute", bottom: 14, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 10 }}>
                  <TileToggle on={micOn} onIcon="mic" offIcon="mic-off" onClick={() => setMicOn((value) => !value)} label="mic" />
                  <TileToggle on={camOn} onIcon="video" offIcon="video-off" onClick={() => setCamOn((value) => !value)} label="camera" />
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
                  <div style={{ fontWeight: 500, fontSize: 14 }}>TalkT interviewer</div>
                  <div className="caption">{interviewLanguage(interview)}</div>
                </div>
                <span className="flex items-center gap-2 mono" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                  <StatusDot color="var(--warn)" pulse /> Waiting
                </span>
              </div>
            </div>

            {micState === "denied" ? (
              <div className="card rounded-lg" style={{ padding: 12, marginBottom: 14, textAlign: "left", borderColor: "var(--error)" }}>
                <div className="flex items-center gap-2" style={{ color: "var(--error)", fontSize: 13 }}>
                  <Icon name="mic-off" size={15} /> Microphone access is blocked — enable it and reload to start.
                </div>
              </div>
            ) : null}
            {error ? (
              <p className="caption" style={{ marginBottom: 14, color: "var(--error)" }}>
                {error}
              </p>
            ) : null}

            <TalkTButton variant="primary" size="lg" icon="phone" className="btn-block" onClick={join} disabled={phase === "connecting" || micState === "denied" || micState === "requesting"}>
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
