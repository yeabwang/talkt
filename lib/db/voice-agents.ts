// Voice-agent personas surfaced in the UI; Vapi voice ids resolve in lib/vapi/voices.ts.
import { prisma } from "@/lib/prisma";

// Seed personas mirrored by components/talkt/data.ts VOICES.
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
 * Resolve a persona key to its display identity with a safe fallback.
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
