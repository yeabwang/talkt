// Privacy-boundary tests for lib/dto.ts toTemplateDTO.
import assert from "node:assert/strict";
import { test } from "node:test";

import { toTemplateDTO, type InterviewRow } from "../../lib/dto";

function row(overrides: Partial<InterviewRow> = {}): InterviewRow {
  return {
    id: "iv_1",
    ownerId: "user_owner",
    title: "System Design",
    subtitle: null,
    role: "Engineer",
    topic: "Engineering",
    difficulty: "Senior",
    blurb: "Practice system design.",
    minutes: 30,
    focus: ["scalability"],
    type: "custom",
    visibility: "public",
    language: "en",
    dimensions: [{ key: "communication", label: "Communication" }],
    questions: ["Design a URL shortener.", { text: "Scale it to 1M users." }],
    voiceConfig: { voiceId: "adi" },
    authorName: "Jane Doe",
    anonymous: false,
    upvotes: 5,
    downvotes: 1,
    rankScore: 0.8,
    flagged: false,
    publishedAt: new Date("2026-01-01"),
    owner: { name: "Jane Account" },
    _count: { attempts: 3 },
    ...overrides,
  };
}

test("never leaks ownerId or owner relation across the seam", () => {
  const dto = toTemplateDTO(row());
  assert.equal("ownerId" in dto, false);
  assert.equal("owner" in dto, false);
  assert.equal("rankScore" in dto, false);
  assert.equal("flagged" in dto, false);
});

test("anonymous interviews are never attributed to a real name", () => {
  const dto = toTemplateDTO(row({ anonymous: true, authorName: "Jane Doe", owner: { name: "Jane Account" } }));
  assert.equal(dto.author, "Community");
  assert.equal(dto.authorName, null);
  assert.equal(dto.anonymous, true);
});

test("named author is credited; falls back to the owner account name", () => {
  assert.equal(toTemplateDTO(row({ authorName: "Jane Doe" })).author, "Jane Doe");
  assert.equal(toTemplateDTO(row({ authorName: null, owner: { name: "Jane Account" } })).author, "Jane Account");
});

test("viewer context defaults to no vote / not mine when omitted", () => {
  const dto = toTemplateDTO(row());
  assert.equal(dto.myVote, 0);
  assert.equal(dto.mine, false);
});

test("viewer context is reflected only when explicitly supplied", () => {
  const dto = toTemplateDTO(row(), { myVote: -1, mine: true });
  assert.equal(dto.myVote, -1);
  assert.equal(dto.mine, true);
});

test("coerces mixed question shapes (string and { text }) to a clean string[]", () => {
  const dto = toTemplateDTO(row());
  assert.deepEqual(dto.questions, ["Design a URL shortener.", "Scale it to 1M users."]);
  assert.equal(dto.count, 2);
});

test("tolerates malformed question/dimension JSON without throwing", () => {
  const dto = toTemplateDTO(row({ questions: "not-an-array", dimensions: null }));
  assert.deepEqual(dto.questions, []);
  assert.deepEqual(dto.dimensions, []);
  assert.equal(dto.count, 0);
});
