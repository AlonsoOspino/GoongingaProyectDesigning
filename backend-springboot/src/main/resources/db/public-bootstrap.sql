-- Fresh PostgreSQL database only. Historical public schema, in Prisma migration order.
-- Existing installations already have these tables and must not run this file.

-- Source: 20260419041438_init
-- Enums
CREATE TYPE "TournamentState" AS ENUM ('SCHEDULED', 'ROUNDROBIN', 'PLAYOFFS', 'SEMIFINALS', 'FINALS', 'FINISHED');
CREATE TYPE "MemberRole" AS ENUM ('ADMIN', 'MANAGER', 'CAPTAIN', 'EDITOR', 'DEFAULT');
CREATE TYPE "TeamState" AS ENUM ('ACTIVE', 'ELIMINATED');
CREATE TYPE "MatchType" AS ENUM ('ROUNDROBIN', 'PLAYINS', 'PLAYOFFS', 'SEMIFINALS', 'FINALS', 'PRACTICE');
CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'PENDINGREGISTERS', 'FINISHED');
CREATE TYPE "MapType" AS ENUM ('CONTROL', 'HYBRID', 'PAYLOAD', 'PUSH', 'FLASHPOINT');
CREATE TYPE "HeroRole" AS ENUM ('TANK', 'DPS', 'SUPPORT');
CREATE TYPE "DraftActionType" AS ENUM ('BAN', 'PICK', 'SKIP');
CREATE TYPE "phase" AS ENUM ('STARTING', 'MAPPICKING', 'BAN', 'PLAYING', 'ENDMAP', 'FINISHED');

-- Tables
CREATE TABLE "Tournament" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "state" "TournamentState" NOT NULL DEFAULT 'SCHEDULED',
  CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Member" (
  "id" SERIAL NOT NULL,
  "nickname" TEXT NOT NULL,
  "user" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "MemberRole" NOT NULL DEFAULT 'DEFAULT',
  "profilePic" TEXT,
  "rank" INTEGER NOT NULL DEFAULT 0,
  "heroVideoFolderPath" TEXT,
  "obsWebsocketPassword" TEXT,
  "teamId" INTEGER,
  CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Team" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "logo" TEXT,
  "bannerURL" TEXT,
  "roster" TEXT,
  "discordRoleId" TEXT,
  "state" "TeamState" NOT NULL DEFAULT 'ACTIVE',
  "victories" INTEGER NOT NULL DEFAULT 0,
  "defeats" INTEGER NOT NULL DEFAULT 0,
  "mapWins" INTEGER NOT NULL DEFAULT 0,
  "mapLoses" INTEGER NOT NULL DEFAULT 0,
  "tournamentId" INTEGER NOT NULL,
  CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

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
  "semanas" INTEGER,
  "title" TEXT,
  "mapsAllowedByRound" JSONB,
  "mapResults" JSONB,
  "mapStartedAt" TIMESTAMP(3),
  "mapTimerPaused" BOOLEAN NOT NULL DEFAULT false,
  "mapTimerPausedAt" TIMESTAMP(3),
  "pauseRequestedBy" INTEGER,
  "pauseRequestedAt" TIMESTAMP(3),
  "discordMessageId" TEXT,
  CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "News" (
  "id" SERIAL NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "imageUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "News_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DraftTable" (
  "id" SERIAL NOT NULL,
  "matchId" INTEGER NOT NULL,
  "currentTurnTeamId" INTEGER,
  "phase" TEXT NOT NULL,
  "phaseStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "bannedHeroes" JSONB,
  "pickedMaps" JSONB,
  "currentMapId" INTEGER,
  CONSTRAINT "DraftTable_pkey" PRIMARY KEY ("id")
);

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

