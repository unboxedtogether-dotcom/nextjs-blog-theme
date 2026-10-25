-- Prospective members: people who register interest through /join-us before
-- (or without ever) creating an account. Kept entirely separate from member
-- profiles, welcome answers and health records.
--
-- Additive only: no existing table, row or policy is changed.
--
-- Access: only the site's own server functions (connecting as the table owner)
-- read or write these tables, after checking the caller. The restricted
-- member role used for member and admin queries gets no grants here, so Row
-- Level Security denies it every row.

CREATE TABLE prospect_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Sent by the browser once per questionnaire; repeated clicks reuse it.
  idempotency_key UUID NOT NULL UNIQUE,
  first_name TEXT CHECK (first_name IS NULL OR char_length(first_name) BETWEEN 1 AND 60),
  email TEXT CHECK (email IS NULL OR (email = lower(email) AND char_length(email) BETWEEN 3 AND 254)),
  -- Question 1 (topics to learn about), 3 (projects) and 4 (involvement).
  topics TEXT[] NOT NULL DEFAULT '{}',
  project_interests TEXT[] NOT NULL DEFAULT '{}',
  involvement TEXT[] NOT NULL DEFAULT '{}',
  -- Question 2. Personal challenges are special category data and are only
  -- stored with explicit consent (see prospect_contact_permissions).
  support_interests TEXT[] NOT NULL DEFAULT '{}',
  questionnaire_version TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  source_campaign TEXT CHECK (source_campaign IS NULL OR char_length(source_campaign) <= 60),
  -- SHA-256 of the private link sent by email for managing preferences.
  manage_token_hash TEXT UNIQUE,
  -- Set only after a signed-in member with this verified email confirms it is theirs.
  linked_member_user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  linked_at TIMESTAMPTZ,
  support_status TEXT NOT NULL DEFAULT 'none' CHECK (support_status IN ('none', 'new', 'contacted', 'closed')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retain_until TIMESTAMPTZ NOT NULL
);

CREATE INDEX prospect_submissions_submitted_at_idx ON prospect_submissions (submitted_at DESC);
CREATE INDEX prospect_submissions_email_idx ON prospect_submissions (email, submitted_at DESC) WHERE email IS NOT NULL;
CREATE INDEX prospect_submissions_linked_idx ON prospect_submissions (linked_member_user_id) WHERE linked_member_user_id IS NOT NULL;

-- Consent audit trail. A row is written whenever a permission is given;
-- withdrawal stamps withdrawn_at and never deletes the row. Rows are only
-- removed when the whole prospect record is erased on request.
CREATE TABLE prospect_contact_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES prospect_submissions(id) ON DELETE CASCADE,
  permission_type TEXT NOT NULL CHECK (permission_type IN ('project_contact', 'general_marketing', 'sensitive_answers')),
  granted BOOLEAN NOT NULL,
  consent_text_version TEXT NOT NULL,
  consent_text TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('questionnaire', 'preferences_link', 'admin', 'retention')),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- General marketing only counts once the address owner confirms it (double opt-in).
  verified_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  withdrawn_by TEXT
);

CREATE INDEX prospect_contact_permissions_prospect_idx ON prospect_contact_permissions (prospect_id, permission_type, recorded_at DESC);

-- Addresses that asked to be erased or unsubscribed, hashed, so a later
-- import or resubmission cannot quietly put them back on a mailing list.
CREATE TABLE prospect_email_suppressions (
  email_hash TEXT PRIMARY KEY,
  reason TEXT NOT NULL CHECK (reason IN ('erased', 'unsubscribed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Daily-rotating hashes for rate limiting the public form; raw IP addresses
-- are never stored. Rows older than a day are purged.
CREATE TABLE prospect_submission_attempts (
  id BIGSERIAL PRIMARY KEY,
  submitter_hash TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX prospect_submission_attempts_idx ON prospect_submission_attempts (submitter_hash, attempted_at DESC);

-- Transactional emails waiting for (or sent by) the email provider. Holds no
-- questionnaire answers. The payload (which can include a private link) is
-- cleared once the email is sent.
CREATE TABLE email_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('interest_confirmation', 'member_welcome')),
  to_email TEXT NOT NULL CHECK (char_length(to_email) BETWEEN 3 AND 254),
  prospect_id UUID REFERENCES prospect_submissions(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed', 'cancelled')),
  attempts SMALLINT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX email_outbox_status_idx ON email_outbox (status, created_at);
-- At most one welcome email per member.
CREATE UNIQUE INDEX email_outbox_member_welcome_idx ON email_outbox (user_id) WHERE kind = 'member_welcome';

ALTER TABLE prospect_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_contact_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_email_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_submission_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_outbox ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON prospect_submissions, prospect_contact_permissions, prospect_email_suppressions,
  prospect_submission_attempts, email_outbox FROM PUBLIC;
REVOKE ALL ON prospect_submissions, prospect_contact_permissions, prospect_email_suppressions,
  prospect_submission_attempts, email_outbox FROM unboxed_member_access;
REVOKE ALL ON SEQUENCE prospect_submission_attempts_id_seq FROM PUBLIC;
