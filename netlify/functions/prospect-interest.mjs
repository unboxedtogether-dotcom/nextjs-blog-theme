import { createHash } from 'node:crypto';
import { verifyRequestOrigin } from '@netlify/identity';
import { cleanProspectSubmission } from '../../utils/prospect-questionnaire.mjs';
import { deliverQueuedEmails, queueEmail, siteUrl } from './_shared/email.mjs';
import { emailSuppressed, isUuid, recentAttempts, saveProspect } from './_shared/prospect-store.mjs';
import { attributeProspect } from './_shared/referrals.mjs';

const noStore = { 'Cache-Control': 'no-store' };
const MIN_FILL_MS = 5000;

// Rotates daily so the stored value cannot be used to track a visitor over time.
function submitterHash(request, context) {
  const ip = context?.ip || request.headers.get('x-nf-client-connection-ip') || 'unknown';
  const day = new Date().toISOString().slice(0, 10);
  return createHash('sha256').update(`${day}:prospect:${process.env.SITE_ID || 'unboxed'}:${ip}`).digest('hex');
}

// Public interest questionnaire. No login and no account is created: the
// answers are stored as a prospect record only. The response never echoes
// any answers back.
export default async function prospectInterest(request, context) {
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: { Allow: 'POST', ...noStore } });
  try {
    verifyRequestOrigin(request);
  } catch {
    return Response.json({ error: 'This request could not be accepted.' }, { status: 403, headers: noStore });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Please complete the questionnaire.' }, { status: 400, headers: noStore });
  if (!isUuid(body.idempotencyKey)) return Response.json({ error: 'Please reload the page and try again.' }, { status: 400, headers: noStore });

  // Hidden honeypot field and a minimum time on the form. Bots get the normal
  // response so they learn nothing, but nothing is stored.
  const startedAt = Number(body.startedAt);
  if (body.website || !Number.isFinite(startedAt) || Date.now() - startedAt < MIN_FILL_MS) {
    return Response.json({ ok: true, contactRequested: false, marketingPending: false }, { status: 201, headers: noStore });
  }

  const { values, error } = cleanProspectSubmission(body);
  if (error) return Response.json({ error }, { status: 422, headers: noStore });

  const hash = submitterHash(request, context);
  try {
    const counts = await recentAttempts(hash, values.email);
    if (counts.per_hour >= 5 || counts.per_day >= 20 || counts.per_email >= 3) {
      return Response.json({ error: 'We have received several submissions from you recently. Please try again later.' }, { status: 429, headers: noStore });
    }

    // People who asked to be erased or unsubscribed are not signed up again
    // silently; their answers are still welcome but without contact permissions.
    if (values.email && await emailSuppressed(values.email)) {
      const resubscribing = values.permissions.project_contact || values.permissions.general_marketing;
      if (!resubscribing) values.email = null;
    }

    const saved = await saveProspect(values, { idempotencyKey: body.idempotencyKey, submitterHash: hash });
    // Came from a member's invitation link: credit that invitation.
    if (!saved.duplicate && saved.prospectId && body.referralToken) {
      await attributeProspect(String(body.referralToken), saved.prospectId).catch((refError) => console.error('Referral not linked', refError.message));
    }
    const contactRequested = values.permissions.project_contact;
    const marketingPending = values.permissions.general_marketing;

    // Confirmation only where the person gave a contact permission.
    if (!saved.duplicate && saved.manageToken && (contactRequested || marketingPending)) {
      const id = await queueEmail({
        kind: 'interest_confirmation',
        to: values.email,
        prospectId: saved.prospectId,
        payload: { firstName: values.firstName, manageUrl: `${siteUrl()}/join-us/preferences#token=${saved.manageToken}`, marketingPending },
      });
      if (id) await deliverQueuedEmails({ ids: [id] }).catch((sendError) => console.error('Interest confirmation not sent', sendError.message));
    }

    return Response.json({ ok: true, contactRequested, marketingPending }, { status: 201, headers: noStore });
  } catch (saveError) {
    console.error('Saving prospect failed', saveError.message);
    return Response.json({ error: 'Your answers could not be saved just now. Please try again shortly.' }, { status: 500, headers: noStore });
  }
}

export const config = { path: '/api/prospect' };
