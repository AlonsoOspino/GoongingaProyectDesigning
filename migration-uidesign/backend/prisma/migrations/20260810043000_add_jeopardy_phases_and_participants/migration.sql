CREATE TYPE "JeopardyPhase" AS ENUM (
  'CREATED',
  'PICKING_MEMBER',
  'PICKING_QUESTION',
  'RESPONDING',
  'RESPONDED',
  'FINALIZED'
);

ALTER TABLE "MiniGame"
ADD COLUMN "phase" "JeopardyPhase" NOT NULL DEFAULT 'CREATED';

CREATE TABLE "MiniGameParticipant" (
  "id" SERIAL NOT NULL,
  "gameId" INTEGER NOT NULL,
  "memberId" INTEGER NOT NULL,
  "score" INTEGER NOT NULL DEFAULT 0,
  "joinedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MiniGameParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MiniGameParticipant_gameId_memberId_key"
ON "MiniGameParticipant"("gameId", "memberId");

CREATE INDEX "MiniGameParticipant_gameId_score_idx"
ON "MiniGameParticipant"("gameId", "score");

CREATE INDEX "MiniGameParticipant_memberId_idx"
ON "MiniGameParticipant"("memberId");

ALTER TABLE "MiniGameParticipant"
ADD CONSTRAINT "MiniGameParticipant_gameId_fkey"
FOREIGN KEY ("gameId") REFERENCES "MiniGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MiniGameParticipant"
ADD CONSTRAINT "MiniGameParticipant_memberId_fkey"
FOREIGN KEY ("memberId") REFERENCES "NetworkMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
