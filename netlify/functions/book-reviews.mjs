import { createHash } from 'node:crypto';
import { getDatabase } from '@netlify/database';
import { getUser, verifyRequestOrigin } from '@netlify/identity';

const db = getDatabase();
const query = async (text, params = []) => (await db.pool.query(text, params)).rows;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const limits = { name: 80, email: 254, headline: 120, body: 5000, purchase: 120 };
const MIN_FILL_MS = 4000;
const thankYou = 'Thank you for sharing your thoughts about Unboxed. Your review has been received and will be checked before appearing on our website.';

// Public fields only. Email addresses, purchase location and moderation details never leave the server here.
const publicReview = (row) => ({
  id: row.id,
  name: row.display_name,
  rating: row.rating,
  headline: row.headline,
  text: row.body,
  date: row.published_at,
});

const clean = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const cleanBody = (value) => String(value ?? '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

// Rotates daily so the stored value cannot be used to track a visitor over time.
function submitterHash(request, context) {
  const ip = context?.ip || request.headers.get('x-nf-client-connection-ip') || 'unknown';
  const day = new Date().toISOString().slice(0, 10);
  return createHash('sha256').update(`${day}:${process.env.SITE_ID || 'unboxed'}:${ip}`).digest('hex');
}

function validate(body) {
  const values = {
    name: clean(body.name, limits.name + 1),
    email: clean(body.email, limits.email + 1).toLowerCase(),
    rating: Number(body.rating),
    headline: clean(body.headline, limits.headline + 1),
    body: cleanBody(body.review),
    purchase: clean(body.purchaseLocation, limits.purchase + 1),
    consent: body.consent === true,
  };
  if (!values.name) return { error: 'Please enter your name or a display name.' };
  if (values.name.length > limits.name) return { error: `Please keep your name under ${limits.name} characters.` };
  if (!emailPattern.test(values.email) || values.email.length > limits.email) return { error: 'Please enter a valid email address.' };
  if (!Number.isInteger(values.rating) || values.rating < 1 || values.rating > 5) return { error: 'Please choose a star rating from 1 to 5.' };
  if (!values.headline) return { error: 'Please add a short headline for your review.' };
  if (values.headline.length > limits.headline) return { error: `Please keep your headline under ${limits.headline} characters.` };
  if (values.body.length < 10) return { error: 'Please write a little more about your experience of the book.' };
  if (values.body.length > limits.body) return { error: 'Please keep your review under 5,000 characters.' };
  if (values.purchase.length > limits.purchase) return { error: `Please keep where you bought the book under ${limits.purchase} characters.` };
  if (!values.consent) return { error: 'Please tick the box to agree to your review and display name being published.' };
  return { values };
}

export default async function bookReviews(request, context) {
  if (request.method === 'GET') {
    try {
      const rows = await query(`
        SELECT id, display_name, rating, headline, body, published_at
        FROM book_reviews WHERE status = 'approved'
        ORDER BY published_at DESC NULLS LAST LIMIT 50
      `);
      return Response.json({ reviews: rows.map(publicReview) }, { headers: { 'Cache-Control': 'public, max-age=60' } });
    } catch (error) {
      console.error('Loading reviews failed', error);
      return Response.json({ reviews: [] }, { status: 500 });
    }
  }

  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: { Allow: 'GET, POST' } });

  try {
    verifyRequestOrigin(request);
  } catch {
    return Response.json({ error: 'This request could not be accepted.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Please complete the review form.' }, { status: 400 });

  // Spam protection: hidden honeypot field and a minimum time on the form.
  // Bots get the normal confirmation so they learn nothing, but nothing is stored.
  const startedAt = Number(body.startedAt);
  if (body.website || !Number.isFinite(startedAt) || Date.now() - startedAt < MIN_FILL_MS) {
    return Response.json({ ok: true, message: thankYou }, { status: 201 });
  }

  const { values, error } = validate(body);
  if (error) return Response.json({ error }, { status: 422 });

  const hash = submitterHash(request, context);
  const user = await getUser().catch(() => null);

  try {
    const [recent] = await query(`
      SELECT
        count(*) FILTER (WHERE submitter_hash = $1 AND created_at > NOW() - INTERVAL '1 hour')::int AS per_hour,
        count(*) FILTER (WHERE submitter_hash = $1 AND created_at > NOW() - INTERVAL '1 day')::int AS per_day,
        count(*) FILTER (WHERE lower(email) = $2 AND created_at > NOW() - INTERVAL '1 day')::int AS per_email
      FROM book_reviews WHERE created_at > NOW() - INTERVAL '1 day'
    `, [hash, values.email]);
    if (recent.per_hour >= 3 || recent.per_day >= 6 || recent.per_email >= 3) {
      return Response.json({ error: 'You have sent several reviews recently. Please try again a little later.' }, { status: 429 });
    }

    await query(`
      INSERT INTO book_reviews
        (display_name, email, rating, headline, body, purchase_location, publication_consent, member_user_id, submitter_hash)
      VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, $8)
    `, [values.name, values.email, values.rating, values.headline, values.body, values.purchase || null, user?.id || null, hash]);
  } catch (dbError) {
    console.error('Saving review failed', dbError);
    return Response.json({ error: 'Your review could not be sent just now. Please try again shortly.' }, { status: 500 });
  }

  return Response.json({ ok: true, message: thankYou }, { status: 201 });
}

export const config = { path: '/api/reviews' };
