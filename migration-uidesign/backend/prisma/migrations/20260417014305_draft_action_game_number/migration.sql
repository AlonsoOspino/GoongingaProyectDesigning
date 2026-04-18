-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DraftAction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "draftId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "value" INTEGER,
    "gameNumber" INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DraftAction_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "DraftTable" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DraftAction_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_DraftAction" ("action", "createdAt", "draftId", "id", "order", "teamId", "value") SELECT "action", "createdAt", "draftId", "id", "order", "teamId", "value" FROM "DraftAction";
DROP TABLE "DraftAction";
ALTER TABLE "new_DraftAction" RENAME TO "DraftAction";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
