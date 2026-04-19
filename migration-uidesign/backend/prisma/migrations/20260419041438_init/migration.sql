-- CreateEnum
CREATE TYPE "TournamentState" AS ENUM ('SCHEDULED', 'ROUNDROBIN', 'PLAYOFFS', 'SEMIFINALS', 'FINALS', 'FINISHED');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('ADMIN', 'MANAGER', 'CAPTAIN', 'EDITOR', 'DEFAULT');

-- CreateEnum
CREATE TYPE "TeamState" AS ENUM ('ACTIVE', 'ELIMINATED');

-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('ROUNDROBIN', 'PLAYINS', 'PLAYOFFS', 'SEMIFINALS', 'FINALS', 'PRACTICE');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'PENDINGREGISTERS', 'FINISHED');

-- CreateEnum
CREATE TYPE "MapType" AS ENUM ('CONTROL', 'HYBRID', 'PAYLOAD', 'PUSH', 'FLASHPOINT');

-- CreateEnum
CREATE TYPE "HeroRole" AS ENUM ('TANK', 'DPS', 'SUPPORT');

-- CreateEnum
CREATE TYPE "DraftActionType" AS ENUM ('BAN', 'PICK', 'SKIP');

-- CreateEnum
CREATE TYPE "phase" AS ENUM ('STARTING', 'MAPPICKING', 'BAN', 'ENDMAP', 'FINISHED');

-- CreateTable
CREATE TABLE "Tournament" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "state" "TournamentState" NOT NULL DEFAULT 'SCHEDULED',

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" SERIAL NOT NULL,
    "nickname" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'DEFAULT',
    "profilePic" TEXT,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "teamId" INTEGER,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT,
    "roster" TEXT,
    "state" "TeamState" NOT NULL DEFAULT 'ACTIVE',
    "victories" INTEGER NOT NULL DEFAULT 0,
    "mapWins" INTEGER NOT NULL DEFAULT 0,
    "mapLoses" INTEGER NOT NULL DEFAULT 0,
    "tournamentId" INTEGER NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" SERIAL NOT NULL,
    "type" "MatchType" NOT NULL,
    "bestOf" INTEGER NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "startDate" TIMESTAMP(3),
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

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "News" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "News_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftTable" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "currentTurnTeamId" INTEGER,
    "phase" TEXT NOT NULL,
    "phaseStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bannedHeroes" JSONB NOT NULL,
    "pickedMaps" JSONB NOT NULL,
    "currentMapId" INTEGER,

    CONSTRAINT "DraftTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftAction" (
    "id" SERIAL NOT NULL,
    "draftId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "action" "DraftActionType" NOT NULL,
    "value" INTEGER,
    "gameNumber" INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DraftAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Map" (
    "id" SERIAL NOT NULL,
    "type" "MapType" NOT NULL,
    "description" TEXT NOT NULL,
    "imgPath" TEXT NOT NULL,

    CONSTRAINT "Map_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hero" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "role" "HeroRole" NOT NULL,
    "imgPath" TEXT NOT NULL,

    CONSTRAINT "Hero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerStat" (
    "id" SERIAL NOT NULL,
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
    "damagePer10" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "healingPer10" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mitigationPer10" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "killsPer10" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "assistsPer10" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deathsPer10" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mapType" "MapType" NOT NULL,
    "role" "HeroRole" NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AllowedMaps" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_AllowedMaps_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_user_key" ON "Member"("user");

-- CreateIndex
CREATE UNIQUE INDEX "DraftTable_matchId_key" ON "DraftTable"("matchId");

-- CreateIndex
CREATE INDEX "_AllowedMaps_B_index" ON "_AllowedMaps"("B");

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_teamAId_fkey" FOREIGN KEY ("teamAId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_teamBId_fkey" FOREIGN KEY ("teamBId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftTable" ADD CONSTRAINT "DraftTable_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftAction" ADD CONSTRAINT "DraftAction_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "DraftTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftAction" ADD CONSTRAINT "DraftAction_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerStat" ADD CONSTRAINT "PlayerStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AllowedMaps" ADD CONSTRAINT "_AllowedMaps_A_fkey" FOREIGN KEY ("A") REFERENCES "Map"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AllowedMaps" ADD CONSTRAINT "_AllowedMaps_B_fkey" FOREIGN KEY ("B") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
