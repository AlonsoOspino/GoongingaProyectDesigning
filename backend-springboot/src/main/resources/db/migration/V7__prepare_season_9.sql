-- A confirmed series score can be archived without fabricating map results.
-- This flag is only accepted for a finished session with no recorded maps.
ALTER TABLE spring_draft.draft_sessions
    ADD COLUMN summary_only_result BOOLEAN NOT NULL DEFAULT FALSE,
    ADD CONSTRAINT draft_sessions_summary_finished CHECK (NOT summary_only_result OR phase = 'FINISHED');

-- Refuse to overwrite a partially recorded or conflicting map history.
DO $$
DECLARE final_record RECORD;
BEGIN
    FOR final_record IN
        SELECT m.*, ds.id AS session_id,
            CASE WHEN lower(regexp_replace(a.name, '[^a-zA-Z0-9]', '', 'g')) IN ('gamin4goonginga', 'gaming4goonginga') THEN 4 ELSE 2 END AS expected_a,
            CASE WHEN lower(regexp_replace(b.name, '[^a-zA-Z0-9]', '', 'g')) IN ('gamin4goonginga', 'gaming4goonginga') THEN 4 ELSE 2 END AS expected_b,
            history.*
        FROM public."Match" m
        JOIN public."Tournament" t ON t.id = m."tournamentId"
        JOIN public."Team" a ON a.id = m."teamAId"
        JOIN public."Team" b ON b.id = m."teamBId"
        LEFT JOIN spring_draft.draft_sessions ds ON ds.match_id = m.id
        CROSS JOIN LATERAL (
            SELECT count(*) AS picked_maps,
                count(*) FILTER (WHERE dm.result_recorded_at IS NOT NULL) AS completed_maps,
                count(*) FILTER (WHERE dm.winner_team_id = m."teamAId") AS wins_a,
                count(*) FILTER (WHERE dm.winner_team_id = m."teamBId") AS wins_b
            FROM spring_draft.draft_maps dm WHERE dm.draft_session_id = ds.id
        ) history
        WHERE t.name ~* '\mseason\s*8\M' AND m.type = 'FINALS'
          AND ((lower(regexp_replace(a.name, '[^a-zA-Z0-9]', '', 'g')) IN ('gamin4goonginga', 'gaming4goonginga')
                AND lower(regexp_replace(b.name, '[^a-zA-Z0-9]', '', 'g')) = 'notank')
            OR (lower(regexp_replace(b.name, '[^a-zA-Z0-9]', '', 'g')) IN ('gamin4goonginga', 'gaming4goonginga')
                AND lower(regexp_replace(a.name, '[^a-zA-Z0-9]', '', 'g')) = 'notank'))
    LOOP
        IF final_record.session_id IS NULL OR NOT (
            (final_record.picked_maps = 0 AND final_record."gameNumber" = 0
                AND (final_record."mapResults" IS NULL OR final_record."mapResults" = '[]'::jsonb))
            OR (final_record.picked_maps = final_record.completed_maps
                AND final_record.completed_maps = final_record."gameNumber"
                AND final_record.wins_a = final_record.expected_a
                AND final_record.wins_b = final_record.expected_b)
        ) THEN
            RAISE EXCEPTION 'Season 8 final % has conflicting map history; audit before closing the series', final_record.id;
        END IF;
    END LOOP;
END $$;

-- Season 8 is complete. Keep its records and correct only the final series
-- identified by the season and the two finalists, independent of their IDs.
UPDATE public."Match" m
SET status = 'FINISHED',
    "mapWinsTeamA" = CASE WHEN lower(regexp_replace(a.name, '[^a-zA-Z0-9]', '', 'g')) IN ('gamin4goonginga', 'gaming4goonginga') THEN 4 ELSE 2 END,
    "mapWinsTeamB" = CASE WHEN lower(regexp_replace(b.name, '[^a-zA-Z0-9]', '', 'g')) IN ('gamin4goonginga', 'gaming4goonginga') THEN 4 ELSE 2 END
