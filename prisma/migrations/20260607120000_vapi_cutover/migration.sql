-- Cut over Attempt call correlation to Vapi call and assistant ids.
DROP INDEX IF EXISTS "Attempt_roomName_key";
ALTER TABLE "Attempt" DROP COLUMN "roomName";
ALTER TABLE "Attempt" ADD COLUMN "vapiCallId" TEXT;
ALTER TABLE "Attempt" ADD COLUMN "vapiAssistantId" TEXT;
CREATE UNIQUE INDEX "Attempt_vapiCallId_key" ON "Attempt"("vapiCallId");
