import { getUser } from '@netlify/identity';
import { withMemberAccess } from './_shared/member-access.mjs';

// Read-only questionnaire access for Identity users with the `admin` role.
// Every request is written to the admin access log.
export default async function adminQuestionnaires(request) {
  if (request.method !== 'GET') return Response.json({ error: 'Method not allowed.' }, { status: 405 });
  const user = await getUser();
  if (!user) return Response.json({ error: 'Please log in to continue.' }, { status: 401 });
  if (!(user.roles || []).includes('admin')) return Response.json({ error: 'You do not have access to member questionnaires.' }, { status: 403 });

  const memberId = new URL(request.url).searchParams.get('member');

  const result = await withMemberAccess(user.id, async (query) => {
    await query('INSERT INTO questionnaire_admin_access_log (admin_user_id, member_user_id) VALUES ($1, $2)', [user.id, memberId]);

    if (!memberId) {
      const members = await query(`
        SELECT p.id, p.display_name, p.marketing_consent, w.answers->>'email' AS email,
          w.completed_at, w.updated_at, h.consent_given_at,
          h.section_2_saved_at, h.section_3_saved_at, h.section_4_saved_at
        FROM profiles p
        JOIN member_welcome_details w ON w.user_id = p.id
        LEFT JOIN member_health_information h ON h.user_id = p.id
        ORDER BY GREATEST(w.updated_at, COALESCE(h.updated_at, w.updated_at)) DESC
        LIMIT 500
      `);
      return { members };
    }

    const [profile] = await query('SELECT id, display_name, marketing_consent, marketing_consented_at, marketing_withdrawn_at FROM profiles WHERE id = $1', [memberId]);
    if (!profile) return null;
    const [welcome] = await query('SELECT answers, adult_confirmed_at, completed_at, updated_at FROM member_welcome_details WHERE user_id = $1', [memberId]);
    const [health] = await query(`
      SELECT consent_name, consent_given_at, answers, section_2_saved_at, section_3_saved_at, section_4_saved_at, updated_at
      FROM member_health_information WHERE user_id = $1
    `, [memberId]);
    const consentHistory = await query('SELECT consent_type, action, recorded_name, recorded_at FROM member_consent_events WHERE user_id = $1 ORDER BY recorded_at DESC', [memberId]);
    return { member: { profile, welcome: welcome || null, health: health || null, consentHistory } };
  }, 'admin');

  if (!result) return Response.json({ error: 'Member not found.' }, { status: 404 });
  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
}

export const config = { path: '/api/admin/questionnaires' };
