-- Permanent form history, baseline and weekly progress tracking.
--
-- Submissions, scores and notes are append-only: the restricted application
-- role can only SELECT and INSERT them, and a trigger rejects UPDATE from any
-- role. Corrections are new rows that point at the original (revision_of).
-- Rows are only ever removed by the member's own erasure request or account
-- deletion, through audited server code running as the table owner.

-- Scoring rules are versioned so historical scores stay comparable.
CREATE TABLE scoring_versions (
  version TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  definition JSONB NOT NULL,
  active_from TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO scoring_versions (version, label, definition) VALUES (
  'wellbeing-v1',
  'Weekly wellbeing check-in, version 1',
  '{
    "period": "past 7 days",
    "range": [0, 100],
    "weights": { "sleep": 0.25, "mood": 0.25, "energy_focus": 0.20, "nutrition": 0.20, "activity": 0.10 },
    "categoryScore": "mean of answered item points; complete only when every required item is answered",
    "overallScore": "weighted sum of the five category scores, rounded to a whole number; only when all five are complete",
    "items": {
      "sleepQuality": "1-5 scale -> 0, 25, 50, 75, 100 (required)",
      "restedAfterSleep": "not at all 0, a little 33, fairly 67, well 100 (required)",
      "enoughSleep": "rarely 0, some days 33, most days 67, every day 100 (optional; any time of day or night)",
      "mood": "1-5 scale (required)",
      "managingDemands": "1-5 scale (required)",
      "energy": "1-5 scale (required)",
      "focus": "1-5 scale (required)",
      "regularMeals": "days 0-7 -> days / 7 x 100 (required; meals that suited your routine)",
      "freshMeals": "days 0-7 -> days / 7 x 100 (required; home-cooked, shop-bought or takeaway all count)",
      "fruitVeg": "none 0, 1-2 33, 3-4 67, 5+ 100 (required)",
      "hydration": "rarely 0, some days 33, most days 67, every day 100 (optional)",
      "movementDays": "days 0-7 -> 5 or more = 100, otherwise days / 5 x 100 (required)"
    },
    "unscored": ["cookingConfidence", "weekContext", "personalNote"]
  }'::jsonb
);

CREATE TABLE member_form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  form_type TEXT NOT NULL CHECK (form_type IN (
    'welcome_details', 'welcome_food', 'welcome_everyday', 'welcome_health',
    'baseline_wellbeing', 'weekly_checkin'
  )),
  form_version TEXT NOT NULL,
  reporting_week_start DATE,
  reporting_week_number INTEGER CHECK (reporting_week_number >= 0),
  answers JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'incomplete')),
  revision_of UUID REFERENCES member_form_submissions(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL DEFAULT 0 CHECK (revision_number >= 0),
  revision_reason TEXT CHECK (revision_reason IS NULL OR char_length(revision_reason) <= 300),
  idempotency_key UUID NOT NULL,
  source TEXT NOT NULL DEFAULT 'member' CHECK (source IN ('member', 'backfill')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((revision_of IS NULL) = (revision_number = 0)),
  UNIQUE (user_id, idempotency_key)
);

-- One original record per welcome page, one baseline and one check-in per
-- reporting week. Anything further is a numbered revision of that original.
CREATE UNIQUE INDEX member_form_submissions_welcome_root_idx ON member_form_submissions (user_id, form_type)
  WHERE revision_of IS NULL AND form_type LIKE 'welcome\_%';
CREATE UNIQUE INDEX member_form_submissions_baseline_root_idx ON member_form_submissions (user_id)
  WHERE revision_of IS NULL AND form_type = 'baseline_wellbeing';
CREATE UNIQUE INDEX member_form_submissions_week_root_idx ON member_form_submissions (user_id, reporting_week_start)
  WHERE revision_of IS NULL AND form_type = 'weekly_checkin';
CREATE UNIQUE INDEX member_form_submissions_revision_idx ON member_form_submissions (revision_of, revision_number)
  WHERE revision_of IS NOT NULL;
CREATE INDEX member_form_submissions_user_idx ON member_form_submissions (user_id, submitted_at DESC);

-- Week 0 pointer. Later check-ins never change it.
CREATE TABLE member_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL UNIQUE REFERENCES member_form_submissions(id) ON DELETE CASCADE,
  baseline_date DATE NOT NULL,
  reporting_week_start DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE member_weekly_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES member_form_submissions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reporting_week_number INTEGER NOT NULL CHECK (reporting_week_number >= 0),
  reporting_week_start DATE NOT NULL,
  scoring_version TEXT NOT NULL REFERENCES scoring_versions(version),
  overall_score NUMERIC(5, 1) CHECK (overall_score BETWEEN 0 AND 100),
  completeness TEXT NOT NULL CHECK (completeness IN ('complete', 'incomplete')),
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((completeness = 'complete') = (overall_score IS NOT NULL)),
  UNIQUE (submission_id, scoring_version)
);

