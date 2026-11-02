-- Catalog content update; safe to rerun against the existing production catalog.
BEGIN;
-- Keep Sombra's existing identity, portraits and ban history; the catalog role
-- drives the Support group and role-based ban rules in every client.
UPDATE public."Hero"
SET role = 'SUPPORT'::public."HeroRole"
WHERE lower(btrim(name)) = 'sombra'
  AND role <> 'SUPPORT'::public."HeroRole";

-- The legacy filename contains a literal percent escape, which becomes double
-- encoded by clients and is rejected by the HTTP firewall. Use a safe filename
-- while preserving the hero's identity, display name and history.
UPDATE public."Hero"
SET "imgPath" = '/HeroImages/Icon-Torbjorn.webp'
WHERE "imgPath" = '/HeroImages/Icon-Torbj%3Frn.webp';

COMMIT;
