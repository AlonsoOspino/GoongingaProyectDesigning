-- AlterTable
ALTER TABLE "Match" ADD COLUMN "mapsAllowedByRound" JSONB;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DraftTable" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "matchId" INTEGER NOT NULL,
    "currentTurnTeamId" INTEGER,
    "phase" TEXT NOT NULL,
    "phaseStartedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bannedHeroes" JSONB NOT NULL,
    "pickedMaps" JSONB NOT NULL,
    "currentMapId" INTEGER,
    CONSTRAINT "DraftTable_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_DraftTable" ("bannedHeroes", "currentMapId", "currentTurnTeamId", "id", "matchId", "phase", "pickedMaps") SELECT "bannedHeroes", "currentMapId", "currentTurnTeamId", "id", "matchId", "phase", "pickedMaps" FROM "DraftTable";
DROP TABLE "DraftTable";
ALTER TABLE "new_DraftTable" RENAME TO "DraftTable";
CREATE UNIQUE INDEX "DraftTable_matchId_key" ON "DraftTable"("matchId");
CREATE TABLE "new_PlayerStat" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "damage" INTEGER NOT NULL,
    "healing" INTEGER NOT NULL,
    "mitigation" INTEGER NOT NULL,
    "kills" INTEGER NOT NULL,
    "assists" INTEGER NOT NULL,
    "deaths" INTEGER NOT NULL,
    "gameDuration" INTEGER NOT NULL,
    "waitTime" INTEGER NOT NULL DEFAULT 0,
    "initialTime" INTEGER NOT NULL DEFAULT 0,
    "extraRounds" INTEGER NOT NULL DEFAULT 0,
    "effectiveDuration" INTEGER NOT NULL DEFAULT 1,
    "damagePer10" REAL NOT NULL DEFAULT 0,
    "healingPer10" REAL NOT NULL DEFAULT 0,
    "mitigationPer10" REAL NOT NULL DEFAULT 0,
    "killsPer10" REAL NOT NULL DEFAULT 0,
    "assistsPer10" REAL NOT NULL DEFAULT 0,
    "deathsPer10" REAL NOT NULL DEFAULT 0,
    "mapType" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayerStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PlayerStat" ("assists", "createdAt", "damage", "deaths", "gameDuration", "healing", "id", "kills", "mapType", "mitigation", "role", "userId") SELECT "assists", "createdAt", "damage", "deaths", "gameDuration", "healing", "id", "kills", "mapType", "mitigation", "role", "userId" FROM "PlayerStat";
DROP TABLE "PlayerStat";
ALTER TABLE "new_PlayerStat" RENAME TO "PlayerStat";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
