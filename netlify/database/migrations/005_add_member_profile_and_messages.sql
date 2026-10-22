-- Member profile, membership tier and private contact messages.
-- Existing profile rows keep all their data; new columns only add defaults.

CREATE TABLE membership_tiers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO membership_tiers (id, name, is_default) VALUES ('free', 'Free Member', TRUE);

ALTER TABLE profiles
  ADD COLUMN bio TEXT NOT NULL DEFAULT '',
  ADD COLUMN avatar_key TEXT,
  ADD COLUMN avatar_updated_at TIMESTAMPTZ,
  ADD COLUMN membership_tier TEXT NOT NULL DEFAULT 'free' REFERENCES membership_tiers(id),
  ADD COLUMN membership_status TEXT NOT NULL DEFAULT 'active' CHECK (membership_status IN ('active', 'paused', 'cancelled')),
  ADD COLUMN membership_started_at TIMESTAMPTZ;

UPDATE profiles SET membership_started_at = created_at WHERE membership_started_at IS NULL;
ALTER TABLE profiles ALTER COLUMN membership_started_at SET DEFAULT NOW();
ALTER TABLE profiles ALTER COLUMN membership_started_at SET NOT NULL;

CREATE TABLE member_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 5000),
  reply_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX member_messages_user_id_idx ON member_messages (user_id, created_at DESC);
CREATE INDEX member_messages_created_at_idx ON member_messages (created_at DESC);

ALTER TABLE member_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_messages FORCE ROW LEVEL SECURITY;

CREATE POLICY messages_owner_select ON member_messages FOR SELECT
  USING (user_id = NULLIF(current_setting('app.current_user_id', TRUE), ''));
CREATE POLICY messages_owner_insert ON member_messages FOR INSERT
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', TRUE), ''));
CREATE POLICY messages_admin_select ON member_messages FOR SELECT
  USING (current_setting('app.current_access_role', TRUE) = 'admin');
CREATE POLICY messages_admin_update ON member_messages FOR UPDATE
  USING (current_setting('app.current_access_role', TRUE) = 'admin')
  WITH CHECK (current_setting('app.current_access_role', TRUE) = 'admin');

GRANT SELECT ON membership_tiers TO unboxed_member_access;
GRANT SELECT, INSERT ON member_messages TO unboxed_member_access;
GRANT UPDATE (status) ON member_messages TO unboxed_member_access;

-- Members may edit their own profile details but never their membership tier or status.
REVOKE UPDATE ON profiles FROM unboxed_member_access;
GRANT UPDATE (display_name, bio, avatar_key, avatar_updated_at, onboarding_completed,
  marketing_consent, marketing_consented_at, marketing_withdrawn_at, updated_at)
  ON profiles TO unboxed_member_access;
