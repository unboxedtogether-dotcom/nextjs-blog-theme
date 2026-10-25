-- Reminder emails sent from the team area, and a fix to consent history.
--
-- 1. Two new outbox email kinds: a nudge for members who have missed a weekly
--    check-in, and one for members who signed up but have not filled in the
--    welcome form. Existing rows are unchanged.
ALTER TABLE email_outbox DROP CONSTRAINT email_outbox_kind_check;
ALTER TABLE email_outbox ADD CONSTRAINT email_outbox_kind_check
  CHECK (kind IN ('interest_confirmation', 'member_welcome', 'checkin_reminder', 'welcome_reminder'));

CREATE INDEX email_outbox_member_reminder_idx ON email_outbox (user_id, kind, created_at DESC)
  WHERE kind IN ('checkin_reminder', 'welcome_reminder');

-- 2. Marketing consent ticked on the signup form was saved on the profile but
--    never written to the consent history, so the team area showed "No consent
--    changes recorded" for those members. One event is added for each such
--    profile, dated when the consent was given. FORCE RLS hides the history
--    from the table owner running this migration; it is lifted for the copy
--    only and restored straight afterwards.
ALTER TABLE member_consent_events NO FORCE ROW LEVEL SECURITY;

INSERT INTO member_consent_events (user_id, consent_type, action, recorded_name, recorded_at)
SELECT p.id, 'marketing_email', 'given', NULLIF(p.display_name, ''), COALESCE(p.marketing_consented_at, p.created_at)
FROM profiles p
WHERE p.marketing_consent
  AND NOT EXISTS (SELECT 1 FROM member_consent_events e WHERE e.user_id = p.id AND e.consent_type = 'marketing_email');

ALTER TABLE member_consent_events FORCE ROW LEVEL SECURITY;
