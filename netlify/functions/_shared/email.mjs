import { getDatabase } from '@netlify/database';

const db = getDatabase();

// Outbound transactional email. Messages are written to `email_outbox` first
// and delivered by the configured provider; with no provider configured they
// simply stay queued, so nothing is ever sent by accident.
//
// Provider: Resend (https://resend.com), called server-side only. Needs the
// RESEND_API_KEY and EMAIL_FROM environment variables. Credentials never reach
// the browser.

export const siteUrl = () => (process.env.EMAIL_SITE_URL || process.env.URL || 'https://www.unboxedtogether.com').replace(/\/$/, '');
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
  // Sent by the team from the admin area. Contains no answers or scores.
  checkin_reminder: ({ firstName }) => {
    const checkIn = `${siteUrl()}/members/check-in`;
    return {
      subject: 'A gentle reminder about your weekly check-in',
      html: brandedEmail({
        preheader: 'You can still add check-ins for the weeks you missed.',
        heading: 'Time for a quick check-in?',
        paragraphs: [
          `Hi ${escapeHtml(firstName || 'there')},`,
          'It looks like a weekly check-in has been missed. That is completely fine, and there is nothing to catch up on in one go.',
          'When you have a few minutes, you can add this week’s check-in, or date one for an earlier week you missed. Each one helps you see how things are changing over time.',
        ],
        button: { href: checkIn, label: 'Open my check-in' },
        footer: 'You are receiving this because you turned on progress tracking in your Unboxed Together account. Reply to this email if you would rather not get reminders.',
      }),
      text: `Hi ${firstName || 'there'},\n\nIt looks like a weekly check-in has been missed. When you have a few minutes you can add this week's check-in, or date one for an earlier week you missed: ${checkIn}\n\nLee\nUnboxed Together`,
    };
  },
  welcome_reminder: ({ firstName }) => {
    const dashboard = `${siteUrl()}/members`;
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
        footer: 'You are receiving this because you created an Unboxed Together account. Reply to this email if you would rather not get reminders.',
      }),
      text: `Hi ${firstName || 'there'},\n\nThank you for joining Unboxed Together. Your short welcome form has not been filled in yet. It only takes a few minutes: ${dashboard}\n\nLee\nUnboxed Together`,
    };
  },
};

export async function queueEmail({ kind, to, prospectId = null, userId = null, payload = {} }) {
  const [row] = await db.sql`
    INSERT INTO email_outbox (kind, to_email, prospect_id, user_id, payload)
    VALUES (${kind}, ${to}, ${prospectId}, ${userId}, ${JSON.stringify(payload)}::jsonb)
    ON CONFLICT DO NOTHING
    RETURNING id
  `;
  return row?.id || null;
}

async function sendWithResend(message, to) {
  const headers = message.unsubscribeUrl ? { 'List-Unsubscribe': `<${message.unsubscribeUrl}>` } : undefined;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject: message.subject, html: message.html, text: message.text, headers }),
  });
  if (!response.ok) throw new Error(`Email provider responded ${response.status}`);
}

// Sends queued emails. Safe to call repeatedly; does nothing without a provider.
export async function deliverQueuedEmails({ ids = null, limit = 20 } = {}) {
  if (!emailDeliveryConfigured()) return { sent: 0, configured: false };
  const rows = ids
    ? await db.sql`SELECT id, kind, to_email, payload FROM email_outbox WHERE status = 'queued' AND id = ANY(${ids}::uuid[])`
    : await db.sql`SELECT id, kind, to_email, payload FROM email_outbox WHERE status = 'queued' AND attempts < 5 ORDER BY created_at LIMIT ${limit}`;
  let sent = 0;
  for (const row of rows) {
    try {
      await sendWithResend(templates[row.kind](row.payload), row.to_email);
      await db.sql`UPDATE email_outbox SET status = 'sent', sent_at = NOW(), payload = '{}'::jsonb, attempts = attempts + 1, last_error = NULL WHERE id = ${row.id}`;
      sent += 1;
    } catch (error) {
      await db.sql`
        UPDATE email_outbox SET attempts = attempts + 1, last_error = ${String(error.message).slice(0, 300)},
          status = CASE WHEN attempts + 1 >= 5 THEN 'failed' ELSE 'queued' END
        WHERE id = ${row.id}
      `;
    }
  }
  return { sent, configured: true };
}

export const renderEmail = (kind, payload) => templates[kind](payload);