CREATE INDEX member_weekly_scores_user_idx ON member_weekly_scores (user_id, reporting_week_number);

CREATE TABLE member_score_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_score_id UUID NOT NULL REFERENCES member_weekly_scores(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('sleep', 'mood', 'energy_focus', 'nutrition', 'activity')),
  weight NUMERIC(4, 2) NOT NULL,
  score NUMERIC(5, 1) CHECK (score BETWEEN 0 AND 100),
  items_answered SMALLINT NOT NULL,
  items_required SMALLINT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('complete', 'incomplete')),
  UNIQUE (weekly_score_id, category)
);

-- Unsubmitted check-ins. Mutable, owner-only, removed when the form is submitted.
CREATE TABLE member_form_drafts (
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  form_type TEXT NOT NULL CHECK (form_type IN ('baseline_wellbeing', 'weekly_checkin')),
  reporting_week_start DATE NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, form_type)
);

-- Members' own notes (visible to them and to admins) and private admin notes.
CREATE TABLE member_progress_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL,
  author_role TEXT NOT NULL CHECK (author_role IN ('member', 'admin')),
  visibility TEXT NOT NULL CHECK (visibility IN ('member', 'admin_private')),
  submission_id UUID REFERENCES member_form_submissions(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  revision_of UUID REFERENCES member_progress_notes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((author_role = 'member') = (visibility = 'member'))
);

CREATE INDEX member_progress_notes_user_idx ON member_progress_notes (user_id, created_at DESC);

-- Content-free audit trail of changes to member records: submissions,
-- revisions, erasures. No foreign key, so erasure events outlive the records.
CREATE TABLE member_record_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  actor_role TEXT NOT NULL CHECK (actor_role IN ('member', 'admin', 'system')),
  action TEXT NOT NULL,
  form_type TEXT,
  resource_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX member_record_events_user_idx ON member_record_events (user_id, created_at DESC);

-- Append-only enforcement, regardless of role.
CREATE FUNCTION prevent_history_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Historical member records cannot be changed. Save a revision instead.';
END
$$;

CREATE TRIGGER member_form_submissions_no_update BEFORE UPDATE ON member_form_submissions FOR EACH ROW EXECUTE FUNCTION prevent_history_update();
CREATE TRIGGER member_baselines_no_update BEFORE UPDATE ON member_baselines FOR EACH ROW EXECUTE FUNCTION prevent_history_update();
CREATE TRIGGER member_weekly_scores_no_update BEFORE UPDATE ON member_weekly_scores FOR EACH ROW EXECUTE FUNCTION prevent_history_update();
CREATE TRIGGER member_score_categories_no_update BEFORE UPDATE ON member_score_categories FOR EACH ROW EXECUTE FUNCTION prevent_history_update();
CREATE TRIGGER member_progress_notes_no_update BEFORE UPDATE ON member_progress_notes FOR EACH ROW EXECUTE FUNCTION prevent_history_update();
CREATE TRIGGER member_record_events_no_update BEFORE UPDATE ON member_record_events FOR EACH ROW EXECUTE FUNCTION prevent_history_update();

