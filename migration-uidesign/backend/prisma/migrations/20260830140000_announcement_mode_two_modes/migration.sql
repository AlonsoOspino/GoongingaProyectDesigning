-- Two-mode announcements: TOURNAMENT (automatic, driven by the live tournament
-- state) or CUSTOM (a single chosen announcement).
ALTER TABLE "AnnouncementMode"
ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'TOURNAMENT',
ADD COLUMN "activeAnnouncementId" INTEGER;
