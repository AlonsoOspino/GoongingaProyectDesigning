-- Broadcast focus for the map pool overlay. Both columns are nullable: NULL
-- overlayFocusType is the plain pool, a type expands that column, and a map id
-- on top of it promotes one tile to the hero card.
ALTER TABLE "Match"
ADD COLUMN "overlayFocusType" "MapType",
ADD COLUMN "overlayFocusMapId" INTEGER;
