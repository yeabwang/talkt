// Server-only Vapi REST helpers + transient-assistant builder.
//
// Two responsibilities:
//   1. Provider voice availability — list a provider's voices so the start path
//      can verify a cached voiceId still resolves and swap a dead one.
//   2. buildAssistant() — compose the transient CreateAssistantDTO the browser
//      hands to the Vapi Web SDK's `vapi.start(assistant)`. The interview's
//      stored questions become the interviewer's script; metadata.attemptId is
//      the join key the end-of-call webhook uses to find the Attempt row.
//
// Never import from a client component (uses VAPI_PRIVATE_KEY).

import type { Interview } from "@/components/talkt/data";

const VAPI_BASE = "https://api.vapi.ai";
const PRIVATE_KEY = process.env.VAPI_PRIVATE_KEY;

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** A provider voice as returned by Vapi's voice library. */
export interface ProviderVoice {
  id: string;
  name?: string;
}

/**
 * List a provider's available voices via Vapi. Returns null when the catalog
 * can't be fetched (no key, network/transport error) so callers can fail open
 * rather than block a call on a flaky provider lookup.
 */
export async function listProviderVoices(provider: string): Promise<ProviderVoice[] | null> {
  if (!PRIVATE_KEY) return null;
  try {
    const res = await fetch(`${VAPI_BASE}/provider/${provider}/voices`, {
      headers: { Authorization: `Bearer ${PRIVATE_KEY}` },
      // Availability is volatile; never let Next cache it.
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    const list = Array.isArray(data) ? data : (data as { voices?: unknown[] })?.voices;
    if (!Array.isArray(list)) return null;
    return list
      .map((v): ProviderVoice | null => {
        if (!v || typeof v !== "object") return null;
        const id = (v as { id?: unknown; voiceId?: unknown }).id ?? (v as { voiceId?: unknown }).voiceId;
        if (typeof id !== "string") return null;
        const name = (v as { name?: unknown }).name;
        return { id, name: typeof name === "string" ? name : undefined };
      })
      .filter((v): v is ProviderVoice => v !== null);
  } catch {
    return null;
  }
}

/** ElevenLabs model id tuned per language: turbo for English, multilingual otherwise. */
function voiceModelFor(language: string): string {
  return language === "en" ? "eleven_turbo_v2" : "eleven_multilingual_v2";
}

/** Deepgram transcription model per language (nova-3 has the widest coverage). */
function transcriberFor(language: string) {
  return { provider: "deepgram" as const, model: "nova-3", language };
}

// Endpointing/barge-in tuning. Default Vapi treats every mid-sentence pause as
// end-of-turn, so the interviewer talks over the candidate. Wait longer and use
// smart endpointing (LiveKit = English-only; Vapi model = multilingual) so a
// turn only ends when the candidate is actually done. stopSpeakingPlan keeps a
// stray "um" from making the interviewer cut out and restart.
function speakingPlans(language: string) {
  const english = language === "en";
  return {
    startSpeakingPlan: {
      waitSeconds: 0.8,
      smartEndpointingPlan: { provider: english ? ("livekit" as const) : ("vapi" as const) },
      // Fallback only (ignored while smartEndpointingPlan is set): be patient when
      // the candidate trails off without punctuation.
      transcriptionEndpointingPlan: { onPunctuationSeconds: 0.3, onNoPunctuationSeconds: 2, onNumberSeconds: 0.6 },
    },
    stopSpeakingPlan: { numWords: 2, voiceSeconds: 0.3, backoffSeconds: 1.5 },
  };
}

// Per-persona spoken delivery cue, keyed by voice-agent key. Steers cadence/tone
// to match the chosen voice; empty for unknown personas.
const DELIVERY_CUES: Record<string, string> = {
  adi: "Speak calmly and in a measured, unhurried way.",
  ren: "Speak warmly and directly, naturally encouraging.",
  kai: "Speak briskly and precisely; keep turns crisp.",
  mira: "Speak gently and patiently, leaving space after questions.",
};

function systemPrompt(args: {
  interview: Interview;
  questions: string[];
  languageLabel: string;
  interviewerName: string;
  deliveryCue: string;
}): string {
  const { interview, questions, languageLabel, interviewerName, deliveryCue } = args;
  const list = questions.map((q, i) => `${i + 1}. ${q}`).join("\n");
  return [
    `You are ${interviewerName}, the interviewer${interview.title ? ` for "${interview.title}"` : ""} on TalkT, a spoken interview-practice platform.`,
    `Speak entirely in ${languageLabel}. This is a live voice conversation, so keep every turn short, natural, and spoken — never read like an essay.`,
    deliveryCue,
    "",
    "## Role",
    "You are the INTERVIEWER, not a tutor or assistant. Your job is to run a realistic interview and let the candidate do the thinking. The candidate is being evaluated; you are not here to help them get the right answer.",
    "",
    "## Hard rules — never break these",
    "- NEVER reveal, state, hint at, or lead toward the answer to any question. Do not provide the solution, the 'expected' answer, definitions, examples, or partial answers.",
    "- NEVER tell the candidate whether their answer is right, wrong, good, or bad. Do not confirm correctness, correct mistakes, or react to quality.",
    "- NEVER teach, explain concepts, or give tips, hints, or feedback during the call. All scoring and feedback happen AFTER the call, handled by a separate system.",
    "- If the candidate asks for the answer, for a hint, or 'is that right?', politely decline: e.g. 'I can't share that during the interview — you'll get full feedback at the end. Let's keep going.'",
    "",
    "## Conducting the interview",
    "- Greet the candidate briefly and warmly, then ask the questions below ONE AT A TIME, in order.",
    "- After they answer, give only a short neutral acknowledgement ('Thanks.', 'Got it.', 'Okay, understood.') — never a judgement of quality.",
    "- Follow-ups: ask a follow-up ONLY when the answer is genuinely ambiguous, vague, or incomplete — to clarify or probe depth, never to hint. Ask at most 1–2 follow-ups per question, then move on regardless. A clear, complete answer needs no follow-up; just proceed to the next question.",
    "- Keep follow-ups open and neutral ('Can you walk me through how?', 'What led you to that?', 'Can you give a concrete example?'). Never phrase a follow-up so it gives away the answer.",
    "- If the candidate is silent, says 'I don't know', or asks to skip: acknowledge calmly, optionally offer one gentle 'Take your time' or 'Anything at all you'd approach?', then move to the next question. Do NOT fill the gap with the answer.",
    "- Stay in character as a human interviewer throughout. Do not mention prompts, models, or that you are an AI.",
    "",
    "## Time",
    "- Manage your pace so you finish all core questions and still close warmly within the time available.",
    "- If you receive a system message beginning with '[director]', treat it as a private wrap cue: bring the current question to a close and move toward ending. Never read it aloud or mention it.",
    "",
    "## Ending",
    "- When the final question is done (including any follow-ups), or on the wrap cue: thank the candidate warmly, briefly say their feedback is being prepared, and say goodbye.",
    "- THEN immediately call the `end_interview` tool with a one-line reason ('completed' when the set is done, 'time' when wrapping for time).",
    "- Do not keep talking after calling `end_interview`.",
    "",
    "## Question set (ask in this order)",
    list,
  ].join("\n");
}

// The natural-completion tool: the model calls this once, after saying goodbye,
// to end the interview. The browser stops the call when it sees the call.
const END_INTERVIEW_TOOL = {
  type: "function",
  function: {
    name: "end_interview",
    description: "Call this once, immediately after saying goodbye, to end the interview.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string", enum: ["completed", "time"], description: "Why the interview ended." },
      },
      required: ["reason"],
    },
  },
};

