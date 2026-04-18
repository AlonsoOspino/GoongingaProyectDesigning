-- CreateTable
CREATE TABLE "PlayerStat" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "damage" INTEGER NOT NULL,
    "healing" INTEGER NOT NULL,
    "mitigation" INTEGER NOT NULL,
    "kills" INTEGER NOT NULL,
    "assists" INTEGER NOT NULL,
    "deaths" INTEGER NOT NULL,
    "gameDuration" INTEGER NOT NULL,
    "mapType" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayerStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
