-- Member management, compliant referrals and reliable email delivery.
--
-- Additive except for two status corrections, both backed up first:
--   * queued "refer a friend" emails are cancelled (they were never sent, and
--     must not go out automatically once an email provider is configured,
--     because the friends never agreed to hear from us), and
--   * nothing else in email_outbox changes meaning: 'sent' still means the
--     provider accepted the message.
--
-- No member, questionnaire, score or consent record is changed.

-- 0. Recoverable copy of the outbox as it was before this migration.
CREATE TABLE email_outbox_backup_016 AS SELECT * FROM email_outbox;
ALTER TABLE email_outbox_backup_016 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON email_outbox_backup_016 FROM PUBLIC;
REVOKE ALL ON email_outbox_backup_016 FROM unboxed_member_access;

-- 1. Profile fields kept in step with Netlify Identity, so the team area can
--    list every registered account (not only those that opened the member
--    area) and tell registered, verified and onboarded members apart.
ALTER TABLE profiles
  ADD COLUMN account_email TEXT CHECK (account_email IS NULL OR (account_email = lower(account_email) AND char_length(account_email) BETWEEN 3 AND 254)),
  ADD COLUMN email_verified_at TIMESTAMPTZ,
  ADD COLUMN identity_synced_at TIMESTAMPTZ,
  -- 'app': made by signup confirmation or a signed-in visit (so the email was
  -- already verified). 'identity_reconcile': made by the team area from an
  -- Identity account that had no profile yet.
  ADD COLUMN created_via TEXT NOT NULL DEFAULT 'app' CHECK (created_via IN ('app', 'identity_reconcile')),
  -- First time the member opened the welcome form (for "in progress").
  ADD COLUMN welcome_started_at TIMESTAMPTZ,
  -- Set when the member turns reminder emails off in their settings.
  ADD COLUMN reminder_emails_paused_at TIMESTAMPTZ;

CREATE INDEX profiles_account_email_idx ON profiles (account_email) WHERE account_email IS NOT NULL;

-- 2. Referrals. Each invitation has its own unguessable token used only to
--    attribute a later visit, questionnaire or registration. A token never
--    grants access to any record. Only server functions (as table owner,
--    after checking the caller) read or write this table.
CREATE TABLE member_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE CHECK (char_length(token) BETWEEN 32 AND 128),
  recipient_email TEXT CHECK (recipient_email IS NULL OR (recipient_email = lower(recipient_email) AND char_length(recipient_email) BETWEEN 3 AND 254)),
  recipient_name TEXT CHECK (recipient_name IS NULL OR char_length(recipient_name) <= 40),
  -- The member agreed to show their preferred first name on the invitation.
  share_referrer_name BOOLEAN NOT NULL DEFAULT FALSE,
  source TEXT NOT NULL DEFAULT 'member' CHECK (source IN ('member', 'legacy_email')),
  shared_at TIMESTAMPTZ,
  shared_via TEXT CHECK (shared_via IS NULL OR shared_via IN ('copy', 'native_share', 'email_app', 'whatsapp')),
  first_opened_at TIMESTAMPTZ,
  last_opened_at TIMESTAMPTZ,
  open_count INTEGER NOT NULL DEFAULT 0,
  prospect_id UUID REFERENCES prospect_submissions(id) ON DELETE SET NULL,
  prospect_at TIMESTAMPTZ,
  registered_user_id TEXT UNIQUE REFERENCES profiles(id) ON DELETE SET NULL,
  registered_at TIMESTAMPTZ,
  attributed_by TEXT CHECK (attributed_by IS NULL OR attributed_by IN ('token', 'email')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (registered_user_id IS NULL OR registered_user_id <> referrer_user_id)
);

-- One invitation per member per friend address; repeats reuse it.
CREATE UNIQUE INDEX member_referrals_recipient_idx ON member_referrals (referrer_user_id, recipient_email) WHERE recipient_email IS NOT NULL;
CREATE INDEX member_referrals_referrer_idx ON member_referrals (referrer_user_id, created_at DESC);
CREATE INDEX member_referrals_unclaimed_email_idx ON member_referrals (recipient_email, created_at) WHERE registered_user_id IS NULL AND recipient_email IS NOT NULL;

-- Earlier "refer a friend" emails become referral records so their history is kept.
INSERT INTO member_referrals (referrer_user_id, token, recipient_email, recipient_name, source, created_at)
SELECT DISTINCT ON (o.user_id, lower(o.to_email))
  o.user_id,
  replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  lower(o.to_email),
  NULLIF(left(btrim(COALESCE(o.payload->>'friendName', '')), 40), ''),
  'legacy_email',
  o.created_at
FROM email_outbox o
JOIN profiles p ON p.id = o.user_id
WHERE o.kind = 'friend_referral' AND o.user_id IS NOT NULL
ORDER BY o.user_id, lower(o.to_email), o.created_at;

