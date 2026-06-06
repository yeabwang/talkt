-- Cut over from LiveKit rooms to Vapi call/assistant ids on Attempt.
DROP INDEX IF EXISTS "Attempt_roomName_key";
ALTER TABLE "Attempt" DROP COLUMN "roomName";
ALTER TABLE "Attempt" ADD COLUMN "vapiCallId" TEXT;
ALTER TABLE "Attempt" ADD COLUMN "vapiAssistantId" TEXT;
CREATE UNIQUE INDEX "Attempt_vapiCallId_key" ON "Attempt"("vapiCallId");
