CREATE TYPE "FeudGameStatus" AS ENUM ('LOBBY', 'ROUND_INTRO', 'AWAITING_EXTERNAL_FACE_OFF', 'FACE_OFF_FIRST_ANSWER', 'FACE_OFF_SECOND_ANSWER', 'PLAY_PASS', 'ROUND_PLAY', 'STEAL', 'ROUND_RESULTS', 'FAST_MONEY', 'FINISHED', 'PAUSED');
CREATE TYPE "FeudTeamSide" AS ENUM ('ALPHA', 'BETA');
CREATE TYPE "FeudParticipantRole" AS ENUM ('MANAGER', 'PLAYER', 'SPECTATOR');
CREATE TYPE "FeudRoundStatus" AS ENUM ('ROUND_INTRO', 'AWAITING_EXTERNAL_FACE_OFF', 'FACE_OFF', 'PLAY_PASS', 'ROUND_PLAY', 'STEAL', 'ROUND_RESULTS', 'FINISHED');
CREATE TYPE "FeudResponseType" AS ENUM ('FACE_OFF', 'ROUND', 'STEAL_SUGGESTION', 'STEAL_FINAL', 'FAST_MONEY');

ALTER TABLE "FamilyFeudGame"
  ADD COLUMN "code" TEXT,
  ADD COLUMN "title" TEXT NOT NULL DEFAULT 'Network Feud',
  ADD COLUMN "status" "FeudGameStatus" NOT NULL DEFAULT 'LOBBY',
  ADD COLUMN "managerMemberId" INTEGER,
  ADD COLUMN "winningTeamId" INTEGER,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "timerEndsAt" TIMESTAMP(3),
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "finishedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "FamilyFeudGame_code_key" ON "FamilyFeudGame"("code");
CREATE INDEX "FamilyFeudGame_status_createdAt_idx" ON "FamilyFeudGame"("status", "createdAt");
CREATE INDEX "FamilyFeudGame_managerMemberId_idx" ON "FamilyFeudGame"("managerMemberId");