-- 3. Outbox tracking columns.
ALTER TABLE email_outbox
  ADD COLUMN referral_id UUID REFERENCES member_referrals(id) ON DELETE SET NULL,
  ADD COLUMN template_version TEXT NOT NULL DEFAULT 'v1',
  -- Who asked for the email: an admin user id, 'member:<id>' or 'system'.
  ADD COLUMN requested_by TEXT NOT NULL DEFAULT 'system',
  -- Same key twice means the same email; the second insert is ignored.
  ADD COLUMN idempotency_key TEXT UNIQUE CHECK (idempotency_key IS NULL OR char_length(idempotency_key) <= 200),
  ADD COLUMN provider TEXT,
  ADD COLUMN provider_message_id TEXT UNIQUE,
  ADD COLUMN last_attempt_at TIMESTAMPTZ,
  ADD COLUMN delivered_at TIMESTAMPTZ,
  ADD COLUMN failed_at TIMESTAMPTZ,
  -- Manual retries started from the team area (attempts counts every try).
  ADD COLUMN retry_count SMALLINT NOT NULL DEFAULT 0,
  -- Non-sensitive scheduling context, such as the reporting week a reminder is for.
  ADD COLUMN context JSONB NOT NULL DEFAULT '{}';

-- 'sent' = accepted by the provider. 'delivered', 'delayed', 'bounced' and
-- 'complained' only ever come from provider webhooks. 'expired' = held too
-- long without a provider and dropped rather than sent late.
ALTER TABLE email_outbox DROP CONSTRAINT email_outbox_status_check;
ALTER TABLE email_outbox ADD CONSTRAINT email_outbox_status_check
  CHECK (status IN ('queued', 'sending', 'sent', 'delivered', 'delayed', 'bounced', 'complained', 'failed', 'cancelled', 'expired'));

ALTER TABLE email_outbox DROP CONSTRAINT email_outbox_kind_check;
ALTER TABLE email_outbox ADD CONSTRAINT email_outbox_kind_check
  CHECK (kind IN ('interest_confirmation', 'member_welcome', 'checkin_reminder', 'welcome_reminder', 'friend_referral', 'baseline_reminder'));

DROP INDEX IF EXISTS email_outbox_member_reminder_idx;
CREATE INDEX email_outbox_member_reminder_idx ON email_outbox (user_id, kind, created_at DESC)
  WHERE kind IN ('checkin_reminder', 'welcome_reminder', 'baseline_reminder');
CREATE INDEX email_outbox_referral_idx ON email_outbox (referral_id) WHERE referral_id IS NOT NULL;
CREATE INDEX email_outbox_created_idx ON email_outbox (created_at DESC);

UPDATE email_outbox o SET referral_id = r.id
FROM member_referrals r
WHERE o.kind = 'friend_referral' AND r.referrer_user_id = o.user_id AND r.recipient_email = lower(o.to_email);

UPDATE email_outbox SET requested_by = 'member:' || user_id WHERE kind = 'friend_referral' AND user_id IS NOT NULL;

-- Reminders were sent by admins; the audit log says which one. The log uses
-- FORCE RLS, which hides it from the owner running this migration, so that is
-- lifted for this copy only and restored straight afterwards.
ALTER TABLE questionnaire_admin_access_log NO FORCE ROW LEVEL SECURITY;
UPDATE email_outbox o SET requested_by = l.admin_user_id
FROM questionnaire_admin_access_log l
WHERE l.action = 'send_reminder' AND l.resource_id = o.id::text;
ALTER TABLE questionnaire_admin_access_log FORCE ROW LEVEL SECURITY;

-- Never-sent friend emails are cancelled (see the note at the top).
UPDATE email_outbox
SET status = 'cancelled', payload = '{}'::jsonb,
  last_error = 'Cancelled before sending: referral emails now need the friend''s own prior consent. The member can share a personal link instead.'
WHERE kind = 'friend_referral' AND status = 'queued';

-- 4. Delivery history: one row per thing that happened to an email, from our
--    own queue (queued, attempt, accepted, failed, retried, cancelled) or the
--    provider's webhooks (delivered, bounced, complained, delayed).
CREATE TABLE email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outbox_id UUID REFERENCES email_outbox(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (char_length(event_type) <= 60),
  provider_event_id TEXT UNIQUE,
  actor TEXT,
  detail TEXT CHECK (detail IS NULL OR char_length(detail) <= 500),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX email_events_outbox_idx ON email_events (outbox_id, occurred_at);

-- 5. Bounced and complained addresses are never emailed again.
ALTER TABLE prospect_email_suppressions DROP CONSTRAINT prospect_email_suppressions_reason_check;
ALTER TABLE prospect_email_suppressions ADD CONSTRAINT prospect_email_suppressions_reason_check
  CHECK (reason IN ('erased', 'unsubscribed', 'bounced', 'complained'));

ALTER TABLE member_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON member_referrals, email_events FROM PUBLIC;
REVOKE ALL ON member_referrals, email_events FROM unboxed_member_access;
