// Catalog helper tests. Guards language code/label resolution — the seam that
// feeds voice selection and the builder — so valid ISO codes are never dropped.
import assert from "node:assert/strict";
import { test } from "node:test";

import { toLanguageCode, toLanguageLabel } from "../../lib/catalog";

test("toLanguageCode passes through known ISO codes", () => {
  assert.equal(toLanguageCode("fr"), "fr");
  assert.equal(toLanguageCode("es"), "es");
  assert.equal(toLanguageCode("EN"), "en"); // case-insensitive
  assert.equal(toLanguageCode("  de  "), "de"); // trimmed
});

test("toLanguageCode maps display labels to codes", () => {
  assert.equal(toLanguageCode("French"), "fr");
  assert.equal(toLanguageCode("spanish"), "es");
  assert.equal(toLanguageCode("English"), "en");
});

test("toLanguageCode falls back to en for unknown/blank", () => {
  assert.equal(toLanguageCode(""), "en");
  assert.equal(toLanguageCode(null), "en");
  assert.equal(toLanguageCode(undefined), "en");
  assert.equal(toLanguageCode("klingon"), "en");
});

test("toLanguageCode and toLanguageLabel round-trip", () => {
  assert.equal(toLanguageLabel(toLanguageCode("French")), "French");
  assert.equal(toLanguageLabel(toLanguageCode("fr")), "French");
});
