-- VoiceAgent: keep only persona display fields; voice resolution lives in application code.
ALTER TABLE "VoiceAgent" DROP COLUMN "provider";
ALTER TABLE "VoiceAgent" DROP COLUMN "voiceId";
ALTER TABLE "VoiceAgent" DROP COLUMN "available";
ALTER TABLE "VoiceAgent" DROP COLUMN "lastChecked";
