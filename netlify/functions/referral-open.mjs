import { recordReferralOpen } from './_shared/referrals.mjs';

const noStore = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };

// Public: the join-us page calls this when it is opened from an invitation
// link. It records the visit against the invitation (no cookies or device
// storage) and returns only the inviter's first name, and only if they
// agreed to share it. Unknown and real tokens get the same response shape,
// and nothing private is ever returned.
export default async function referralOpen(request) {
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: noStore });
  const body = await request.json().catch(() => ({}));
  try {
    const result = await recordReferralOpen(body?.token);
    return Response.json({ referrerName: result?.referrerName || null }, { headers: noStore });
  } catch (error) {
    console.error('Referral open not recorded', error.message);
    return Response.json({ referrerName: null }, { headers: noStore });
  }
}

export const config = { path: '/api/referral/open' };
