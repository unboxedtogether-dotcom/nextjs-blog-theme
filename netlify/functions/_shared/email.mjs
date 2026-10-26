import { createHash } from 'node:crypto';
import { getDatabase } from '@netlify/database';
import {
  REFERRAL_BUTTON, REFERRAL_SUBJECT, referralClosing, referralInvitationText, referralOpening, referralParagraphs, referralProjects,
} from '../../../utils/referral-invitation.mjs';

const db = getDatabase();

// Outbound transactional email. Messages are written to `email_outbox` first
// and delivered by the configured provider; with no provider configured they
// simply stay queued, so nothing is ever sent by accident.
//
// Provider: Resend (https://resend.com), called server-side only. Needs the
// RESEND_API_KEY and EMAIL_FROM environment variables. Credentials never reach
// the browser.

// Absolute site address for email links. A value saved without https:// would
// otherwise produce links that email apps treat as relative and break.
export const siteUrl = () => {
  const base = (process.env.EMAIL_SITE_URL || process.env.URL || 'https://unboxedtogether.com').trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(base) ? base : `https://${base}`;
};
export const emailDeliveryConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const font = "font-family:'Source Sans 3','Segoe UI',Helvetica,Arial,sans-serif;";
const paragraph = (text, extra = '') => `<p style="margin:0 0 16px;${font}font-size:17px;line-height:1.6;color:#0b0b0d;${extra}">${text}</p>`;

// Same frame as the Identity email templates in public/email-templates.
export function brandedEmail({ preheader, heading, paragraphs, button, footer }) {
  const base = siteUrl();
  const buttonHtml = button ? `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:14px 0 28px;">
              <a href="${escapeHtml(button.href)}" target="_blank" style="display:inline-block;padding:17px 36px;background:#1843f4;border-radius:999px;${font}font-size:16px;line-height:1.2;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#ffffff;text-decoration:none;">${escapeHtml(button.label)}</a>
            </td></tr></table>` : '';
  return `<!DOCTYPE html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background:#f4f6ff;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#f4f6ff;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6ff;"><tr><td align="center" style="padding:32px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #cbdced;border-radius:20px;">
    <tr><td style="height:6px;line-height:6px;font-size:0;background:#1843f4;border-radius:20px 20px 0 0;">&nbsp;</td></tr>
    <tr><td align="center" style="padding:32px 24px 8px;"><a href="${base}" target="_blank"><img src="${base}/email-templates/unboxed-together-logo.png" width="200" alt="Unboxed Together" style="display:block;width:200px;max-width:70%;height:auto;margin:0 auto;"></a></td></tr>
    <tr><td style="padding:28px 32px 12px;">
      <h1 style="margin:0 0 22px;font-family:Montserrat,'Segoe UI',Arial,sans-serif;font-size:26px;line-height:1.2;font-weight:800;color:#0b0b0d;">${escapeHtml(heading)}</h1>
      ${paragraphs.map((text) => paragraph(text)).join('\n      ')}
      ${buttonHtml}
      ${paragraph('<strong>Lee</strong><br>Unboxed Together<br><a href="https://www.unboxedtogether.com" style="color:#1843f4;text-decoration:none;font-weight:700;">www.unboxedtogether.com</a>', 'margin-top:24px;')}
    </td></tr>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;"><tr><td align="center" style="padding:22px 16px 8px;${font}font-size:12px;line-height:1.6;color:#52647a;">
    Unboxed.Together Ltd &middot; <a href="${base}" style="color:#52647a;">unboxedtogether.com</a> &middot; <a href="mailto:support@unboxedtogether.com" style="color:#52647a;">support@unboxedtogether.com</a><br>
    ${footer} <a href="${base}/privacy" style="color:#52647a;">Privacy Policy</a>
  </td></tr></table>
</td></tr></table>
</body></html>`;
}

const preferencesUrl = () => `${siteUrl()}/members/profile#settings-communication`;
const reminderFooter = (reason) => `You are receiving this because ${reason}. <a href="${escapeHtml(preferencesUrl())}" style="color:#52647a;">Turn reminder emails off</a> &middot;`;

