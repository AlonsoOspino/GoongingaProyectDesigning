-- Update PlayerStat for match linkage and remove unused timing fields
ALTER TABLE "PlayerStat" ADD COLUMN "matchId" INTEGER;
ALTER TABLE "PlayerStat" ADD COLUMN "gameNumber" INTEGER;

ALTER TABLE "PlayerStat" DROP COLUMN "waitTime";
ALTER TABLE "PlayerStat" DROP COLUMN "initialTime";
ALTER TABLE "PlayerStat" DROP COLUMN "extraRounds";
ALTER TABLE "PlayerStat" DROP COLUMN "effectiveDuration";

CREATE INDEX "PlayerStat_matchId_index" ON "PlayerStat"("matchId");

ALTER TABLE "PlayerStat"
  ADD CONSTRAINT "PlayerStat_matchId_fkey"
  FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;
