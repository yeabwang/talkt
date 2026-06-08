// Boundary-validator tests for lib/validate.ts.
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ValidationError,
  isRecord,
  optBool,
  optString,
  reqString,
  stringArray,
} from "../../lib/validate";

test("isRecord accepts plain objects, rejects arrays and null", () => {
  assert.equal(isRecord({}), true);
  assert.equal(isRecord({ a: 1 }), true);
  assert.equal(isRecord([]), false);
  assert.equal(isRecord(null), false);
  assert.equal(isRecord("x"), false);
});

test("reqString trims and requires a non-empty string", () => {
  assert.equal(reqString("  hi  ", "f"), "hi");
  assert.throws(() => reqString("", "f"), ValidationError);
  assert.throws(() => reqString("   ", "f"), ValidationError);
  assert.throws(() => reqString(42, "f"), ValidationError);
});

test("reqString enforces the max length", () => {
  assert.throws(() => reqString("x".repeat(11), "f", 10), ValidationError);
  assert.equal(reqString("x".repeat(10), "f", 10).length, 10);
});

test("optString maps absent/blank to undefined, rejects non-strings", () => {
  assert.equal(optString(undefined, "f"), undefined);
  assert.equal(optString(null, "f"), undefined);
  assert.equal(optString("   ", "f"), undefined);
  assert.equal(optString(" v ", "f"), "v");
  assert.throws(() => optString(5, "f"), ValidationError);
  assert.throws(() => optString("x".repeat(11), "f", 10), ValidationError);
});

test("optBool passes booleans, maps absent to undefined, rejects others", () => {
  assert.equal(optBool(true, "f"), true);
  assert.equal(optBool(false, "f"), false);
  assert.equal(optBool(undefined, "f"), undefined);
  assert.equal(optBool(null, "f"), undefined);
  assert.throws(() => optBool("true", "f"), ValidationError);
});

test("stringArray rejects non-arrays, filters blanks, trims, caps length", () => {
  assert.throws(() => stringArray("nope", "f"), ValidationError);
  assert.deepEqual(stringArray([" a ", "", 3, "b"], "f"), ["a", "b"]);
  assert.equal(stringArray(Array.from({ length: 100 }, () => "x"), "f", 50).length, 50);
});
