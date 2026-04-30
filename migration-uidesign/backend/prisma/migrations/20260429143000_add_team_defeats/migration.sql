-- Add match defeat tracking to teams
ALTER TABLE "Team"
ADD COLUMN "defeats" INTEGER NOT NULL DEFAULT 0;