export interface BuildAssistantArgs {
  interview: Interview;
  voice: { provider: string; voiceId: string };
  languageCode: string; // ISO 639-1
  languageLabel: string; // display label for the prompt
  attemptId: string;
  interviewerName: string;
  persona: string; // voice-agent key, for the delivery cue
  candidateFirstName?: string;
}

/**
 * Compose the transient assistant config the browser passes to `vapi.start()`.
 * The shape is intentionally a plain object (no @vapi-ai/web import here) so it
 * serializes cleanly through the API route to the client.
 */
export function buildAssistant(args: BuildAssistantArgs): Record<string, unknown> {
  const { interview, voice, languageCode, languageLabel, attemptId, interviewerName, persona, candidateFirstName } = args;
  const questions = interview.questions ?? [];
  const greetName = candidateFirstName ? `, ${candidateFirstName}` : "";

  return {
    name: `${interviewerName} · ${interview.title}`.slice(0, 40),
    firstMessage: `Hi${greetName}, thanks for joining. I'll ask you a few questions about ${interview.title}. Whenever you're ready, let's begin.`,
    model: {
      provider: "openai",
      model: "gpt-4o",
      temperature: 0.6,
      messages: [
        {
          role: "system",
          content: systemPrompt({ interview, questions, languageLabel, interviewerName, deliveryCue: DELIVERY_CUES[persona] ?? "" }),
        },
      ],
      // Natural-completion path: the model ends the call via this tool.
      tools: [END_INTERVIEW_TOOL],
    },
    voice: {
      provider: voice.provider,
      voiceId: voice.voiceId,
      model: voiceModelFor(languageCode),
    },
    transcriber: transcriberFor(languageCode),
    // Don't talk over the candidate (see speakingPlans).
    ...speakingPlans(languageCode),
    // Hard time cap (the second completion path): end the call if it runs past
    // the estimated length plus a small buffer, so it can't run unbounded.
    maxDurationSeconds: Math.min(3600, Math.max(120, ((interview.minutes || 15) + 2) * 60)),
    // Audio only — we never send the candidate's camera to Vapi.
    metadata: { attemptId, interviewId: interview.id },
    server: {
      url: `${appUrl()}/api/vapi/webhook`,
      ...(process.env.VAPI_WEBHOOK_SECRET ? { secret: process.env.VAPI_WEBHOOK_SECRET } : {}),
    },
    // Only the post-call artifact is needed server-side; live transcript is
    // rendered client-side from Web SDK events.
    serverMessages: ["end-of-call-report"],
  };
}
