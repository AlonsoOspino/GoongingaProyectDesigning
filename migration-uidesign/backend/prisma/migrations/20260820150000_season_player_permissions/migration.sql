DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SeasonPlayerRole') THEN
    CREATE TYPE "SeasonPlayerRole" AS ENUM ('CAPTAIN', 'PLAYER');
  END IF;
END $$;

ALTER TABLE "SeasonPlayer"
  ADD COLUMN IF NOT EXISTS "teamId" INTEGER,
  ADD COLUMN IF NOT EXISTS "role" "SeasonPlayerRole" NOT NULL DEFAULT 'PLAYER';

DROP INDEX IF EXISTS "SeasonPlayer_tournamentId_idx";
CREATE INDEX IF NOT EXISTS "SeasonPlayer_tournamentId_teamId_idx"
  ON "SeasonPlayer"("tournamentId", "teamId");
CREATE INDEX IF NOT EXISTS "SeasonPlayer_teamId_idx"
  ON "SeasonPlayer"("teamId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SeasonPlayer_teamId_fkey'
  ) THEN
    ALTER TABLE "SeasonPlayer"
      ADD CONSTRAINT "SeasonPlayer_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "SeasonPlayer" (
  "memberId", "tournamentId", "teamId", "role", "joinedAt", "createdAt", "updatedAt"
)
SELECT
  member."id",
  team."tournamentId",
  team."id",
  CASE WHEN member."role" = 'CAPTAIN' THEN 'CAPTAIN'::"SeasonPlayerRole" ELSE 'PLAYER'::"SeasonPlayerRole" END,
  member."createdAt",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "NetworkMember" member
JOIN "Team" team ON team."id" = member."teamId"
WHERE member."teamId" IS NOT NULL
ON CONFLICT ("memberId", "tournamentId") DO UPDATE SET
  "teamId" = EXCLUDED."teamId",
  "role" = EXCLUDED."role",
  "updatedAt" = CURRENT_TIMESTAMP;

ALTER TABLE "PlayerStat"
  ADD COLUMN IF NOT EXISTS "seasonPlayerId" INTEGER;

CREATE INDEX IF NOT EXISTS "PlayerStat_seasonPlayerId_idx"
  ON "PlayerStat"("seasonPlayerId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PlayerStat_seasonPlayerId_fkey'
  ) THEN
    ALTER TABLE "PlayerStat"
      ADD CONSTRAINT "PlayerStat_seasonPlayerId_fkey"
      FOREIGN KEY ("seasonPlayerId") REFERENCES "SeasonPlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

UPDATE "PlayerStat" stat
SET "seasonPlayerId" = season_player."id"
FROM "Match" match, "SeasonPlayer" season_player
WHERE stat."matchId" = match."id"
  AND season_player."memberId" = stat."userId"
  AND season_player."tournamentId" = match."tournamentId"
  AND stat."seasonPlayerId" IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum enum_value
    JOIN pg_type enum_type ON enum_type.oid = enum_value.enumtypid
    WHERE enum_type.typname = 'MatchStatus' AND enum_value.enumlabel = 'PENDINGREGISTERS'
  ) THEN
    UPDATE "Match" SET "status" = 'FINISHED' WHERE "status" = 'PENDINGREGISTERS';
    ALTER TABLE "Match" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TYPE "MatchStatus" RENAME TO "MatchStatus_old";
    CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'FINISHED');
    ALTER TABLE "Match"
      ALTER COLUMN "status" TYPE "MatchStatus"
      USING ("status"::text::"MatchStatus");
    DROP TYPE "MatchStatus_old";
  END IF;
END $$;

ALTER TABLE "Match" ALTER COLUMN "status" SET DEFAULT 'SCHEDULED';