// Bumped whenever a template's wording changes, and stored with each email.
export const templateVersions = {
  interest_confirmation: 'v1', member_welcome: 'v1', welcome_reminder: 'v2', checkin_reminder: 'v2', baseline_reminder: 'v1', friend_referral: 'v2',
};

const templates = {
  // Sent only to people who ticked a contact permission. Contains no questionnaire answers.
  interest_confirmation: ({ firstName, manageUrl, marketingPending }) => ({
    subject: 'Thank you for helping shape Unboxed Together',
    html: brandedEmail({
      preheader: 'Your interest has been recorded.',
      heading: 'Thank you for helping shape Unboxed Together',
      paragraphs: [
        `Hi ${escapeHtml(firstName || 'there')},`,
        'Thank you for telling us what you are interested in. Your interest has been recorded and we will only contact you about the things you asked us to.',
        marketingPending
          ? 'You also asked to receive general Unboxed Together news. Please confirm this using the button below. Until you do, we will not send you general news or promotional emails.'
          : 'You can change what we contact you about, or ask us to delete your answers, at any time.',
        'We are building Unboxed Together with people, not just for them.',
      ],
      button: { href: manageUrl, label: marketingPending ? 'Confirm my email preferences' : 'Manage my preferences' },
      footer: `You are receiving this because you registered interest at unboxedtogether.com/join-us. <a href="${escapeHtml(manageUrl)}" style="color:#52647a;">Manage preferences or unsubscribe</a> &middot;`,
    }),
    text: `Hi ${firstName || 'there'},\n\nThank you for telling us what you are interested in. Your interest has been recorded and we will only contact you about the things you asked us to.\n\n${marketingPending ? 'Please confirm that you would like general Unboxed Together news:' : 'Manage your preferences:'} ${manageUrl}\n\nLee\nUnboxed Together`,
    unsubscribeUrl: manageUrl,
  }),
  member_welcome: ({ firstName }) => {
    const dashboard = `${siteUrl()}/members`;
    return {
      subject: 'Welcome to Unboxed Together',
      html: brandedEmail({
        preheader: 'Your free membership is ready.',
        heading: 'Welcome to Unboxed Together',
        paragraphs: [
          `Hi ${escapeHtml(firstName || 'there')},`,
          'Your email is confirmed and your free membership is ready.',
          'Start with the short welcome form. It only takes a few minutes, and the optional health and wellbeing sections can be skipped or completed later.',
          'No perfect diets. No quick fixes. Just helping you understand you.',
        ],
        button: { href: dashboard, label: 'Open my member space' },
        footer: 'You are receiving this because you created an Unboxed Together account.',
      }),
      text: `Hi ${firstName || 'there'},\n\nYour email is confirmed and your free membership is ready. Start with the short welcome form: ${dashboard}\n\nLee\nUnboxed Together`,
    };
  },
  // Sent by the team from the admin area, at most once per reporting week.
  // Contains no answers or scores. Logged-out members go through login and
  // then straight back to the check-in.
  checkin_reminder: ({ firstName }) => {
    const checkIn = `${siteUrl()}/login?next=${encodeURIComponent('/members/check-in')}`;
    return {
      subject: 'Your Unboxed Together check-in is ready',
      html: brandedEmail({
        preheader: 'It only takes a few minutes.',
        heading: 'Your check-in is ready',
        paragraphs: [
          `Hi ${escapeHtml(firstName || 'there')},`,
          'Just a quick reminder that your next Unboxed Together check-in is ready.',
          'It only takes a few minutes, and your answers help you build a clearer picture of your progress over time.',
        ],
        button: { href: checkIn, label: 'Complete my check-in' },
        footer: reminderFooter('you turned on progress tracking in your Unboxed Together account'),
      }),
      text: `Hi ${firstName || 'there'},\n\nJust a quick reminder that your next Unboxed Together check-in is ready.\n\nIt only takes a few minutes, and your answers help you build a clearer picture of your progress over time.\n\nComplete my check-in: ${checkIn}\n\nTurn reminders off: ${preferencesUrl()}\n\nLee\nUnboxed Together`,
      unsubscribeUrl: preferencesUrl(),
    };
  },
  // Onboarding nudge for members who turned progress tracking on but have
  // not recorded their starting point yet.
  baseline_reminder: ({ firstName }) => {
    const checkIn = `${siteUrl()}/login?next=${encodeURIComponent('/members/check-in')}`;
    return {
      subject: 'Your Unboxed Together starting point is ready',
      html: brandedEmail({
        preheader: 'Record your starting point in a few minutes.',
        heading: 'Ready to record your starting point?',
        paragraphs: [
          `Hi ${escapeHtml(firstName || 'there')},`,
          'You turned on progress tracking, but your starting point has not been recorded yet.',
          'It only takes a few minutes, and it is what each weekly check-in is compared with, so you can see how things change over time.',
        ],
        button: { href: checkIn, label: 'Record my starting point' },
        footer: reminderFooter('you turned on progress tracking in your Unboxed Together account'),
      }),
      text: `Hi ${firstName || 'there'},\n\nYou turned on progress tracking, but your starting point has not been recorded yet. It only takes a few minutes: ${checkIn}\n\nTurn reminders off: ${preferencesUrl()}\n\nLee\nUnboxed Together`,
      unsubscribeUrl: preferencesUrl(),
    };
  },
  // Referral invitation. Only ever sent to an address whose owner already
  // agreed to receive Unboxed Together emails (see member-referral.mjs);
  // otherwise the member shares the same wording themselves. Holds only the
  // referral link and, if the member agreed, their preferred first name.
  friend_referral: ({ referralUrl, referrerName }) => ({
    subject: REFERRAL_SUBJECT,
    html: brandedEmail({
      preheader: referralOpening(referrerName),
      heading: referralOpening(referrerName).toUpperCase(),
      paragraphs: [
        ...referralParagraphs.map((line) => escapeHtml(line).replace('Unboxed – The Dirty Secret Hiding In Our Diet', '<strong>Unboxed – The Dirty Secret Hiding In Our Diet</strong>')),
        `Now we’re developing:<br>${referralProjects.map((line) => `&bull; ${escapeHtml(line)}`).join('<br>')}`,
        escapeHtml(referralClosing[0]),
        `<strong>${escapeHtml(referralClosing[1])}</strong>`,
      ],
      button: { href: referralUrl, label: REFERRAL_BUTTON },
      footer: 'You are receiving this one-off invitation because you previously agreed to hear from Unboxed Together and a member suggested it to you. We have not added you to any new mailing list. <a href="mailto:support@unboxedtogether.com?subject=Unsubscribe" style="color:#52647a;">Unsubscribe</a> &middot;',
    }),
    text: `${referralInvitationText({ referrerName, url: referralUrl })}\n\nLee\nUnboxed Together\n\nYou received this one-off invitation because you previously agreed to hear from Unboxed Together. To unsubscribe, reply with "unsubscribe".`,
    unsubscribeUrl: 'mailto:support@unboxedtogether.com?subject=Unsubscribe',
  }),
  welcome_reminder: ({ firstName }) => {
    const dashboard = `${siteUrl()}/login?next=${encodeURIComponent('/members')}`;
    return {
      subject: 'Your Unboxed Together welcome form is waiting',
      html: brandedEmail({
        preheader: 'It only takes a few minutes.',
        heading: 'Finish setting up your membership',
        paragraphs: [
          `Hi ${escapeHtml(firstName || 'there')},`,
          'Thank you for joining Unboxed Together. Your short welcome form has not been filled in yet.',
          'It only takes a few minutes and helps us shape the support you get. The optional health and wellbeing sections can be skipped or completed later.',
        ],
        button: { href: dashboard, label: 'Open my member space' },
        footer: reminderFooter('you created an Unboxed Together account'),
      }),
      text: `Hi ${firstName || 'there'},\n\nThank you for joining Unboxed Together. Your short welcome form has not been filled in yet. It only takes a few minutes: ${dashboard}\n\nTurn reminders off: ${preferencesUrl()}\n\nLee\nUnboxed Together`,
      unsubscribeUrl: preferencesUrl(),
    };
  },
};


