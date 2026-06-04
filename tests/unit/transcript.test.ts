import assert from "node:assert/strict";
import { test } from "node:test";

import { sanitizeTranscript, MAX_TURNS, MAX_TURN_CHARS } from "../../lib/transcript";

test("drops non-object and empty turns", () => {
  const out = sanitizeTranscript([{ role: "user", text: "hi" }, null, { role: "user", text: "" }, "x"]);
  assert.deepEqual(out, [{ role: "user", text: "hi" }]);
});

test("normalizes role to user/assistant", () => {
  const out = sanitizeTranscript([{ role: "system", text: "a" }, { role: "user", text: "b" }]);
  assert.equal(out[0].role, "assistant");
  assert.equal(out[1].role, "user");
});

test("caps the number of turns", () => {
  const many = Array.from({ length: MAX_TURNS + 50 }, (_, i) => ({ role: "user", text: `t${i}` }));
  assert.equal(sanitizeTranscript(many).length, MAX_TURNS);
});

test("truncates over-long turn text", () => {
  const out = sanitizeTranscript([{ role: "user", text: "x".repeat(MAX_TURN_CHARS + 100) }]);
  assert.equal(out[0].text.length, MAX_TURN_CHARS);
});

test("non-array input yields empty", () => {
  assert.deepEqual(sanitizeTranscript("nope"), []);
});
