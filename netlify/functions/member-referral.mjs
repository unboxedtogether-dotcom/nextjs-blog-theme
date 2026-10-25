import { getDatabase } from '@netlify/database';
import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { deliverQueuedEmails, emailDeliveryConfigured, queueEmail } from './_shared/email.mjs';
import { withConfirmedAccount } from './_shared/identity-accounts.mjs';
import { ensureProfile } from './_shared/member-access.mjs';
import { emailSuppressed } from './_shared/prospect-store.mjs';

const db = getDatabase();
const noStore = { 'Cache-Control': 'no-store' };
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PER_DAY = 5;
const PER_MONTH = 20;
const SAME_FRIEND_DAYS = 30;

const firstWord = (value) => String(value || '').trim().split(/\s+/)[0].slice(0, 40);
const cleanName = (value) => String(value || '').replace(/[\r\n<>]/g, ' ').trim().slice(0, 40);

async function sentCounts(userId) {
  const [row] = await db.sql`
    SELECT COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day')::int AS per_day,
           COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')::int AS per_month
    FROM email_outbox WHERE kind = 'friend_referral' AND user_id = ${userId}
  `;
  return { perDay: row?.per_day || 0, perMonth: row?.per_month || 0 };
}

// Refer a friend. A signed-in member gives a friend's email address and we
// send that friend one branded email linking to /join-us. The address is
// only used for that email: no prospect record or mailing list entry is made.
export default async function memberReferral(request) {
  const user = await withConfirmedAccount(await getUser());
  if (!user) return Response.json({ error: 'Please log in to continue.' }, { status: 401, headers: noStore });

  if (request.method === 'GET') {
    const counts = await sentCounts(user.id);
    return Response.json({ sentThisMonth: counts.perMonth, remainingToday: Math.max(0, PER_DAY - counts.perDay) }, { headers: noStore });
  }

  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: noStore });
  try {
    verifyRequestOrigin(request);
  } catch {
    return Response.json({ error: 'This request could not be accepted.' }, { status: 403, headers: noStore });
  }
  if (!user.confirmedAt) return Response.json({ error: 'Please confirm your email address first. Use the link in the confirmation email we sent you, then log in again.' }, { status: 403, headers: noStore });

  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  const friendName = cleanName(body.friendName);
  if (!emailPattern.test(email) || email.length > 254) return Response.json({ error: 'Please enter a valid email address for your friend.' }, { status: 422, headers: noStore });
  if (email === String(user.email || '').toLowerCase()) return Response.json({ error: 'That is your own email address. Please enter your friend’s email.' }, { status: 422, headers: noStore });

  await ensureProfile(user);
  const counts = await sentCounts(user.id);
  if (counts.perDay >= PER_DAY || counts.perMonth >= PER_MONTH) {
    return Response.json({ error: 'You have sent several invitations recently. Thank you! Please try again in a little while.' }, { status: 429, headers: noStore });
  }

  const [recent] = await db.sql`
    SELECT 1 FROM email_outbox
    WHERE kind = 'friend_referral' AND to_email = ${email} AND created_at > NOW() - (${SAME_FRIEND_DAYS} * INTERVAL '1 day')
    LIMIT 1
  `;
  // People who asked us to stop emailing them, or who were invited recently,
  // are not emailed again. The member sees the normal confirmation either way
  // so nothing about the friend is revealed.
  if (!recent && !(await emailSuppressed(email))) {
    const [profile] = await db.sql`SELECT display_name FROM profiles WHERE id = ${user.id}`;
    const memberName = firstWord(profile?.display_name || user.userMetadata?.full_name || '');
    const id = await queueEmail({ kind: 'friend_referral', to: email, userId: user.id, payload: { friendName, memberName } });
    if (id) await deliverQueuedEmails({ ids: [id] }).catch((error) => console.error('Referral email not sent', error.message));
  }

  return Response.json({ ok: true, delivery: emailDeliveryConfigured() }, { status: 201, headers: noStore });
}

export const config = { path: '/api/member/refer' };
