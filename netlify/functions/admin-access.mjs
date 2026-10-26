import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { getDatabase } from '@netlify/database';
import { authoriseAdmin, logAdminAccess, notAllowlistedMessage, withMemberAccess } from './_shared/member-access.mjs';

const db = getDatabase();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Log actions that change something, as opposed to views, searches and lists.
const changeActions = [
  'add_private_note', 'mark_message_read', 'allowlist_add', 'allowlist_remove', 'allowlist_role', 'set_member_type', 'send_reminder',
  'moderate_review', 'delete_review', 'erase_prospect', 'prospect_support_status', 'prospect_withdraw_permission', 'export_member_report', 'export_prospects', 'retry_email',
];

async function listEntries(userId) {
  const rows = await db.sql`SELECT email, user_id, role, added_by, added_at, bound_at FROM member_admins ORDER BY added_at, email`;
  return rows.map(({ user_id: boundUserId, ...row }) => ({ ...row, bound: Boolean(boundUserId), isYou: boundUserId === userId }));
}

// Database admin allowlist and the admin access log. The allowlist table is
// unreachable through the restricted role, so it is read and changed here as
// the table owner, only after the caller is confirmed as an allowlisted admin.
export default async function adminAccess(request) {
  const user = await getUser();
  if (!user) return Response.json({ error: 'Please log in to continue.' }, { status: 401 });
  const callerRole = await authoriseAdmin(user);
  if (!callerRole) return Response.json({ error: (user.roles || []).includes('admin') ? notAllowlistedMessage : 'You do not have access to this area.' }, { status: 403 });

  if (request.method === 'GET') {
    const changesOnly = new URL(request.url).searchParams.get('filter') === 'changes';
    const log = await withMemberAccess(user.id, async (query) => {
      await logAdminAccess(query, user.id, null, 'view_access_log');
      return query(`
        SELECT l.id, l.admin_user_id, l.member_user_id, l.action, l.resource_type, l.detail, l.accessed_at,
          a.display_name AS admin_name, m.display_name AS member_name
        FROM questionnaire_admin_access_log l
        LEFT JOIN profiles a ON a.id = l.admin_user_id
        LEFT JOIN profiles m ON m.id = l.member_user_id
        WHERE NOT $1 OR l.action = ANY($2::text[])
        ORDER BY l.accessed_at DESC LIMIT 200
      `, [changesOnly, changeActions]);
    }, 'admin');
    return Response.json({ entries: await listEntries(user.id), log, role: callerRole }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (!['POST', 'PATCH', 'DELETE'].includes(request.method)) return Response.json({ error: 'Method not allowed.' }, { status: 405 });
  verifyRequestOrigin(request);
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!emailPattern.test(email) || email.length > 254) return Response.json({ error: 'Please enter a valid email address.' }, { status: 422 });

  if (request.method === 'PATCH') {
    // Only owners can make someone an owner or change an owner back to admin.
    if (callerRole !== 'owner') return Response.json({ error: 'Only owners can change admin and owner roles.' }, { status: 403 });
    if (!['admin', 'owner'].includes(body.role)) return Response.json({ error: 'Please choose Admin or Owner.' }, { status: 422 });
    const entry = (await listEntries(user.id)).find((item) => item.email === email);
    if (!entry) return Response.json({ error: 'That email is not on the allowlist.' }, { status: 404 });
    if (entry.isYou) return Response.json({ error: 'You cannot change your own role. Ask another owner.' }, { status: 409 });
    await db.sql`UPDATE member_admins SET role = ${body.role} WHERE email = ${email}`;
    await withMemberAccess(user.id, (query) => logAdminAccess(query, user.id, null, 'allowlist_role', 'member_admins', null, `${email} → ${body.role}`), 'admin');
    return Response.json({ entries: await listEntries(user.id) });
  }

  if (request.method === 'POST') {
    await db.sql`INSERT INTO member_admins (email, added_by) VALUES (${email}, ${user.id}) ON CONFLICT (email) DO NOTHING`;
  } else {
    const entries = await listEntries(user.id);
    const entry = entries.find((item) => item.email === email);
    if (!entry) return Response.json({ error: 'That email is not on the allowlist.' }, { status: 404 });
    if (entry.isYou) return Response.json({ error: 'You cannot remove your own admin access. Ask another authorised admin.' }, { status: 409 });
    if (entry.role === 'owner' && callerRole !== 'owner') return Response.json({ error: 'Only owners can remove an owner.' }, { status: 403 });
    await db.sql`DELETE FROM member_admins WHERE email = ${email}`;
  }
  await withMemberAccess(user.id, (query) => logAdminAccess(query, user.id, null, request.method === 'POST' ? 'allowlist_add' : 'allowlist_remove', 'member_admins', null, email), 'admin');
  return Response.json({ entries: await listEntries(user.id) });
}

export const config = { path: '/api/admin/access' };
