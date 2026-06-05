import assert from "node:assert/strict";
import test from "node:test";

import {
  appendTranscriptChunk,
  disconnectStatus,
  isFinalTranscript,
  mergeTurn,
  shouldPublishTranscriptChunk,
  transcriptBlocks,
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

test("mergeTurn preserves referential identity for duplicate stream updates", () => {
  const turns: TranscriptTurn[] = [{ role: "assistant", text: "Question one", final: false }];
  const next = mergeTurn(turns, "assistant", "Question one", false);
  assert.equal(next, turns);
});

test("transcriptBlocks includes the assistant's in-flight speech", () => {
  const turns: TranscriptTurn[] = [
    { role: "assistant", text: "Tell me about a project", final: false },
    { role: "user", text: "I built a scheduler", final: true },
  ];
  assert.deepEqual(transcriptBlocks(turns), [
    { role: "assistant", text: "Tell me about a project", final: false },
    { role: "user", text: "I built a scheduler", final: true },
  ]);
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

test("appendTranscriptChunk accumulates delta chunks instead of replacing with the last word", () => {
  let text = "";
  text = appendTranscriptChunk(text, "Thanks for ");
  text = appendTranscriptChunk(text, "joining.");
  assert.equal(text, "Thanks for joining.");
});

test("assistant transcript chunks publish only when final", () => {
  assert.equal(shouldPublishTranscriptChunk("assistant", false), false);
  assert.equal(shouldPublishTranscriptChunk("assistant", true), true);
  assert.equal(shouldPublishTranscriptChunk("user", false), true);
});

test("disconnectStatus treats a post-connect disconnect as a normal end", () => {
  assert.equal(disconnectStatus(true), "ended");
});

test("disconnectStatus treats a pre-connect disconnect as an error", () => {
  assert.equal(disconnectStatus(false), "error");
});