-- Linked rows must belong to the same member (foreign keys alone do not check this).
CREATE FUNCTION check_member_record_links() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Nested IFs: PL/pgSQL does not short-circuit AND, and each table has different columns.
  IF TG_TABLE_NAME = 'member_form_submissions' THEN
    IF NEW.revision_of IS NOT NULL THEN
      PERFORM 1 FROM member_form_submissions
        WHERE id = NEW.revision_of AND user_id = NEW.user_id AND form_type = NEW.form_type AND revision_of IS NULL;
      IF NOT FOUND THEN RAISE EXCEPTION 'A revision must point at the same member''s original submission of the same form.'; END IF;
    END IF;
  ELSIF TG_TABLE_NAME IN ('member_baselines', 'member_weekly_scores') THEN
    PERFORM 1 FROM member_form_submissions WHERE id = NEW.submission_id AND user_id = NEW.user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Scores must belong to the member who made the submission.'; END IF;
  ELSIF TG_TABLE_NAME = 'member_score_categories' THEN
    PERFORM 1 FROM member_weekly_scores WHERE id = NEW.weekly_score_id AND user_id = NEW.user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Category scores must belong to the same member.'; END IF;
  ELSIF TG_TABLE_NAME = 'member_progress_notes' THEN
    IF NEW.submission_id IS NOT NULL THEN
      PERFORM 1 FROM member_form_submissions WHERE id = NEW.submission_id AND user_id = NEW.user_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Notes must refer to the same member''s submission.'; END IF;
    END IF;
    IF NEW.revision_of IS NOT NULL THEN
      PERFORM 1 FROM member_progress_notes WHERE id = NEW.revision_of AND user_id = NEW.user_id AND author_user_id = NEW.author_user_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Only the author can revise a note.'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION check_member_record_links() FROM PUBLIC;

CREATE TRIGGER member_form_submissions_links BEFORE INSERT ON member_form_submissions FOR EACH ROW EXECUTE FUNCTION check_member_record_links();
CREATE TRIGGER member_baselines_links BEFORE INSERT ON member_baselines FOR EACH ROW EXECUTE FUNCTION check_member_record_links();
CREATE TRIGGER member_weekly_scores_links BEFORE INSERT ON member_weekly_scores FOR EACH ROW EXECUTE FUNCTION check_member_record_links();
CREATE TRIGGER member_score_categories_links BEFORE INSERT ON member_score_categories FOR EACH ROW EXECUTE FUNCTION check_member_record_links();
CREATE TRIGGER member_progress_notes_links BEFORE INSERT ON member_progress_notes FOR EACH ROW EXECUTE FUNCTION check_member_record_links();

-- Separate consent for personal progress tracking, with the notice version shown.
ALTER TABLE member_consent_events DROP CONSTRAINT member_consent_events_consent_type_check;
ALTER TABLE member_consent_events ADD CONSTRAINT member_consent_events_consent_type_check
  CHECK (consent_type IN ('health_information', 'marketing_email', 'progress_tracking'));
ALTER TABLE member_consent_events ADD COLUMN notice_version TEXT;

-- Row Level Security. The restricted role is used for every member and admin
-- query; is_authorised_admin() needs the server-set admin role AND the allowlist.
ALTER TABLE scoring_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_weekly_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_score_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_form_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_progress_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_record_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON scoring_versions, member_form_submissions, member_baselines, member_weekly_scores,
  member_score_categories, member_form_drafts, member_progress_notes, member_record_events FROM PUBLIC;

CREATE POLICY scoring_versions_read ON scoring_versions FOR SELECT USING (TRUE);

