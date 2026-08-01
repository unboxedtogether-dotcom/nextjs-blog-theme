import { getDatabase } from '@netlify/database';

const db = getDatabase();

export async function searchAdditives(query, limit = 8) {
  const normalizedQuery = query.toLowerCase().replace(/[^a-z0-9]/g, '');
  const numericQuery = query.replace(/\D/g, '');
  const namePattern = `%${query.toLowerCase()}%`;
  const numberPattern = `%${normalizedQuery}%`;

  return db.sql`
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
    LIMIT ${limit}
  `;
}

export function parseAdditiveQuery(request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get('q') || '').trim().slice(0, 80);
  const normalizedQuery = query.toLowerCase().replace(/[^a-z0-9]/g, '');
  return normalizedQuery ? query : '';
}
