"use client";

// React hook around `@vapi-ai/web` for a single interview web call. Keeps the
// compact surface `live-screen.tsx` consumes. The browser starts the call with
// the ephemeral assistant id minted server-side (the prompt/questions never reach
// here). Vapi runs STT/LLM/TTS; we mirror transcript + speaking state for the UI.
//
// `@vapi-ai/web` is imported lazily on start() so it never runs during SSR.
import * as React from "react";

export type CallStatus = "idle" | "connecting" | "active" | "ended" | "error";

export interface TranscriptTurn {
  role: "assistant" | "user";
  text: string;
  final: boolean;
  segmentId?: string;
}

export interface TranscriptBlock {
  role: "assistant" | "user";
  text: string;
  final: boolean;
}

// ── Pure helpers (unit-tested in tests/unit/vapi-call.test.ts) ──────────────

/** Append a final turn, or replace the trailing partial for the same role. */
export function mergeTurn(
  turns: TranscriptTurn[],
  role: "assistant" | "user",
  text: string,
  final: boolean,
  segmentId?: string,
): TranscriptTurn[] {
  const clean = text.trim();
  if (!clean) return turns;

  const incoming: TranscriptTurn = segmentId ? { role, text: clean, final, segmentId } : { role, text: clean, final };
  const existingIndex = segmentId ? turns.findIndex((turn) => turn.segmentId === segmentId) : -1;
  if (existingIndex >= 0) {
    const existing = turns[existingIndex];
    if (sameTurn(existing, incoming)) return turns;
    const next = [...turns];
    next[existingIndex] = incoming;
    return next;
  }

  const last = turns[turns.length - 1];
  if (last && last.role === role && !last.final && !last.segmentId) {
    if (sameTurn(last, incoming)) return turns;
    const next = [...turns];
    next[next.length - 1] = incoming;
    return next;
  }

  return [...turns, incoming];
}

function sameTurn(a: TranscriptTurn, b: TranscriptTurn): boolean {
  return a.role === b.role && a.text === b.text && a.final === b.final && a.segmentId === b.segmentId;
}

export function transcriptBlocks(turns: TranscriptTurn[]): TranscriptBlock[] {
  const blocks: TranscriptBlock[] = [];
  for (const turn of turns) {
    const text = turn.text.trim();
    if (!text) continue;
    const last = blocks[blocks.length - 1];
    if (last && last.role === turn.role) {
      last.text = `${last.text} ${text}`.trim();
      last.final = last.final && turn.final;
    } else {
      blocks.push({ role: turn.role, text, final: turn.final });
    }
  }
  return blocks;
}

/** After a successful connect, any end is normal; an end before connect is a
 * genuine failure. */
export function disconnectStatus(connected: boolean): CallStatus {
  return connected ? "ended" : "error";
}

/** Normalize a Vapi `message` (type "transcript") to our turn fields. Returns
 * null for non-transcript messages. */
export function transcriptFromMessage(
  msg: unknown,
): { role: "assistant" | "user"; text: string; final: boolean } | null {
  const m = (msg ?? {}) as { type?: unknown; role?: unknown; transcript?: unknown; transcriptType?: unknown };
  if (m.type !== "transcript") return null;
  const role = m.role === "user" ? "user" : "assistant";
  const text = typeof m.transcript === "string" ? m.transcript : "";
  const final = m.transcriptType === "final";
  return { role, text, final };
}

// ── Hook ───────────────────────────────────────────────────────────────────

export interface UseVapiCall {
  status: CallStatus;
  turns: TranscriptTurn[];
  assistantSpeaking: boolean;
  userSpeaking: boolean;
  volume: number;
  muted: boolean;
  error: string | null;
  noInputDetected: boolean;
  // True once the candidate ended the call themselves (hit End). Drives only the
  // "you ended early" UI copy — the webhook decides completed-vs-abandoned.
  endedManually: boolean;
  start: (assistantId: string, publicKey: string) => Promise<void>;
  stop: (manual?: boolean) => void;
  toggleMute: () => void;
}

// Minimal structural type for the Vapi client (lazy-loaded in start()).
interface VapiLike {
  start: (assistantId: string) => Promise<unknown>;
  stop: () => void;
  setMuted: (muted: boolean) => void;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  removeAllListeners: () => void;
}

