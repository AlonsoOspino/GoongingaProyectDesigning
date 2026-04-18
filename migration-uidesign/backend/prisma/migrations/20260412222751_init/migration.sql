-- CreateTable
CREATE TABLE "Tournament" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "state" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Member" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nickname" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'DEFAULT',
    "profilePic" TEXT,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "teamId" INTEGER,
    CONSTRAINT "Member_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Team" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "logo" TEXT,
    "roster" TEXT,
    "state" TEXT NOT NULL DEFAULT 'ACTIVE',
    "victories" INTEGER NOT NULL DEFAULT 0,
    "mapWins" INTEGER NOT NULL DEFAULT 0,
    "mapLoses" INTEGER NOT NULL DEFAULT 0,
    "tournamentId" INTEGER NOT NULL,
    CONSTRAINT "Team_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Match" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "bestOf" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
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

-- CreateTable
CREATE TABLE "DraftTable" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "matchId" INTEGER NOT NULL,
    "currentTurnTeamId" INTEGER,
    "phase" TEXT NOT NULL,
    "bannedHeroes" JSONB NOT NULL,
    "pickedMaps" JSONB NOT NULL,
    "currentMapId" INTEGER,
    CONSTRAINT "DraftTable_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Map" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imgPath" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Hero" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "role" TEXT NOT NULL,
    "imgPath" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_AllowedMaps" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_AllowedMaps_A_fkey" FOREIGN KEY ("A") REFERENCES "Map" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_AllowedMaps_B_fkey" FOREIGN KEY ("B") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_user_key" ON "Member"("user");

-- CreateIndex
CREATE UNIQUE INDEX "DraftTable_matchId_key" ON "DraftTable"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "_AllowedMaps_AB_unique" ON "_AllowedMaps"("A", "B");

-- CreateIndex
CREATE INDEX "_AllowedMaps_B_index" ON "_AllowedMaps"("B");
