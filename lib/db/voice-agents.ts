// Voice-agent personas: the pool of interviewer personas surfaced in the UI.
// The persona's actual Vapi TTS voice is resolved in code from a per-language
// catalog (lib/vapi/voices.ts), so there is no availability to poll and no voice
// id stored here. resolveVoiceAgent() is a pure persona lookup (key/name/tone)
// with the unknown-key fallback preserved.
import { PERSONAS } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";

// Seed personas, derived from the catalog (the single source of truth). Selection
// is by key; the spoken voice id is resolved in lib/vapi/voices.ts. `language`
// here is just the persona's primary language for the seed row.
const DEFAULT_AGENTS = PERSONAS.map((p) => ({
  key: p.key,
  name: p.name,
  tone: p.tone,
  language: p.languages[0] ?? "en",
}));

export interface ResolvedVoice {
  key: string;
  name: string;
  tone: string;
}

// Last-resort identity, used only in the (static-data-impossible) case that
// PERSONAS — and therefore the seed pool — is empty and the DB seed never ran.
// Keeps the start path non-throwing instead of dereferencing DEFAULT_AGENTS[0].
const FALLBACK_AGENT: ResolvedVoice = { key: "default", name: "Interviewer", tone: "Neutral" };

/** Insert the default persona pool if the table is empty. Idempotent. */
export async function ensureVoiceAgents(): Promise<void> {
  await prisma.voiceAgent.createMany({ data: DEFAULT_AGENTS, skipDuplicates: true });
}

/**
 * Resolve a persona key to its display identity. Falls back to the first seeded
 * persona when the key is unknown, and to a hard-coded default if the table seed
 * never ran, so the start path never throws.
 */
export async function resolveVoiceAgent(key: string): Promise<ResolvedVoice> {
  await ensureVoiceAgents();

  const agent =
    (await prisma.voiceAgent.findUnique({ where: { key } })) ??
    (await prisma.voiceAgent.findFirst({ orderBy: { createdAt: "asc" } }));

  if (!agent) {
    const d = DEFAULT_AGENTS[0];
    return d ? { key: d.key, name: d.name, tone: d.tone } : FALLBACK_AGENT;
  }
  return { key: agent.key, name: agent.name, tone: agent.tone };
}
