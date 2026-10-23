import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { getDatabase } from '@netlify/database';
import { authoriseAdmin, logAdminAccess, notAllowlistedMessage, withMemberAccess } from './_shared/member-access.mjs';
import { assignableMemberTypes, resolveMemberType } from '../../utils/member-types.mjs';

const db = getDatabase();
const noStore = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };

async function listMembers(query) {
  const members = await query(`
    SELECT p.id, p.display_name, w.answers->>'email' AS email, p.membership_tier, p.is_moderator, p.created_at
    FROM profiles p LEFT JOIN member_welcome_details w ON w.user_id = p.id
    ORDER BY p.display_name, p.created_at
    LIMIT 500
  `);
  // The allowlist is unreachable through the restricted role, so it is read as the table owner.
  const admins = await db.sql`SELECT user_id, role FROM member_admins WHERE user_id IS NOT NULL`;
  const adminRoles = new Map(admins.map((row) => [row.user_id, row.role]));
  return members.map(({ membership_tier: membershipTier, is_moderator: isModerator, ...row }) => ({
    ...row,
    memberType: resolveMemberType({ membershipTier, isModerator, adminRole: adminRoles.get(row.id) || null }),
    managedByAllowlist: adminRoles.has(row.id),
  }));
}

// Member type assignment for allowlisted administrators. Free, Subscribed and
// Moderator are set here; Admin and Owner come from the admin allowlist.
export default async function adminMemberTypes(request) {
  const user = await getUser();
  if (!user) return Response.json({ error: 'Please log in to continue.' }, { status: 401 });
  if (!(await authoriseAdmin(user))) return Response.json({ error: (user.roles || []).includes('admin') ? notAllowlistedMessage : 'You do not have access to this area.' }, { status: 403 });

  if (request.method === 'GET') {
    const members = await withMemberAccess(user.id, async (query) => {
      await logAdminAccess(query, user.id, null, 'list_member_types');
      return listMembers(query);
    }, 'admin');
    return Response.json({ members }, { headers: noStore });
  }

  if (request.method !== 'PUT') return Response.json({ error: 'Method not allowed.' }, { status: 405 });
  verifyRequestOrigin(request);
  const body = await request.json().catch(() => ({}));
  const memberId = typeof body.member === 'string' ? body.member : '';
  if (!assignableMemberTypes.includes(body.memberType)) return Response.json({ error: 'Please choose Free Member, Subscribed Member or Moderator.' }, { status: 422 });

  const [profile] = await db.sql`SELECT id FROM profiles WHERE id = ${memberId}`;
  if (!profile) return Response.json({ error: 'Member not found.' }, { status: 404 });
  const [admin] = await db.sql`SELECT 1 FROM member_admins WHERE user_id = ${memberId}`;
  if (admin) return Response.json({ error: 'Admins and owners are managed in Admin access.' }, { status: 409 });

  const isModerator = body.memberType === 'moderator';
  await db.sql`
    UPDATE profiles SET is_moderator = ${isModerator},
      membership_tier = CASE WHEN ${isModerator} THEN membership_tier ELSE ${body.memberType} END,
      updated_at = NOW()
    WHERE id = ${memberId}
  `;
  const members = await withMemberAccess(user.id, async (query) => {
    await logAdminAccess(query, user.id, memberId, 'set_member_type', 'profile', memberId, body.memberType);
    return listMembers(query);
  }, 'admin');
  return Response.json({ members }, { headers: noStore });
}

export const config = { path: '/api/admin/member-types' };
