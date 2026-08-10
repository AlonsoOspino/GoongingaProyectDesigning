CREATE TYPE "AnnouncementModeType" AS ENUM ('TOURNAMENT', 'JEOPARDY');

CREATE TABLE "AnnouncementMode" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "activeMode" "AnnouncementModeType" NOT NULL DEFAULT 'TOURNAMENT',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "updatedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnnouncementMode_pkey" PRIMARY KEY ("id")
);

INSERT INTO "AnnouncementMode" ("id", "activeMode", "enabled", "config")
VALUES (1, 'TOURNAMENT', true, '{}')
ON CONFLICT ("id") DO NOTHING;
