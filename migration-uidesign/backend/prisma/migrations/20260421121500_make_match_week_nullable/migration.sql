-- Allow non-round-robin matches to have no week assignment.
ALTER TABLE "Match"
  ALTER COLUMN "semanas" DROP DEFAULT,
  ALTER COLUMN "semanas" DROP NOT NULL;

-- Existing bracket/stage matches should not be grouped by week.
UPDATE "Match"
SET "semanas" = NULL
WHERE "type" <> 'ROUNDROBIN';
