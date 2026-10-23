import { getUser } from '@netlify/identity';
import { ensureProfile, withMemberAccess } from './_shared/member-access.mjs';
import { loadSubmissionDetail, loadSubmissionList } from './_shared/member-records.mjs';

// The signed-in member's own form history (read-only).
export default async function memberForms(request) {
  if (request.method !== 'GET') return Response.json({ error: 'Method not allowed.' }, { status: 405 });
  const user = await getUser();
  if (!user) return Response.json({ error: 'Please log in to continue.' }, { status: 401 });
  await ensureProfile(user);

  const id = new URL(request.url).searchParams.get('id');
  const result = await withMemberAccess(user.id, (query) => (id ? loadSubmissionDetail(query, user.id, id) : loadSubmissionList(query, user.id)));
  if (!result) return Response.json({ error: 'That record could not be found.' }, { status: 404 });
  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
}

export const config = { path: '/api/forms' };
