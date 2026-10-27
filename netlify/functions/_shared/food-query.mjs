import { getDatabase } from '@netlify/database';

const db = getDatabase();

// One search across the existing additives table and the Ingredient Library.
// Both libraries are small (hundreds of rows), so published records are held
// in memory for a few minutes and scored here. That gives case-insensitive,
// accent-insensitive matching with tolerance for small spelling slips.
const cacheMs = 5 * 60 * 1000;
let cache = { at: 0, records: null };

export const normalise = (value) => String(value || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();

const compact = (value) => normalise(value).replace(/ /g, '');

// Stable additive address built from its E number and name, e.g. e102-tartrazine.
// It does not change any stored additive data.
export const additiveSlug = (row) => `${compact(row.e_number)}-${normalise(row.additive_name).replace(/ /g, '-')}`;

const splitTerms = (value) => String(value || '').split(/\s*[;|]\s*/).map((item) => item.trim()).filter(Boolean);

const firstSentence = (value, max = 190) => {
  const text = String(value || '').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 120))}…`;
};

function editDistance(a, b, limit) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, current[j]);
    }
    if (rowMin > limit) return limit + 1;
    previous = current;
  }
  return previous[b.length];
}

const term = (text, weight, exact = false) => ({ text: normalise(text), weight, exact });

function toAdditive(row) {
  return {
    type: 'additive',
    slug: additiveSlug(row),
    id: row.ual_id,
    name: row.additive_name,
    eNumber: row.e_number,
    category: row.category,
    summary: row.food_function,
    keyInfo: [
      { label: 'Awareness level', value: row.risk_indicator.replace(/^[^A-Za-z]+/, '').trim(), tone: row.risk_indicator },
      { label: 'Function', value: row.food_function },
    ],
    eCompact: compact(row.e_number),
    eDigits: row.e_number.replace(/\D/g, ''),
    terms: [
      term(row.additive_name, 100), term(row.e_number, 100), term(row.category, 40),
      term(row.food_function, 30), ...splitTerms(row.natural_alternatives).map((item) => term(item, 15)),
    ],
    keywords: normalise(`${row.found_in} ${row.food_function}`),
  };
}

function toIngredient(row) {
  return {
    type: 'ingredient',
    slug: row.slug,
    id: row.ingredient_id,
    name: row.ingredient_name,
    category: row.ingredient_category,
    summary: firstSentence(row.what_it_is),
    keyInfo: [
      row.processing_level && { label: 'Processing', value: row.processing_level },
      row.vegan_status && { label: 'Vegan', value: row.vegan_status },
      row.evidence_quality && { label: 'Evidence', value: row.evidence_quality },
    ].filter(Boolean),
    terms: [
      term(row.ingredient_name, 100), term(row.ingredient_id, 100, true),
      ...splitTerms(row.alternative_names).map((item) => term(item, 85)),
      ...splitTerms(row.label_names).map((item) => term(item, 75)),
      ...splitTerms(row.scanner_matching_terms).map((item) => term(item, 75)),
      ...splitTerms(row.common_misspellings).map((item) => term(item, 70)),
      term(row.ingredient_category, 40), term(row.parent_ingredient, 35),
    ],
    keywords: normalise(`${row.what_it_is} ${row.commonly_found_in} ${row.why_it_is_used}`),
  };
}

export async function loadFoodRecords() {
  if (cache.records && Date.now() - cache.at < cacheMs) return cache.records;
  const [additives, ingredients] = await Promise.all([
    db.sql`SELECT ual_id, e_number, additive_name, category, food_function, risk_indicator, found_in, natural_alternatives FROM additives WHERE publish_ready = TRUE`,
    db.sql`
      SELECT ingredient_id, slug, ingredient_name, alternative_names, ingredient_category, parent_ingredient, what_it_is,
        why_it_is_used, processing_level, vegan_status, evidence_quality, label_names, scanner_matching_terms,
        common_misspellings, commonly_found_in
      FROM ingredients WHERE publish_ready = TRUE
    `,
  ]);
  cache = { at: Date.now(), records: [...additives.map(toAdditive), ...ingredients.map(toIngredient)] };
  return cache.records;
}

export const clearFoodCache = () => { cache = { at: 0, records: null }; };

function scoreTerm(query, queryWords, { text, weight, exact }) {
  if (!text) return 0;
  if (text === query) return weight;
  if (exact) return 0;
  // Closer matches rank higher: "table salt" beats "salt of aspartame-acesulfame" for "salt".
  const coverage = query.length / text.length;
  if (text.startsWith(query)) return weight * (0.72 + 0.2 * coverage);
  if (` ${text} `.includes(` ${query} `)) return weight * (0.68 + 0.25 * coverage);
  if (query.length >= 3 && ` ${text}`.includes(` ${query}`)) return weight * 0.65;
  // Matching inside a word ("gum" in "legumes") is only useful for longer searches.
  if (query.length >= 5 && text.includes(query)) return weight * 0.5;
  // Spelling tolerance is for words; E numbers and codes must match exactly.
  if (query.length < 4 || /\d/.test(query)) return 0;
  // Small spelling slips: one edit for short words, two for longer ones.
  const limit = query.length >= 7 ? 2 : 1;
  if (editDistance(query, text, limit) <= limit) return weight * 0.7;
  if (queryWords.length === 1) {
    const words = text.split(' ');
    if (words.some((word) => word.length >= 4 && editDistance(query, word, limit) <= limit)) return weight * 0.45;
  }
  return 0;
}

export function scoreRecord(record, query) {
  const queryWords = query.split(' ');
  let best = 0;
  if (record.type === 'additive') {
    const q = query.replace(/ /g, '');
    if (record.eCompact === q || record.eCompact === `e${q}`) best = 130;
    else if (/^\d+$/.test(q) && record.eDigits === q) best = 120;
    else if (/^e?\d+[a-z]*$/.test(q) && record.eCompact.startsWith(q.startsWith('e') ? q : `e${q}`)) best = 90;
  }
  for (const item of record.terms) best = Math.max(best, scoreTerm(query, queryWords, item));
  if (best === 0 && query.length >= 3) {
    const haystack = `${record.terms.map((item) => item.text).join(' ')} ${record.keywords}`;
    if (queryWords.every((word) => ` ${haystack}`.includes(` ${word}`))) best = 20;
  }
  return best;
}

export async function searchFood(rawQuery, type = 'all', limit = 40) {
  const query = normalise(rawQuery);
  if (!query) return { results: [], counts: { additive: 0, ingredient: 0 } };
  const records = await loadFoodRecords();
  const scored = records
    .map((record) => ({ record, score: scoreRecord(record, query) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.record.name.localeCompare(b.record.name));
  const counts = { additive: 0, ingredient: 0 };
  scored.forEach(({ record }) => { counts[record.type] += 1; });
  const filtered = type === 'all' ? scored : scored.filter(({ record }) => record.type === type);
  return {
    counts,
    results: filtered.slice(0, limit).map(({ record }) => ({
      type: record.type, slug: record.slug, id: record.id, name: record.name, eNumber: record.eNumber || null,
      category: record.category, summary: record.summary, keyInfo: record.keyInfo,
    })),
  };
}

const additiveColumns = `ual_id, e_number, additive_name, category, food_function, risk_indicator, attention_level, found_in,
  peak_exposure, processing, typical_clearance, adi, evidence_suggests, stacking_factors, who_should_be_aware,
  natural_alternatives, uk_regulatory_status, sources, unboxed_view, evidence_strength, research_status,
  source_url_uk_list, source_url_fsa, source_url_efsa, last_reviewed, evidence_notes`;

export async function getAdditive(slug) {
  const records = await loadFoodRecords();
  const match = records.find((record) => record.type === 'additive' && record.slug === slug);
  if (!match) return null;
  const [row] = await db.pool.query(`SELECT ${additiveColumns} FROM additives WHERE ual_id = $1 AND publish_ready = TRUE`, [match.id]).then((result) => result.rows);
  return row ? { ...row, slug } : null;
}

// Internal notes are editorial and never leave the team area.
export async function getIngredient(slug) {
  const [row] = await db.sql`SELECT * FROM ingredients WHERE slug = ${slug} AND publish_ready = TRUE`;
  if (!row) return null;
  const { internal_notes: _internal, import_batch_id: _batch, publish_ready: _published, created_at: _created, ...publicRow } = row;
  const relatedIds = [...new Set(String(row.related_ingredients || '').match(/UIL-\d{4,}/g) || [])];
  const related = relatedIds.length
    ? await db.sql`SELECT ingredient_id, slug, ingredient_name FROM ingredients WHERE ingredient_id = ANY(${relatedIds}) AND publish_ready = TRUE`
    : [];
  return { ...publicRow, related: related.map((item) => ({ id: item.ingredient_id, slug: item.slug, name: item.ingredient_name })) };
}

// The summary a visitor without an account sees: the same fields as a search card.
export async function getPreview(type, slug) {
  const records = await loadFoodRecords();
  const record = records.find((item) => item.type === type && item.slug === slug);
  if (!record) return null;
  return { type: record.type, slug: record.slug, id: record.id, name: record.name, eNumber: record.eNumber || null, category: record.category, summary: record.summary, keyInfo: record.keyInfo };
}
