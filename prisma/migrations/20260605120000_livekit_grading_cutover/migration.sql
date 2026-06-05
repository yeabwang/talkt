-- VoiceAgent: prune legacy voice-provider machinery. With LiveKit Inference the
-- spoken voice is resolved worker-side, so persona rows keep only key/name/tone.
ALTER TABLE "VoiceAgent" DROP COLUMN "provider";
ALTER TABLE "VoiceAgent" DROP COLUMN "voiceId";
ALTER TABLE "VoiceAgent" DROP COLUMN "available";
ALTER TABLE "VoiceAgent" DROP COLUMN "lastChecked";
