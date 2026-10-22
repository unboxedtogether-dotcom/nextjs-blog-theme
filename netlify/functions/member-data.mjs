import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { bioLimit } from '../../utils/member-options.mjs';
import { cleanSectionAnswers } from '../../utils/welcome-questionnaire.mjs';
import { ensureProfile, questionnaireStatus, recordConsent, withMemberAccess } from './_shared/member-access.mjs';

async function loadMember(query, user) {
  const [profile] = await query(`
    SELECT p.display_name, p.onboarding_completed, p.marketing_consent, p.marketing_consented_at, p.bio,
      p.avatar_updated_at, p.membership_tier, t.name AS membership_tier_name, p.membership_status,
      p.membership_started_at, p.created_at
    FROM profiles p JOIN membership_tiers t ON t.id = p.membership_tier
    WHERE p.id = $1
  `, [user.id]);
  const [welcome] = await query('SELECT answers FROM member_welcome_details WHERE user_id = $1', [user.id]);
  const answers = welcome?.answers || {};
  return {
    profile: profile || null,
    // Interests, reasons and contact details are the member's own page 1 answers,
    // edited in place so there is only one copy of each.
    about: { interests: answers.enjoys || '', reasons: answers.reasons || [], town: answers.town || '', phone: answers.phone || '' },
    questionnaire: await questionnaireStatus(query, user.id),
  };
}

async function saveProfile(query, user, input) {
  const displayName = String(input.displayName || '').trim().slice(0, 80);
  if (!displayName) return { status: 422, error: 'Please enter your name.' };
  const bio = String(input.bio || '').trim();
  if (bio.length > bioLimit) return { status: 422, error: `Please keep your bio under ${bioLimit} characters.` };

  const [welcome] = await query('SELECT answers FROM member_welcome_details WHERE user_id = $1', [user.id]);
  if (!welcome) return { status: 409, error: 'Please complete page 1 of the welcome questionnaire first.' };
  const { values, error } = cleanSectionAnswers(1, {
    ...welcome.answers,
    preferredName: displayName,
    enjoys: input.interests,
    reasons: input.reasons,
    town: input.town,
    phone: input.phone,
  });
  if (error) return { status: 422, error };

  await query('UPDATE member_welcome_details SET answers = $2::jsonb, updated_at = NOW() WHERE user_id = $1', [user.id, JSON.stringify(values)]);
  await query('UPDATE profiles SET display_name = $2, bio = $3, updated_at = NOW() WHERE id = $1', [user.id, displayName, bio]);
  return { status: 200 };
}

async function savePreferences(query, user, input) {
  const [profile] = await query('SELECT display_name, marketing_consent FROM profiles WHERE id = $1', [user.id]);
  const wantsMarketing = input.marketingConsent === true;
  if (profile && wantsMarketing !== profile.marketing_consent) {
    await query(`
      UPDATE profiles SET marketing_consent = $2,
        marketing_consented_at = CASE WHEN $2 THEN NOW() ELSE marketing_consented_at END,
        marketing_withdrawn_at = CASE WHEN $2 THEN NULL ELSE NOW() END,
        updated_at = NOW()
      WHERE id = $1
    `, [user.id, wantsMarketing]);
    await recordConsent(query, user.id, 'marketing_email', wantsMarketing ? 'given' : 'withdrawn', profile.display_name);
  }
  return { status: 200 };
}

export default async function memberData(request) {
  const user = await getUser();
  if (!user) return Response.json({ error: 'Please log in to continue.' }, { status: 401 });
  await ensureProfile(user);

  if (request.method === 'GET') {
    // Lightweight lookup used by the site header on every page.
    if (new URL(request.url).searchParams.has('summary')) {
      const [profile] = await withMemberAccess(user.id, (query) => query('SELECT display_name, avatar_updated_at FROM profiles WHERE id = $1', [user.id]));
      return Response.json({ displayName: profile?.display_name || '', avatarUpdatedAt: profile?.avatar_updated_at || null }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const result = await withMemberAccess(user.id, (query) => loadMember(query, user));
    return Response.json({ ...result, isAdmin: (user.roles || []).includes('admin') }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (request.method !== 'PUT') return Response.json({ error: 'Method not allowed.' }, { status: 405 });
  verifyRequestOrigin(request);
  const body = await request.json().catch(() => ({}));

  const result = await withMemberAccess(user.id, async (query) => {
    if (body.profile) {
      const saved = await saveProfile(query, user, body.profile);
      if (saved.error) return saved;
    }
    if (body.preferences) return savePreferences(query, user, body.preferences);
    return { status: 200 };
  });

  if (result.error) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ ok: true });
}

export const config = { path: '/api/member' };
