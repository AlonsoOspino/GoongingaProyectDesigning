-- Rehearsal display controls do not change competitive map history or standings.
CREATE TABLE spring_draft.practice_display_controls (
    match_id INTEGER PRIMARY KEY REFERENCES public."Match" (id) ON DELETE CASCADE,
    score_a INTEGER CHECK (score_a >= 0),
    score_b INTEGER CHECK (score_b >= 0),
    team_a_bans INTEGER[],
    team_b_bans INTEGER[],
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
