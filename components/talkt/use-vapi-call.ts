"use client";

// React hook around one @vapi-ai/web interview call.
// The assistant is created server-side; this hook only mirrors call state for the UI.
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
  if (incoming.segmentId && last && last.role === role && !last.segmentId && relatedText(last.text, incoming.text)) {
    const next = [...turns];
    next[next.length - 1] = incoming;
    return next;
  }

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

function relatedText(a: string, b: string): boolean {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  return left.length > 0 && right.length > 0 && (left.includes(right) || right.includes(left));
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

export function assistantSpeechFromMessage(
  msg: unknown,
): { role: "assistant"; text: string; final: true; segmentId: string } | null {
  const m = (msg ?? {}) as { type?: unknown; text?: unknown; turn?: unknown; timestamp?: unknown };
  if (m.type !== "assistant.speechStarted") return null;
  const text = typeof m.text === "string" ? m.text.trim() : "";
  if (!text) return null;
  const id =
    typeof m.turn === "number"
      ? `assistant-speech-${m.turn}`
      : typeof m.timestamp === "number"
        ? `assistant-speech-${m.timestamp}`
        : `assistant-speech-${text.slice(0, 48)}`;
  return { role: "assistant", text, final: true, segmentId: id };
}

export interface UseVapiCall {
  status: CallStatus;
  turns: TranscriptTurn[];
  assistantSpeaking: boolean;
  userSpeaking: boolean;
  volume: number;
  muted: boolean;
  error: string | null;
  // False until the first interviewer speech or transcript event arrives.
  interviewerStarted: boolean;
  // True when the user ends the call from the client.
  endedManually: boolean;
  start: (assistantId: string, publicKey: string) => Promise<void>;
  stop: (manual?: boolean) => void;
  toggleMute: () => void;
}

// Structural type for the lazily imported Vapi client.
interface VapiLike {
  start: (assistantId: string) => Promise<unknown>;
  stop: () => void | Promise<void>;
  end: () => void;
  setMuted: (muted: boolean) => void;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  removeAllListeners: () => void;
}

const UNMOUNT_CLEANUP_DELAY_MS = 50;

// Keep one active client across fast route changes and remounts.
let activeVapiClient: VapiLike | null = null;

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return Boolean(value && typeof value === "object" && "then" in value && typeof (value as { then?: unknown }).then === "function");
}

async function destroyVapiClient(vapi: VapiLike | null): Promise<void> {
  if (!vapi) return;
  try {
    vapi.removeAllListeners();
  } catch {
    /* ignore */
  }
  try {
    const stopped = vapi.stop();
    if (isPromiseLike(stopped)) await stopped;
  } catch {
    /* ignore */
  }
}

