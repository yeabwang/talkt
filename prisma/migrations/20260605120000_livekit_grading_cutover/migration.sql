-- Attempt: rename the Vapi join key to the deterministic LiveKit room name.
-- Rename (not drop+recreate) so existing rows and the unique index survive.
ALTER TABLE "Attempt" RENAME COLUMN "vapiCallId" TO "roomName";
ALTER INDEX "Attempt_vapiCallId_key" RENAME TO "Attempt_roomName_key";

-- VoiceAgent: prune the Vapi-era voice machinery. With LiveKit Inference the
-- spoken voice is resolved worker-side, so persona rows keep only key/name/tone.
ALTER TABLE "VoiceAgent" DROP COLUMN "provider";
ALTER TABLE "VoiceAgent" DROP COLUMN "voiceId";
ALTER TABLE "VoiceAgent" DROP COLUMN "available";
ALTER TABLE "VoiceAgent" DROP COLUMN "lastChecked";
