import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { avatarMaxBytes as maxBytes } from '../../utils/member-options.mjs';
import { avatarKey, avatarStore as store } from './_shared/avatar-store.mjs';
import { ensureProfile, withMemberAccess } from './_shared/member-access.mjs';

// Only ever returns or changes the signed-in member's own picture.

function imageType(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

export default async function memberAvatar(request) {
  const user = await getUser();
  if (!user) return Response.json({ error: 'Please log in to continue.' }, { status: 401 });

  if (request.method === 'GET') {
    const [profile] = await withMemberAccess(user.id, (query) => query('SELECT avatar_key FROM profiles WHERE id = $1', [user.id]));
    if (!profile?.avatar_key) return new Response(null, { status: 404 });
    const data = await store().get(profile.avatar_key, { type: 'arrayBuffer' });
    if (!data) return new Response(null, { status: 404 });
    return new Response(data, {
      headers: {
        'Content-Type': imageType(new Uint8Array(data)) || 'application/octet-stream',
        'Cache-Control': 'private, max-age=86400',
        // A different signed-in account on the same browser never reuses this copy.
        Vary: 'Cookie',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'",
      },
    });
  }

  if (!['PUT', 'DELETE'].includes(request.method)) return Response.json({ error: 'Method not allowed.' }, { status: 405 });
  verifyRequestOrigin(request);
  await ensureProfile(user);

  if (request.method === 'DELETE') {
    await store().delete(avatarKey(user.id));
    await withMemberAccess(user.id, (query) => query('UPDATE profiles SET avatar_key = NULL, avatar_updated_at = NULL, updated_at = NOW() WHERE id = $1', [user.id]));
    return Response.json({ ok: true });
  }

  const declaredSize = Number(request.headers.get('content-length') || 0);
  if (declaredSize > maxBytes) return Response.json({ error: 'Please choose an image under 2 MB.' }, { status: 413 });
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (!bytes.length) return Response.json({ error: 'Please choose an image.' }, { status: 422 });
  if (bytes.length > maxBytes) return Response.json({ error: 'Please choose an image under 2 MB.' }, { status: 413 });
  if (!imageType(bytes)) return Response.json({ error: 'Please choose a JPG, PNG or WebP image.' }, { status: 415 });

  await store().set(avatarKey(user.id), bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length));
  const [updated] = await withMemberAccess(user.id, (query) => query(
    'UPDATE profiles SET avatar_key = $2, avatar_updated_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING avatar_updated_at',
    [user.id, avatarKey(user.id)],
  ));
  return Response.json({ ok: true, avatarUpdatedAt: updated?.avatar_updated_at || null });
}

export const config = { path: '/api/member/avatar' };
