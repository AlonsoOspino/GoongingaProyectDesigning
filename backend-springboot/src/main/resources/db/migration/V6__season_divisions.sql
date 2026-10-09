-- Historical seasons remain a single pool unless divisions are configured.
ALTER TABLE public."Tournament" ALTER COLUMN "startDate" DROP NOT NULL;
ALTER TABLE public."Tournament"
    ADD COLUMN "teamFormation" TEXT NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN "targetTeamCount" INTEGER,
    ADD CONSTRAINT "Tournament_teamFormation_check" CHECK ("teamFormation" IN ('DRAFT', 'COMMITTEE')),
    ADD CONSTRAINT "Tournament_targetTeamCount_check" CHECK ("targetTeamCount" IS NULL OR "targetTeamCount" BETWEEN 2 AND 128);

CREATE TABLE public."TournamentDivision" (
    id SERIAL PRIMARY KEY,
    "tournamentId" INTEGER NOT NULL REFERENCES public."Tournament" (id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
    "sortOrder" INTEGER NOT NULL CHECK ("sortOrder" >= 0),
    UNIQUE ("tournamentId", name),
    UNIQUE (id, "tournamentId")
);

ALTER TABLE public."Team"
    ADD COLUMN "divisionId" INTEGER,
    ADD CONSTRAINT "Team_division_season_fkey" FOREIGN KEY ("divisionId", "tournamentId")
        REFERENCES public."TournamentDivision" (id, "tournamentId") ON DELETE RESTRICT;
CREATE INDEX "Team_divisionId_idx" ON public."Team" ("divisionId");
