import { parseAdditiveQuery, searchAdditives } from './_shared/additive-query.mjs';

const publicFields = (row) => ({
  eNumber: row.e_number,
  additiveName: row.additive_name,
  category: row.category,
});

const additiveSearch = async (request) => {
  if (request.method !== 'GET') {
    return Response.json(
      { error: 'Method not allowed' },
      { status: 405, headers: { Allow: 'GET' } },
    );
  }

  const query = parseAdditiveQuery(request);

  if (!query) {
    return Response.json({ results: [], authenticated: false });
  }

  try {
    const rows = await searchAdditives(query, 1);

    return Response.json(
      { results: rows.map(publicFields), authenticated: false },
      { headers: { 'Cache-Control': 'public, max-age=300' } },
    );
  } catch (error) {
    console.error('Additive search failed', error);
    return Response.json(
      { error: 'The additive library is temporarily unavailable.' },
      { status: 500 },
    );
  }
};

export default additiveSearch;

export const config = {
  path: '/api/additives',
};
