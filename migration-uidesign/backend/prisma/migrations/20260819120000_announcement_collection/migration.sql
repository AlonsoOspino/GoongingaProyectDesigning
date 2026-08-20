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
