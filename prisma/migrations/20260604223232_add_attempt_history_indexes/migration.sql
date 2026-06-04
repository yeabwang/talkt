-- DropIndex
DROP INDEX "Attempt_userId_idx";

-- CreateIndex
CREATE INDEX "Attempt_userId_status_startedAt_idx" ON "Attempt"("userId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "Attempt_userId_startedAt_idx" ON "Attempt"("userId", "startedAt");
