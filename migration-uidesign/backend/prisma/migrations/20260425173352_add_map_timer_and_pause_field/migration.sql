-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "mapStartedAt" TIMESTAMP(3),
ADD COLUMN     "mapTimerPaused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mapTimerPausedAt" TIMESTAMP(3),
ADD COLUMN     "pauseRequestedAt" TIMESTAMP(3),
ADD COLUMN     "pauseRequestedBy" INTEGER;
