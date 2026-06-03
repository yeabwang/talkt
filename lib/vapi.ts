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

function systemPrompt(interview: Interview, questions: string[], languageLabel: string): string {
  const list = questions.map((q, i) => `${i + 1}. ${q}`).join("\n");
  return [
    `You are ${interview.title ? `the interviewer for "${interview.title}"` : "a professional interviewer"} on TalkT, a spoken interview-practice platform.`,
    `Conduct the entire conversation in ${languageLabel}.`,
    "",
    "Your job:",
    "- Greet the candidate briefly, then work through the question set below, one question at a time.",
    "- Ask the next question only after they finish answering. Keep your turns short — you are speaking, not writing.",
    "- You may ask one brief, natural follow-up when an answer is thin, then move on.",
    "- Do not coach, score, or give feedback during the call; that happens afterward.",
    "- When the last question is answered, thank them warmly and end the call.",
    "",
    "Question set (ask in order):",
    list,
  ].join("\n");
}

export interface BuildAssistantArgs {
  interview: Interview;
  voice: { provider: string; voiceId: string };
  languageCode: string; // ISO 639-1
  languageLabel: string; // display label for the prompt
  attemptId: string;
  interviewerName: string;
  candidateFirstName?: string;
}

/**
 * Compose the transient assistant config the browser passes to `vapi.start()`.
 * The shape is intentionally a plain object (no @vapi-ai/web import here) so it
 * serializes cleanly through the API route to the client.
 */
export function buildAssistant(args: BuildAssistantArgs): Record<string, unknown> {
  const { interview, voice, languageCode, languageLabel, attemptId, interviewerName, candidateFirstName } = args;
  const questions = interview.questions ?? [];
  const greetName = candidateFirstName ? `, ${candidateFirstName}` : "";

  return {
    name: `${interviewerName} · ${interview.title}`.slice(0, 40),
    firstMessage: `Hi${greetName}, thanks for joining. I'll ask you a few questions about ${interview.title}. Whenever you're ready, let's begin.`,
    model: {
      provider: "openai",
      model: "gpt-4o",
      temperature: 0.6,
      messages: [{ role: "system", content: systemPrompt(interview, questions, languageLabel) }],
    },
    voice: {
      provider: voice.provider,
      voiceId: voice.voiceId,
      model: voiceModelFor(languageCode),
    },
    transcriber: transcriberFor(languageCode),
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
