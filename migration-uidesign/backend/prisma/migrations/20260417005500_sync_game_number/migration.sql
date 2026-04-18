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
    CONSTRAINT "Match_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Match_teamAId_fkey" FOREIGN KEY ("teamAId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Match_teamBId_fkey" FOREIGN KEY ("teamBId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Match" ("bestOf", "gameNumber", "id", "mapWinsTeamA", "mapWinsTeamB", "pointsTeamA", "pointsTeamB", "startDate", "status", "teamAId", "teamBId", "tournamentId", "type") SELECT "bestOf", "gameNumber", "id", "mapWinsTeamA", "mapWinsTeamB", "pointsTeamA", "pointsTeamB", "startDate", "status", "teamAId", "teamBId", "tournamentId", "type" FROM "Match";
DROP TABLE "Match";
ALTER TABLE "new_Match" RENAME TO "Match";
CREATE TABLE "new_Tournament" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'SCHEDULED'
);
INSERT INTO "new_Tournament" ("id", "name", "startDate", "state") SELECT "id", "name", "startDate", "state" FROM "Tournament";
DROP TABLE "Tournament";
ALTER TABLE "new_Tournament" RENAME TO "Tournament";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
