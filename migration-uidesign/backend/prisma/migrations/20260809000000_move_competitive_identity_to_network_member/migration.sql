-- Season 8 was exported before this migration. Raw stats are cleared because
-- their user ids belonged to the removed password-based Member table.
ALTER TABLE "NetworkMember"
  ADD COLUMN "nickname" TEXT,
  ADD COLUMN "profilePic" TEXT,
  ADD COLUMN "role" "MemberRole" NOT NULL DEFAULT 'DEFAULT',
  ADD COLUMN "rank" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "teamId" INTEGER,
  ADD COLUMN "heroVideoFolderPath" TEXT,
  ADD COLUMN "obsWebsocketUrl" TEXT,
  ADD COLUMN "obsWebsocketPassword" TEXT;

UPDATE "NetworkMember" SET "nickname" = "username", "profilePic" = "avatarUrl";

CREATE INDEX "NetworkMember_teamId_idx" ON "NetworkMember"("teamId");
ALTER TABLE "NetworkMember" ADD CONSTRAINT "NetworkMember_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PlayerStat" DROP CONSTRAINT IF EXISTS "PlayerStat_userId_fkey";
TRUNCATE TABLE "PlayerStat" RESTART IDENTITY;
ALTER TABLE "PlayerStat" ADD CONSTRAINT "PlayerStat_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "NetworkMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP TABLE IF EXISTS "MvpVote" CASCADE;
DROP TABLE IF EXISTS "MvpCandidate" CASCADE;
DROP TABLE IF EXISTS "MvpCampaign" CASCADE;
DROP TYPE IF EXISTS "MvpStatus";
DROP TABLE IF EXISTS "Wrapped" CASCADE;
DROP TABLE IF EXISTS "Member" CASCADE;

ALTER TABLE "Match"
  DROP COLUMN IF EXISTS "presentationStartDate",
  DROP COLUMN IF EXISTS "presentationVersion";
