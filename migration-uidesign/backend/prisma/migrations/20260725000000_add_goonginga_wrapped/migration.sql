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
