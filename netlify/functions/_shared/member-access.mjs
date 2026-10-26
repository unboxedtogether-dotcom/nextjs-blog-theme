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

// Creates the profile on first use and keeps the sign-in email in step with
// Identity, so the team area always knows who the member is. The
// verification date is only ever copied from Identity, never assumed.
// Nothing else on an existing profile is changed.
export async function ensureProfile(user) {
  const email = String(user.email || '').trim().toLowerCase();
  const accountEmail = email.length >= 3 && email.length <= 254 ? email : null;
  const verifiedAt = user.confirmedAt || null;
  await db.sql`
    INSERT INTO profiles (id, display_name, account_email, email_verified_at, identity_synced_at)
    VALUES (${user.id}, ${user.userMetadata?.full_name || user.email?.split('@')[0] || 'Member'}, ${accountEmail}, ${verifiedAt}, NOW())
    ON CONFLICT (id) DO UPDATE SET
      account_email = COALESCE(EXCLUDED.account_email, profiles.account_email),
      email_verified_at = COALESCE(profiles.email_verified_at, EXCLUDED.email_verified_at),
      identity_synced_at = NOW()
    WHERE (EXCLUDED.account_email IS NOT NULL AND profiles.account_email IS DISTINCT FROM EXCLUDED.account_email)
      OR (profiles.email_verified_at IS NULL AND EXCLUDED.email_verified_at IS NOT NULL)
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

export const notAllowlistedMessage = 'Your account has the Identity admin role but is not on the database admin allowlist, so member records stay locked. Ask an authorised admin to add your email in Team area → Admin access.';

// Admin access needs the Identity `admin` role AND a database allowlist entry.
// An allowlist entry added by email is bound to the Identity user id the first
// time an Identity admin with that email signs in; after that only the id counts.
// Resolves to the allowlist role ('admin' or 'owner') when authorised, else false.
export async function authoriseAdmin(user) {
  if (!user || !(user.roles || []).includes('admin')) return false;
  const email = (user.email || '').trim().toLowerCase();
  if (email) {
    await db.sql`
      UPDATE member_admins SET user_id = ${user.id}, bound_at = NOW()
      WHERE email = ${email} AND user_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM member_admins WHERE user_id = ${user.id})
    `;
  }
  const [entry] = await db.sql`SELECT role FROM member_admins WHERE user_id = ${user.id}`;
  return entry ? entry.role : false;
}

// Must run inside withMemberAccess(..., 'admin'); RLS only accepts the
// signed-in, allowlisted admin's own id.
export const logAdminAccess = (query, adminId, memberId, action, resourceType = null, resourceId = null, detail = null) => query(
  'INSERT INTO questionnaire_admin_access_log (admin_user_id, member_user_id, action, resource_type, resource_id, detail) VALUES ($1, $2, $3, $4, $5, $6)',
  [adminId, memberId, action, resourceType, resourceId, detail],
);
