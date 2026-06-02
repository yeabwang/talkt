-- AlterTable
ALTER TABLE "Interview" ADD COLUMN     "dimensions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en';