CREATE POLICY submissions_owner_select ON member_form_submissions FOR SELECT
  USING (user_id = NULLIF(current_setting('app.current_user_id', TRUE), ''));
CREATE POLICY submissions_owner_insert ON member_form_submissions FOR INSERT
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', TRUE), '') AND source = 'member');
CREATE POLICY submissions_admin_select ON member_form_submissions FOR SELECT USING (is_authorised_admin());

CREATE POLICY baselines_v2_owner_select ON member_baselines FOR SELECT
  USING (user_id = NULLIF(current_setting('app.current_user_id', TRUE), ''));
CREATE POLICY baselines_v2_owner_insert ON member_baselines FOR INSERT
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', TRUE), ''));
CREATE POLICY baselines_v2_admin_select ON member_baselines FOR SELECT USING (is_authorised_admin());

CREATE POLICY weekly_scores_owner_select ON member_weekly_scores FOR SELECT
  USING (user_id = NULLIF(current_setting('app.current_user_id', TRUE), ''));
CREATE POLICY weekly_scores_owner_insert ON member_weekly_scores FOR INSERT
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', TRUE), ''));
CREATE POLICY weekly_scores_admin_select ON member_weekly_scores FOR SELECT USING (is_authorised_admin());

CREATE POLICY score_categories_owner_select ON member_score_categories FOR SELECT
  USING (user_id = NULLIF(current_setting('app.current_user_id', TRUE), ''));
CREATE POLICY score_categories_owner_insert ON member_score_categories FOR INSERT
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', TRUE), ''));
CREATE POLICY score_categories_admin_select ON member_score_categories FOR SELECT USING (is_authorised_admin());

CREATE POLICY drafts_owner_all ON member_form_drafts FOR ALL
  USING (user_id = NULLIF(current_setting('app.current_user_id', TRUE), ''))
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', TRUE), ''));

CREATE POLICY notes_owner_select ON member_progress_notes FOR SELECT
  USING (user_id = NULLIF(current_setting('app.current_user_id', TRUE), '') AND visibility = 'member');
CREATE POLICY notes_owner_insert ON member_progress_notes FOR INSERT
  WITH CHECK (
    user_id = NULLIF(current_setting('app.current_user_id', TRUE), '')
    AND author_user_id = user_id AND author_role = 'member' AND visibility = 'member'
  );
CREATE POLICY notes_admin_select ON member_progress_notes FOR SELECT USING (is_authorised_admin());
CREATE POLICY notes_admin_insert ON member_progress_notes FOR INSERT
  WITH CHECK (
    is_authorised_admin()
    AND author_user_id = NULLIF(current_setting('app.current_user_id', TRUE), '')
    AND author_role = 'admin' AND visibility = 'admin_private'
  );

CREATE POLICY record_events_owner_select ON member_record_events FOR SELECT
  USING (user_id = NULLIF(current_setting('app.current_user_id', TRUE), ''));
CREATE POLICY record_events_owner_insert ON member_record_events FOR INSERT
  WITH CHECK (
    user_id = NULLIF(current_setting('app.current_user_id', TRUE), '')
    AND actor_user_id = user_id AND actor_role = 'member'
  );
CREATE POLICY record_events_admin_select ON member_record_events FOR SELECT USING (is_authorised_admin());
CREATE POLICY record_events_admin_insert ON member_record_events FOR INSERT
  WITH CHECK (
    is_authorised_admin()
    AND actor_user_id = NULLIF(current_setting('app.current_user_id', TRUE), '')
    AND actor_role = 'admin'
  );

GRANT SELECT ON scoring_versions TO unboxed_member_access;
GRANT SELECT, INSERT ON member_form_submissions, member_baselines, member_weekly_scores,
  member_score_categories, member_progress_notes, member_record_events TO unboxed_member_access;
GRANT SELECT, INSERT, UPDATE, DELETE ON member_form_drafts TO unboxed_member_access;
