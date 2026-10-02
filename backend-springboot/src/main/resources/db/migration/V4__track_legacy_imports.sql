CREATE TABLE spring_draft.legacy_imports (
    match_id integer PRIMARY KEY REFERENCES public."Match"(id) ON DELETE CASCADE,
    legacy_draft_id integer NOT NULL,
    source_fingerprint varchar(32) NOT NULL,
    imported_at timestamptz NOT NULL DEFAULT now()
);
