import { getDatabase } from '@netlify/database';
import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { deliverQueuedEmails, emailAddressSuppressed, queueEmail } from './_shared/email.mjs';
import { withConfirmedAccount } from './_shared/identity-accounts.mjs';
import { ensureProfile } from './_shared/member-access.mjs';
import { isUuid } from './_shared/progress-store.mjs';
import { memberReferralList, newReferralToken, recipientHasEmailConsent, referralUrl } from './_shared/referrals.mjs';

const db = getDatabase();
const noStore = { 'Cache-Control': 'no-store' };
const json = (body, status = 200) => Response.json(body, { status, headers: noStore });
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PER_DAY = 10;
const PER_MONTH = 40;
// The same address is emailed at most once in this many days, by anyone.
const SAME_FRIEND_DAYS = 30;
const shareChannels = ['copy', 'native_share', 'email_app', 'whatsapp'];

const firstWord = (value) => String(value || '').trim().split(/\s+/)[0].slice(0, 40);
const cleanName = (value) => String(value || '').replace(/[\r\n<>]/g, ' ').trim().slice(0, 40);

async function createdCounts(userId) {
  const [row] = await db.sql`
    SELECT COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day')::int AS per_day,
           COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')::int AS per_month
    FROM member_referrals WHERE referrer_user_id = ${userId}
  `;
  return { perDay: row?.per_day || 0, perMonth: row?.per_month || 0 };
}

async function summary(userId) {
  const counts = await createdCounts(userId);
  const [profile] = await db.sql`SELECT display_name FROM profiles WHERE id = ${userId}`;
  return {
    referrals: await memberReferralList(userId),
    remainingToday: Math.max(0, PER_DAY - counts.perDay),
    createdThisMonth: counts.perMonth,
    preferredName: firstWord(profile?.display_name),
  };
}

/**
 * Emails the invitation only where it is lawful under UK PECR: the friend
 * already gave Unboxed Together verified consent to emails, has not opted
 * out, bounced or complained, and nobody emailed them an invitation
 * recently. Returns nothing the member can see, so it never reveals whether
 * a friend has a relationship with us.
 */
async function maybeEmailFriend(user, referral, referrerName) {
  if (!referral.recipient_email) return;
  if (await emailAddressSuppressed(referral.recipient_email)) return;
  if (!(await recipientHasEmailConsent(referral.recipient_email))) return;
  const [recent] = await db.sql`
    SELECT 1 FROM email_outbox
    WHERE kind = 'friend_referral' AND lower(to_email) = ${referral.recipient_email}
      AND status NOT IN ('cancelled', 'expired') AND created_at > NOW() - (${SAME_FRIEND_DAYS} * INTERVAL '1 day')
    LIMIT 1
  `;
  if (recent) return;
  const id = await queueEmail({
    kind: 'friend_referral',
    to: referral.recipient_email,
    userId: user.id,
    referralId: referral.id,
    payload: { referralUrl: referralUrl(referral.token), referrerName },
    requestedBy: `member:${user.id}`,
    idempotencyKey: `friend_referral:${referral.id}`,
  });
  if (id) await deliverQueuedEmails({ ids: [id] }).catch((error) => console.error('Referral email not sent', error.message));
}

async function createReferral(user, body) {
  const email = body.email ? String(body.email).trim().toLowerCase() : '';
  const friendName = cleanName(body.friendName) || null;
  const shareName = body.shareName === true;
  if (email && (!emailPattern.test(email) || email.length > 254)) return json({ error: 'Please enter a valid email address for your friend, or leave it blank.' }, 422);
  if (email && email === String(user.email || '').toLowerCase()) return json({ error: 'That is your own email address. Please enter your friend’s email, or leave it blank.' }, 422);

  // Same friend again: the existing invitation (and link) is reused.
  if (email) {
    const [existing] = await db.sql`SELECT id FROM member_referrals WHERE referrer_user_id = ${user.id} AND recipient_email = ${email}`;
    if (existing) {
      const list = await memberReferralList(user.id);
      return json({ ok: true, duplicate: true, referral: list.find((item) => item.id === existing.id) || null, ...(await summary(user.id)) });
    }
  }
  const counts = await createdCounts(user.id);
  if (counts.perDay >= PER_DAY || counts.perMonth >= PER_MONTH) {
    return json({ error: 'You have created several invitations recently. Thank you! Please try again in a little while.' }, 429);
  }

  const [profile] = await db.sql`SELECT display_name FROM profiles WHERE id = ${user.id}`;
  const referrerName = shareName ? firstWord(profile?.display_name || user.userMetadata?.full_name || '') || null : null;
  const [referral] = await db.sql`
    INSERT INTO member_referrals (referrer_user_id, token, recipient_email, recipient_name, share_referrer_name)
    VALUES (${user.id}, ${newReferralToken()}, ${email || null}, ${friendName}, ${shareName})
    ON CONFLICT DO NOTHING
    RETURNING id, token, recipient_email
  `;
  if (!referral) return json({ error: 'That invitation already exists. Please refresh the page.' }, 409);
  await maybeEmailFriend(user, referral, referrerName).catch((error) => console.error('Referral email check failed', error.message));
  const result = await summary(user.id);
  return json({ ok: true, duplicate: false, referral: result.referrals.find((item) => item.id === referral.id) || null, ...result }, 201);
}

// Refer a friend for signed-in, confirmed members. The member gets a
// personal invitation link to share themselves; see maybeEmailFriend for
// when Unboxed Together emails the friend directly.
export default async function memberReferral(request) {
  const user = await withConfirmedAccount(await getUser());
  if (!user) return json({ error: 'Please log in to continue.' }, 401);

  if (request.method === 'GET') {
    await ensureProfile(user);
    return json(await summary(user.id));
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  try {
    verifyRequestOrigin(request);
  } catch {
    return json({ error: 'This request could not be accepted.' }, 403);
  }
  if (!user.confirmedAt) return json({ error: 'Please confirm your email address first. Use the link in the confirmation email we sent you, then log in again.' }, 403);
  await ensureProfile(user);
  const body = await request.json().catch(() => ({}));

  if (body.action === 'shared') {
    if (!isUuid(body.id)) return json({ error: 'That invitation could not be found.' }, 404);
    const via = shareChannels.includes(body.via) ? body.via : 'copy';
    // Only the member's own invitation can be marked.
    const rows = await db.sql`
      UPDATE member_referrals SET shared_at = COALESCE(shared_at, NOW()), shared_via = COALESCE(shared_via, ${via})
      WHERE id = ${body.id} AND referrer_user_id = ${user.id} RETURNING id
    `;
    if (!rows.length) return json({ error: 'That invitation could not be found.' }, 404);
    return json({ ok: true, ...(await summary(user.id)) });
  }
  return createReferral(user, body);
}

export const config = { path: '/api/member/refer' };
