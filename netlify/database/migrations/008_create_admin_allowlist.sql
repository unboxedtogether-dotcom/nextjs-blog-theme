-- Database-level administrator allowlist. Admin access to member records now
-- needs both the Identity `admin` role (checked by the server) and an entry in
-- this table bound to the signed-in Identity user id.
--
-- Entries are added by email. An entry is bound to an Identity user id the
-- first time a user with that verified email and the Identity `admin` role
-- opens the team area. The restricted application role cannot read or change
-- this table.

CREATE TABLE member_admins (
  email TEXT PRIMARY KEY CHECK (email = lower(email) AND char_length(email) BETWEEN 3 AND 254),
  user_id TEXT UNIQUE,
  added_by TEXT NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bound_at TIMESTAMPTZ
);

ALTER TABLE member_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON member_admins FROM PUBLIC;

-- Accounts confirmed by the site owner on 2026-10-23. Both addresses are listed
-- because it was not certain which one holds the Identity admin role; the
-- unused one can be removed from the team area once the right one is bound.
INSERT INTO member_admins (email, added_by) VALUES
  ('support@unboxedtogether.com', 'site owner confirmation 2026-10-23'),
  ('unboxedtogether@gmail.com', 'site owner confirmation 2026-10-23'),
  ('unboxestogether@gmail.com', 'site owner confirmation 2026-10-23');

-- True only when the server has set the admin access role for this
-- transaction AND the current user id is a bound allowlist entry.
CREATE FUNCTION is_authorised_admin() RETURNS BOOLEAN
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(current_setting('app.current_access_role', TRUE) = 'admin', FALSE)
    AND EXISTS (
      SELECT 1 FROM member_admins
      WHERE user_id IS NOT NULL AND user_id = NULLIF(current_setting('app.current_user_id', TRUE), '')
    )
$$;

REVOKE ALL ON FUNCTION is_authorised_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_authorised_admin() TO unboxed_member_access;

-- Existing admin policies now also require the allowlist.
ALTER POLICY welcome_admin_select ON member_welcome_details USING (is_authorised_admin());
ALTER POLICY health_admin_select ON member_health_information USING (is_authorised_admin());
ALTER POLICY consent_events_admin_select ON member_consent_events USING (is_authorised_admin());
ALTER POLICY profiles_admin_select ON profiles USING (is_authorised_admin());
ALTER POLICY messages_admin_select ON member_messages USING (is_authorised_admin());
ALTER POLICY messages_admin_update ON member_messages USING (is_authorised_admin()) WITH CHECK (is_authorised_admin());
ALTER POLICY admin_access_log_insert ON questionnaire_admin_access_log WITH CHECK (
  is_authorised_admin() AND admin_user_id = NULLIF(current_setting('app.current_user_id', TRUE), '')
);

-- The access log becomes the audit trail for every admin view, search, note
-- and export. Existing rows were all questionnaire views.
ALTER TABLE questionnaire_admin_access_log
  ADD COLUMN action TEXT NOT NULL DEFAULT 'view_questionnaires',
  ADD COLUMN resource_type TEXT,
  ADD COLUMN resource_id TEXT,
  ADD COLUMN detail TEXT;

CREATE INDEX questionnaire_admin_access_log_accessed_at_idx ON questionnaire_admin_access_log (accessed_at DESC);

CREATE POLICY admin_access_log_select ON questionnaire_admin_access_log FOR SELECT USING (is_authorised_admin());
GRANT SELECT ON questionnaire_admin_access_log TO unboxed_member_access;
