import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { withConfirmedAccount } from './_shared/identity-accounts.mjs';
import { ensureProfile } from './_shared/member-access.mjs';
import { linkProspect, prospectsForMember, unlinkProspect } from './_shared/prospect-store.mjs';

const noStore = { 'Cache-Control': 'no-store' };

// Lets a signed-in member link an earlier interest form to their account.
// Only records carrying the member's own verified account email are offered,
// and nothing is linked until the member confirms. Answers are not returned
// and are never copied into member records.
export default async function memberInterest(request) {
  const user = await withConfirmedAccount(await getUser());
  if (!user) return Response.json({ error: 'Please log in to continue.' }, { status: 401, headers: noStore });

  if (request.method === 'GET') {
    const { linked, available } = await prospectsForMember(user);
    return Response.json({ linked, available }, { headers: noStore });
  }

  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: noStore });
  try {
    verifyRequestOrigin(request);
  } catch {
    return Response.json({ error: 'This request could not be accepted.' }, { status: 403, headers: noStore });
  }
  if (!user.confirmedAt) return Response.json({ error: 'Please confirm your email address first. Use the link in the confirmation email we sent you, then log in again.' }, { status: 403, headers: noStore });
  await ensureProfile(user);
  const body = await request.json().catch(() => ({}));
  const done = body.action === 'unlink' ? await unlinkProspect(user, body.id) : await linkProspect(user, body.id);
  if (!done) return Response.json({ error: 'That interest form could not be found for your account.' }, { status: 404, headers: noStore });
  const { linked, available } = await prospectsForMember(user);
  return Response.json({ linked, available }, { headers: noStore });
}

export const config = { path: '/api/member/interest' };
