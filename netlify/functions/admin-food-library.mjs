import { createHash } from 'node:crypto';
import { getDatabase } from '@netlify/database';
import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { authoriseAdmin, logAdminAccess, notAllowlistedMessage, withMemberAccess } from './_shared/member-access.mjs';
import { fieldLabels, ingredientColumns, planIngredientImport, summarisePlan } from './_shared/ingredient-library.mjs';
import { clearFoodCache } from './_shared/food-query.mjs';

const db = getDatabase();
const maxFileBytes = 5 * 1024 * 1024;
const storedColumns = [...ingredientColumns, 'slug', 'extra_fields'];

const fingerprint = (text) => createHash('sha256').update(text).digest('hex');
// Dates are read as text so comparisons never depend on the server time zone.
const loadExisting = async () => (await db.pool.query(`SELECT ${storedColumns.map((column) => (column === 'last_reviewed' ? 'last_reviewed::text AS last_reviewed' : column)).join(', ')} FROM ingredients`)).rows;
const log = (user, action, detail) => withMemberAccess(user.id, (q) => logAdminAccess(q, user.id, null, action, 'ingredients', null, detail), 'admin');

const describe = (plan) => ({
  summary: summarisePlan(plan),
  created: plan.created.map(({ line, record }) => ({ line, ingredientId: record.ingredient_id, name: record.ingredient_name, category: record.ingredient_category })),
  updated: plan.updated.map(({ line, record, fields }) => ({ line, ingredientId: record.ingredient_id, name: record.ingredient_name, fields: fields.map((field) => fieldLabels[field] || 'Additional columns') })),
  duplicates: plan.duplicates,
  rejected: plan.rejected,
  notInFile: plan.notInFile,
  missingColumns: plan.missingColumns,
  extraColumns: plan.extraColumns,
});

// Ingredient Library imports for allowlisted admins. Step one previews what a
// master file would change; step two applies exactly that file (matched by its
// fingerprint). Records are matched on UIL code and are never deleted here.
// The additives table is not touched.
export default async function adminFoodLibrary(request) {
  const user = await getUser();
  if (!user) return Response.json({ error: 'Please log in to continue.' }, { status: 401 });
  if (!(user.roles || []).includes('admin')) return Response.json({ error: 'You do not have access to the food library.' }, { status: 403 });
  if (!(await authoriseAdmin(user))) return Response.json({ error: notAllowlistedMessage }, { status: 403 });
  const headers = { 'Cache-Control': 'no-store' };

  if (request.method === 'GET') {
    const [[counts], batches] = await Promise.all([
      db.sql`SELECT
        (SELECT COUNT(*)::int FROM ingredients) AS ingredients,
        (SELECT COUNT(*)::int FROM ingredients WHERE publish_ready) AS published_ingredients,
        (SELECT COUNT(*)::int FROM additives) AS additives,
        (SELECT COUNT(*)::int FROM additives WHERE publish_ready) AS published_additives`,
      db.sql`SELECT id, source_name, imported_by, created_count, updated_count, unchanged_count, rejected_count, summary, created_at
        FROM ingredient_import_batches ORDER BY created_at DESC LIMIT 20`,
    ]);
    return Response.json({ counts, batches }, { headers });
  }

  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed.' }, { status: 405, headers });
  try {
    verifyRequestOrigin(request);
  } catch {
    return Response.json({ error: 'This request could not be accepted.' }, { status: 403, headers });
  }
  const body = await request.json().catch(() => ({}));
  const text = typeof body.csv === 'string' ? body.csv : '';
  const fileName = String(body.fileName || 'Ingredient Library upload').slice(0, 200);
  if (!text.trim()) return Response.json({ error: 'Choose a CSV export of the Ingredient Library.' }, { status: 422, headers });
  if (Buffer.byteLength(text) > maxFileBytes) return Response.json({ error: 'That file is larger than 5 MB. Export the Ingredient Library sheet only.' }, { status: 413, headers });

  const plan = planIngredientImport(text, await loadExisting());
  if (plan.error) return Response.json({ error: plan.error }, { status: 422, headers });
  const fileFingerprint = fingerprint(text);

  if (body.action === 'preview') {
    await log(user, 'preview_ingredient_import', `${fileName}: ${JSON.stringify(summarisePlan(plan))}`);
    return Response.json({ fingerprint: fileFingerprint, fileName, ...describe(plan) }, { headers });
  }

  if (body.action !== 'apply') return Response.json({ error: 'Choose preview or apply.' }, { status: 422, headers });
  if (body.fingerprint !== fileFingerprint) return Response.json({ error: 'The file has changed since it was previewed. Preview it again before applying.' }, { status: 409, headers });
  if (!plan.created.length && !plan.updated.length) return Response.json({ error: 'There are no new or changed records to apply.' }, { status: 409, headers });

  const summary = summarisePlan(plan);
  const client = await db.pool.connect();
  let batchId;
  try {
    await client.query('BEGIN');
    const { rows: [batch] } = await client.query(
      `INSERT INTO ingredient_import_batches (source_name, source_fingerprint, imported_by, created_count, updated_count, unchanged_count, rejected_count, summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [fileName, fileFingerprint, user.email || user.id, summary.created, summary.updated, summary.unchanged, summary.rejected + summary.duplicates,
        JSON.stringify({ rejected: plan.rejected, duplicates: plan.duplicates, notInFile: plan.notInFile })],
    );
    batchId = batch.id;
    const values = (record) => storedColumns.map((column) => (column === 'extra_fields' ? JSON.stringify(record.extra_fields || {}) : record[column]));
    const placeholders = storedColumns.map((_, index) => `$${index + 1}`).join(', ');
    for (const { record } of plan.created) {
      await client.query(
        `INSERT INTO ingredients (${storedColumns.join(', ')}, import_batch_id) VALUES (${placeholders}, $${storedColumns.length + 1})
         ON CONFLICT (ingredient_id) DO NOTHING`,
        [...values(record), batchId],
      );
    }
    const updateColumns = storedColumns.filter((column) => column !== 'ingredient_id' && column !== 'slug');
    for (const { record } of plan.updated) {
      await client.query(
        `UPDATE ingredients SET ${updateColumns.map((column, index) => `${column} = $${index + 2}`).join(', ')},
           import_batch_id = $${updateColumns.length + 2}, updated_at = NOW()
         WHERE ingredient_id = $1`,
        [record.ingredient_id, ...updateColumns.map((column) => (column === 'extra_fields' ? JSON.stringify(record.extra_fields || {}) : record[column])), batchId],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Ingredient import failed', error);
    return Response.json({ error: 'The import could not be applied. Nothing was changed.' }, { status: 500, headers });
  } finally {
    client.release();
  }
  clearFoodCache();
  await log(user, 'apply_ingredient_import', `${fileName} (batch ${batchId}): ${JSON.stringify(summary)}`);
  return Response.json({ ok: true, batchId, summary }, { headers });
}

export const config = { path: '/api/admin/food-library' };
