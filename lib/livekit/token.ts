// Server-only LiveKit token + agent-dispatch minting. The candidate receives a
// short-lived room join token; token-based agent dispatch (RoomConfiguration +
// RoomAgentDispatch) sends the interviewer worker (spec 15) into the room the
// moment the browser creates it.
//
// Never import from a client component (uses LIVEKIT_API_SECRET).
import { AccessToken, RoomAgentDispatch, RoomConfiguration } from "livekit-server-sdk";

import type { InterviewJob } from "@/lib/livekit/job";

// The worker registers under this name (agent/src/index.ts ServerOptions.agentName).
const AGENT_NAME = "talkt-interviewer";

// Long enough for the browser to join, short enough not to hoard.
const TOKEN_TTL = "15m";

export interface MintCallTokenArgs {
  userId: string; // Clerk userId — one human per room
  roomName: string; // deterministic "attempt_<id>"
  job: InterviewJob; // dispatch metadata the worker consumes
}

export interface MintedCall {
  token: string;
  serverUrl: string; // LIVEKIT_URL the browser connects to
}

/**
 * Mint a room-join JWT for `userId` into `roomName`, with token-based dispatch of
 * the `talkt-interviewer` agent carrying the interview job as metadata. The
 * dispatch fires when the room is first created — exactly the one-room-per-attempt
 * model. Returns the token plus the server URL the browser dials.
 */
export async function mintCallToken(args: MintCallTokenArgs): Promise<MintedCall> {
  const { userId, roomName, job } = args;

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const serverUrl = process.env.LIVEKIT_URL;
  if (!apiKey || !apiSecret || !serverUrl) {
    throw new Error("LiveKit is not configured (LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET).");
  }

  const at = new AccessToken(apiKey, apiSecret, { identity: userId, ttl: TOKEN_TTL });
  at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
  at.roomConfig = new RoomConfiguration({
    agents: [new RoomAgentDispatch({ agentName: AGENT_NAME, metadata: JSON.stringify(job) })],
  });

  return { token: await at.toJwt(), serverUrl };
}
