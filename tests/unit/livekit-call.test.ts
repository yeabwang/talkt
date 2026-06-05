import assert from "node:assert/strict";
import test from "node:test";

import {
  disconnectStatus,
  isFinalTranscript,
  mergeTurn,
  transcriptRole,
  type TranscriptTurn,
} from "@/components/talkt/use-livekit-call";

test("mergeTurn appends a new turn when the last is a different role", () => {
  const turns: TranscriptTurn[] = [{ role: "assistant", text: "Hi", final: true }];
  const next = mergeTurn(turns, "user", "Hello", false);
  assert.deepEqual(next, [
    { role: "assistant", text: "Hi", final: true },
    { role: "user", text: "Hello", final: false },
  ]);
});

test("mergeTurn replaces the trailing partial for the same role", () => {
  let turns: TranscriptTurn[] = [];
  turns = mergeTurn(turns, "user", "I think", false);
  turns = mergeTurn(turns, "user", "I think the answer", false);
  turns = mergeTurn(turns, "user", "I think the answer is six", true);
  assert.deepEqual(turns, [{ role: "user", text: "I think the answer is six", final: true }]);
});

test("mergeTurn keeps a final turn and starts a fresh one after it", () => {
  let turns: TranscriptTurn[] = [{ role: "assistant", text: "Q1", final: true }];
  turns = mergeTurn(turns, "assistant", "follow up", false);
  assert.equal(turns.length, 2);
  assert.deepEqual(turns[1], { role: "assistant", text: "follow up", final: false });
});

test("transcriptRole maps the local participant to the candidate", () => {
  assert.equal(transcriptRole("user_42", "user_42"), "user");
});

test("transcriptRole maps any other sender to the interviewer", () => {
  assert.equal(transcriptRole("user_42", "agent-AB12"), "assistant");
  assert.equal(transcriptRole(null, "agent-AB12"), "assistant");
});

test("isFinalTranscript reads the lk.transcription_final stream attribute", () => {
  assert.equal(isFinalTranscript({ "lk.transcription_final": "true" }), true);
  assert.equal(isFinalTranscript({ "lk.transcription_final": "false" }), false);
  assert.equal(isFinalTranscript({}), false);
  assert.equal(isFinalTranscript(undefined), false);
});

test("disconnectStatus treats a post-connect disconnect as a normal end", () => {
  assert.equal(disconnectStatus(true), "ended");
});

test("disconnectStatus treats a pre-connect disconnect as an error", () => {
  assert.equal(disconnectStatus(false), "error");
});
