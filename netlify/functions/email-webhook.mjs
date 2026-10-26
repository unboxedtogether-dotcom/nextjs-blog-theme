import { createHmac, timingSafeEqual } from 'node:crypto';
import { applyProviderEvent } from './_shared/email.mjs';

const TOLERANCE_SECONDS = 5 * 60;

// Resend signs webhooks the Svix way: HMAC-SHA256 over "id.timestamp.body"
// with the base64 secret after its "whsec_" prefix.
export function verifySignature({ secret, id, timestamp, signatures, body, now = Date.now() }) {
  if (!secret || !id || !timestamp || !signatures) return false;
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(now / 1000 - seconds) > TOLERANCE_SECONDS) return false;
  let key;
  try {
    key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  } catch {
    return false;
  }
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest();
  return signatures.split(' ').some((part) => {
    const [version, value] = part.split(',');
    if (version !== 'v1' || !value) return false;
    const given = Buffer.from(value, 'base64');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

// Delivery, bounce and complaint events from the email provider. Without the
// signing secret every request is refused, so nobody can fake a status.
export default async function emailWebhook(request) {
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed.' }, { status: 405 });
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: 'Webhook not configured.' }, { status: 503 });
  const body = await request.text();
  const ok = verifySignature({
    secret,
    id: request.headers.get('svix-id'),
    timestamp: request.headers.get('svix-timestamp'),
    signatures: request.headers.get('svix-signature'),
    body,
  });
  if (!ok) return Response.json({ error: 'Invalid signature.' }, { status: 401 });

  let event;
  try {
    event = JSON.parse(body);
  } catch {
    return Response.json({ error: 'Invalid body.' }, { status: 400 });
  }
  const data = event?.data || {};
  const bounce = data.bounce ? [data.bounce.type, data.bounce.subType, data.bounce.message].filter(Boolean).join(' – ') : null;
  const result = await applyProviderEvent({
    type: String(event?.type || ''),
    providerEventId: request.headers.get('svix-id'),
    messageId: typeof data.email_id === 'string' ? data.email_id : null,
    occurredAt: typeof event?.created_at === 'string' ? event.created_at : null,
    detail: bounce || (data.failed?.reason ? String(data.failed.reason) : null),
  });
  return Response.json({ ok: true, matched: result.matched });
}

export const config = { path: '/api/email/webhook' };
