-- The first progress tables (created in 003) were never connected to a page or
-- form. They are kept, with any rows they hold, under legacy names so the new
-- progress tracking tables can use the requested names. Nothing is dropped.

ALTER TABLE member_baselines RENAME TO legacy_member_baselines;
ALTER TABLE member_progress_checkins RENAME TO legacy_member_progress_checkins;

-- Index-backed constraint names live alongside table names, so they move too.
ALTER TABLE legacy_member_baselines RENAME CONSTRAINT member_baselines_pkey TO legacy_member_baselines_pkey;
ALTER TABLE legacy_member_baselines RENAME CONSTRAINT member_baselines_user_id_key TO legacy_member_baselines_user_id_key;
ALTER TABLE legacy_member_progress_checkins RENAME CONSTRAINT member_progress_checkins_pkey TO legacy_member_progress_checkins_pkey;
ALTER INDEX member_progress_checkins_user_id_idx RENAME TO legacy_member_progress_checkins_user_id_idx;
