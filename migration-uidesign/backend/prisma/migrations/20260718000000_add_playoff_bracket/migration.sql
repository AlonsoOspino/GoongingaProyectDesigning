ALTER TABLE "Team" ADD COLUMN "playoffSeed" INTEGER;

ALTER TABLE "Match" ADD COLUMN "playoffRound" INTEGER;
ALTER TABLE "Match" ADD COLUMN "playoffSlot" INTEGER;

CREATE UNIQUE INDEX "Team_tournamentId_playoffSeed_key"
ON "Team"("tournamentId", "playoffSeed");

CREATE UNIQUE INDEX "Match_tournamentId_playoffRound_playoffSlot_key"
ON "Match"("tournamentId", "playoffRound", "playoffSlot");
