-- New Goonginga network identities. The legacy "Member" table remains
-- untouched because it is still used by the active GGL season.
CREATE TYPE "NetworkMemberRole" AS ENUM (
  'MEMBER',
  'ADMIN',
  'CASTER',
  'DEVELOPER',
  'SEASON_PLAYER',
  'MODERATOR',
  'COMMUNITY_MANAGER',
  'CONTENT_CREATOR'
);

CREATE TYPE "NetworkMemberStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

CREATE TABLE "NetworkMember" (
  "id" SERIAL NOT NULL,
  "discordUserId" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "avatarUrl" TEXT,
  "roles" "NetworkMemberRole"[] NOT NULL DEFAULT ARRAY['MEMBER']::"NetworkMemberRole"[],
  "status" "NetworkMemberStatus" NOT NULL DEFAULT 'ACTIVE',
  "discordJoinedGglAt" TIMESTAMP(3),
  "discordLastVerifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NetworkMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeasonPlayer" (
  "id" SERIAL NOT NULL,
  "memberId" INTEGER NOT NULL,
  "tournamentId" INTEGER NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SeasonPlayer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NetworkMember_discordUserId_key" ON "NetworkMember"("discordUserId");
CREATE INDEX "NetworkMember_status_idx" ON "NetworkMember"("status");
CREATE UNIQUE INDEX "SeasonPlayer_memberId_tournamentId_key" ON "SeasonPlayer"("memberId", "tournamentId");
CREATE INDEX "SeasonPlayer_tournamentId_idx" ON "SeasonPlayer"("tournamentId");

ALTER TABLE "SeasonPlayer"
  ADD CONSTRAINT "SeasonPlayer_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "NetworkMember"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeasonPlayer"
  ADD CONSTRAINT "SeasonPlayer_tournamentId_fkey"
  FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
