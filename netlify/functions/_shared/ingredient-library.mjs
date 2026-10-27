// Ingredient Library master-file handling shared by the seed generator, the
// team-area importer and the tests. Rows are matched on their UIL code, so
// re-importing an updated file updates records instead of duplicating them.
// Nothing here deletes a record: rows missing from a file are left as they are.

export const ingredientFields = [
  ['ingredient_id', 'Ingredient ID'],
  ['ingredient_name', 'Ingredient Name'],
  ['alternative_names', 'Alternative Names / Synonyms'],
  ['ingredient_category', 'Ingredient Category'],
  ['parent_ingredient', 'Parent Ingredient'],
  ['what_it_is', 'What It Is'],
  ['source', 'Source'],
  ['why_it_is_used', 'Why It Is Used'],
  ['processing_level', 'Processing Level'],
  ['main_nutritional_contribution', 'Main Nutritional Contribution'],
  ['protein_relevance', 'Protein Relevance'],
  ['fat_relevance', 'Fat Relevance'],
  ['carbohydrate_sugar_relevance', 'Carbohydrate / Sugar Relevance'],
  ['fibre_relevance', 'Fibre Relevance'],
  ['blood_sugar_relevance', 'Blood Sugar Relevance'],
  ['gut_relevance', 'Gut Relevance'],
  ['inflammation_relevance', 'Inflammation Relevance'],
  ['allergy_intolerance_concerns', 'Allergy / Intolerance Concerns'],
  ['who_should_be_aware', 'Who Should Be Aware'],
  ['commonly_found_in', 'Commonly Found In'],
  ['label_names', 'Label Names to Look For'],
  ['better_alternatives', 'Better Alternatives'],
  ['vegan_status', 'Vegan Status'],
  ['vegetarian_status', 'Vegetarian Status'],
  ['gluten_relevance', 'Gluten Relevance'],
  ['nova_relevance', 'NOVA Relevance'],
  ['unboxed_classification', 'Unboxed Rating / Classification'],
  ['evidence_quality', 'Evidence Quality'],
  ['regulatory_notes', 'Regulatory Notes'],
  ['unboxed_summary', 'Unboxed Summary'],
  ['scanner_matching_terms', 'Scanner Matching Terms'],
  ['common_misspellings', 'Common Misspellings'],
  ['related_ingredients', 'Related Ingredients'],
  ['related_additives', 'Related Additives'],
  ['reference_sources', 'References'],
  ['last_reviewed', 'Last Reviewed'],
  ['internal_notes', 'Internal Notes'],
];

export const ingredientColumns = ingredientFields.map(([column]) => column);
export const fieldLabels = Object.fromEntries(ingredientFields);

// A row without these cannot be published honestly, so it is rejected and reported.
const requiredFields = ['ingredient_id', 'ingredient_name', 'ingredient_category', 'what_it_is', 'evidence_quality', 'reference_sources', 'last_reviewed'];

const headerKey = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const headerLookup = new Map(ingredientFields.map(([column, label]) => [headerKey(label), column]));
for (const column of ingredientColumns) headerLookup.set(headerKey(column), column);

export const slugify = (value) => String(value || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export const normaliseName = (value) => slugify(value).replace(/-/g, ' ');

const cleanText = (value) => String(value ?? '').replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').trim();

// Accepts 2026-10-17, 17/10/2026 or 17-10-2026. Returns null when unreadable.
export function parseReviewDate(value) {
  const text = cleanText(value);
  let year; let month; let day;
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) [, year, month, day] = match;
  else if ((match = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) [, day, month, year] = match;
  else return null;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(date.getTime()) || date.getUTCDate() !== Number(day)) return null;
  return date.toISOString().slice(0, 10);
}

// RFC 4180 CSV (Google Sheets "Download → CSV"). Tab-separated files are
// detected from the header row.
export function parseDelimited(text) {
  const source = String(text || '').replace(/^﻿/, '');
  const firstLine = source.split(/\r?\n/, 1)[0] || '';
  const delimiter = (firstLine.match(/\t/g) || []).length > (firstLine.match(/,/g) || []).length ? '\t' : ',';
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field === '') quoted = true;
    else if (char === delimiter) { row.push(field); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += char;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Finds the header row (the master file has a title row above it) and maps
// each column to a database field. Unrecognised columns are kept as extras.
export function mapHeaders(rows) {
  const headerIndex = rows.findIndex((cells) => cells.some((cell) => headerLookup.get(headerKey(cell)) === 'ingredient_id'));
  if (headerIndex === -1) return { error: 'No "Ingredient ID" column was found. Export the Ingredient Library sheet as CSV with its header row.' };
  const columns = rows[headerIndex].map((cell) => {
    const label = cleanText(cell);
    return { label, column: headerLookup.get(headerKey(label)) || null };
  });
  const missing = ingredientFields.filter(([column]) => !columns.some((item) => item.column === column)).map(([, label]) => label);
  return { headerIndex, columns, missing };
}

// Turns raw cells into a record. Returns the record plus any problems.
export function toRecord(cells, columns) {
  const record = Object.fromEntries(ingredientColumns.map((column) => [column, '']));
  record.extra_fields = {};
  columns.forEach(({ label, column }, index) => {
    const value = cleanText(cells[index]);
    if (column) record[column] = value;
    else if (label && value) record.extra_fields[label] = value;
  });
  record.ingredient_id = record.ingredient_id.toUpperCase().replace(/\s+/g, '');
  const problems = [];
  if (!/^UIL-\d{4,}$/.test(record.ingredient_id)) problems.push(record.ingredient_id ? `"${record.ingredient_id}" is not a UIL code (expected UIL-0001 format)` : 'Missing Ingredient ID');
  const rawDate = record.last_reviewed;
  record.last_reviewed = parseReviewDate(rawDate);
  if (rawDate && !record.last_reviewed) problems.push(`Last Reviewed "${rawDate}" is not a valid date`);
  const empty = requiredFields.filter((column) => column !== 'ingredient_id' && !record[column] && !(column === 'last_reviewed' && rawDate));
  if (empty.length) problems.push(`Missing ${empty.map((column) => fieldLabels[column]).join(', ')}`);
  return { record, problems };
}

const comparable = (record) => ({
  ...Object.fromEntries(ingredientColumns.map((column) => [column, column === 'last_reviewed' ? (record.last_reviewed ? String(record.last_reviewed).slice(0, 10) : null) : (record[column] ?? '')])),
  extra_fields: JSON.stringify(Object.entries(record.extra_fields || {}).sort(([a], [b]) => a.localeCompare(b))),
});

export function changedFields(existing, incoming) {
  const before = comparable(existing);
  const after = comparable(incoming);
  return [...ingredientColumns, 'extra_fields'].filter((column) => before[column] !== after[column]);
}

const toDateText = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};

