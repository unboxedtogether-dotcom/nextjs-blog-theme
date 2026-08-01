import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { getDatabase } from '@netlify/database';

const db = getDatabase();
const allowedExposure = ['Almost all of it', 'Most of it', 'About half', 'Not much', 'Hardly any', 'I am not sure'];
const score = (value, nullable = false) => value === null && nullable ? null : Number(value);
const validScore = (value, nullable = false) => (nullable && value === null) || Number.isInteger(value) && value >= 1 && value <= 5;
const list = (value, max) => Array.isArray(value) ? value.filter((item) => typeof item === 'string').slice(0, max) : [];

export default async function memberData(request) {
  const user = await getUser();
  if (!user) return Response.json({ error: 'Please log in to continue.' }, { status: 401 });

  if (request.method === 'GET') {
    await db.sql`
      INSERT INTO profiles (id, display_name)
      VALUES (${user.id}, ${user.userMetadata?.full_name || user.email?.split('@')[0] || 'Member'})
      ON CONFLICT (id) DO NOTHING
    `;
    const profiles = await db.sql`SELECT display_name, onboarding_completed, marketing_consent FROM profiles WHERE id = ${user.id} LIMIT 1`;
    const baselines = await db.sql`
      SELECT improvement_goals, general_wellbeing_score, energy_score, focus_score, sleep_score,
        digestion_score, ingredient_list_exposure, barriers, desired_features, submitted_at, updated_at
      FROM member_baselines WHERE user_id = ${user.id} LIMIT 1
    `;
    return Response.json({ profile: profiles[0] || null, baseline: baselines[0] || null });
  }

  if (request.method !== 'PUT') return Response.json({ error: 'Method not allowed.' }, { status: 405 });
  verifyRequestOrigin(request);
  const body = await request.json();

  if (body.profile) {
    const displayName = String(body.profile.displayName || '').trim().slice(0, 80);
    if (!displayName) return Response.json({ error: 'Please enter your name.' }, { status: 422 });
    await db.sql`UPDATE profiles SET display_name = ${displayName}, updated_at = NOW() WHERE id = ${user.id}`;
  }

  if (body.baseline) {
    const baseline = body.baseline;
    const wellbeing = score(baseline.generalWellbeingScore);
    const energy = score(baseline.energyScore);
    const focus = score(baseline.focusScore);
    const sleep = score(baseline.sleepScore);
    const digestion = score(baseline.digestionScore, true);
    if (![wellbeing, energy, focus, sleep].every((value) => validScore(value)) || !validScore(digestion, true)) {
      return Response.json({ error: 'Please answer each wellbeing question.' }, { status: 422 });
    }
    if (!allowedExposure.includes(baseline.ingredientListExposure)) {
      return Response.json({ error: 'Please choose an ingredient-list answer.' }, { status: 422 });
    }

    await db.sql`
      INSERT INTO member_baselines (
        user_id, improvement_goals, general_wellbeing_score, energy_score, focus_score,
        sleep_score, digestion_score, ingredient_list_exposure, barriers, desired_features
      ) VALUES (
        ${user.id}, ${list(baseline.improvementGoals, 3)}, ${wellbeing}, ${energy}, ${focus},
        ${sleep}, ${digestion}, ${baseline.ingredientListExposure}, ${list(baseline.barriers, 3)},
        ${list(baseline.desiredFeatures, 3)}
      )
      ON CONFLICT (user_id) DO UPDATE SET
        improvement_goals = EXCLUDED.improvement_goals,
        general_wellbeing_score = EXCLUDED.general_wellbeing_score,
        energy_score = EXCLUDED.energy_score,
        focus_score = EXCLUDED.focus_score,
        sleep_score = EXCLUDED.sleep_score,
        digestion_score = EXCLUDED.digestion_score,
        ingredient_list_exposure = EXCLUDED.ingredient_list_exposure,
        barriers = EXCLUDED.barriers,
        desired_features = EXCLUDED.desired_features,
        updated_at = NOW()
    `;
    await db.sql`UPDATE profiles SET onboarding_completed = TRUE, updated_at = NOW() WHERE id = ${user.id}`;
  }

  return Response.json({ ok: true });
}

export const config = { path: '/api/member' };
