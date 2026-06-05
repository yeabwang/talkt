"use client";

// React hook around `livekit-client` for a single interview call. It keeps the
// compact surface `live-screen.tsx` consumes.
//
// The candidate joins the room minted server-side (spec 16) with a token that
// also dispatches the interviewer worker (spec 15). We publish the mic, play the
// agent's audio, and stream transcripts via the `lk.transcription` text stream.
// Speaker flags come from active-speaker / agent-state signals.
//
// `livekit-client` is imported lazily on start() so it never runs during SSR.
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

// LiveKit topic the agent publishes interim + final transcriptions on.
const TRANSCRIPTION_TOPIC = "lk.transcription";

// ── Pure helpers (unit-tested in tests/unit/livekit-call.test.ts) ──────────

/**
 * Append a final turn, or replace the trailing partial for the same role. The
 * transcript drawer depends on this stable merge behavior.
 */
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

/**
 * Classify a transcription text stream by its sender: the local participant is
 * the candidate ("user"); everyone else (the agent) is "assistant".
 */
export function transcriptRole(localIdentity: string | null, senderIdentity: string): "assistant" | "user" {
  return localIdentity && senderIdentity === localIdentity ? "user" : "assistant";
}

/** Read the `lk.transcription_final` stream attribute (it arrives as a string). */
export function isFinalTranscript(attributes: Record<string, string> | undefined): boolean {
  const v = attributes?.["lk.transcription_final"];
  return v === "true" || (v as unknown) === true;
}

function transcriptSegmentId(attributes: Record<string, string> | undefined, streamId: string): string {
  return attributes?.["lk.segment_id"] ?? streamId;
}

/**
 * Map a `Disconnected` event to a status. After a successful connect, any
 * disconnect is a normal end (the worker closed the session / the agent left, or
 * the candidate hit End) — never the connect-failed screen. A disconnect before
 * connect is a genuine failure.
 */
export function disconnectStatus(connected: boolean): CallStatus {
  return connected ? "ended" : "error";
}

// ── Hook ───────────────────────────────────────────────────────────────────

export interface UseLiveKitCall {
  status: CallStatus;
  turns: TranscriptTurn[];
  assistantSpeaking: boolean;
  userSpeaking: boolean;
  volume: number;
  muted: boolean;
  roomName: string | null;
  error: string | null;
  noInputDetected: boolean;
  // True once the candidate ended the call themselves (hit End). Drives only the
  // "you ended early" UI copy — the worker decides completed-vs-abandoned.
  endedManually: boolean;
  start: (serverUrl: string, token: string) => Promise<void>;
  stop: (manual?: boolean) => void;
  toggleMute: () => void;
}

// Minimal structural type for the `Room` instance we drive — avoids importing
// types from `livekit-client` at module scope (it's lazy-loaded in start()).
interface RoomLike {
  name: string;
  localParticipant: { identity: string; setMicrophoneEnabled: (enabled: boolean) => Promise<unknown> };
  on: (event: string, cb: (...args: unknown[]) => void) => RoomLike;
  connect: (url: string, token: string) => Promise<void>;
  disconnect: () => Promise<void>;
  registerTextStreamHandler: (topic: string, cb: (reader: TextReaderLike, info: { identity: string }) => void) => void;
  unregisterTextStreamHandler?: (topic: string) => void;
}

interface TextReaderLike extends AsyncIterable<string> {
  info: { id: string; attributes?: Record<string, string> };
}

interface SpeakerLike {
  identity: string;
  audioLevel: number;
}

