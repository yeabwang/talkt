import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  disconnectStatus,
  mergeTurn,
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
