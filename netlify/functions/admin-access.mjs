import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { getDatabase } from '@netlify/database';
import { authoriseAdmin, logAdminAccess, notAllowlistedMessage, withMemberAccess } from './_shared/member-access.mjs';

const db = getDatabase();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function listEntries(userId) {
  const rows = await db.sql`SELECT email, user_id, added_by, added_at, bound_at FROM member_admins ORDER BY added_at, email`;
  return rows.map(({ user_id: boundUserId, ...row }) => ({ ...row, bound: Boolean(boundUserId), isYou: boundUserId === userId }));
}

// Database admin allowlist and the admin access log. The allowlist table is
// unreachable through the restricted role, so it is read and changed here as
// the table owner, only after the caller is confirmed as an allowlisted admin.
export default async function adminAccess(request) {
  const user = await getUser();
  if (!user) return Response.json({ error: 'Please log in to continue.' }, { status: 401 });
  if (!(await authoriseAdmin(user))) return Response.json({ error: (user.roles || []).includes('admin') ? notAllowlistedMessage : 'You do not have access to this area.' }, { status: 403 });

  if (request.method === 'GET') {
    const log = await withMemberAccess(user.id, async (query) => {
      await logAdminAccess(query, user.id, null, 'view_access_log');
      return query(`
        SELECT l.id, l.admin_user_id, l.member_user_id, l.action, l.resource_type, l.detail, l.accessed_at,
          a.display_name AS admin_name, m.display_name AS member_name
        FROM questionnaire_admin_access_log l
        LEFT JOIN profiles a ON a.id = l.admin_user_id
        LEFT JOIN profiles m ON m.id = l.member_user_id
        ORDER BY l.accessed_at DESC LIMIT 200
      `);
    }, 'admin');
    return Response.json({ entries: await listEntries(user.id), log }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (!['POST', 'DELETE'].includes(request.method)) return Response.json({ error: 'Method not allowed.' }, { status: 405 });
  verifyRequestOrigin(request);
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!emailPattern.test(email) || email.length > 254) return Response.json({ error: 'Please enter a valid email address.' }, { status: 422 });

  if (request.method === 'POST') {
    await db.sql`INSERT INTO member_admins (email, added_by) VALUES (${email}, ${user.id}) ON CONFLICT (email) DO NOTHING`;
  } else {
    const entries = await listEntries(user.id);
    const entry = entries.find((item) => item.email === email);
    if (!entry) return Response.json({ error: 'That email is not on the allowlist.' }, { status: 404 });
    if (entry.isYou) return Response.json({ error: 'You cannot remove your own admin access. Ask another authorised admin.' }, { status: 409 });
    await db.sql`DELETE FROM member_admins WHERE email = ${email}`;
  }
  await withMemberAccess(user.id, (query) => logAdminAccess(query, user.id, null, request.method === 'POST' ? 'allowlist_add' : 'allowlist_remove', 'member_admins', null, email), 'admin');
  return Response.json({ entries: await listEntries(user.id) });
}

export const config = { path: '/api/admin/access' };
