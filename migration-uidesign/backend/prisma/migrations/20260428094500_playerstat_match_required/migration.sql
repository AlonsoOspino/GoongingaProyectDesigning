-- Ensure PlayerStat has match linkage and game numbers
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Match") THEN
    RAISE EXCEPTION 'Cannot backfill PlayerStat.matchId because no matches exist.';
  END IF;
END $$;

UPDATE "PlayerStat"
SET "matchId" = (SELECT "id" FROM "Match" ORDER BY "id" LIMIT 1)
WHERE "matchId" IS NULL;

UPDATE "PlayerStat"
SET "gameNumber" = 1
WHERE "gameNumber" IS NULL;

ALTER TABLE "PlayerStat" ALTER COLUMN "matchId" SET NOT NULL;
ALTER TABLE "PlayerStat" ALTER COLUMN "gameNumber" SET NOT NULL;