CREATE TABLE "Map" (
  "id" SERIAL NOT NULL,
  "type" "MapType" NOT NULL,
  "description" TEXT NOT NULL,
  "imgPath" TEXT NOT NULL,
  CONSTRAINT "Map_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Hero" (
  "id" SERIAL NOT NULL,
  "name" TEXT,
  "role" "HeroRole" NOT NULL,
  "imgPath" TEXT NOT NULL,
  "heroGift" TEXT,
  CONSTRAINT "Hero_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlayerStat" (
  "id" SERIAL NOT NULL,
  "damage" INTEGER NOT NULL,
  "healing" INTEGER NOT NULL,
  "mitigation" INTEGER NOT NULL,
  "kills" INTEGER NOT NULL,
  "assists" INTEGER NOT NULL,
  "deaths" INTEGER NOT NULL,
  "gameDuration" INTEGER NOT NULL,
  "damagePer10" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "healingPer10" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "mitigationPer10" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "killsPer10" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "assistsPer10" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "deathsPer10" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "mapType" "MapType" NOT NULL,
  "role" "HeroRole" NOT NULL,
  "userId" INTEGER NOT NULL,
  "matchId" INTEGER NOT NULL,
  "gameNumber" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlayerStat_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "_AllowedMaps" (
  "A" INTEGER NOT NULL,
  "B" INTEGER NOT NULL,
  CONSTRAINT "_AllowedMaps_AB_pkey" PRIMARY KEY ("A","B")
);

-- Indexes
CREATE UNIQUE INDEX "Member_user_key" ON "Member"("user");
CREATE UNIQUE INDEX "DraftTable_matchId_key" ON "DraftTable"("matchId");
CREATE INDEX "_AllowedMaps_B_index" ON "_AllowedMaps"("B");

-- Foreign keys
ALTER TABLE "Member" ADD CONSTRAINT "Member_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Team" ADD CONSTRAINT "Team_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Match" ADD CONSTRAINT "Match_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Match" ADD CONSTRAINT "Match_teamAId_fkey" FOREIGN KEY ("teamAId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Match" ADD CONSTRAINT "Match_teamBId_fkey" FOREIGN KEY ("teamBId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DraftTable" ADD CONSTRAINT "DraftTable_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DraftAction" ADD CONSTRAINT "DraftAction_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "DraftTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DraftAction" ADD CONSTRAINT "DraftAction_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlayerStat" ADD CONSTRAINT "PlayerStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "_AllowedMaps" ADD CONSTRAINT "_AllowedMaps_A_fkey" FOREIGN KEY ("A") REFERENCES "Map"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_AllowedMaps" ADD CONSTRAINT "_AllowedMaps_B_fkey" FOREIGN KEY ("B") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Source: 20260507000000_add_draft_asset_paths
-- placeholder migration restored
-- original migration was deleted accidentally
-- this file is a no-op placeholder so Prisma's migration history can be reconciled


-- Source: 20260507001000_add_member_stream_settings
ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "heroVideoFolderPath" TEXT;
ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "leaderboardImagePath" TEXT;
ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "matchCardsImagePath" TEXT;
ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "obsWebsocketPassword" TEXT;


-- Source: 20260507005000_add_obs_websocket_url_to_member
ALTER TABLE "Member" ADD COLUMN "obsWebsocketUrl" TEXT;


-- Source: 20260510000000_add_team_banners_left_right
ALTER TABLE "Team" RENAME COLUMN "bannerURL" TO "bannerLeft";
ALTER TABLE "Team" ADD COLUMN "bannerRight" TEXT;


-- Source: 20260514000000_add_leaderboard_overlay_asset
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


-- Source: 20260718000000_add_playoff_bracket
ALTER TABLE "Team" ADD COLUMN "playoffSeed" INTEGER;

ALTER TABLE "Match" ADD COLUMN "playoffRound" INTEGER;
ALTER TABLE "Match" ADD COLUMN "playoffSlot" INTEGER;

CREATE UNIQUE INDEX "Team_tournamentId_playoffSeed_key"
ON "Team"("tournamentId", "playoffSeed");

CREATE UNIQUE INDEX "Match_tournamentId_playoffRound_playoffSlot_key"
ON "Match"("tournamentId", "playoffRound", "playoffSlot");


-- Source: 20260725000000_add_goonginga_wrapped
CREATE TABLE "Wrapped" (
    "id" SERIAL NOT NULL,
    "tournamentId" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "assets" JSONB NOT NULL DEFAULT '{}',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wrapped_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Wrapped_tournamentId_key" ON "Wrapped"("tournamentId");

ALTER TABLE "Wrapped" ADD CONSTRAINT "Wrapped_tournamentId_fkey"
FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Source: 20260726000000_add_family_feud_games
CREATE TABLE "FamilyFeudGame" (
    "id" SERIAL NOT NULL,
    "roomId" TEXT NOT NULL,
    "alphaInviteToken" TEXT NOT NULL,
    "betaInviteToken" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyFeudGame_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FamilyFeudGame_roomId_key" ON "FamilyFeudGame"("roomId");
CREATE UNIQUE INDEX "FamilyFeudGame_alphaInviteToken_key" ON "FamilyFeudGame"("alphaInviteToken");
CREATE UNIQUE INDEX "FamilyFeudGame_betaInviteToken_key" ON "FamilyFeudGame"("betaInviteToken");


-- Source: 20260729000000_add_family_feud_progress
ALTER TABLE "FamilyFeudGame"
ADD COLUMN "phase" TEXT NOT NULL DEFAULT 'notStarted',
ADD COLUMN "round" INTEGER;



-- Source: 20260729001000_backfill_family_feud_progress
UPDATE "FamilyFeudGame"
SET
  "phase" = CASE
    WHEN "state"->'round'->>'phase' = 'question' THEN 'choosingParticipant'
    WHEN "state"->'round'->>'phase' IN ('faceoff', 'control', 'steal') THEN 'playing'
    WHEN "state"->'round'->>'phase' = 'round-over' THEN 'roundComplete'
    WHEN COALESCE(("state"->>'gameStarted')::boolean, false) THEN 'teamLobby'
    ELSE 'notStarted'
  END,
  "round" = CASE
    WHEN COALESCE(("state"->'round'->>'number')::integer, 0) > 0
      THEN ("state"->'round'->>'number')::integer
    ELSE NULL
  END;


-- Source: 20260803000000_add_network_members
-- New Goonginga network identities. The legacy "Member" table remains
-- untouched because it is still used by the active GGL season.
CREATE TYPE "NetworkMemberRole" AS ENUM (
  'MEMBER',
  'ADMIN',
  'CASTER',
  'DEVELOPER',
  'SEASON_PLAYER',
  'MODERATOR',
  'COMMUNITY_MANAGER',
  'CONTENT_CREATOR'
);

CREATE TYPE "NetworkMemberStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

CREATE TABLE "NetworkMember" (
  "id" SERIAL NOT NULL,
  "discordUserId" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "avatarUrl" TEXT,
  "roles" "NetworkMemberRole"[] NOT NULL DEFAULT ARRAY['MEMBER']::"NetworkMemberRole"[],
  "status" "NetworkMemberStatus" NOT NULL DEFAULT 'ACTIVE',
  "discordJoinedGglAt" TIMESTAMP(3),
  "discordLastVerifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NetworkMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeasonPlayer" (
  "id" SERIAL NOT NULL,
  "memberId" INTEGER NOT NULL,
  "tournamentId" INTEGER NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SeasonPlayer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NetworkMember_discordUserId_key" ON "NetworkMember"("discordUserId");
CREATE INDEX "NetworkMember_status_idx" ON "NetworkMember"("status");
CREATE UNIQUE INDEX "SeasonPlayer_memberId_tournamentId_key" ON "SeasonPlayer"("memberId", "tournamentId");
CREATE INDEX "SeasonPlayer_tournamentId_idx" ON "SeasonPlayer"("tournamentId");

ALTER TABLE "SeasonPlayer"
  ADD CONSTRAINT "SeasonPlayer_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "NetworkMember"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeasonPlayer"
  ADD CONSTRAINT "SeasonPlayer_tournamentId_fkey"
  FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;


-- Source: 20260804000000_add_minigames
ALTER TYPE "NetworkMemberRole" ADD VALUE IF NOT EXISTS 'SOCIAL_MEDIA';

CREATE TYPE "MiniGameType" AS ENUM ('JEOPARDY', 'FAMILY_FEUD', 'CUSTOM');
CREATE TYPE "MiniGameStatus" AS ENUM ('LIVE', 'UNDER_DEVELOPMENT');

CREATE TABLE "MiniGame" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "coverImageUrl" TEXT,
    "gameType" "MiniGameType" NOT NULL DEFAULT 'JEOPARDY',
    "status" "MiniGameStatus" NOT NULL DEFAULT 'LIVE',
    "config" JSONB NOT NULL DEFAULT '{}',
    "state" JSONB NOT NULL DEFAULT '{}',
    "createdById" INTEGER NOT NULL,
    "underDevelopmentById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MiniGame_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MiniGame_slug_key" ON "MiniGame"("slug");
CREATE INDEX "MiniGame_status_createdAt_idx" ON "MiniGame"("status", "createdAt");
CREATE INDEX "MiniGame_createdById_idx" ON "MiniGame"("createdById");

ALTER TABLE "MiniGame"
  ADD CONSTRAINT "MiniGame_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "NetworkMember"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MiniGame"
  ADD CONSTRAINT "MiniGame_underDevelopmentById_fkey"
  FOREIGN KEY ("underDevelopmentById") REFERENCES "NetworkMember"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;


-- Source: 20260805000000_add_finals_presentation_time
ALTER TABLE "Match" ADD COLUMN "presentationStartDate" TIMESTAMP(3);


-- Source: 20260805010000_add_finals_presentation_version
ALTER TABLE "Match" ADD COLUMN "presentationVersion" INTEGER NOT NULL DEFAULT 0;


-- Source: 20260807000000_add_mvp_voting
CREATE TYPE "MvpStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

CREATE TABLE "MvpCampaign" (
  "id" SERIAL PRIMARY KEY,
  "matchId" INTEGER NOT NULL UNIQUE,
  "status" "MvpStatus" NOT NULL DEFAULT 'DRAFT',
  "winnerCandidateId" INTEGER,
  "openedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MvpCampaign_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "MvpCandidate" (
  "id" SERIAL PRIMARY KEY,
  "campaignId" INTEGER NOT NULL,
  "memberId" INTEGER NOT NULL,
  "displayName" TEXT NOT NULL,
  "imageUrl" TEXT,
  "sortOrder" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "MvpCandidate_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MvpCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MvpCandidate_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "MvpVote" (
  "id" SERIAL PRIMARY KEY,
  "campaignId" INTEGER NOT NULL,
  "candidateId" INTEGER NOT NULL,
  "networkMemberId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MvpVote_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MvpCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MvpVote_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "MvpCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MvpVote_networkMemberId_fkey" FOREIGN KEY ("networkMemberId") REFERENCES "NetworkMember"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "MvpCampaign" ADD CONSTRAINT "MvpCampaign_winnerCandidateId_fkey" FOREIGN KEY ("winnerCandidateId") REFERENCES "MvpCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "MvpCandidate_campaignId_memberId_key" ON "MvpCandidate"("campaignId", "memberId");
CREATE UNIQUE INDEX "MvpCandidate_campaignId_sortOrder_key" ON "MvpCandidate"("campaignId", "sortOrder");
CREATE UNIQUE INDEX "MvpVote_campaignId_networkMemberId_key" ON "MvpVote"("campaignId", "networkMemberId");
CREATE INDEX "MvpVote_candidateId_idx" ON "MvpVote"("candidateId");


-- Source: 20260809000000_move_competitive_identity_to_network_member
-- Season 8 was exported before this migration. Raw stats are cleared because
-- their user ids belonged to the removed password-based Member table.
ALTER TABLE "NetworkMember"
  ADD COLUMN "nickname" TEXT,
  ADD COLUMN "profilePic" TEXT,
  ADD COLUMN "role" "MemberRole" NOT NULL DEFAULT 'DEFAULT',
  ADD COLUMN "rank" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "teamId" INTEGER,
  ADD COLUMN "heroVideoFolderPath" TEXT,
  ADD COLUMN "obsWebsocketUrl" TEXT,
  ADD COLUMN "obsWebsocketPassword" TEXT;

UPDATE "NetworkMember" SET "nickname" = "username", "profilePic" = "avatarUrl";

CREATE INDEX "NetworkMember_teamId_idx" ON "NetworkMember"("teamId");
ALTER TABLE "NetworkMember" ADD CONSTRAINT "NetworkMember_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PlayerStat" DROP CONSTRAINT IF EXISTS "PlayerStat_userId_fkey";
TRUNCATE TABLE "PlayerStat" RESTART IDENTITY;
ALTER TABLE "PlayerStat" ADD CONSTRAINT "PlayerStat_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "NetworkMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP TABLE IF EXISTS "MvpVote" CASCADE;
DROP TABLE IF EXISTS "MvpCandidate" CASCADE;
DROP TABLE IF EXISTS "MvpCampaign" CASCADE;
DROP TYPE IF EXISTS "MvpStatus";
DROP TABLE IF EXISTS "Wrapped" CASCADE;
DROP TABLE IF EXISTS "Member" CASCADE;

ALTER TABLE "Match"
  DROP COLUMN IF EXISTS "presentationStartDate",
  DROP COLUMN IF EXISTS "presentationVersion";


-- Source: 20260809220000_add_announcement_modes
CREATE TYPE "AnnouncementModeType" AS ENUM ('TOURNAMENT', 'JEOPARDY');

CREATE TABLE "AnnouncementMode" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "activeMode" "AnnouncementModeType" NOT NULL DEFAULT 'TOURNAMENT',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "updatedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnnouncementMode_pkey" PRIMARY KEY ("id")
);

INSERT INTO "AnnouncementMode" ("id", "activeMode", "enabled", "config")
VALUES (1, 'TOURNAMENT', true, '{}')
ON CONFLICT ("id") DO NOTHING;


-- Source: 20260810043000_add_jeopardy_phases_and_participants
CREATE TYPE "JeopardyPhase" AS ENUM (
  'CREATED',
  'PICKING_MEMBER',
  'PICKING_QUESTION',
  'RESPONDING',
  'RESPONDED',
  'FINALIZED'
);

ALTER TABLE "MiniGame"
ADD COLUMN "phase" "JeopardyPhase" NOT NULL DEFAULT 'CREATED';

CREATE TABLE "MiniGameParticipant" (
  "id" SERIAL NOT NULL,
  "gameId" INTEGER NOT NULL,
  "memberId" INTEGER NOT NULL,
  "score" INTEGER NOT NULL DEFAULT 0,
  "joinedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MiniGameParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MiniGameParticipant_gameId_memberId_key"
ON "MiniGameParticipant"("gameId", "memberId");

CREATE INDEX "MiniGameParticipant_gameId_score_idx"
ON "MiniGameParticipant"("gameId", "score");

CREATE INDEX "MiniGameParticipant_memberId_idx"
ON "MiniGameParticipant"("memberId");

ALTER TABLE "MiniGameParticipant"
ADD CONSTRAINT "MiniGameParticipant_gameId_fkey"
FOREIGN KEY ("gameId") REFERENCES "MiniGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MiniGameParticipant"
ADD CONSTRAINT "MiniGameParticipant_memberId_fkey"
FOREIGN KEY ("memberId") REFERENCES "NetworkMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Source: 20260813010000_network_feud_authoritative
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


-- Source: 20260814020000_rename_family_feud
ALTER TABLE "FamilyFeudGame" ALTER COLUMN "title" SET DEFAULT 'Family Feud';

UPDATE "FamilyFeudGame"
SET "title" = 'Family Feud'
WHERE "title" = 'Network Feud';

UPDATE "FeudQuestion"
SET "pack" = 'Family Feud Starter'
WHERE "pack" = 'Network Feud Starter';


-- Source: 20260814150000_add_family_feud_development_mode
ALTER TABLE "FamilyFeudGame"
ADD COLUMN "developmentMode" BOOLEAN NOT NULL DEFAULT false;


-- Source: 20260819120000_announcement_collection
CREATE TYPE "AnnouncementType" AS ENUM ('TOURNAMENT', 'MINIGAME', 'CUSTOM');

CREATE TABLE "Announcement" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AnnouncementType" NOT NULL,
    "content" JSONB NOT NULL DEFAULT '{}',
    "countdownAt" TIMESTAMP(3),
    "createdById" INTEGER NOT NULL,
    "updatedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Announcement_type_updatedAt_idx" ON "Announcement"("type", "updatedAt");

ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "NetworkMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AnnouncementMode" ADD COLUMN "publishedId" INTEGER;

-- Seed one announcement per legacy mode so the public site does not change.
-- createdById is required and is provenance only -- no permission check reads
-- it. The author falls back from the singleton's last editor, to the lowest-id
-- member who can manage announcements (ADMIN preferred, then SOCIAL_MEDIA --
-- exactly the roles hasManagerAccess allows), to any member at all. Only a
-- database with no members at all seeds nothing, which is correct: there is no
-- existing announcement to preserve there.
CREATE OR REPLACE FUNCTION pg_temp.announcement_seed_author() RETURNS INTEGER AS $$
    SELECT COALESCE(
        (SELECT m."updatedById" FROM "AnnouncementMode" m WHERE m."id" = 1),
        (SELECT n."id" FROM "NetworkMember" n
         WHERE 'ADMIN' = ANY(n."roles") OR 'SOCIAL_MEDIA' = ANY(n."roles")
         ORDER BY (CASE WHEN 'ADMIN' = ANY(n."roles") THEN 0 ELSE 1 END), n."id" ASC
         LIMIT 1),
        (SELECT n."id" FROM "NetworkMember" n ORDER BY n."id" ASC LIMIT 1)
    );
$$ LANGUAGE SQL;

INSERT INTO "Announcement" ("name", "type", "content", "countdownAt", "createdById")
SELECT
    'Tournament',
    'TOURNAMENT',
    '{"matchId": null, "headline": ""}'::jsonb,
    CASE
        WHEN m."config" ->> 'countdownAt' IS NULL THEN NULL
        ELSE ((m."config" ->> 'countdownAt')::timestamptz AT TIME ZONE 'UTC')
    END,
    pg_temp.announcement_seed_author()
FROM "AnnouncementMode" m
WHERE m."id" = 1 AND pg_temp.announcement_seed_author() IS NOT NULL;

INSERT INTO "Announcement" ("name", "type", "content", "countdownAt", "createdById")
SELECT
    'Minigame',
    'MINIGAME',
    jsonb_build_object(
        'minigameSlug',
        COALESCE((
            SELECT g."slug" FROM "MiniGame" g
            WHERE g."gameType" = 'JEOPARDY' AND g."status" = 'LIVE'
            ORDER BY g."updatedAt" DESC LIMIT 1
        ), ''),
        'ctaLabel', ''
    ),
    CASE
        WHEN m."config" ->> 'countdownAt' IS NULL THEN NULL
        ELSE ((m."config" ->> 'countdownAt')::timestamptz AT TIME ZONE 'UTC')
    END,
    pg_temp.announcement_seed_author()
FROM "AnnouncementMode" m
WHERE m."id" = 1 AND pg_temp.announcement_seed_author() IS NOT NULL;

-- Point the singleton at whichever seeded row matches the old activeMode.
UPDATE "AnnouncementMode" m
SET "publishedId" = (
    SELECT a."id" FROM "Announcement" a
    WHERE a."type" = (CASE WHEN m."activeMode" = 'JEOPARDY' THEN 'MINIGAME' ELSE 'TOURNAMENT' END)::"AnnouncementType"
    ORDER BY a."id" ASC LIMIT 1
)
WHERE m."id" = 1;

ALTER TABLE "AnnouncementMode" ADD CONSTRAINT "AnnouncementMode_publishedId_fkey"
    FOREIGN KEY ("publishedId") REFERENCES "Announcement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AnnouncementMode" DROP COLUMN "activeMode";
ALTER TABLE "AnnouncementMode" DROP COLUMN "config";

DROP TYPE "AnnouncementModeType";


-- Source: 20260820120000_announcement_ordering
ALTER TYPE "AnnouncementType" ADD VALUE IF NOT EXISTS 'FORM';

ALTER TABLE "Announcement"
    ADD COLUMN IF NOT EXISTS "published" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;

-- Preserve the singleton's currently published announcement before removing
-- the pointer. Every other announcement remains a draft.
UPDATE "Announcement" a
SET "published" = true, "order" = 0
FROM "AnnouncementMode" m
WHERE m."id" = 1 AND m."publishedId" = a."id";

CREATE INDEX IF NOT EXISTS "Announcement_published_order_idx"
    ON "Announcement"("published", "order");

ALTER TABLE "AnnouncementMode"
    DROP CONSTRAINT IF EXISTS "AnnouncementMode_publishedId_fkey";
ALTER TABLE "AnnouncementMode"
    DROP COLUMN IF EXISTS "publishedId";


-- Source: 20260820150000_season_player_permissions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SeasonPlayerRole') THEN
    CREATE TYPE "SeasonPlayerRole" AS ENUM ('CAPTAIN', 'PLAYER');
  END IF;
END $$;

ALTER TABLE "SeasonPlayer"
  ADD COLUMN IF NOT EXISTS "teamId" INTEGER,
  ADD COLUMN IF NOT EXISTS "role" "SeasonPlayerRole" NOT NULL DEFAULT 'PLAYER';

DROP INDEX IF EXISTS "SeasonPlayer_tournamentId_idx";
CREATE INDEX IF NOT EXISTS "SeasonPlayer_tournamentId_teamId_idx"
  ON "SeasonPlayer"("tournamentId", "teamId");
CREATE INDEX IF NOT EXISTS "SeasonPlayer_teamId_idx"
  ON "SeasonPlayer"("teamId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SeasonPlayer_teamId_fkey'
  ) THEN
    ALTER TABLE "SeasonPlayer"
      ADD CONSTRAINT "SeasonPlayer_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "SeasonPlayer" (
  "memberId", "tournamentId", "teamId", "role", "joinedAt", "createdAt", "updatedAt"
)
SELECT
  member."id",
  team."tournamentId",
  team."id",
  CASE WHEN member."role" = 'CAPTAIN' THEN 'CAPTAIN'::"SeasonPlayerRole" ELSE 'PLAYER'::"SeasonPlayerRole" END,
  member."createdAt",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "NetworkMember" member
JOIN "Team" team ON team."id" = member."teamId"
WHERE member."teamId" IS NOT NULL
ON CONFLICT ("memberId", "tournamentId") DO UPDATE SET
  "teamId" = EXCLUDED."teamId",
  "role" = EXCLUDED."role",
  "updatedAt" = CURRENT_TIMESTAMP;

ALTER TABLE "PlayerStat"
  ADD COLUMN IF NOT EXISTS "seasonPlayerId" INTEGER;

CREATE INDEX IF NOT EXISTS "PlayerStat_seasonPlayerId_idx"
  ON "PlayerStat"("seasonPlayerId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PlayerStat_seasonPlayerId_fkey'
  ) THEN
    ALTER TABLE "PlayerStat"
      ADD CONSTRAINT "PlayerStat_seasonPlayerId_fkey"
      FOREIGN KEY ("seasonPlayerId") REFERENCES "SeasonPlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

UPDATE "PlayerStat" stat
SET "seasonPlayerId" = season_player."id"
FROM "Match" match, "SeasonPlayer" season_player
WHERE stat."matchId" = match."id"
  AND season_player."memberId" = stat."userId"
  AND season_player."tournamentId" = match."tournamentId"
  AND stat."seasonPlayerId" IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum enum_value
    JOIN pg_type enum_type ON enum_type.oid = enum_value.enumtypid
    WHERE enum_type.typname = 'MatchStatus' AND enum_value.enumlabel = 'PENDINGREGISTERS'
  ) THEN
    UPDATE "Match" SET "status" = 'FINISHED' WHERE "status" = 'PENDINGREGISTERS';
    ALTER TABLE "Match" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TYPE "MatchStatus" RENAME TO "MatchStatus_old";
    CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'FINISHED');
    ALTER TABLE "Match"
      ALTER COLUMN "status" TYPE "MatchStatus"
      USING ("status"::text::"MatchStatus");
    DROP TYPE "MatchStatus_old";
  END IF;
END $$;

ALTER TABLE "Match" ALTER COLUMN "status" SET DEFAULT 'SCHEDULED';


-- Source: 20260822010000_add_draft_selected_map_type
ALTER TYPE "phase" ADD VALUE IF NOT EXISTS 'MAPTYPEPICKING' BEFORE 'MAPPICKING';

ALTER TABLE "DraftTable"
ADD COLUMN "selectedMapType" "MapType";


-- Source: 20260828120000_add_match_overlay_focus
-- Broadcast focus for the map pool overlay. Both columns are nullable: NULL
-- overlayFocusType is the plain pool, a type expands that column, and a map id
-- on top of it promotes one tile to the hero card.
ALTER TABLE "Match"
ADD COLUMN "overlayFocusType" "MapType",
ADD COLUMN "overlayFocusMapId" INTEGER;


-- Source: 20260830140000_announcement_mode_two_modes
-- Two-mode announcements: TOURNAMENT (automatic, driven by the live tournament
-- state) or CUSTOM (a single chosen announcement).
ALTER TABLE "AnnouncementMode"
ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'TOURNAMENT',
ADD COLUMN "activeAnnouncementId" INTEGER;
