import { getDatabase } from '@netlify/database';

const db = getDatabase();

const publicFields = (row) => ({
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

export default async (request) => {
  if (request.method !== 'GET') {
    return Response.json(
      { error: 'Method not allowed' },
      { status: 405, headers: { Allow: 'GET' } },
    );
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get('q') || '').trim().slice(0, 80);

  if (!query) {
    return Response.json({ results: [] });
  }

  const normalizedQuery = query.toLowerCase().replace(/[^a-z0-9]/g, '');
  const numericQuery = query.replace(/\D/g, '');

  if (!normalizedQuery) {
    return Response.json({ results: [] });
  }

  const namePattern = `%${query.toLowerCase()}%`;
  const numberPattern = `%${normalizedQuery}%`;

  try {
    const rows = await db.sql`
      SELECT
        e_number,
        additive_name,
        category,
        food_function,
        risk_indicator,
        found_in,
        peak_exposure,
        processing,
        typical_clearance,
        adi,
        evidence_suggests,
        stacking_factors,
        who_should_be_aware,
        natural_alternatives,
        uk_regulatory_status,
        sources,
        unboxed_view
      FROM additives
      WHERE publish_ready = TRUE
        AND (
          LOWER(additive_name) LIKE ${namePattern}
          OR REGEXP_REPLACE(LOWER(e_number), '[^a-z0-9]', '', 'g') LIKE ${numberPattern}
          OR (${numericQuery} <> '' AND REGEXP_REPLACE(e_number, '[^0-9]', '', 'g') = ${numericQuery})
        )
      ORDER BY
        CASE
          WHEN REGEXP_REPLACE(LOWER(e_number), '[^a-z0-9]', '', 'g') = ${normalizedQuery} THEN 0
          WHEN LOWER(additive_name) = ${query.toLowerCase()} THEN 1
          WHEN LOWER(additive_name) LIKE ${`${query.toLowerCase()}%`} THEN 2
          ELSE 3
        END,
        e_number
      LIMIT 8
    `;

    return Response.json(
      { results: rows.map(publicFields) },
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

export const config = {
  path: '/api/additives',
};