export function useVapiCall(): UseVapiCall {
  const [status, setStatus] = React.useState<CallStatus>("idle");
  const [turns, setTurns] = React.useState<TranscriptTurn[]>([]);
  const [assistantSpeaking, setAssistantSpeaking] = React.useState(false);
  const [userSpeaking, setUserSpeaking] = React.useState(false);
  const [volume, setVolume] = React.useState(0);
  const [muted, setMuted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [endedManually, setEndedManually] = React.useState(false);
  const [noInputDetected, setNoInputDetected] = React.useState(false);

  const vapiRef = React.useRef<VapiLike | null>(null);
  const connectedRef = React.useRef(false);
  const heardUserRef = React.useRef(false);
  const noInputTimer = React.useRef<number | null>(null);
  const userSpeakingTimer = React.useRef<number | null>(null);

  const cleanup = React.useCallback(() => {
    if (noInputTimer.current) window.clearTimeout(noInputTimer.current);
    if (userSpeakingTimer.current) window.clearTimeout(userSpeakingTimer.current);
    noInputTimer.current = null;
    userSpeakingTimer.current = null;
    const v = vapiRef.current;
    if (v) {
      try {
        v.removeAllListeners();
        v.stop();
      } catch {
        /* ignore */
      }
      vapiRef.current = null;
    }
  }, []);

  React.useEffect(() => cleanup, [cleanup]);

  const pushTranscript = React.useCallback((role: "assistant" | "user", text: string, final: boolean) => {
    setTurns((prev) => mergeTurn(prev, role, text, final));
  }, []);

  const start = React.useCallback(
    async (assistantId: string, publicKey: string) => {
      if (!assistantId || !publicKey) {
        setError("Call session missing");
        setStatus("error");
        return;
      }
      setStatus("connecting");
      setError(null);
      setTurns([]);
      connectedRef.current = false;
      heardUserRef.current = false;
      setAssistantSpeaking(false);
      setUserSpeaking(false);
      setVolume(0);
      setNoInputDetected(false);
      setEndedManually(false);

      try {
        const mod = await import("@vapi-ai/web");
        const Vapi = mod.default;
        const vapi = new Vapi(publicKey) as unknown as VapiLike;
        vapiRef.current = vapi;

        vapi.on("call-start", () => {
          connectedRef.current = true;
          setStatus("active");
          if (noInputTimer.current) window.clearTimeout(noInputTimer.current);
          noInputTimer.current = window.setTimeout(() => {
            if (!heardUserRef.current) {
              console.warn("[vapi] no candidate audio ~10s after connect — mic may not be captured");
              setNoInputDetected(true);
            }
          }, 10_000);
        });

        vapi.on("call-end", () => {
          setAssistantSpeaking(false);
          setUserSpeaking(false);
          setVolume(0);
          setStatus((s) => (s === "error" ? s : disconnectStatus(connectedRef.current)));
        });

        vapi.on("speech-start", () => setAssistantSpeaking(true));
        vapi.on("speech-end", () => setAssistantSpeaking(false));

        vapi.on("volume-level", (...args: unknown[]) => {
          const level = typeof args[0] === "number" ? args[0] : 0;
          setVolume(level);
        });

        vapi.on("message", (...args: unknown[]) => {
          const t = transcriptFromMessage(args[0]);
          if (!t || !t.text.trim()) return;
          pushTranscript(t.role, t.text, t.final);
          if (t.role === "user") {
            heardUserRef.current = true;
            setNoInputDetected(false);
            // Drive the candidate tile's speaking flag off transcript activity.
            setUserSpeaking(true);
            if (userSpeakingTimer.current) window.clearTimeout(userSpeakingTimer.current);
            userSpeakingTimer.current = window.setTimeout(() => setUserSpeaking(false), 1200);
          }
        });

        vapi.on("error", (...args: unknown[]) => {
          const err = args[0];
          const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "Voice service error";
          setError(msg);
          setStatus((s) => (connectedRef.current ? s : "error"));
        });

        await vapi.start(assistantId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to start call");
        setStatus("error");
        cleanup();
      }
    },
    [cleanup, pushTranscript],
  );

  const stop = React.useCallback((manual = false) => {
    if (manual) setEndedManually(true);
    try {
      vapiRef.current?.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const toggleMute = React.useCallback(() => {
    setMuted((m) => {
      const next = !m;
      try {
        vapiRef.current?.setMuted(next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return React.useMemo(
    () => ({ status, turns, assistantSpeaking, userSpeaking, volume, muted, error, noInputDetected, endedManually, start, stop, toggleMute }),
    [status, turns, assistantSpeaking, userSpeaking, volume, muted, error, noInputDetected, endedManually, start, stop, toggleMute],
  );
}
