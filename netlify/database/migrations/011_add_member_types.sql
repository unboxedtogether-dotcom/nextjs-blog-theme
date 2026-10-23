-- Member types: Free Member, Subscribed Member, Moderator, Admin and Owner.
--
-- Free and Subscribed are membership tiers. Moderator is a flag on the
-- profile. Admin and Owner come from the database admin allowlist, so admin
-- access rules are unchanged. Members cannot change any of these themselves:
-- the restricted role has no UPDATE grant on the new columns.

INSERT INTO membership_tiers (id, name) VALUES ('subscribed', 'Subscribed Member') ON CONFLICT (id) DO NOTHING;

ALTER TABLE profiles ADD COLUMN is_moderator BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE member_admins
  ADD COLUMN role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'owner'));

-- The addresses confirmed by the site owner are the owner accounts.
UPDATE member_admins SET role = 'owner' WHERE added_by = 'site owner confirmation 2026-10-23';