export const renderEmail = (kind, payload) => templates[kind](payload);

const MAX_ATTEMPTS = 5;
// Emails held this long without a provider are dropped, not sent late.
const EXPIRY_DAYS = 7;
const MAX_MANUAL_RETRIES = 3;
const emailHash = (email) => createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex');

export async function recordEmailEvent(outboxId, eventType, { actor = null, detail = null, providerEventId = null, occurredAt = null } = {}) {
  const rows = await db.sql`
    INSERT INTO email_events (outbox_id, event_type, actor, detail, provider_event_id, occurred_at)
    VALUES (${outboxId}, ${eventType}, ${actor}, ${detail ? String(detail).slice(0, 500) : null}, ${providerEventId}, COALESCE(${occurredAt}::timestamptz, NOW()))
    ON CONFLICT (provider_event_id) DO NOTHING
    RETURNING id
  `;
  return rows.length > 0;
}

export async function emailAddressSuppressed(email) {
  if (!email) return false;
  const rows = await db.sql`SELECT 1 FROM prospect_email_suppressions WHERE email_hash = ${emailHash(email)}`;
  return rows.length > 0;
}

export async function suppressedAddresses(emails) {
  const list = [...new Set(emails.filter(Boolean).map((email) => String(email).toLowerCase()))];
  if (!list.length) return new Set();
  const hashes = list.map(emailHash);
  const rows = await db.sql`SELECT email_hash FROM prospect_email_suppressions WHERE email_hash = ANY(${hashes}::text[])`;
  const found = new Set(rows.map((row) => row.email_hash));
  return new Set(list.filter((email) => found.has(emailHash(email))));
}

