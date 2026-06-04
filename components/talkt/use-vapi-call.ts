"use client";

// React hook around the Vapi Web SDK for a single interview call.
// Exposes call status, a live transcript, and speaker flags (assistant vs you)
// derived from SDK events:
//   - speech-start/speech-end/volume-level fire for the *remote* participant
//     (the interviewer), so they drive `assistantSpeaking`.
//   - `userSpeaking` is inferred from partial user transcripts.
// The SDK is imported lazily on start() so it never runs during SSR.
import * as React from "react";

export type CallStatus = "idle" | "connecting" | "active" | "ended" | "error";

export interface TranscriptTurn {
  role: "assistant" | "user";
  text: string;
  final: boolean;
}

interface VapiMessage {
  type?: string;
  role?: "assistant" | "user";
  transcript?: string;
  transcriptType?: "partial" | "final";
}

// Pull a human-readable message out of the assorted error shapes the Web SDK
// and underlying Daily transport throw (string | Error | {errorMsg|message|type}
// | {error:{message}}).
function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function extractVapiErrorMessage(raw: unknown): string {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  if (raw instanceof Error) return raw.message;

  const seen = new Set<Record<string, unknown>>();
  const readMessage = (value: unknown): string | undefined => {
    const record = asRecord(value);
    if (!record || seen.has(record)) return undefined;
    seen.add(record);

    for (const key of ["errorMsg", "message", "msg"]) {
      const message = nonEmptyString(record[key]);
      if (message) return message;
    }

    for (const key of ["error", "message", "details"]) {
      const message = readMessage(record[key]);
      if (message) return message;
    }

    return nonEmptyString(record.type);
  };

  return readMessage(raw) ?? "";
}

// Daily/Vapi emit these as `error` events during a *normal* call teardown.
// They mean the call ended, not that it failed — never show the error screen.
const BENIGN_END_PATTERNS = [
  "meeting has ended",
  "meeting ended",
  "room was deleted",
  "signaling connection interrupted",
  "ejected",
];
export function isVapiBenignEnd(msg: string): boolean {
  const m = msg.toLowerCase();
  return BENIGN_END_PATTERNS.some((p) => m.includes(p));
}

// Minimal structural type for the Vapi Web SDK instance we use.
interface VapiInstance {
  start: (assistant: unknown) => Promise<unknown>;
  stop: () => void;
  setMuted: (muted: boolean) => void;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  removeAllListeners: () => void;
}

export interface UseVapiCall {
  status: CallStatus;
  turns: TranscriptTurn[];
  assistantSpeaking: boolean;
  userSpeaking: boolean;
  volume: number;
  muted: boolean;
  callId: string | null;
  error: string | null;
  start: (publicKey: string, assistant: unknown) => Promise<void>;
  stop: () => void;
  toggleMute: () => void;
}

export function useVapiCall(): UseVapiCall {
  const [status, setStatus] = React.useState<CallStatus>("idle");
  const [turns, setTurns] = React.useState<TranscriptTurn[]>([]);
  const [assistantSpeaking, setAssistantSpeaking] = React.useState(false);
  const [userSpeaking, setUserSpeaking] = React.useState(false);
  const [volume, setVolume] = React.useState(0);
  const [muted, setMuted] = React.useState(false);
  const [callId, setCallId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const vapiRef = React.useRef<VapiInstance | null>(null);
  const userIdleTimer = React.useRef<number | null>(null);
  // Set once the call connects — used to distinguish a normal teardown
  // disconnect (route to results) from a genuine connect failure (error screen).
  const connectedRef = React.useRef(false);

  const cleanup = React.useCallback(() => {
    if (userIdleTimer.current) window.clearTimeout(userIdleTimer.current);
    const vapi = vapiRef.current;
    if (vapi) {
      try {
        vapi.stop();
      } catch {
        /* ignore — may not have connected yet */
      }
      try {
        vapi.removeAllListeners();
      } catch {
        /* ignore */
      }
      vapiRef.current = null;
    }
  }, []);

  React.useEffect(() => cleanup, [cleanup]);

  // Append a final turn, or replace the trailing partial for the same role.
  const pushTranscript = React.useCallback((role: "assistant" | "user", text: string, final: boolean) => {
    setTurns((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last && last.role === role && !last.final) {
        next[next.length - 1] = { role, text, final };
      } else {
        next.push({ role, text, final });
      }
      return next;
    });
  }, []);

  const start = React.useCallback(
    async (publicKey: string, assistant: unknown) => {
      if (!publicKey) {
        setError("Voice key missing");
        setStatus("error");
        return;
      }
      setStatus("connecting");
      setError(null);
      setTurns([]);
      connectedRef.current = false;

      try {
        const mod = await import("@vapi-ai/web");
        const Vapi = (mod.default ?? mod) as new (key: string) => VapiInstance;
        const vapi = new Vapi(publicKey);
        vapiRef.current = vapi;

        vapi.on("call-start", () => {
          connectedRef.current = true;
          setStatus("active");
        });
        vapi.on("call-start-success", (...args: unknown[]) => {
          const e = args[0] as { callId?: string } | undefined;
          if (e?.callId) setCallId(e.callId);
        });
        vapi.on("call-end", () => {
          setAssistantSpeaking(false);
          setUserSpeaking(false);
          setStatus("ended");
        });
        vapi.on("speech-start", () => setAssistantSpeaking(true));
        vapi.on("speech-end", () => setAssistantSpeaking(false));
        vapi.on("volume-level", (...args: unknown[]) => setVolume(Number(args[0]) || 0));
        vapi.on("message", (...args: unknown[]) => {
          const msg = args[0] as VapiMessage;
          if (msg?.type !== "transcript" || typeof msg.transcript !== "string") return;
          const role = msg.role === "user" ? "user" : "assistant";
          const final = msg.transcriptType === "final";
          pushTranscript(role, msg.transcript, final);

          if (role === "user") {
            setUserSpeaking(true);
            if (userIdleTimer.current) window.clearTimeout(userIdleTimer.current);
            userIdleTimer.current = window.setTimeout(() => setUserSpeaking(false), final ? 200 : 1200);
          }
        });
        vapi.on("error", (...args: unknown[]) => {
          const raw = args[0];
          const msg = extractVapiErrorMessage(raw);
          // A benign teardown disconnect, or any error after we've connected,
          // means the call is over — end gracefully and let the results poller
          // take over instead of showing the connect-failed screen.
          if (isVapiBenignEnd(msg) || connectedRef.current) {
            console.debug("[vapi] call ended:", msg || raw);
            setAssistantSpeaking(false);
            setUserSpeaking(false);
            setStatus((s) => (s === "error" ? s : "ended"));
            return;
          }
          // Pre-connect failure (bad key, invalid assistant, transport refused).
          console.error("[vapi] call error:", raw);
          setError(msg || "Call error");
          setStatus("error");
        });

        await vapi.start(assistant);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to start call");
        setStatus("error");
        cleanup();
      }
    },
    [cleanup, pushTranscript],
  );

  const stop = React.useCallback(() => {
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

  return { status, turns, assistantSpeaking, userSpeaking, volume, muted, callId, error, start, stop, toggleMute };
}