CREATE TABLE "FeudTeam" (
  "id" SERIAL NOT NULL,
  "gameId" INTEGER NOT NULL,
  "side" "FeudTeamSide" NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "score" INTEGER NOT NULL DEFAULT 0,
  "captainMemberId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeudTeam_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FeudTeam_gameId_side_key" ON "FeudTeam"("gameId", "side");
CREATE INDEX "FeudTeam_captainMemberId_idx" ON "FeudTeam"("captainMemberId");

CREATE TABLE "FeudParticipant" (
  "id" SERIAL NOT NULL,
  "gameId" INTEGER NOT NULL,
  "teamId" INTEGER,
  "memberId" INTEGER NOT NULL,
  "role" "FeudParticipantRole" NOT NULL DEFAULT 'PLAYER',
  "ready" BOOLEAN NOT NULL DEFAULT false,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeudParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FeudParticipant_gameId_memberId_key" ON "FeudParticipant"("gameId", "memberId");
CREATE INDEX "FeudParticipant_teamId_idx" ON "FeudParticipant"("teamId");
CREATE INDEX "FeudParticipant_memberId_idx" ON "FeudParticipant"("memberId");

CREATE TABLE "FeudQuestion" (
  "id" SERIAL NOT NULL,
  "question" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'GENERAL',
  "pack" TEXT NOT NULL DEFAULT 'Core Set',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeudQuestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FeudQuestion_active_category_idx" ON "FeudQuestion"("active", "category");
CREATE INDEX "FeudQuestion_createdById_idx" ON "FeudQuestion"("createdById");

CREATE TABLE "FeudAnswer" (
  "id" SERIAL NOT NULL,
  "questionId" INTEGER NOT NULL,
  "answer" TEXT NOT NULL,
  "points" INTEGER NOT NULL,
  "rank" INTEGER NOT NULL,
  "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  CONSTRAINT "FeudAnswer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FeudAnswer_questionId_rank_key" ON "FeudAnswer"("questionId", "rank");
CREATE INDEX "FeudAnswer_questionId_idx" ON "FeudAnswer"("questionId");

CREATE TABLE "FeudRound" (
  "id" SERIAL NOT NULL,
  "gameId" INTEGER NOT NULL,
  "questionId" INTEGER NOT NULL,
  "roundNumber" INTEGER NOT NULL,
  "multiplier" INTEGER NOT NULL DEFAULT 1,
  "activeTeamId" INTEGER,
  "roundBank" INTEGER NOT NULL DEFAULT 0,
  "strikes" INTEGER NOT NULL DEFAULT 0,
  "status" "FeudRoundStatus" NOT NULL DEFAULT 'ROUND_INTRO',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "FeudRound_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FeudRound_gameId_roundNumber_key" ON "FeudRound"("gameId", "roundNumber");
CREATE INDEX "FeudRound_questionId_idx" ON "FeudRound"("questionId");
CREATE INDEX "FeudRound_activeTeamId_idx" ON "FeudRound"("activeTeamId");

CREATE TABLE "FeudResponse" (
  "id" SERIAL NOT NULL,
  "roundId" INTEGER NOT NULL,
  "participantId" INTEGER,
  "memberId" INTEGER,
  "text" TEXT NOT NULL,
  "matchedAnswerId" INTEGER,
  "correct" BOOLEAN,
  "points" INTEGER NOT NULL DEFAULT 0,
  "responseType" "FeudResponseType" NOT NULL DEFAULT 'ROUND',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "FeudResponse_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FeudResponse_roundId_createdAt_idx" ON "FeudResponse"("roundId", "createdAt");
CREATE INDEX "FeudResponse_memberId_idx" ON "FeudResponse"("memberId");
CREATE INDEX "FeudResponse_matchedAnswerId_idx" ON "FeudResponse"("matchedAnswerId");

CREATE TABLE "FeudFaceOff" (
  "id" SERIAL NOT NULL,
  "roundId" INTEGER NOT NULL,
  "teamARepresentativeId" INTEGER NOT NULL,
  "teamBRepresentativeId" INTEGER NOT NULL,
  "externalWinnerMemberId" INTEGER,
  "familyWinnerTeamId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "FeudFaceOff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FeudFaceOff_roundId_key" ON "FeudFaceOff"("roundId");
CREATE INDEX "FeudFaceOff_externalWinnerMemberId_idx" ON "FeudFaceOff"("externalWinnerMemberId");
CREATE INDEX "FeudFaceOff_familyWinnerTeamId_idx" ON "FeudFaceOff"("familyWinnerTeamId");

ALTER TABLE "FamilyFeudGame" ADD CONSTRAINT "FamilyFeudGame_managerMemberId_fkey" FOREIGN KEY ("managerMemberId") REFERENCES "NetworkMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FamilyFeudGame" ADD CONSTRAINT "FamilyFeudGame_winningTeamId_fkey" FOREIGN KEY ("winningTeamId") REFERENCES "FeudTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeudTeam" ADD CONSTRAINT "FeudTeam_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "FamilyFeudGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeudTeam" ADD CONSTRAINT "FeudTeam_captainMemberId_fkey" FOREIGN KEY ("captainMemberId") REFERENCES "NetworkMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeudParticipant" ADD CONSTRAINT "FeudParticipant_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "FamilyFeudGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeudParticipant" ADD CONSTRAINT "FeudParticipant_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "FeudTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeudParticipant" ADD CONSTRAINT "FeudParticipant_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "NetworkMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeudQuestion" ADD CONSTRAINT "FeudQuestion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "NetworkMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeudAnswer" ADD CONSTRAINT "FeudAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "FeudQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeudRound" ADD CONSTRAINT "FeudRound_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "FamilyFeudGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeudRound" ADD CONSTRAINT "FeudRound_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "FeudQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeudRound" ADD CONSTRAINT "FeudRound_activeTeamId_fkey" FOREIGN KEY ("activeTeamId") REFERENCES "FeudTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeudResponse" ADD CONSTRAINT "FeudResponse_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "FeudRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeudResponse" ADD CONSTRAINT "FeudResponse_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "FeudParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeudResponse" ADD CONSTRAINT "FeudResponse_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "NetworkMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeudResponse" ADD CONSTRAINT "FeudResponse_matchedAnswerId_fkey" FOREIGN KEY ("matchedAnswerId") REFERENCES "FeudAnswer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeudFaceOff" ADD CONSTRAINT "FeudFaceOff_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "FeudRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeudFaceOff" ADD CONSTRAINT "FeudFaceOff_teamARepresentativeId_fkey" FOREIGN KEY ("teamARepresentativeId") REFERENCES "NetworkMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeudFaceOff" ADD CONSTRAINT "FeudFaceOff_teamBRepresentativeId_fkey" FOREIGN KEY ("teamBRepresentativeId") REFERENCES "NetworkMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeudFaceOff" ADD CONSTRAINT "FeudFaceOff_externalWinnerMemberId_fkey" FOREIGN KEY ("externalWinnerMemberId") REFERENCES "NetworkMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeudFaceOff" ADD CONSTRAINT "FeudFaceOff_familyWinnerTeamId_fkey" FOREIGN KEY ("familyWinnerTeamId") REFERENCES "FeudTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