/**
 * Adds an email to the outbox. Returns its id, or null when the same email
 * (same idempotency key, or a second welcome email) is already there.
 */
export async function queueEmail({
  kind, to, prospectId = null, userId = null, referralId = null, payload = {}, requestedBy = 'system', idempotencyKey = null, context = {},
}) {
  const [row] = await db.sql`
    INSERT INTO email_outbox (kind, to_email, prospect_id, user_id, referral_id, payload, template_version, requested_by, idempotency_key, context)
    VALUES (${kind}, ${to}, ${prospectId}, ${userId}, ${referralId}, ${JSON.stringify(payload)}::jsonb, ${templateVersions[kind] || 'v1'},
      ${requestedBy}, ${idempotencyKey}, ${JSON.stringify(context)}::jsonb)
    ON CONFLICT DO NOTHING
    RETURNING id
  `;
  if (row) await recordEmailEvent(row.id, 'queued', { actor: requestedBy });
  return row?.id || null;
}

class ProviderError extends Error {
  constructor(message, permanent) {
    super(message);
    this.permanent = permanent;
  }
}

// One request per email. The outbox id is the provider idempotency key, so a
// retry after a timeout can never produce a second copy.
async function sendWithResend(message, to, outboxId) {
  const headers = message.unsubscribeUrl ? { 'List-Unsubscribe': `<${message.unsubscribeUrl}>` } : undefined;
  let response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': outboxId },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject: message.subject, html: message.html, text: message.text, headers, tags: [{ name: 'outbox_id', value: outboxId }] }),
    });
  } catch (error) {
    throw new ProviderError(`Email provider could not be reached: ${error.message}`, false);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof body?.message === 'string' ? `: ${body.message.slice(0, 200)}` : '';
    // Rate limits and provider outages are retried; anything else needs a person.
    throw new ProviderError(`Email provider responded ${response.status}${detail}`, response.status !== 429 && response.status < 500);
  }
  return body?.id ? String(body.id) : null;
}

