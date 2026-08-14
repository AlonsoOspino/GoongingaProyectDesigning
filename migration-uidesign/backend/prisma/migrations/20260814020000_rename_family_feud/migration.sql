ALTER TABLE "FamilyFeudGame" ALTER COLUMN "title" SET DEFAULT 'Family Feud';

UPDATE "FamilyFeudGame"
SET "title" = 'Family Feud'
WHERE "title" = 'Network Feud';

UPDATE "FeudQuestion"
SET "pack" = 'Family Feud Starter'
WHERE "pack" = 'Network Feud Starter';
