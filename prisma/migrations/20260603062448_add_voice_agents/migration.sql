-- CreateTable
CREATE TABLE "VoiceAgent" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT '11labs',
    "voiceId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "available" BOOLEAN NOT NULL DEFAULT true,
    "lastChecked" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceAgent_pkey" PRIMARY KEY ("key")
);
