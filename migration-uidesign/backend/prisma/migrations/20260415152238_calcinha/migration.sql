/*
  Warnings:

  - Added the required column `startDate` to the `Match` table without a default value. This is not possible if the table is not empty.

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
    "pointsTeamA" INTEGER NOT NULL DEFAULT 0,
    "pointsTeamB" INTEGER NOT NULL DEFAULT 0,
    "mapWinsTeamA" INTEGER NOT NULL DEFAULT 0,
    "mapWinsTeamB" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Match_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Match_teamAId_fkey" FOREIGN KEY ("teamAId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Match_teamBId_fkey" FOREIGN KEY ("teamBId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Match" ("bestOf", "id", "mapWinsTeamA", "mapWinsTeamB", "pointsTeamA", "pointsTeamB", "status", "teamAId", "teamBId", "tournamentId", "type") SELECT "bestOf", "id", "mapWinsTeamA", "mapWinsTeamB", "pointsTeamA", "pointsTeamB", "status", "teamAId", "teamBId", "tournamentId", "type" FROM "Match";
DROP TABLE "Match";
ALTER TABLE "new_Match" RENAME TO "Match";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
