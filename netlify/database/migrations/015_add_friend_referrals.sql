-- Refer a friend: members can email a friend a link to /join-us.
--
-- 1. A new outbox email kind. Existing rows are unchanged.
ALTER TABLE email_outbox DROP CONSTRAINT email_outbox_kind_check;
ALTER TABLE email_outbox ADD CONSTRAINT email_outbox_kind_check
  CHECK (kind IN ('interest_confirmation', 'member_welcome', 'checkin_reminder', 'welcome_reminder', 'friend_referral'));

-- 2. Lets the server cap how many invitations each member sends, and stop the
--    same friend being invited over and over.
CREATE INDEX email_outbox_friend_referral_idx ON email_outbox (user_id, created_at DESC)
  WHERE kind = 'friend_referral';
