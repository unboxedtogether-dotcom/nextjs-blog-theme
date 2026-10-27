import { getUser } from '@netlify/identity';
import { getAdditive, getIngredient, getPreview } from './_shared/food-query.mjs';

const slugPattern = /^[a-z0-9-]{1,120}$/;

// One additive or ingredient record. Full records are for signed-in members,
// as the Food Database has always been; everyone else gets the card summary.
export default async function foodRecord(request) {
  if (request.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'GET' } });
  }
  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const slug = url.searchParams.get('slug') || '';
  if (!['additive', 'ingredient'].includes(type) || !slugPattern.test(slug)) {
    return Response.json({ error: 'Choose a food database record.' }, { status: 422 });
  }
  const headers = { 'Cache-Control': 'private, no-store' };

  try {
    const user = await getUser();
    if (!user) {
      const preview = await getPreview(type, slug);
      if (!preview) return Response.json({ error: 'That record is not in the food database.' }, { status: 404, headers });
      return Response.json({ authenticated: false, preview }, { headers });
    }
    const record = type === 'additive' ? await getAdditive(slug) : await getIngredient(slug);
    if (!record) return Response.json({ error: 'That record is not in the food database.' }, { status: 404, headers });
    return Response.json({ authenticated: true, type, record }, { headers });
  } catch (error) {
    console.error('Food record lookup failed', error);
    return Response.json({ error: 'The food database is temporarily unavailable.' }, { status: 500, headers });
  }
}

export const config = { path: '/api/food/record' };
