-- AlterTable
ALTER TABLE "Interview" ADD COLUMN     "anonymous" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "authorName" TEXT,
ADD COLUMN     "blurb" TEXT,
ADD COLUMN     "downvotes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "flagged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "flaggedAt" TIMESTAMP(3),
ADD COLUMN     "focus" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "minutes" INTEGER,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "rankScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "subtitle" TEXT,
ADD COLUMN     "upvotes" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vote_interviewId_idx" ON "Vote"("interviewId");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_userId_interviewId_key" ON "Vote"("userId", "interviewId");

-- CreateIndex
CREATE INDEX "Interview_flagged_visibility_type_rankScore_idx" ON "Interview"("flagged", "visibility", "type", "rankScore");

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
