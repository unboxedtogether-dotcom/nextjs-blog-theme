import { getDatabase } from '@netlify/database';
import { getUser } from '@netlify/identity';

const db = getDatabase();

export async function getMember() {
  const user = await getUser();
  if (!user) return null;

  await db.sql`
    INSERT INTO profiles (id, display_name)
    VALUES (${user.id}, ${user.userMetadata?.full_name || user.email?.split('@')[0] || 'Member'})
    ON CONFLICT (id) DO NOTHING
  `;

  const profiles = await db.sql`
    SELECT id, display_name, onboarding_completed, marketing_consent
    FROM profiles WHERE id = ${user.id} LIMIT 1
  `;

  return { user, profile: profiles[0] };
}

export async function getBaseline(userId) {
  const rows = await db.sql`
    SELECT improvement_goals, general_wellbeing_score, energy_score, focus_score,
      sleep_score, digestion_score, ingredient_list_exposure, barriers, desired_features,
      submitted_at, updated_at
    FROM member_baselines WHERE user_id = ${userId} LIMIT 1
  `;
  return rows[0] || null;
}

export { db };
