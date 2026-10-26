import { randomBytes } from 'node:crypto';
import { getDatabase } from '@netlify/database';
import { siteUrl } from './email.mjs';

const db = getDatabase();

// Refer a friend. Each invitation has its own random token that only links a
// later visit, interest form or registration back to the member who shared
// it. Tokens never unlock any record. Everything here runs as the table owner
// after the calling function has checked who is asking.

export const newReferralToken = () => randomBytes(32).toString('base64url');
export const referralUrl = (token) => `${siteUrl()}/join-us?ref=${encodeURIComponent(token)}`;
const tokenPattern = /^[A-Za-z0-9_-]{32,128}$/;
export const isReferralToken = (value) => typeof value === 'string' && tokenPattern.test(value);
// A token or address already credited elsewhere raises a unique violation;
// that simply means there is nothing to attribute.
const quietly = async (run) => {
  try {
    return await run();
  } catch {
    return [];
  }
};
const firstWord = (value) => String(value || '').trim().split(/\s+/)[0].slice(0, 40);

/**
 * UK PECR: a "tell a friend" email we send is our own marketing, so it needs
 * the friend's prior consent. We only email a friend who has already given
 * Unboxed Together verified, unwithdrawn consent to general emails and has
 * not unsubscribed, bounced or complained. Everyone else gets the invitation
 * from the member directly (personal link and sharing options).
 */
export async function recipientHasEmailConsent(email) {
  if (!email) return false;
  const rows = await db.sql`
    SELECT 1 FROM prospect_submissions s
    JOIN prospect_contact_permissions c ON c.prospect_id = s.id
    WHERE s.email = ${email} AND c.permission_type = 'general_marketing' AND c.granted
      AND c.withdrawn_at IS NULL AND c.verified_at IS NOT NULL
    LIMIT 1
  `;
  return rows.length > 0;
}

// Records that an invitation link was opened. No cookie or device storage is
// used. Repeated loads within a minute count once. Returns the referrer's
// first name only when they agreed to share it.
export async function recordReferralOpen(token) {
  if (!isReferralToken(token)) return null;
  const [row] = await db.sql`
    UPDATE member_referrals SET
      first_opened_at = COALESCE(first_opened_at, NOW()),
      open_count = open_count + CASE WHEN last_opened_at IS NULL OR last_opened_at < NOW() - INTERVAL '1 minute' THEN 1 ELSE 0 END,
      last_opened_at = NOW()
    WHERE token = ${token}
    RETURNING referrer_user_id, share_referrer_name
  `;
  if (!row) return null;
  if (!row.share_referrer_name) return { referrerName: null };
  const [profile] = await db.sql`SELECT display_name FROM profiles WHERE id = ${row.referrer_user_id}`;
  return { referrerName: firstWord(profile?.display_name) || null };
}

export async function attributeProspect(token, prospectId) {
  if (!isReferralToken(token) || !prospectId) return false;
  const rows = await db.sql`
    UPDATE member_referrals SET prospect_id = ${prospectId}, prospect_at = NOW()
    WHERE token = ${token} AND prospect_id IS NULL RETURNING id
  `;
  return rows.length > 0;
}

/**
 * Links a newly registered member to the invitation they came from: first by
 * the token carried through signup, otherwise by the earliest unclaimed
 * invitation for the same (verified) address. A member is only ever credited
 * to one referral, and never to themselves.
 */
export async function attributeRegistration(user) {
  if (!user?.id) return null;
  const [already] = await db.sql`SELECT id FROM member_referrals WHERE registered_user_id = ${user.id}`;
  if (already) return already.id;
  const token = user.userMetadata?.referral_token;
  if (isReferralToken(token)) {
    const [row] = await quietly(() => db.sql`
      UPDATE member_referrals SET registered_user_id = ${user.id}, registered_at = NOW(), attributed_by = 'token'
      WHERE token = ${token} AND registered_user_id IS NULL AND referrer_user_id <> ${user.id}
        AND EXISTS (SELECT 1 FROM profiles WHERE id = ${user.id})
      RETURNING id
    `);
    if (row) return row.id;
  }
  const email = String(user.email || '').trim().toLowerCase();
  if (!email || !user.confirmedAt) return null;
  const [row] = await quietly(() => db.sql`
    UPDATE member_referrals SET registered_user_id = ${user.id}, registered_at = NOW(), attributed_by = 'email'
    WHERE id = (
      SELECT id FROM member_referrals
      WHERE recipient_email = ${email} AND registered_user_id IS NULL AND referrer_user_id <> ${user.id}
      ORDER BY created_at LIMIT 1
    ) AND EXISTS (SELECT 1 FROM profiles WHERE id = ${user.id})
    RETURNING id
  `);
  return row?.id || null;
}

// What the referring member sees. Email delivery details are left out on
// purpose: they would reveal whether the friend had separately agreed to
// hear from us.
export async function memberReferralList(userId) {
  const rows = await db.sql`
    SELECT r.id, r.token, r.recipient_name, r.recipient_email, r.share_referrer_name, r.source, r.created_at, r.shared_at,
      r.first_opened_at, r.registered_at,
      (r.registered_user_id IS NOT NULL AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = r.registered_user_id AND p.onboarding_completed)) AS onboarded
    FROM member_referrals r WHERE r.referrer_user_id = ${userId}
    ORDER BY r.created_at DESC LIMIT 100
  `;
  return rows.map(({ token, ...row }) => {
    let stage = 'awaiting_sharing';
    if (row.onboarded) stage = 'onboarded';
    else if (row.registered_at) stage = 'registered';
    else if (row.first_opened_at) stage = 'opened';
    else if (row.shared_at || row.source === 'legacy_email') stage = 'shared';
    return { ...row, stage, url: referralUrl(token) };
  });
}

// Referral rows for the team area (all members, or one referrer).
export async function adminReferralList({ referrerId = null, limit = 500 } = {}) {
  return db.sql`
    SELECT r.id, r.referrer_user_id, rp.display_name AS referrer_name, r.recipient_name, r.recipient_email, r.share_referrer_name, r.source,
      r.created_at, r.shared_at, r.shared_via, r.first_opened_at, r.open_count, r.prospect_at, r.registered_at, r.registered_user_id, r.attributed_by,
      mp.display_name AS registered_name, mp.onboarding_completed AS registered_onboarded,
      e.id AS email_id, e.status AS email_status, e.created_at AS email_created_at, e.sent_at AS email_sent_at, e.last_error AS email_error
    FROM member_referrals r
    JOIN profiles rp ON rp.id = r.referrer_user_id
    LEFT JOIN profiles mp ON mp.id = r.registered_user_id
    LEFT JOIN LATERAL (
      SELECT id, status, created_at, sent_at, last_error FROM email_outbox o
      WHERE o.referral_id = r.id ORDER BY o.created_at DESC LIMIT 1
    ) e ON TRUE
    WHERE ${referrerId}::text IS NULL OR r.referrer_user_id = ${referrerId}
    ORDER BY r.created_at DESC
    LIMIT ${limit}
  `;
}
