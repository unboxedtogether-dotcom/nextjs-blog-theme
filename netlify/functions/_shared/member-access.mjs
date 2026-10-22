import { getDatabase } from '@netlify/database';
import { checkInRows } from '../../../utils/welcome-questionnaire.mjs';

const db = getDatabase();

// Runs queries as the restricted `unboxed_member_access` role so Row Level
// Security policies apply. `role` is only ever set to 'admin' after the
// caller has checked the signed-in user's Identity roles.
export async function withMemberAccess(userId, work, role = 'member') {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE unboxed_member_access');
    await client.query("SELECT set_config('app.current_user_id', $1, TRUE), set_config('app.current_access_role', $2, TRUE)", [userId, role]);
    const query = async (text, params = []) => (await client.query(text, params)).rows;
    const result = await work(query);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export const recordConsent = (query, userId, type, action, name = null) => query(
  'INSERT INTO member_consent_events (user_id, consent_type, action, recorded_name) VALUES ($1, $2, $3, $4)',
  [userId, type, action, name],
);

export async function ensureProfile(user) {
  await db.sql`
    INSERT INTO profiles (id, display_name)
    VALUES (${user.id}, ${user.userMetadata?.full_name || user.email?.split('@')[0] || 'Member'})
    ON CONFLICT (id) DO NOTHING
  `;
}

export async function questionnaireStatus(query, userId) {
  const [welcome] = await query('SELECT completed_at, updated_at FROM member_welcome_details WHERE user_id = $1', [userId]);
  const [health] = await query(`
    SELECT consent_given_at, section_2_saved_at, section_3_saved_at, section_4_saved_at, answers
    FROM member_health_information WHERE user_id = $1
  `, [userId]);
  const answers = health?.answers || {};
  return {
    welcomeCompletedAt: welcome?.completed_at || null,
    welcomeUpdatedAt: welcome?.updated_at || null,
    healthConsentGivenAt: health?.consent_given_at || null,
    sectionSavedAt: { 2: health?.section_2_saved_at || null, 3: health?.section_3_saved_at || null, 4: health?.section_4_saved_at || null },
    checkIn: {
      baselineDate: answers.baselineDate || null,
      scores: Object.fromEntries(checkInRows.map(({ key }) => [key, answers[key] ?? null])),
    },
  };
}
