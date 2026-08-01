CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT '',
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  marketing_consent BOOLEAN NOT NULL DEFAULT FALSE,
  marketing_consented_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE member_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  improvement_goals TEXT[] NOT NULL DEFAULT '{}',
  general_wellbeing_score SMALLINT NOT NULL CHECK (general_wellbeing_score BETWEEN 1 AND 5),
  energy_score SMALLINT NOT NULL CHECK (energy_score BETWEEN 1 AND 5),
  focus_score SMALLINT NOT NULL CHECK (focus_score BETWEEN 1 AND 5),
  sleep_score SMALLINT NOT NULL CHECK (sleep_score BETWEEN 1 AND 5),
  digestion_score SMALLINT CHECK (digestion_score BETWEEN 1 AND 5),
  ingredient_list_exposure TEXT NOT NULL,
  barriers TEXT[] NOT NULL DEFAULT '{}',
  desired_features TEXT[] NOT NULL DEFAULT '{}',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE member_progress_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  general_wellbeing_score SMALLINT CHECK (general_wellbeing_score BETWEEN 1 AND 5),
  energy_score SMALLINT CHECK (energy_score BETWEEN 1 AND 5),
  focus_score SMALLINT CHECK (focus_score BETWEEN 1 AND 5),
  sleep_score SMALLINT CHECK (sleep_score BETWEEN 1 AND 5),
  digestion_score SMALLINT CHECK (digestion_score BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX member_progress_checkins_user_id_idx ON member_progress_checkins (user_id, created_at DESC);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_progress_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_owner_select ON profiles FOR SELECT
  USING (id = NULLIF(current_setting('app.current_user_id', TRUE), ''));
CREATE POLICY profiles_owner_update ON profiles FOR UPDATE
  USING (id = NULLIF(current_setting('app.current_user_id', TRUE), ''))
  WITH CHECK (id = NULLIF(current_setting('app.current_user_id', TRUE), ''));

CREATE POLICY baselines_owner_select ON member_baselines FOR SELECT
  USING (user_id = NULLIF(current_setting('app.current_user_id', TRUE), ''));
CREATE POLICY baselines_owner_insert ON member_baselines FOR INSERT
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', TRUE), ''));
CREATE POLICY baselines_owner_update ON member_baselines FOR UPDATE
  USING (user_id = NULLIF(current_setting('app.current_user_id', TRUE), ''))
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', TRUE), ''));

CREATE POLICY checkins_owner_select ON member_progress_checkins FOR SELECT
  USING (user_id = NULLIF(current_setting('app.current_user_id', TRUE), ''));
CREATE POLICY checkins_owner_insert ON member_progress_checkins FOR INSERT
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', TRUE), ''));
