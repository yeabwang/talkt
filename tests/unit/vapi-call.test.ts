import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  assistantSpeechFromMessage,
  disconnectStatus,
  mergeTurn,
  stopAction,
  transcriptBlocks,
  transcriptFromMessage,
  type TranscriptTurn,
} from "@/components/talkt/use-vapi-call";

test("mergeTurn replaces a trailing partial of the same role", () => {
  let turns: TranscriptTurn[] = [];
  turns = mergeTurn(turns, "user", "I think", false);
  turns = mergeTurn(turns, "user", "I think the answer is X", false);
  assert.equal(turns.length, 1);
  assert.equal(turns[0].text, "I think the answer is X");
});

test("mergeTurn appends a new role / a finalized turn", () => {
  let turns: TranscriptTurn[] = [];
  turns = mergeTurn(turns, "assistant", "Question one?", true);
  turns = mergeTurn(turns, "user", "Answer.", true);
  assert.deepEqual(
    turns.map((t) => t.role),
    ["assistant", "user"],
  );
});

test("mergeTurn replaces a partial assistant transcript with full assistant speech", () => {
  let turns: TranscriptTurn[] = [];
  turns = mergeTurn(turns, "assistant", "Question", false);
  turns = mergeTurn(turns, "assistant", "Question one?", true, "assistant-speech-0");
  assert.equal(turns.length, 1);
  assert.deepEqual(turns[0], {
    role: "assistant",
    text: "Question one?",
    final: true,
    segmentId: "assistant-speech-0",
  });
});

test("transcriptBlocks coalesces consecutive same-role turns", () => {
  const blocks = transcriptBlocks([
    { role: "assistant", text: "Hi.", final: true },
    { role: "assistant", text: "Question?", final: true },
    { role: "user", text: "Yes.", final: true },
  ]);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].text, "Hi. Question?");
});

test("disconnectStatus distinguishes connect failure from normal end", () => {
  assert.equal(disconnectStatus(true), "ended");
  assert.equal(disconnectStatus(false), "error");
});

test("stopAction only sends the Vapi end message after the call has joined", () => {
  assert.equal(stopAction(true, true), "end");
  assert.equal(stopAction(true, false), "stop");
  assert.equal(stopAction(false, true), "stop");
});

test("transcriptFromMessage maps Vapi transcript messages, ignores others", () => {
  assert.deepEqual(transcriptFromMessage({ type: "transcript", role: "user", transcript: "Hi", transcriptType: "final" }), {
    role: "user",
    text: "Hi",
    final: true,
  });
  assert.deepEqual(transcriptFromMessage({ type: "transcript", role: "assistant", transcript: "Q", transcriptType: "partial" }), {
    role: "assistant",
    text: "Q",
    final: false,
  });
  assert.equal(transcriptFromMessage({ type: "status-update" }), null);
});

test("assistantSpeechFromMessage maps Vapi full assistant speech events", () => {
  assert.deepEqual(assistantSpeechFromMessage({ type: "assistant.speechStarted", text: "Full question?", turn: 2 }), {
    role: "assistant",
    text: "Full question?",
    final: true,
    segmentId: "assistant-speech-2",
  });
  assert.equal(assistantSpeechFromMessage({ type: "transcript", text: "Nope" }), null);
});
