import { verifyRequestOrigin } from '@netlify/identity';
import { permissionTypes } from '../../utils/prospect-questionnaire.mjs';
import {
  confirmMarketing, eraseProspect, findByManageToken, grantMarketing, suppressEmail, withdrawPermission,
} from './_shared/prospect-store.mjs';

const noStore = { 'Cache-Control': 'no-store' };

// Preference management and unsubscribe for people who registered interest.
// The private token from their email is the only credential: it is sent in
// the request body (never a URL query string) and only its hash is stored.
// Only permission state is returned, never questionnaire answers.
export default async function prospectPreferences(request) {
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: noStore });
  try {
    verifyRequestOrigin(request);
  } catch {
    return Response.json({ error: 'This request could not be accepted.' }, { status: 403, headers: noStore });
  }
  const body = await request.json().catch(() => ({}));
  const prospect = await findByManageToken(body.token);
  if (!prospect) return Response.json({ error: 'This link is not valid or has expired. Contact support@unboxedtogether.com if you need help.' }, { status: 404, headers: noStore });

  const action = body.action || 'load';
  if (action === 'confirm_marketing') await confirmMarketing(prospect.id);
  else if (action === 'grant_marketing') await grantMarketing(prospect.id);
  else if (action === 'withdraw') {
    if (!permissionTypes.includes(body.type)) return Response.json({ error: 'Choose a preference to change.' }, { status: 422, headers: noStore });
    await withdrawPermission(prospect.id, body.type, 'prospect');
    if (body.type === 'general_marketing') await suppressEmail(prospect.id, 'unsubscribed');
  } else if (action === 'unsubscribe_all') {
    for (const type of ['project_contact', 'general_marketing']) await withdrawPermission(prospect.id, type, 'prospect');
    await suppressEmail(prospect.id, 'unsubscribed');
  } else if (action === 'erase') {
    await eraseProspect(prospect.id);
    return Response.json({ erased: true }, { headers: noStore });
  } else if (action !== 'load') {
    return Response.json({ error: 'Unknown action.' }, { status: 422, headers: noStore });
  }

  const current = await findByManageToken(body.token);
  return Response.json({ firstName: current.firstName, submittedAt: current.submittedAt, permissions: current.permissions }, { headers: noStore });
}

export const config = { path: '/api/prospect/preferences' };
