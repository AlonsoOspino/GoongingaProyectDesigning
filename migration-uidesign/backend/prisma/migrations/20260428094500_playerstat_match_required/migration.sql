-- Ensure PlayerStat has match linkage and game numbers
-- Backfill with default values if data exists
UPDATE "PlayerStat"
SET "matchId" = COALESCE("matchId", (SELECT COALESCE(MIN("id"), 1) FROM "Match"))
WHERE "matchId" IS NULL;

UPDATE "PlayerStat"
SET "gameNumber" = COALESCE("gameNumber", 1)
WHERE "gameNumber" IS NULL;

-- Make columns required
ALTER TABLE "PlayerStat" ALTER COLUMN "matchId" SET NOT NULL;
ALTER TABLE "PlayerStat" ALTER COLUMN "gameNumber" SET NOT NULL;
