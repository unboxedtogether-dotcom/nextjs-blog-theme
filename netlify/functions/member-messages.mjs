import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { messageTopics } from '../../utils/member-options.mjs';
import { ensureProfile, withMemberAccess } from './_shared/member-access.mjs';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Private member-to-team messages. Stored in Netlify Database only and read by
// the team on the restricted admin page; nothing is emailed.
export default async function memberMessages(request) {
  const user = await getUser();
  if (!user) return Response.json({ error: 'Please log in to continue.' }, { status: 401 });

  if (request.method === 'GET') {
    const messages = await withMemberAccess(user.id, (query) => query(
      'SELECT id, topic, message, status, created_at FROM member_messages WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
      [user.id],
    ));
    return Response.json({ messages }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed.' }, { status: 405 });
  verifyRequestOrigin(request);
  await ensureProfile(user);
  const body = await request.json().catch(() => ({}));

  const topic = messageTopics.includes(body.topic) ? body.topic : messageTopics[0];
  const message = String(body.message || '').trim();
  const replyEmail = String(body.replyEmail || user.email || '').trim().slice(0, 254);
  if (!message) return Response.json({ error: 'Please write your message.' }, { status: 422 });
  if (message.length > 5000) return Response.json({ error: 'Please keep your message under 5,000 characters.' }, { status: 422 });
  if (!emailPattern.test(replyEmail)) return Response.json({ error: 'Please enter a valid email address for our reply.' }, { status: 422 });

  const result = await withMemberAccess(user.id, async (query) => {
    const [recent] = await query("SELECT count(*)::int AS count FROM member_messages WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 hour'", [user.id]);
    if (recent.count >= 5) return null;
    const [saved] = await query(
      'INSERT INTO member_messages (user_id, topic, message, reply_email) VALUES ($1, $2, $3, $4) RETURNING id, topic, message, status, created_at',
      [user.id, topic, message, replyEmail],
    );
    return saved;
  });
  if (!result) return Response.json({ error: 'You have sent several messages recently. Please try again a little later.' }, { status: 429 });
  return Response.json({ ok: true, message: result }, { status: 201 });
}

export const config = { path: '/api/member/messages' };
