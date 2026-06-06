// Voice-agent personas: the pool of interviewer personas surfaced in the UI.
// The persona's actual Vapi TTS voice is resolved in code from a per-language
// catalog (lib/vapi/voices.ts), so there is no availability to poll and no voice
// id stored here. resolveVoiceAgent() is a pure persona lookup (key/name/tone)
// with the unknown-key fallback preserved.
import { prisma } from "@/lib/prisma";

// Seed personas surfaced in the UI (components/talkt/data.ts VOICES). Selection
// is by key; the spoken voice is resolved worker-side (agent/src/model-config.ts).
const DEFAULT_AGENTS = [
  { key: "adi", name: "Adi", tone: "Calm, measured", language: "en" },
  { key: "ren", name: "Ren", tone: "Warm, direct", language: "en" },
  { key: "kai", name: "Kai", tone: "Brisk, precise", language: "en" },
  { key: "mira", name: "Mira", tone: "Patient, probing", language: "en" },
];

export interface ResolvedVoice {
  key: string;
  name: string;
  tone: string;
}

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
    return { key: d.key, name: d.name, tone: d.tone };
  }
  return { key: agent.key, name: agent.name, tone: agent.tone };
}
