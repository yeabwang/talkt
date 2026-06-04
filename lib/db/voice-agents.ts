// Voice-agent cache: the pool of usable interviewer voices, resolved at call
// start. resolveVoiceAgent() returns a live provider voice id for a persona,
// re-checking availability against Vapi (TTL-gated) and swapping a dead voice id
// for a working one — persisting the swap so the next caller skips the lookup.
import { prisma } from "@/lib/prisma";
import { listProviderVoices } from "@/lib/vapi";

// Re-verify a voice against the provider at most this often; within the window
// the cached `available` flag is trusted so most starts cost zero round-trips.
const CHECK_TTL_MS = 1000 * 60 * 60 * 6; // 6h

// Seed personas surfaced in the UI (components/talkt/data.ts VOICES). Real
// ElevenLabs voice ids; the cache row is the source of truth once seeded.
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
  provider: string;
  voiceId: string;
}

/** Insert the default persona pool if the table is empty. Idempotent. */
export async function ensureVoiceAgents(): Promise<void> {
  await prisma.voiceAgent.createMany({ data: DEFAULT_AGENTS, skipDuplicates: true });
}

/**
 * Resolve a persona key to a live provider voice. Falls back to the first
 * seeded persona when the key is unknown. When the cached voice id is stale
 * (past TTL) it is verified against the provider catalog; a missing id is
 * replaced with another available voice from the same provider and the row is
 * updated. Fails open: if the catalog can't be fetched the cached id is kept.
 */
export async function resolveVoiceAgent(key: string): Promise<ResolvedVoice> {
  await ensureVoiceAgents();

  const agent =
    (await prisma.voiceAgent.findUnique({ where: { key } })) ??
    (await prisma.voiceAgent.findFirst({ orderBy: { createdAt: "asc" } }));

  if (!agent) {
    // Table seed failed and no rows exist — return a hard default so the call
    // can still proceed rather than throwing on the start path.
    const d = DEFAULT_AGENTS[0];
    return { key: d.key, name: d.name, tone: d.tone, provider: d.provider, voiceId: d.voiceId };
  }

  const fresh = agent.lastChecked && Date.now() - agent.lastChecked.getTime() < CHECK_TTL_MS && agent.available;
  if (fresh) {
    return { key: agent.key, name: agent.name, tone: agent.tone, provider: agent.provider, voiceId: agent.voiceId };
  }

  const catalog = await listProviderVoices(agent.provider);
  if (!catalog) {
    // Provider lookup unavailable — trust the cache, don't block the call.
    return { key: agent.key, name: agent.name, tone: agent.tone, provider: agent.provider, voiceId: agent.voiceId };
  }

  const ids = new Set(catalog.map((v) => v.id));
  if (ids.has(agent.voiceId)) {
    await prisma.voiceAgent.update({
      where: { key: agent.key },
      data: { available: true, lastChecked: new Date() },
    });
    return { key: agent.key, name: agent.name, tone: agent.tone, provider: agent.provider, voiceId: agent.voiceId };
  }

  // Cached voice id is gone. Pick a replacement not already used by another
  // persona so the pool stays distinct, then persist the swap.
  const taken = new Set(
    (await prisma.voiceAgent.findMany({ select: { voiceId: true } })).map((r) => r.voiceId),
  );
  const replacement = catalog.find((v) => !taken.has(v.id)) ?? catalog[0];
  const voiceId = replacement?.id ?? agent.voiceId;
  const available = Boolean(replacement);

  await prisma.voiceAgent.update({
    where: { key: agent.key },
    data: { voiceId, available, lastChecked: new Date() },
  });

  return { key: agent.key, name: replacement?.name ?? agent.name, tone: agent.tone, provider: agent.provider, voiceId };
}
