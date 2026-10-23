import { getDatabase } from '@netlify/database';
import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { authoriseAdmin, notAllowlistedMessage } from './_shared/member-access.mjs';

const db = getDatabase();
const query = async (text, params = []) => (await db.pool.query(text, params)).rows;
const statuses = ['pending', 'approved', 'rejected', 'removed'];
const uuidPattern = /^[0-9a-f-]{36}$/i;

// Book review moderation for allowlisted admins (Identity `admin` role plus the database allowlist),
// because the moderation list includes reviewers' email addresses.
// Moderators change publication status only; review text and ratings are never edited.
export default async function adminReviews(request) {
  const user = await getUser();
  if (!user) return Response.json({ error: 'Please log in to continue.' }, { status: 401 });
  if (!(user.roles || []).includes('admin')) return Response.json({ error: 'You do not have access to book reviews.' }, { status: 403 });
  if (!(await authoriseAdmin(user))) return Response.json({ error: notAllowlistedMessage }, { status: 403 });

  if (request.method === 'GET') {
    const reviews = await query(`
      SELECT id, display_name, email, rating, headline, body, purchase_location, member_user_id IS NOT NULL AS from_member,
        status, created_at, published_at, moderated_at, moderated_by
      FROM book_reviews ORDER BY (status = 'pending') DESC, created_at DESC LIMIT 500
    `);
    return Response.json({ reviews }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (!['PATCH', 'DELETE'].includes(request.method)) return Response.json({ error: 'Method not allowed.' }, { status: 405 });
  try {
    verifyRequestOrigin(request);
  } catch {
    return Response.json({ error: 'This request could not be accepted.' }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  if (typeof body.id !== 'string' || !uuidPattern.test(body.id)) return Response.json({ error: 'Choose a review.' }, { status: 422 });

  // Permanent deletion is limited to rejected reviews (for example spam), so genuine feedback is kept.
  if (request.method === 'DELETE') {
    const rows = await query("DELETE FROM book_reviews WHERE id = $1::uuid AND status = 'rejected' RETURNING id", [body.id]);
    if (!rows.length) return Response.json({ error: 'Only rejected reviews can be deleted.' }, { status: 409 });
    return Response.json({ ok: true });
  }

  if (!statuses.includes(body.status)) return Response.json({ error: 'Choose a valid status.' }, { status: 422 });
  const [review] = await query(`
    UPDATE book_reviews SET
      status = $2,
      published_at = CASE WHEN $2 = 'approved' THEN COALESCE(published_at, NOW()) ELSE published_at END,
      moderated_at = NOW(),
      moderated_by = $3
    WHERE id = $1::uuid
    RETURNING id, status, published_at, moderated_at, moderated_by
  `, [body.id, body.status, user.email || user.id]);
  if (!review) return Response.json({ error: 'That review no longer exists.' }, { status: 404 });
  return Response.json({ ok: true, review });
}

export const config = { path: '/api/admin/reviews' };
