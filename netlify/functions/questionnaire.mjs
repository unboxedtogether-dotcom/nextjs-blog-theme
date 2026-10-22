import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { getDatabase } from '@netlify/database';
import { cleanSectionAnswers } from '../../utils/welcome-questionnaire.mjs';
import { ensureProfile, recordConsent, withMemberAccess } from './_shared/member-access.mjs';

const db = getDatabase();
const savedColumns = { 2: 'section_2_saved_at', 3: 'section_3_saved_at', 4: 'section_4_saved_at' };


async function withdrawHealthConsent(query, userId) {
  const removed = await query('DELETE FROM member_health_information WHERE user_id = $1 RETURNING consent_name', [userId]);
  if (removed.length) await recordConsent(query, userId, 'health_information', 'withdrawn', removed[0].consent_name);
  return removed.length > 0;
}

async function loadQuestionnaire(query, user) {
  const [profile] = await query('SELECT display_name, marketing_consent FROM profiles WHERE id = $1', [user.id]);
  const [welcome] = await query('SELECT answers, completed_at, updated_at FROM member_welcome_details WHERE user_id = $1', [user.id]);
  const [health] = await query(`
    SELECT consent_name, consent_given_at, answers, section_2_saved_at, section_3_saved_at, section_4_saved_at
    FROM member_health_information WHERE user_id = $1
  `, [user.id]);
  return {
    profile: { displayName: profile?.display_name || '', marketingConsent: profile?.marketing_consent === true },
    accountEmail: user.email || '',
    welcome: welcome ? { answers: welcome.answers, completedAt: welcome.completed_at, updatedAt: welcome.updated_at } : null,
    health: health ? {
      consentName: health.consent_name,
      consentGivenAt: health.consent_given_at,
      answers: health.answers,
      sectionSavedAt: { 2: health.section_2_saved_at, 3: health.section_3_saved_at, 4: health.section_4_saved_at },
    } : null,
  };
}

async function saveWelcome(query, user, input) {
  const { values, error } = cleanSectionAnswers(1, input);
  if (error) return { status: 422, error };
  if (!values.preferredName) return { status: 422, error: 'Please enter the name you would like us to use.' };
  if (!values.email) return { status: 422, error: 'Please enter your email address.' };
  if (!values.adultConfirmed) return { status: 422, error: 'Please confirm you are aged 18 or over to set up an adult membership.' };

  await query(`
    INSERT INTO member_welcome_details (user_id, answers, adult_confirmed_at)
    VALUES ($1, $2::jsonb, NOW())
    ON CONFLICT (user_id) DO UPDATE SET answers = EXCLUDED.answers, updated_at = NOW()
  `, [user.id, JSON.stringify(values)]);

  const [profile] = await query('SELECT marketing_consent FROM profiles WHERE id = $1', [user.id]);
  const wantsMarketing = input.marketingConsent === true;
  if (wantsMarketing !== (profile?.marketing_consent === true)) {
    await query(`
      UPDATE profiles SET marketing_consent = $2,
        marketing_consented_at = CASE WHEN $2 THEN NOW() ELSE marketing_consented_at END,
        marketing_withdrawn_at = CASE WHEN $2 THEN NULL ELSE NOW() END
      WHERE id = $1
    `, [user.id, wantsMarketing]);
    await recordConsent(query, user.id, 'marketing_email', wantsMarketing ? 'given' : 'withdrawn', values.preferredName);
  }
  await query('UPDATE profiles SET display_name = $2, onboarding_completed = TRUE, updated_at = NOW() WHERE id = $1', [user.id, values.preferredName.slice(0, 80)]);
  return { status: 200 };
}

async function saveHealthSection(query, user, section, input, healthConsent) {
  const [existing] = await query('SELECT consent_given_at FROM member_health_information WHERE user_id = $1', [user.id]);

  if (section === 2 && !healthConsent) {
    const withdrawn = await withdrawHealthConsent(query, user.id);
    return { status: 200, body: { healthConsent: false, withdrawn } };
  }
  if (section !== 2 && !existing) {
    return { status: 403, error: 'Please tick the consent box on page 2 before completing pages 3 and 4.' };
  }

  const { values, error } = cleanSectionAnswers(section, input);
  if (error) return { status: 422, error };

  if (!existing) {
    const [profile] = await query('SELECT display_name FROM profiles WHERE id = $1', [user.id]);
    const consentName = profile?.display_name || user.email || '';
    await query('INSERT INTO member_health_information (user_id, consent_name) VALUES ($1, $2)', [user.id, consentName]);
    await recordConsent(query, user.id, 'health_information', 'given', consentName);
  }
  await query(`
    UPDATE member_health_information
    SET answers = answers || $2::jsonb, ${savedColumns[section]} = NOW(), updated_at = NOW()
    WHERE user_id = $1
  `, [user.id, JSON.stringify(values)]);
  return { status: 200, body: { healthConsent: true } };
}

export default async function questionnaire(request) {
  const user = await getUser();
  if (!user) return Response.json({ error: 'Please log in to continue.' }, { status: 401 });
  await ensureProfile(user);

  if (request.method === 'GET') {
    return Response.json(await withMemberAccess(user.id, (query) => loadQuestionnaire(query, user)), { headers: { 'Cache-Control': 'no-store' } });
  }

  if (!['PUT', 'DELETE'].includes(request.method)) return Response.json({ error: 'Method not allowed.' }, { status: 405 });
  verifyRequestOrigin(request);
  const body = await request.json().catch(() => ({}));

  if (request.method === 'DELETE') {
    if (!['health', 'all'].includes(body.scope)) return Response.json({ error: 'Choose which answers to delete.' }, { status: 422 });
    await withMemberAccess(user.id, async (query) => {
      await withdrawHealthConsent(query, user.id);
      if (body.scope === 'all') await query('DELETE FROM member_welcome_details WHERE user_id = $1', [user.id]);
    });
    if (body.scope === 'all') {
      await db.sql`DELETE FROM member_baselines WHERE user_id = ${user.id}`;
      await db.sql`UPDATE profiles SET onboarding_completed = FALSE, updated_at = NOW() WHERE id = ${user.id}`;
    }
    return Response.json({ ok: true });
  }

  const section = Number(body.section);
  if (![1, 2, 3, 4].includes(section)) return Response.json({ error: 'Unknown questionnaire page.' }, { status: 422 });
  const answers = body.answers && typeof body.answers === 'object' ? body.answers : {};

  const result = await withMemberAccess(user.id, async (query) => {
    if (section !== 1) {
      const [welcome] = await query('SELECT 1 FROM member_welcome_details WHERE user_id = $1', [user.id]);
      if (!welcome) return { status: 409, error: 'Please complete page 1 first.' };
      return saveHealthSection(query, user, section, answers, body.healthConsent === true);
    }
    return saveWelcome(query, user, answers);
  });

  if (result.error) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ ok: true, ...result.body });
}

export const config = { path: '/api/questionnaire' };
