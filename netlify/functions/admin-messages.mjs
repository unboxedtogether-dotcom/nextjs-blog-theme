import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { withMemberAccess } from './_shared/member-access.mjs';

// Member contact messages for Identity users with the `admin` role.
export default async function adminMessages(request) {
  const user = await getUser();
  if (!user) return Response.json({ error: 'Please log in to continue.' }, { status: 401 });
  if (!(user.roles || []).includes('admin')) return Response.json({ error: 'You do not have access to member messages.' }, { status: 403 });

  if (request.method === 'GET') {
    const messages = await withMemberAccess(user.id, (query) => query(`
      SELECT m.id, m.topic, m.message, m.reply_email, m.status, m.created_at, p.display_name
      FROM member_messages m JOIN profiles p ON p.id = m.user_id
      ORDER BY m.created_at DESC LIMIT 200
    `), 'admin');
    return Response.json({ messages }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (request.method !== 'PATCH') return Response.json({ error: 'Method not allowed.' }, { status: 405 });
  verifyRequestOrigin(request);
  const body = await request.json().catch(() => ({}));
  if (typeof body.id !== 'string') return Response.json({ error: 'Choose a message.' }, { status: 422 });
  await withMemberAccess(user.id, (query) => query("UPDATE member_messages SET status = 'read' WHERE id = $1::uuid", [body.id]), 'admin');
  return Response.json({ ok: true });
}

export const config = { path: '/api/admin/messages' };
