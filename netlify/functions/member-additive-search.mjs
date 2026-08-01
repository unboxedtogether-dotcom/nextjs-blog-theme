import { getUser } from '@netlify/identity';
import { parseAdditiveQuery, searchAdditives } from './_shared/additive-query.mjs';

const memberFields = (row) => ({
  eNumber: row.e_number,
  additiveName: row.additive_name,
  category: row.category,
  foodFunction: row.food_function,
  riskIndicator: row.risk_indicator,
  foundIn: row.found_in,
  peakExposure: row.peak_exposure,
  processing: row.processing,
  typicalClearance: row.typical_clearance,
  adi: row.adi,
  evidenceSuggests: row.evidence_suggests,
  stackingFactors: row.stacking_factors,
  whoShouldBeAware: row.who_should_be_aware,
  naturalAlternatives: row.natural_alternatives,
  ukRegulatoryStatus: row.uk_regulatory_status,
  sources: row.sources,
  unboxedView: row.unboxed_view,
});

export default async function memberAdditiveSearch(request) {
  if (request.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'GET' } });
  }

  const user = await getUser();
  if (!user) {
    return Response.json(
      { error: 'Create a free account or log in to view full additive records.' },
      { status: 401, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  const query = parseAdditiveQuery(request);
  if (!query) return Response.json({ results: [], authenticated: true }, { headers: { 'Cache-Control': 'private, no-store' } });

  try {
    const rows = await searchAdditives(query, 8);
    return Response.json(
      { results: rows.map(memberFields), authenticated: true },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    console.error('Member additive search failed', error);
    return Response.json({ error: 'The additive library is temporarily unavailable.' }, { status: 500 });
  }
}

export const config = { path: '/api/member-additives' };