FROM public."Tournament" t, public."Team" a, public."Team" b
WHERE m."tournamentId" = t.id
  AND t.name ~* '\mseason\s*8\M'
  AND m.type = 'FINALS'
  AND a.id = m."teamAId" AND b.id = m."teamBId"
  AND ((lower(regexp_replace(a.name, '[^a-zA-Z0-9]', '', 'g')) IN ('gamin4goonginga', 'gaming4goonginga')
        AND lower(regexp_replace(b.name, '[^a-zA-Z0-9]', '', 'g')) = 'notank')
    OR (lower(regexp_replace(b.name, '[^a-zA-Z0-9]', '', 'g')) IN ('gamin4goonginga', 'gaming4goonginga')
        AND lower(regexp_replace(a.name, '[^a-zA-Z0-9]', '', 'g')) = 'notank'));

UPDATE spring_draft.draft_sessions ds
SET phase = 'FINISHED', turn_team_id = NULL, turn_deadline_at = NULL,
    paused_at = NULL, version = version + 1,
    summary_only_result = NOT EXISTS (SELECT 1 FROM spring_draft.draft_maps dm WHERE dm.draft_session_id = ds.id)
FROM public."Match" m, public."Tournament" t, public."Team" a, public."Team" b
WHERE ds.match_id = m.id AND m."tournamentId" = t.id
  AND t.name ~* '\mseason\s*8\M' AND m.type = 'FINALS'
  AND m.status = 'FINISHED' AND a.id = m."teamAId" AND b.id = m."teamBId"
  AND ((lower(regexp_replace(a.name, '[^a-zA-Z0-9]', '', 'g')) IN ('gamin4goonginga', 'gaming4goonginga')
        AND lower(regexp_replace(b.name, '[^a-zA-Z0-9]', '', 'g')) = 'notank')
    OR (lower(regexp_replace(b.name, '[^a-zA-Z0-9]', '', 'g')) IN ('gamin4goonginga', 'gaming4goonginga')
        AND lower(regexp_replace(a.name, '[^a-zA-Z0-9]', '', 'g')) = 'notank'));

UPDATE public."Team" team
SET state = CASE WHEN lower(regexp_replace(team.name, '[^a-zA-Z0-9]', '', 'g')) IN ('gamin4goonginga', 'gaming4goonginga')
    THEN 'ACTIVE'::"TeamState" ELSE 'ELIMINATED'::"TeamState" END
FROM public."Tournament" t
WHERE team."tournamentId" = t.id AND t.name ~* '\mseason\s*8\M'
  AND lower(regexp_replace(team.name, '[^a-zA-Z0-9]', '', 'g')) IN ('gamin4goonginga', 'gaming4goonginga', 'notank');

UPDATE public."Tournament" SET state = 'FINISHED' WHERE name ~* '\mseason\s*8\M';

-- No start date or team assignments have been announced for Season 9.
INSERT INTO public."Tournament" (name, "startDate", state, "teamFormation", "targetTeamCount")
SELECT 'Goonginga Season 9!', NULL, 'SCHEDULED', 'COMMITTEE', 8
WHERE NOT EXISTS (SELECT 1 FROM public."Tournament" WHERE name ~* '\mseason\s*9\M');

UPDATE public."Tournament" SET "teamFormation" = 'COMMITTEE', "targetTeamCount" = 8
WHERE name ~* '\mseason\s*9\M';

INSERT INTO public."TournamentDivision" ("tournamentId", name, "sortOrder")
SELECT t.id, d.name, d.position
FROM public."Tournament" t
CROSS JOIN (VALUES ('Division A', 0), ('Division B', 1)) AS d(name, position)
WHERE t.name ~* '\mseason\s*9\M'
  AND NOT EXISTS (SELECT 1 FROM public."TournamentDivision" existing WHERE existing."tournamentId" = t.id);