export function useLiveKitCall(): UseLiveKitCall {
  const [status, setStatus] = React.useState<CallStatus>("idle");
  const [turns, setTurns] = React.useState<TranscriptTurn[]>([]);
  const [assistantSpeaking, setAssistantSpeaking] = React.useState(false);
  const [userSpeaking, setUserSpeaking] = React.useState(false);
  const [volume, setVolume] = React.useState(0);
  const [muted, setMuted] = React.useState(false);
  const [roomName, setRoomName] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [endedManually, setEndedManually] = React.useState(false);
  // Set when we connect but never receive a single user transcript — a strong
  // sign the candidate's mic isn't reaching the room (so they'd go ungraded).
  const [noInputDetected, setNoInputDetected] = React.useState(false);

  const roomRef = React.useRef<RoomLike | null>(null);
  const audioElsRef = React.useRef<HTMLMediaElement[]>([]);
  const noInputTimer = React.useRef<number | null>(null);
  const heardUserRef = React.useRef(false);
  // Set once connected — distinguishes a normal teardown from a connect failure.
  const connectedRef = React.useRef(false);
  // Once the agent reports its own state attribute, trust it over active-speaker
  // heuristics for the assistant tile.
  const sawAgentStateRef = React.useRef(false);
  const assistantSpeakingRef = React.useRef(false);
  const userSpeakingRef = React.useRef(false);
  const volumeRef = React.useRef(0);

  const cleanup = React.useCallback(() => {
    if (noInputTimer.current) {
      window.clearTimeout(noInputTimer.current);
      noInputTimer.current = null;
    }
    for (const el of audioElsRef.current) {
      try {
        el.remove();
      } catch {
        /* ignore */
      }
    }
    audioElsRef.current = [];
    const room = roomRef.current;
    if (room) {
      room.unregisterTextStreamHandler?.(TRANSCRIPTION_TOPIC);
      void room.disconnect().catch(() => {});
      roomRef.current = null;
    }
  }, []);

  React.useEffect(() => cleanup, [cleanup]);

  const pushTranscript = React.useCallback((role: "assistant" | "user", text: string, final: boolean, segmentId?: string) => {
    setTurns((prev) => mergeTurn(prev, role, text, final, segmentId));
  }, []);

  const setAssistantSpeakingStable = React.useCallback((next: boolean) => {
    if (assistantSpeakingRef.current === next) return;
    assistantSpeakingRef.current = next;
    setAssistantSpeaking(next);
  }, []);

  const setUserSpeakingStable = React.useCallback((next: boolean) => {
    if (userSpeakingRef.current === next) return;
    userSpeakingRef.current = next;
    setUserSpeaking(next);
  }, []);

  const setVolumeStable = React.useCallback((next: number) => {
    const normalized = Number.isFinite(next) ? next : 0;
    if (Math.abs(volumeRef.current - normalized) < 0.02) return;
    volumeRef.current = normalized;
    setVolume(normalized);
  }, []);

  const start = React.useCallback(
    async (serverUrl: string, token: string) => {
      if (!serverUrl || !token) {
        setError("Call session missing");
        setStatus("error");
        return;
      }
      setStatus("connecting");
      setError(null);
      setTurns([]);
      connectedRef.current = false;
      heardUserRef.current = false;
      sawAgentStateRef.current = false;
      assistantSpeakingRef.current = false;
      userSpeakingRef.current = false;
      volumeRef.current = 0;
      setAssistantSpeaking(false);
      setUserSpeaking(false);
      setVolume(0);
      setNoInputDetected(false);
      setEndedManually(false);

      try {
        const lk = await import("livekit-client");
        const { Room, RoomEvent, Track } = lk;
        const room = new Room() as unknown as RoomLike;
        roomRef.current = room;

        const localId = () => room.localParticipant.identity;

        room.on(RoomEvent.Disconnected, () => {
          setAssistantSpeakingStable(false);
          setUserSpeakingStable(false);
          setVolumeStable(0);
          setStatus((s) => (s === "error" ? s : disconnectStatus(connectedRef.current)));
        });

        // Auto-subscribed remote audio (the interviewer): attach to a hidden
        // element so it plays. Detached on cleanup.
        room.on(RoomEvent.TrackSubscribed, (...args: unknown[]) => {
          const track = args[0] as { kind?: string; attach?: () => HTMLMediaElement };
          if (track?.kind === Track.Kind.Audio && typeof track.attach === "function") {
            const el = track.attach();
            el.style.display = "none";
            document.body.appendChild(el);
            audioElsRef.current.push(el);
          }
        });

        // Speaker flags: local participant → you; anyone else → the interviewer.
        room.on(RoomEvent.ActiveSpeakersChanged, (...args: unknown[]) => {
          const speakers = (args[0] as SpeakerLike[]) ?? [];
          const id = localId();
          let you = false;
          let agent = false;
          let vol = 0;
          for (const s of speakers) {
            if (s.identity === id) {
              you = true;
              vol = s.audioLevel ?? 0;
            } else {
              agent = true;
            }
          }
          setUserSpeakingStable(you);
          setVolumeStable(you ? vol : 0);
          // The agent's own state attribute is more precise; defer to it once seen.
          if (!sawAgentStateRef.current) setAssistantSpeakingStable(agent);
        });

        // The agent publishes `lk.agent.state` (…|speaking|listening|thinking).
        // Authoritative for the interviewer tile once present.
        room.on(RoomEvent.ParticipantAttributesChanged, (...args: unknown[]) => {
          const changed = args[0] as Record<string, string> | undefined;
          if (!changed || !("lk.agent.state" in changed)) return;
          sawAgentStateRef.current = true;
          setAssistantSpeakingStable(changed["lk.agent.state"] === "speaking");
        });

        // Streamed transcriptions (interim + final), role by sender identity.
        room.registerTextStreamHandler(TRANSCRIPTION_TOPIC, (reader, sender) => {
          const role = transcriptRole(localId(), sender.identity);
          const segmentId = transcriptSegmentId(reader.info.attributes, reader.info.id);
          void (async () => {
            let text = "";
            try {
              for await (const chunk of reader) {
                text = chunk;
                pushTranscript(role, text, false, segmentId);
                if (role === "user" && text.trim()) {
                  heardUserRef.current = true;
                  setNoInputDetected(false);
                }
              }
            } catch {
              /* stream aborted on teardown — keep whatever we have */
            }
            const final = isFinalTranscript(reader.info.attributes);
            pushTranscript(role, text, final, segmentId);
            if (role === "user") {
              heardUserRef.current = true;
              setNoInputDetected(false); // React bails if already false — no extra render
            }
          })();
        });

        await room.connect(serverUrl, token);

        // Connected — publish the mic and go active.
        connectedRef.current = true;
        setRoomName(room.name);
        setStatus("active");
        await room.localParticipant.setMicrophoneEnabled(true);

        // If no user transcript lands within ~10s, the mic almost certainly isn't
        // reaching the room — flag it so the UI can warn the candidate.
        if (noInputTimer.current) window.clearTimeout(noInputTimer.current);
        noInputTimer.current = window.setTimeout(() => {
          if (!heardUserRef.current) {
            console.warn("[livekit] no candidate audio ~10s after connect — mic may not be captured");
            setNoInputDetected(true);
          }
        }, 10_000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to start call");
        setStatus("error");
        cleanup();
      }
    },
    [cleanup, pushTranscript, setAssistantSpeakingStable, setUserSpeakingStable, setVolumeStable],
  );

  // `manual` marks a candidate-initiated hang-up (the End button) so the UI shows
  // the "you ended early" copy. The worker still owns the completed/abandoned call.
  const stop = React.useCallback((manual = false) => {
    if (manual) setEndedManually(true);
    void roomRef.current?.disconnect().catch(() => {});
  }, []);

  const toggleMute = React.useCallback(() => {
    setMuted((m) => {
      const next = !m;
      void roomRef.current?.localParticipant.setMicrophoneEnabled(!next).catch(() => {});
      return next;
    });
  }, []);

  return React.useMemo(
    () => ({ status, turns, assistantSpeaking, userSpeaking, volume, muted, roomName, error, noInputDetected, endedManually, start, stop, toggleMute }),
    [status, turns, assistantSpeaking, userSpeaking, volume, muted, roomName, error, noInputDetected, endedManually, start, stop, toggleMute],
  );
}
