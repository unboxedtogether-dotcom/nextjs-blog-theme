import { admin, getUser, verifyRequestOrigin } from '@netlify/identity';
import { getDatabase } from '@netlify/database';

const db = getDatabase();

export default async function deleteAccount(request) {
  if (request.method !== 'DELETE') return Response.json({ error: 'Method not allowed.' }, { status: 405 });
  verifyRequestOrigin(request);
  const user = await getUser();
  if (!user) return Response.json({ error: 'Please log in to continue.' }, { status: 401 });
  const body = await request.json();
  if (body.confirmation !== 'DELETE MY ACCOUNT') {
    return Response.json({ error: 'Type DELETE MY ACCOUNT to confirm.' }, { status: 422 });
  }

  await db.sql`DELETE FROM profiles WHERE id = ${user.id}`;
  await admin.deleteUser(user.id);
  return new Response(null, { status: 204 });
}

export const config = { path: '/api/account' };