/**
 * Compares a master file with the current library. `existing` is every
 * ingredient row currently stored (published or not).
 * Returns the records to create and update, and every rejected row with its reason.
 */
export function planIngredientImport(text, existing = []) {
  const rows = parseDelimited(text);
  const mapped = mapHeaders(rows);
  if (mapped.error) return { error: mapped.error };
  const { headerIndex, columns, missing } = mapped;
  const absentColumns = ingredientFields.filter(([column]) => !columns.some((item) => item.column === column)).map(([column]) => column);

  const byId = new Map(existing.map((row) => [row.ingredient_id, { ...row, last_reviewed: toDateText(row.last_reviewed) }]));
  const idByName = new Map(existing.map((row) => [normaliseName(row.ingredient_name), row.ingredient_id]));
  const usedSlugs = new Map(existing.map((row) => [row.slug, row.ingredient_id]));

  const parsed = [];
  const rejected = [];
  rows.slice(headerIndex + 1).forEach((cells, offset) => {
    const line = headerIndex + offset + 2;
    if (!cells.some((cell) => cleanText(cell))) return;
    const { record, problems } = toRecord(cells, columns);
    if (problems.length) rejected.push({ line, ingredientId: record.ingredient_id || null, name: record.ingredient_name || null, reasons: problems });
    else parsed.push({ line, record });
  });

  // The same UIL code twice in one file is ambiguous, so every copy is held back.
  const idCounts = new Map();
  parsed.forEach(({ record }) => idCounts.set(record.ingredient_id, (idCounts.get(record.ingredient_id) || 0) + 1));
  const nameOwners = new Map();
  const created = [];
  const updated = [];
  const unchanged = [];
  const duplicates = [];

  for (const { line, record } of parsed) {
    const name = normaliseName(record.ingredient_name);
    if (idCounts.get(record.ingredient_id) > 1) {
      duplicates.push({ line, ingredientId: record.ingredient_id, name: record.ingredient_name, reason: `${record.ingredient_id} appears ${idCounts.get(record.ingredient_id)} times in this file` });
      continue;
    }
    const nameOwner = nameOwners.get(name) || idByName.get(name);
    if (nameOwner && nameOwner !== record.ingredient_id) {
      duplicates.push({ line, ingredientId: record.ingredient_id, name: record.ingredient_name, reason: `The name "${record.ingredient_name}" is already used by ${nameOwner}` });
      continue;
    }
    nameOwners.set(name, record.ingredient_id);

    const current = byId.get(record.ingredient_id);
    if (current) {
      // Keep the published address stable even if the name is edited, and
      // never blank a field just because a column was left out of the file.
      record.slug = current.slug;
      for (const column of absentColumns) record[column] = current[column] ?? '';
      record.extra_fields = { ...(current.extra_fields || {}), ...record.extra_fields };
      const fields = changedFields(current, record);
      if (fields.length) updated.push({ line, record, fields });
      else unchanged.push({ line, ingredientId: record.ingredient_id });
      continue;
    }
    let slug = slugify(record.ingredient_name) || record.ingredient_id.toLowerCase();
    if (usedSlugs.has(slug) && usedSlugs.get(slug) !== record.ingredient_id) slug = `${slug}-${record.ingredient_id.slice(4)}`;
    usedSlugs.set(slug, record.ingredient_id);
    record.slug = slug;
    created.push({ line, record });
  }

  const inFile = new Set(parsed.map(({ record }) => record.ingredient_id));
  const notInFile = existing.filter((row) => !inFile.has(row.ingredient_id)).map((row) => row.ingredient_id);
  const extraColumns = columns.filter((item) => !item.column && item.label).map((item) => item.label);

  return { created, updated, unchanged, duplicates, rejected, notInFile, missingColumns: missing, extraColumns };
}

export const summarisePlan = (plan) => ({
  created: plan.created.length,
  updated: plan.updated.length,
  unchanged: plan.unchanged.length,
  duplicates: plan.duplicates.length,
  rejected: plan.rejected.length,
  notInFile: plan.notInFile.length,
});
