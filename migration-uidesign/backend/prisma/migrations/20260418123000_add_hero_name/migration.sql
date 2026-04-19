-- AlterTable
ALTER TABLE "Hero" ADD COLUMN "name" TEXT;

-- Backfill existing heroes from imgPath so frontend can consume names immediately.
UPDATE "Hero"
SET "name" = TRIM(
  REPLACE(
    REPLACE(
      REPLACE(
        REPLACE("imgPath", '/HeroImages/', ''),
        'Icon-',
        ''
      ),
      '.webp',
      ''
    ),
    '_',
    ' '
  )
)
WHERE "name" IS NULL;

UPDATE "Hero"
SET "name" = REPLACE("name", '%3F', 'o')
WHERE "name" LIKE '%3F%';

-- Normalize special display names.
UPDATE "Hero" SET "name" = 'D.Va' WHERE "name" = 'D.Va';
UPDATE "Hero" SET "name" = 'Junker Queen' WHERE "name" = 'Junker Queen';
UPDATE "Hero" SET "name" = 'Soldier: 76' WHERE "name" = 'Soldier 76';
UPDATE "Hero" SET "name" = 'Torbjorn' WHERE "name" = 'Torbjorn';
UPDATE "Hero" SET "name" = 'Wrecking Ball' WHERE "name" = 'Wrecking Ball';
