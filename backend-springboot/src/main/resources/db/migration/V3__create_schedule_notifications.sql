-- Coalesce schedule updates and retry delivery independently of the captain request.
CREATE TABLE spring_draft.schedule_notifications (
    match_id integer PRIMARY KEY REFERENCES public."Match"(id) ON DELETE CASCADE,
    start_at timestamp without time zone NOT NULL,
    delivered_start_at timestamp without time zone,
    pending boolean NOT NULL DEFAULT true,
    attempts integer NOT NULL DEFAULT 0,
    next_attempt_at timestamptz NOT NULL DEFAULT now(),
    last_error varchar(160),
    updated_at timestamptz NOT NULL DEFAULT now()
);
