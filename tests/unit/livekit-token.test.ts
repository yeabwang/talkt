import assert from "node:assert/strict";
import test from "node:test";

import { TokenVerifier } from "livekit-server-sdk";

import type { InterviewJob } from "@/lib/livekit/job";
import { mintCallToken } from "@/lib/livekit/token";

const API_KEY = "devkey";
const API_SECRET = "this-is-a-test-secret-at-least-32-bytes-long";

process.env.LIVEKIT_API_KEY = API_KEY;
process.env.LIVEKIT_API_SECRET = API_SECRET;
process.env.LIVEKIT_URL = "wss://test.livekit.cloud";

const job: InterviewJob = {
  attemptId: "att_42",
  interviewTitle: "Frontend engineer",
  interviewerName: "Adi",
  persona: "adi",
  languageCode: "en",
  languageLabel: "English",
  questions: ["Q1", "Q2"],
  candidateFirstName: "Sam",
  maxDurationSeconds: 1020,
};

test("mintCallToken returns the configured server URL", async () => {
  const { serverUrl } = await mintCallToken({ userId: "user_1", roomName: "attempt_att_42", job });
  assert.equal(serverUrl, "wss://test.livekit.cloud");
});

test("minted token encodes identity, room grant, and agent dispatch", async () => {
  const { token } = await mintCallToken({ userId: "user_1", roomName: "attempt_att_42", job });
  assert.ok(token.length > 0);

  const claims = await new TokenVerifier(API_KEY, API_SECRET).verify(token);

  // Identity is the Clerk userId.
  assert.equal(claims.sub, "user_1");

  // Room join grant scoped to the deterministic room.
  assert.equal(claims.video?.roomJoin, true);
  assert.equal(claims.video?.room, "attempt_att_42");
  assert.equal(claims.video?.canPublish, true);
  assert.equal(claims.video?.canSubscribe, true);

  // Token-based dispatch of the interviewer worker.
  const dispatch = claims.roomConfig?.agents?.[0];
  assert.equal(dispatch?.agentName, "talkt-interviewer");
  assert.ok(dispatch?.metadata);
  assert.deepEqual(JSON.parse(dispatch!.metadata), job);
});

test("mintCallToken throws when LiveKit is not configured", async () => {
  const saved = process.env.LIVEKIT_API_SECRET;
  delete process.env.LIVEKIT_API_SECRET;
  await assert.rejects(
    () => mintCallToken({ userId: "user_1", roomName: "attempt_att_42", job }),
    /LiveKit is not configured/,
  );
  process.env.LIVEKIT_API_SECRET = saved;
});
