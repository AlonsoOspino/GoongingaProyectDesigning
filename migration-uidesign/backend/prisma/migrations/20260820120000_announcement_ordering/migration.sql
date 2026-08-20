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
