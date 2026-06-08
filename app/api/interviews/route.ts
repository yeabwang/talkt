// POST /api/interviews: persist a builder-generated private interview.
import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

import { badRequest, unauthorized } from "@/lib/api";
import { createFromBuilder, type BuilderInterviewInput } from "@/lib/db/interviews";
import { ensureUser } from "@/lib/db/users";
import {
  ValidationError,
  isRecord,
  optString,
  reqString,
  stringArray,
} from "@/lib/validate";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  let input: BuilderInterviewInput;
  try {
    if (!isRecord(raw)) throw new ValidationError("Body must be an object");
    const questions = stringArray(raw.questions, "questions");
    if (questions.length === 0) throw new ValidationError("At least one question is required");

    const dimensionsRaw = Array.isArray(raw.dimensions) ? raw.dimensions : [];
    const dimensions = dimensionsRaw
      .filter(
        (d): d is { key: string; label: string } =>
          isRecord(d) && typeof d.key === "string" && typeof d.label === "string",
      )
      .map((d) => ({ key: d.key.trim(), label: d.label.trim() }))
      .filter((d) => d.key && d.label);

    const minutesRaw = raw.minutes;
    const minutes =
      typeof minutesRaw === "number" && Number.isFinite(minutesRaw)
        ? Math.min(180, Math.max(1, Math.round(minutesRaw)))
        : undefined;

    input = {
      title: reqString(raw.title, "title", 200),
      subtitle: optString(raw.subtitle, "subtitle", 200),
      role: optString(raw.role, "role", 200),
      category: optString(raw.category, "category", 100),
      difficulty: optString(raw.difficulty, "difficulty", 100),
      blurb: optString(raw.blurb, "blurb", 500),
      minutes,
      focus: stringArray(raw.focus, "focus", 12),
      language: optString(raw.language, "language", 40),
      voiceId: optString(raw.voiceId, "voiceId", 40),
      questions,
      dimensions,
    };
  } catch (error) {
    if (error instanceof ValidationError) return badRequest(error.message);
    return badRequest("Invalid request");
  }

  await ensureUser();
  const interview = await createFromBuilder(userId, input);
  return Response.json({ interview }, { status: 201 });
}
