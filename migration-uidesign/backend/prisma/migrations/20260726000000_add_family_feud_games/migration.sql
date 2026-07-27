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
