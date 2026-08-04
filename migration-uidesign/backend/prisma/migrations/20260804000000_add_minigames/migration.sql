ALTER TYPE "NetworkMemberRole" ADD VALUE IF NOT EXISTS 'SOCIAL_MEDIA';

CREATE TYPE "MiniGameType" AS ENUM ('JEOPARDY', 'FAMILY_FEUD', 'CUSTOM');
CREATE TYPE "MiniGameStatus" AS ENUM ('LIVE', 'UNDER_DEVELOPMENT');

CREATE TABLE "MiniGame" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "coverImageUrl" TEXT,
    "gameType" "MiniGameType" NOT NULL DEFAULT 'JEOPARDY',
    "status" "MiniGameStatus" NOT NULL DEFAULT 'LIVE',
    "config" JSONB NOT NULL DEFAULT '{}',
    "state" JSONB NOT NULL DEFAULT '{}',
    "createdById" INTEGER NOT NULL,
    "underDevelopmentById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MiniGame_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MiniGame_slug_key" ON "MiniGame"("slug");
CREATE INDEX "MiniGame_status_createdAt_idx" ON "MiniGame"("status", "createdAt");
CREATE INDEX "MiniGame_createdById_idx" ON "MiniGame"("createdById");

ALTER TABLE "MiniGame"
  ADD CONSTRAINT "MiniGame_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "NetworkMember"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MiniGame"
  ADD CONSTRAINT "MiniGame_underDevelopmentById_fkey"
  FOREIGN KEY ("underDevelopmentById") REFERENCES "NetworkMember"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
