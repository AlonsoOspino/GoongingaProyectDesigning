/*
  Warnings:

  - You are about to drop the column `semana` on the `Match` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Match" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "bestOf" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "startDate" DATETIME NOT NULL,
    "tournamentId" INTEGER NOT NULL,
    "teamAId" INTEGER NOT NULL,
    "teamBId" INTEGER NOT NULL,
    "teamAready" INTEGER NOT NULL DEFAULT 0,
    "teamBready" INTEGER NOT NULL DEFAULT 0,
    "pointsTeamA" INTEGER NOT NULL DEFAULT 0,
    "pointsTeamB" INTEGER NOT NULL DEFAULT 0,
    "mapWinsTeamA" INTEGER NOT NULL DEFAULT 0,
    "mapWinsTeamB" INTEGER NOT NULL DEFAULT 0,
    "gameNumber" INTEGER NOT NULL DEFAULT 0,
    "semanas" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT,
    "mapsAllowedByRound" JSONB,
    "mapResults" JSONB,
    CONSTRAINT "Match_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Match_teamAId_fkey" FOREIGN KEY ("teamAId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Match_teamBId_fkey" FOREIGN KEY ("teamBId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Match" ("bestOf", "gameNumber", "id", "mapWinsTeamA", "mapWinsTeamB", "mapsAllowedByRound", "pointsTeamA", "pointsTeamB", "semanas", "startDate", "status", "teamAId", "teamAready", "teamBId", "teamBready", "title", "tournamentId", "type") SELECT "bestOf", "gameNumber", "id", "mapWinsTeamA", "mapWinsTeamB", "mapsAllowedByRound", "pointsTeamA", "pointsTeamB", "semanas", "startDate", "status", "teamAId", "teamAready", "teamBId", "teamBready", "title", "tournamentId", "type" FROM "Match";
DROP TABLE "Match";
ALTER TABLE "new_Match" RENAME TO "Match";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
