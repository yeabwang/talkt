// Voice-agent personas: the pool of interviewer personas surfaced in the UI.
// With LiveKit Inference the persona's actual TTS voice is a stable model string
// mapped worker-side (agent/src/voices.ts), so there is no availability to poll
// and no voice id to swap. resolveVoiceAgent() is now a pure persona lookup
// (key/name/tone) with the unknown-key fallback preserved.
//
// (The VoiceAgent provider/voiceId/available/lastChecked columns are pruned in
// spec 18; until then the seed still writes them for schema compatibility.)
import { prisma } from "@/lib/prisma";

// Seed personas surfaced in the UI (components/talkt/data.ts VOICES). The
// provider/voiceId fields are legacy schema columns kept until spec 18 prunes
// them; persona selection is by key, and the spoken voice is resolved worker-side.
const DEFAULT_AGENTS = [
  { key: "adi", name: "Adi", tone: "Calm, measured", provider: "11labs", voiceId: "ZoiZ8fuDWInAcwPXaVeq" },
  { key: "ren", name: "Ren", tone: "Warm, direct", provider: "11labs", voiceId: "21m00Tcm4TlvDq8ikWAM" },
  { key: "kai", name: "Kai", tone: "Brisk, precise", provider: "11labs", voiceId: "pNInz6obpgDQGcFmaJgB" },
  { key: "mira", name: "Mira", tone: "Patient, probing", provider: "11labs", voiceId: "EXAVITQu4vr4xnSDxMaL" },
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
