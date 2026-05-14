CREATE TABLE "LeaderboardOverlayAsset" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "backgroundImageUrl" TEXT,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaderboardOverlayAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeaderboardOverlayAsset_matchId_key" ON "LeaderboardOverlayAsset"("matchId");

ALTER TABLE "LeaderboardOverlayAsset"
ADD CONSTRAINT "LeaderboardOverlayAsset_matchId_fkey"
FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
