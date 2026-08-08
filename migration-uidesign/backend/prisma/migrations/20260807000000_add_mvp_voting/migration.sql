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
  CONSTRAINT "MvpCandidate_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MvpCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE
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
