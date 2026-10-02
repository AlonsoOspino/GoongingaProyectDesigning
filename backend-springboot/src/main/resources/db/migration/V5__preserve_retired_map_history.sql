-- DraftAction stored map ids as integers even after catalog entries were deleted.
-- Keep those historical ids; never invent replacement maps or change a result.
ALTER TABLE spring_draft.draft_maps DROP CONSTRAINT draft_maps_map_id_fkey;
ALTER TABLE spring_draft.draft_maps ALTER COLUMN map_type DROP NOT NULL;
ALTER TABLE spring_draft.draft_maps ADD CONSTRAINT draft_maps_active_type_required
    CHECK (map_type IS NOT NULL OR result_recorded_at IS NOT NULL);
