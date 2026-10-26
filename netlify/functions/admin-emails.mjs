import { getDatabase } from '@netlify/database';
import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { authoriseAdmin, logAdminAccess, notAllowlistedMessage, withMemberAccess } from './_shared/member-access.mjs';
import { emailDeliveryConfigured, retryEmail } from './_shared/email.mjs';
import { loadIdentityAccount } from './_shared/identity-accounts.mjs';
import { loadMembers } from './_shared/member-directory.mjs';
import { recipientHasEmailConsent } from './_shared/referrals.mjs';
import { reminderEligibility } from '../../utils/member-status.mjs';

const db = getDatabase();
const noStore = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
const json = (body, status = 200) => Response.json(body, { status, headers: noStore });
const isUuid = (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const statusGroups = {
  pending: ['queued', 'sending'],
  accepted: ['sent', 'delayed'],
  delivered: ['delivered'],
  failed: ['failed', 'bounced', 'complained'],
  closed: ['cancelled', 'expired'],
};
const kindGroups = {
  reminders: ['checkin_reminder', 'welcome_reminder', 'baseline_reminder'],
  checkin: ['checkin_reminder'],
  welcome: ['welcome_reminder'],
  baseline: ['baseline_reminder'],
  referrals: ['friend_referral'],
  welcome_email: ['member_welcome'],
  prospects: ['interest_confirmation'],
};
const reminderTypes = { checkin_reminder: 'checkin', welcome_reminder: 'welcome', baseline_reminder: 'baseline' };

// The outbox never stores answers, and the private link in a payload is
// never returned here.
async function listEmails({ status, kind, q, page }) {
  const statuses = statusGroups[status] || null;
  const kinds = kindGroups[kind] || null;
  const term = String(q || '').trim().toLowerCase().slice(0, 100);
  const pattern = term ? `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%` : null;
  const size = 50;
  const current = Math.max(1, Number(page) || 1);
  const rows = await db.sql`
    SELECT o.id, o.kind, o.to_email, o.status, o.template_version, o.requested_by, o.created_at, o.last_attempt_at, o.sent_at,
      o.delivered_at, o.failed_at, o.last_error, o.attempts, o.retry_count, o.user_id, o.referral_id, o.context->>'week' AS week,
      o.provider_message_id IS NOT NULL AS has_provider_id,
      CASE WHEN o.kind = 'friend_referral' THEN NULL ELSE p.display_name END AS member_name,
      a.display_name AS requested_by_name,
      COUNT(*) OVER () AS total
    FROM email_outbox o
    LEFT JOIN profiles p ON p.id = o.user_id
    LEFT JOIN profiles a ON a.id = o.requested_by
    WHERE (${statuses}::text[] IS NULL OR o.status = ANY(${statuses}::text[]))
      AND (${kinds}::text[] IS NULL OR o.kind = ANY(${kinds}::text[]))
      AND (${pattern}::text IS NULL OR lower(o.to_email) LIKE ${pattern} OR lower(COALESCE(p.display_name, '')) LIKE ${pattern})
    ORDER BY o.created_at DESC
    LIMIT ${size} OFFSET ${(current - 1) * size}
  `;
  const total = rows[0] ? Number(rows[0].total) : 0;
  return { emails: rows.map(({ total: _total, ...row }) => row), total, page: current, pages: Math.max(1, Math.ceil(total / size)) };
}

async function emailStats() {
  const [row] = await db.sql`
    SELECT COUNT(*) FILTER (WHERE status IN ('queued', 'sending'))::int AS pending,
      COUNT(*) FILTER (WHERE status IN ('sent', 'delayed'))::int AS accepted,
      COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered,
      COUNT(*) FILTER (WHERE status IN ('failed', 'bounced', 'complained'))::int AS failed,
      COUNT(*) FILTER (WHERE status IN ('cancelled', 'expired'))::int AS closed,
      COUNT(*) FILTER (WHERE kind = 'checkin_reminder')::int AS checkin_reminders,
      COUNT(*) FILTER (WHERE kind IN ('welcome_reminder', 'baseline_reminder'))::int AS onboarding_reminders,
      COUNT(*) FILTER (WHERE kind = 'friend_referral')::int AS referral_invitations,
      COUNT(*)::int AS total
    FROM email_outbox
  `;
  const [prefs] = await db.sql`
    SELECT COUNT(*) FILTER (WHERE marketing_consent)::int AS marketing,
      COUNT(*) FILTER (WHERE reminder_emails_paused_at IS NOT NULL)::int AS reminders_paused,
      COUNT(*)::int AS members
    FROM profiles
  `;
  const [suppressed] = await db.sql`SELECT COUNT(*)::int AS n FROM prospect_email_suppressions WHERE reason IN ('bounced', 'complained', 'unsubscribed')`;
  return { ...row, preferences: { ...prefs, suppressed: suppressed.n } };
}

// Before a retry, checks the email is still appropriate.
async function stillWanted(adminId, row) {
  const type = reminderTypes[row.kind];
  if (type) {
    const account = row.user_id ? await loadIdentityAccount(row.user_id) : null;
    const [member] = await loadMembers(adminId, { memberId: row.user_id, accounts: account ? new Map([[row.user_id, account]]) : null });
    if (!member) return { ok: false, reason: 'the member no longer exists' };
    // The failed email itself does not count as a recent reminder.
    const check = { ...member, reminders: { ...member.reminders, [type]: null } };
    const result = reminderEligibility(type, check);
    return result.eligible ? { ok: true } : { ok: false, reason: result.reason.toLowerCase() };
  }
  if (row.kind === 'friend_referral') {
    const [email] = await db.sql`SELECT to_email FROM email_outbox WHERE id = ${row.id}`;
    return (await recipientHasEmailConsent(email.to_email)) ? { ok: true } : { ok: false, reason: 'the friend has not given consent to emails' };
  }
  return { ok: true };
}

// Emails & reminders for allowlisted administrators.
export default async function adminEmails(request) {
  const user = await getUser();
  if (!user) return json({ error: 'Please log in to continue.' }, 401);
  if (!(await authoriseAdmin(user))) return json({ error: (user.roles || []).includes('admin') ? notAllowlistedMessage : 'You do not have access to this area.' }, 403);
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const emailId = url.searchParams.get('email');
    if (emailId) {
      if (!isUuid(emailId)) return json({ error: 'That email could not be found.' }, 404);
      const [email] = await db.sql`
        SELECT id, kind, to_email, status, template_version, requested_by, created_at, last_attempt_at, sent_at, delivered_at, failed_at,
          last_error, attempts, retry_count, user_id, referral_id, provider, provider_message_id
        FROM email_outbox WHERE id = ${emailId}
      `;
      if (!email) return json({ error: 'That email could not be found.' }, 404);
      const events = await db.sql`SELECT event_type, actor, detail, occurred_at FROM email_events WHERE outbox_id = ${emailId} ORDER BY occurred_at, received_at`;
      await withMemberAccess(user.id, (query) => logAdminAccess(query, user.id, email.kind === 'friend_referral' ? null : email.user_id, 'view_email', 'email', emailId), 'admin');
      return json({ email, events });
    }
    const filters = Object.fromEntries(['status', 'kind', 'q', 'page'].map((key) => [key, url.searchParams.get(key) || undefined]));
    await withMemberAccess(user.id, (query) => logAdminAccess(query, user.id, null, 'list_emails', null, null, [filters.status, filters.kind].filter(Boolean).join(', ') || null), 'admin');
    return json({
      ...(await listEmails(filters)),
      stats: await emailStats(),
      deliveryConfigured: emailDeliveryConfigured(),
      webhookConfigured: Boolean(process.env.RESEND_WEBHOOK_SECRET),
    });
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  try {
    verifyRequestOrigin(request);
  } catch {
    return json({ error: 'This request could not be accepted.' }, 403);
  }
  const body = await request.json().catch(() => ({}));
  if (body.action !== 'retry') return json({ error: 'Unknown action.' }, 422);
  if (!isUuid(body.id)) return json({ error: 'That email could not be found.' }, 404);
  const result = await retryEmail(body.id, user.id, (row) => stillWanted(user.id, row));
  const [row] = await db.sql`SELECT user_id, kind FROM email_outbox WHERE id = ${body.id}`;
  await withMemberAccess(user.id, (query) => logAdminAccess(
    query, user.id, row && row.kind !== 'friend_referral' ? row.user_id : null, 'retry_email', 'email', body.id, result.error ? `refused: ${result.error}` : 'retried',
  ), 'admin');
  if (result.error) return json({ error: result.error }, result.status);
  return json({ ok: true, email: result.email, deliveryConfigured: result.configured });
}

export const config = { path: '/api/admin/emails' };