async function claimQueued(ids, limit) {
  // Emails stuck mid-send (for example a function timeout) go back in the
  // queue; the provider idempotency key stops a duplicate.
  await db.sql`UPDATE email_outbox SET status = 'queued' WHERE status = 'sending' AND last_attempt_at < NOW() - INTERVAL '15 minutes'`;
  const expired = await db.sql`
    UPDATE email_outbox SET status = 'expired', payload = '{}'::jsonb, last_error = ${`Not sent within ${EXPIRY_DAYS} days of being queued`}
    WHERE status = 'queued' AND created_at < NOW() - (${EXPIRY_DAYS} * INTERVAL '1 day') AND retry_count = 0
    RETURNING id
  `;
  for (const row of expired) await recordEmailEvent(row.id, 'expired', { actor: 'system' });
  return ids
    ? db.sql`
      UPDATE email_outbox SET status = 'sending', last_attempt_at = NOW(), attempts = attempts + 1
      WHERE id IN (SELECT id FROM email_outbox WHERE status = 'queued' AND id = ANY(${ids}::uuid[]) FOR UPDATE SKIP LOCKED)
      RETURNING id, kind, to_email, payload, attempts`
    : db.sql`
      UPDATE email_outbox SET status = 'sending', last_attempt_at = NOW(), attempts = attempts + 1
      WHERE id IN (SELECT id FROM email_outbox WHERE status = 'queued' AND attempts < ${MAX_ATTEMPTS} ORDER BY created_at LIMIT ${limit} FOR UPDATE SKIP LOCKED)
      RETURNING id, kind, to_email, payload, attempts`;
}

// Sends queued emails. Safe to call repeatedly and concurrently: each email
// is claimed by one caller only. Does nothing without a provider.
export async function deliverQueuedEmails({ ids = null, limit = 20 } = {}) {
  if (!emailDeliveryConfigured()) return { sent: 0, failed: 0, configured: false, results: [] };
  const rows = await claimQueued(ids, limit);
  let sent = 0;
  let failed = 0;
  const results = [];
  for (const row of rows) {
    if (await emailAddressSuppressed(row.to_email)) {
      await db.sql`UPDATE email_outbox SET status = 'cancelled', payload = '{}'::jsonb, last_error = 'Address is suppressed (bounced, complained or unsubscribed)' WHERE id = ${row.id}`;
      await recordEmailEvent(row.id, 'cancelled', { actor: 'system', detail: 'Suppressed address' });
      results.push({ id: row.id, status: 'cancelled' });
      continue;
    }
    await recordEmailEvent(row.id, 'attempt', { actor: 'system', detail: `Attempt ${row.attempts}` });
    try {
      const messageId = await sendWithResend(templates[row.kind](row.payload), row.to_email, row.id);
      await db.sql`
        UPDATE email_outbox SET status = 'sent', sent_at = NOW(), payload = '{}'::jsonb, last_error = NULL, provider = 'resend', provider_message_id = ${messageId}
        WHERE id = ${row.id}
      `;
      await recordEmailEvent(row.id, 'accepted', { actor: 'resend', detail: messageId ? `Provider message ${messageId}` : null });
      sent += 1;
      results.push({ id: row.id, status: 'sent' });
    } catch (error) {
      const permanent = error.permanent === true || row.attempts >= MAX_ATTEMPTS;
      const reason = String(error.message).slice(0, 300);
      await db.sql`
        UPDATE email_outbox SET last_error = ${reason}, provider = 'resend',
          status = ${permanent ? 'failed' : 'queued'}, failed_at = CASE WHEN ${permanent} THEN NOW() ELSE failed_at END
        WHERE id = ${row.id}
      `;
      await recordEmailEvent(row.id, permanent ? 'failed' : 'attempt_failed', { actor: 'resend', detail: reason });
      console.error('Email not sent', row.kind, row.id, reason);
      if (permanent) failed += 1;
      results.push({ id: row.id, status: permanent ? 'failed' : 'queued', error: reason });
    }
  }
  return { sent, failed, configured: true, results };
}

