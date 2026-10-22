-- Welcome questionnaire. Page 1 (ordinary membership details) and pages 2 to 4
-- (health and wellbeing information given under explicit consent) live in
-- separate tables so sensitive answers never sit alongside profile data.

CREATE TABLE member_welcome_details (
  user_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}',
  adult_confirmed_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE member_health_information (
  user_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  consent_name TEXT NOT NULL,
  consent_given_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answers JSONB NOT NULL DEFAULT '{}',
  section_2_saved_at TIMESTAMPTZ,
  section_3_saved_at TIMESTAMPTZ,
  section_4_saved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Consent history is kept when answers are deleted so withdrawals stay on record.
CREATE TABLE member_consent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('health_information', 'marketing_email')),
  action TEXT NOT NULL CHECK (action IN ('given', 'withdrawn')),
  recorded_name TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX member_consent_events_user_id_idx ON member_consent_events (user_id, recorded_at DESC);

CREATE TABLE questionnaire_admin_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id TEXT NOT NULL,
  member_user_id TEXT,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ADD COLUMN marketing_withdrawn_at TIMESTAMPTZ;

-- Row Level Security. The application switches to the restricted role below for
-- every questionnaire query, so these policies are always enforced.
ALTER TABLE member_welcome_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_welcome_details FORCE ROW LEVEL SECURITY;
ALTER TABLE member_health_information ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_health_information FORCE ROW LEVEL SECURITY;
ALTER TABLE member_consent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_consent_events FORCE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_admin_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_admin_access_log FORCE ROW LEVEL SECURITY;

CREATE POLICY welcome_owner_all ON member_welcome_details FOR ALL
  USING (user_id = NULLIF(current_setting('app.current_user_id', TRUE), ''))
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', TRUE), ''));
CREATE POLICY welcome_admin_select ON member_welcome_details FOR SELECT
  USING (current_setting('app.current_access_role', TRUE) = 'admin');

CREATE POLICY health_owner_all ON member_health_information FOR ALL
  USING (user_id = NULLIF(current_setting('app.current_user_id', TRUE), ''))
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', TRUE), ''));
CREATE POLICY health_admin_select ON member_health_information FOR SELECT
  USING (current_setting('app.current_access_role', TRUE) = 'admin');

CREATE POLICY consent_events_owner_select ON member_consent_events FOR SELECT
  USING (user_id = NULLIF(current_setting('app.current_user_id', TRUE), ''));
CREATE POLICY consent_events_owner_insert ON member_consent_events FOR INSERT
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', TRUE), ''));
CREATE POLICY consent_events_admin_select ON member_consent_events FOR SELECT
  USING (current_setting('app.current_access_role', TRUE) = 'admin');

CREATE POLICY admin_access_log_insert ON questionnaire_admin_access_log FOR INSERT
  WITH CHECK (
    current_setting('app.current_access_role', TRUE) = 'admin'
    AND admin_user_id = NULLIF(current_setting('app.current_user_id', TRUE), '')
  );

CREATE POLICY profiles_admin_select ON profiles FOR SELECT
  USING (current_setting('app.current_access_role', TRUE) = 'admin');

-- Restricted role without BYPASSRLS, assumed with SET LOCAL ROLE inside transactions.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'unboxed_member_access') THEN
    CREATE ROLE unboxed_member_access NOLOGIN NOBYPASSRLS;
  END IF;
END
$$;

GRANT unboxed_member_access TO CURRENT_USER WITH INHERIT FALSE, SET TRUE;
GRANT USAGE ON SCHEMA public TO unboxed_member_access;
GRANT SELECT, UPDATE ON profiles TO unboxed_member_access;
GRANT SELECT, INSERT, UPDATE, DELETE ON member_welcome_details TO unboxed_member_access;
GRANT SELECT, INSERT, UPDATE, DELETE ON member_health_information TO unboxed_member_access;
GRANT SELECT, INSERT ON member_consent_events TO unboxed_member_access;
GRANT INSERT ON questionnaire_admin_access_log TO unboxed_member_access;
