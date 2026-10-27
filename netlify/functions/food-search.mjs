import { searchFood } from './_shared/food-query.mjs';

const types = { all: 'all', additives: 'additive', ingredients: 'ingredient' };

// Public Food Database search across additives and ingredients. Returns card
// summaries only; full records come from /api/food/record for signed-in members.
export default async function foodSearch(request) {
  if (request.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'GET' } });
  }
  const url = new URL(request.url);
  const query = (url.searchParams.get('q') || '').trim().slice(0, 80);
  const type = types[url.searchParams.get('type')] || 'all';
  if (!query) return Response.json({ results: [], counts: { additive: 0, ingredient: 0 } });

  try {
    const { results, counts } = await searchFood(query, type);
    return Response.json({ results, counts }, { headers: { 'Cache-Control': 'public, max-age=300' } });
  } catch (error) {
    console.error('Food search failed', error);
    return Response.json({ error: 'The food database is temporarily unavailable.' }, { status: 500 });
  }
}

export const config = { path: '/api/food/search' };