/**
 * Puts one failed email back in the queue and tries it again. `stillWanted`
 * re-checks the reason for the email (for example that a reminder is still
 * needed) before anything is sent.
 */
export async function retryEmail(id, adminId, stillWanted = async () => ({ ok: true })) {
  const [row] = await db.sql`SELECT id, kind, status, user_id, referral_id, retry_count, payload FROM email_outbox WHERE id = ${id}`;
  if (!row) return { status: 404, error: 'That email could not be found.' };
  if (row.status !== 'failed') return { status: 409, error: 'Only failed emails can be retried. Bounced or complained addresses are never emailed again.' };
  if (row.retry_count >= MAX_MANUAL_RETRIES) return { status: 409, error: `This email has already been retried ${MAX_MANUAL_RETRIES} times.` };
  if (!row.payload || !Object.keys(row.payload).length) return { status: 409, error: 'This email can no longer be rebuilt. Send a new one instead.' };
  const check = await stillWanted(row);
  if (!check.ok) {
    await db.sql`UPDATE email_outbox SET status = 'cancelled', payload = '{}'::jsonb, last_error = ${`Cancelled on retry: ${check.reason}`} WHERE id = ${id} AND status = 'failed'`;
    await recordEmailEvent(id, 'cancelled', { actor: adminId, detail: check.reason });
    return { status: 409, error: `Not retried: ${check.reason}. The email has been cancelled.` };
  }
  const updated = await db.sql`
    UPDATE email_outbox SET status = 'queued', attempts = 0, retry_count = retry_count + 1, last_error = NULL, failed_at = NULL
    WHERE id = ${id} AND status = 'failed' RETURNING id
  `;
  if (!updated.length) return { status: 409, error: 'This email changed while you were looking at it. Please refresh.' };
  await recordEmailEvent(id, 'retried', { actor: adminId });
  const delivery = await deliverQueuedEmails({ ids: [id] });
  const [after] = await db.sql`SELECT status, last_error FROM email_outbox WHERE id = ${id}`;
  return { status: 200, email: after, configured: delivery.configured };
}

// Provider delivery events (Resend webhooks). Statuses only move forward, so
// a late "delivered" never hides an earlier bounce.
const statusRank = { queued: 0, sending: 1, sent: 2, delayed: 3, delivered: 4, failed: 5, bounced: 6, complained: 7 };
const providerEvents = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.delivery_delayed': 'delayed',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.failed': 'failed',
};

export async function applyProviderEvent({ type, providerEventId, messageId, occurredAt, detail }) {
  const status = providerEvents[type];
  if (!messageId) return { matched: false };
  const [row] = await db.sql`SELECT id, status, to_email FROM email_outbox WHERE provider_message_id = ${messageId}`;
  if (!row) return { matched: false };
  const fresh = await recordEmailEvent(row.id, type.replace(/^email\./, ''), { actor: 'resend', detail, providerEventId, occurredAt });
  if (!fresh || !status) return { matched: true, duplicate: !fresh };
  if ((statusRank[status] ?? -1) > (statusRank[row.status] ?? -1)) {
    await db.sql`
      UPDATE email_outbox SET status = ${status},
        delivered_at = CASE WHEN ${status} = 'delivered' THEN COALESCE(${occurredAt}::timestamptz, NOW()) ELSE delivered_at END,
        failed_at = CASE WHEN ${status} IN ('bounced', 'complained', 'failed') THEN COALESCE(${occurredAt}::timestamptz, NOW()) ELSE failed_at END,
        last_error = CASE WHEN ${status} IN ('bounced', 'complained', 'failed') THEN ${detail ? String(detail).slice(0, 300) : status} ELSE last_error END
      WHERE id = ${row.id}
    `;
  }
  if (status === 'bounced' || status === 'complained') {
    await db.sql`
      INSERT INTO prospect_email_suppressions (email_hash, reason) VALUES (${emailHash(row.to_email)}, ${status})
      ON CONFLICT (email_hash) DO NOTHING
    `;
  }
  return { matched: true };
}