export function stopAction(manual: boolean, connected: boolean): "end" | "stop" {
  return manual && connected ? "end" : "stop";
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
  const [interviewerStarted, setInterviewerStarted] = React.useState(false);

  const vapiRef = React.useRef<VapiLike | null>(null);
  const connectedRef = React.useRef(false);
  const interviewerStartedRef = React.useRef(false);
  const userSpeakingTimer = React.useRef<number | null>(null);
  const assistantSpeechBuffer = React.useRef<Map<string, { text: string; segmentId: string }>>(new Map());
  const assistantSpeechSeenRef = React.useRef(false);
  const unmountCleanupTimer = React.useRef<number | null>(null);
  const startTokenRef = React.useRef(0);

  const cleanup = React.useCallback(() => {
    startTokenRef.current += 1;
    if (userSpeakingTimer.current) window.clearTimeout(userSpeakingTimer.current);
    userSpeakingTimer.current = null;
    if (unmountCleanupTimer.current) window.clearTimeout(unmountCleanupTimer.current);
    unmountCleanupTimer.current = null;
    assistantSpeechBuffer.current.clear();
    const v = vapiRef.current;
    vapiRef.current = null;
    if (activeVapiClient === v) activeVapiClient = null;
    connectedRef.current = false;
    void destroyVapiClient(v);
  }, []);

  React.useEffect(() => {
    if (unmountCleanupTimer.current) window.clearTimeout(unmountCleanupTimer.current);
    unmountCleanupTimer.current = null;

    return () => {
      unmountCleanupTimer.current = window.setTimeout(cleanup, UNMOUNT_CLEANUP_DELAY_MS);
    };
  }, [cleanup]);

  const pushTranscript = React.useCallback((role: "assistant" | "user", text: string, final: boolean, segmentId?: string) => {
    setTurns((prev) => mergeTurn(prev, role, text, final, segmentId));
  }, []);

  const flushAssistantSpeech = React.useCallback(() => {
    const buffered = Array.from(assistantSpeechBuffer.current.values());
    if (!buffered.length) return;
    assistantSpeechBuffer.current.clear();
    setTurns((prev) => buffered.reduce((next, item) => mergeTurn(next, "assistant", item.text, true, item.segmentId), prev));
  }, []);

  // Mark the interviewer as started on the first speech or transcript event.
  const markInterviewerStarted = React.useCallback(() => {
    if (interviewerStartedRef.current) return;
    interviewerStartedRef.current = true;
    setInterviewerStarted(true);
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
      assistantSpeechSeenRef.current = false;
      assistantSpeechBuffer.current.clear();
      setAssistantSpeaking(false);
      setUserSpeaking(false);
      setVolume(0);
      setEndedManually(false);
      setInterviewerStarted(false);
      interviewerStartedRef.current = false;
      if (unmountCleanupTimer.current) window.clearTimeout(unmountCleanupTimer.current);
      unmountCleanupTimer.current = null;

      const token = (startTokenRef.current += 1);

      try {
        const mod = await import("@vapi-ai/web");
        if (startTokenRef.current !== token) return;

        const previous = vapiRef.current;
        vapiRef.current = null;
        if (previous) {
          if (activeVapiClient === previous) activeVapiClient = null;
          await destroyVapiClient(previous);
        }

        const active = activeVapiClient;
        if (active) {
          activeVapiClient = null;
          await destroyVapiClient(active);
        }
        if (startTokenRef.current !== token) return;

        const Vapi = mod.default;
        const vapi = new Vapi(publicKey) as unknown as VapiLike;
        const isCurrent = () => startTokenRef.current === token && vapiRef.current === vapi;
        vapiRef.current = vapi;
        activeVapiClient = vapi;

        vapi.on("call-start", () => {
          if (!isCurrent()) return;
          connectedRef.current = true;
          setStatus("active");
        });

        vapi.on("call-end", () => {
          if (!isCurrent()) return;
          flushAssistantSpeech();
          setAssistantSpeaking(false);
          setUserSpeaking(false);
          setVolume(0);
          if (activeVapiClient === vapi) activeVapiClient = null;
          vapiRef.current = null;
          setStatus((s) => (s === "error" ? s : disconnectStatus(connectedRef.current)));
        });

        vapi.on("speech-start", () => {
          if (!isCurrent()) return;
          markInterviewerStarted();
          setAssistantSpeaking(true);
        });
        vapi.on("speech-end", () => {
          if (!isCurrent()) return;
          setAssistantSpeaking(false);
          flushAssistantSpeech();
        });

        vapi.on("volume-level", (...args: unknown[]) => {
          if (!isCurrent()) return;
          const level = typeof args[0] === "number" ? args[0] : 0;
          setVolume(level);
        });

        vapi.on("message", (...args: unknown[]) => {
          if (!isCurrent()) return;
          const speech = assistantSpeechFromMessage(args[0]);
          if (speech) {
            assistantSpeechSeenRef.current = true;
            markInterviewerStarted();
            assistantSpeechBuffer.current.set(speech.segmentId, { text: speech.text, segmentId: speech.segmentId });
            return;
          }

          const t = transcriptFromMessage(args[0]);
          if (!t || !t.text.trim()) return;
          if (t.role === "assistant") markInterviewerStarted();
          if (t.role === "assistant" && assistantSpeechSeenRef.current) return;
          pushTranscript(t.role, t.text, t.final);
          if (t.role === "user") {
            // Candidate speaking state follows transcript activity.
            setUserSpeaking(true);
            if (userSpeakingTimer.current) window.clearTimeout(userSpeakingTimer.current);
            userSpeakingTimer.current = window.setTimeout(() => setUserSpeaking(false), 1200);
          }
        });

        vapi.on("error", (...args: unknown[]) => {
          if (!isCurrent()) return;
          const err = args[0];
          const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "Voice service error";
          setError(msg);
          setStatus((s) => (connectedRef.current ? s : "error"));
        });

        await vapi.start(assistantId);
        if (!isCurrent()) await destroyVapiClient(vapi);
      } catch (err) {
        if (startTokenRef.current !== token) return;
        setError(err instanceof Error ? err.message : "Failed to start call");
        setStatus("error");
        cleanup();
      }
    },
    [cleanup, pushTranscript, markInterviewerStarted, flushAssistantSpeech],
  );

  const stop = React.useCallback((manual = false) => {
    if (manual) setEndedManually(true);
    try {
      const vapi = vapiRef.current;
      if (!vapi) {
        if (manual) setStatus("ended");
        return;
      }
      const action = stopAction(manual, connectedRef.current);
      if (action === "end") vapi.end();
      else void vapi.stop();
      if (manual) setStatus((s) => (s === "error" ? s : "ended"));
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
    () => ({ status, turns, assistantSpeaking, userSpeaking, volume, muted, error, interviewerStarted, endedManually, start, stop, toggleMute }),
    [status, turns, assistantSpeaking, userSpeaking, volume, muted, error, interviewerStarted, endedManually, start, stop, toggleMute],
  );
}
