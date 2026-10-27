// Food Database tests: the existing additive library, the imported Ingredient
// Library, the unified search, record access and the team-area importer.
// They run against a throwaway local copy of Netlify Database built from the
// project's migrations, so no live data is read or changed.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { NetlifyDB } from '@netlify/database-dev';
import { planIngredientImport } from '../netlify/functions/_shared/ingredient-library.mjs';

const origin = 'https://food.test';
const member = { sub: randomUUID(), email: 'member@food.test', name: 'Food Member', roles: ['member'] };
const roleOnlyAdmin = { sub: randomUUID(), email: 'role-only@food.test', name: 'Role Only', roles: ['admin'] };
const admin = { sub: randomUUID(), email: 'admin@food.test', name: 'Food Admin', roles: ['member', 'admin'] };

// Fingerprint of every additive row's content (all columns except the
// created/updated timestamps) built from migrations 001–002 alone, before the
// Ingredient Library was added.
const additivesFingerprint = '1fc1a9da70b5b724c97396f021eab850';

function signInAs(user) {
  globalThis.netlifyIdentityContext = user
    ? { user: { sub: user.sub, email: user.email, app_metadata: { roles: user.roles }, user_metadata: { full_name: user.name } } }
    : undefined;
}

async function call(handler, user, method, path, body) {
  signInAs(user);
  const init = { method, headers: { origin, 'content-type': 'application/json' } };
  if (body !== undefined) init.body = JSON.stringify(body);
  const response = await handler(new Request(`${origin}${path}`, init), {});
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: response.status, body: json, text };
}

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const header = ['Ingredient ID', 'Ingredient Name', 'Alternative Names / Synonyms', 'Ingredient Category', 'What It Is', 'Evidence Quality', 'References', 'Last Reviewed', 'Internal Notes', 'Season'];
const toCsv = (rows) => ['UNBOXED TOGETHER — INGREDIENT LIBRARY', header.map(csvCell).join(','), ...rows.map((row) => row.map(csvCell).join(','))].join('\r\n');

describe('food database', () => {
  let localDb;
  let owner;
  let fn;
  const one = async (sql, params = []) => (await owner.query(sql, params)).rows[0];

  before(async () => {
    localDb = new NetlifyDB({ logger: () => {} });
    const url = await localDb.start();
    await localDb.applyMigrations(fileURLToPath(new URL('../netlify/database/migrations', import.meta.url)));
    process.env.NETLIFY_DB_URL = url;
    delete process.env.NETLIFY_DATABASE_URL;
    const load = async (name) => (await import(`../netlify/functions/${name}.mjs`)).default;
    fn = {
      search: await load('food-search'),
      record: await load('food-record'),
      importer: await load('admin-food-library'),
      legacySearch: await load('additive-search'),
      legacyMemberSearch: await load('member-additive-search'),
    };
    owner = new pg.Client({ connectionString: url });
    await owner.connect();
    await owner.query("INSERT INTO member_admins (email, user_id, added_by, role) VALUES ($1, $2, 'test', 'admin')", [admin.email, admin.sub]);
  });

  after(async () => {
    signInAs(null);
    await owner?.end().catch(() => {});
    await localDb?.stop?.().catch(() => {});
  });

  const additiveFingerprint = async (table) => (await one(`SELECT COUNT(*)::int AS n, md5(string_agg((to_jsonb(t) - 'created_at' - 'updated_at')::text, '|' ORDER BY ual_id)) AS hash, md5(string_agg(t::text, '|' ORDER BY ual_id)) AS full_row FROM ${table} t`));

  test('all 329 existing additive records are present, unchanged and backed up', async () => {
    const live = await additiveFingerprint('additives');
    assert.equal(live.n, 329);
    assert.equal(live.hash, additivesFingerprint);
    const backup = await additiveFingerprint('additives_backup_2026_10_27');
    assert.deepEqual(backup, live);
    assert.equal((await one('SELECT COUNT(*)::int AS n FROM additives WHERE publish_ready')).n, 306);
  });

  test('every valid Ingredient Library record is imported once, with research fields intact', async () => {
    const counts = await one('SELECT COUNT(*)::int AS n, COUNT(DISTINCT ingredient_id)::int AS ids, COUNT(DISTINCT LOWER(ingredient_name))::int AS names, COUNT(DISTINCT slug)::int AS slugs FROM ingredients');
    assert.deepEqual(counts, { n: 587, ids: 587, names: 587, slugs: 587 });
    const range = await one("SELECT MIN(ingredient_id) AS first, MAX(ingredient_id) AS last, COUNT(*) FILTER (WHERE ingredient_id = 'UIL-0591')::int AS incomplete FROM ingredients");
    assert.deepEqual(range, { first: 'UIL-0001', last: 'UIL-0590', incomplete: 0 });
    const gaps = await one("SELECT COUNT(*)::int AS n FROM ingredients WHERE reference_sources = '' OR evidence_quality = '' OR last_reviewed IS NULL OR what_it_is = ''");
    assert.equal(gaps.n, 0);
    const maltodextrin = await one("SELECT * FROM ingredients WHERE ingredient_id = 'UIL-0001'");
    assert.equal(maltodextrin.ingredient_name, 'Maltodextrin');
    assert.match(maltodextrin.alternative_names, /tapioca maltodextrin/);
    assert.equal(maltodextrin.processing_level, 'Highly refined ingredient');
    assert.match(maltodextrin.reference_sources, /https:\/\/www\.gov\.uk\/government\/publications\/composition-of-foods-integrated-dataset-cofid/);
    const barley = await one("SELECT * FROM ingredients WHERE ingredient_id = 'UIL-0590'");
    assert.equal(barley.evidence_quality, 'High');
    assert.equal(String(barley.last_reviewed.toISOString()).slice(0, 10), '2026-10-17');
    assert.match(barley.related_ingredients, /UIL-0564/);
  });

  test('the single search finds additives by E number, with or without the E', async () => {
    for (const q of ['E102', 'e102', '102', 'E 102']) {
      const { status, body } = await call(fn.search, null, 'GET', `/api/food/search?q=${encodeURIComponent(q)}`);
      assert.equal(status, 200);
      assert.equal(body.results[0].type, 'additive', q);
      assert.equal(body.results[0].eNumber, 'E102', q);
      assert.equal(body.results[0].slug, 'e102-tartrazine');
      assert.ok(!body.results.some((result) => result.eNumber === 'E122'), `${q} should not return near-miss E numbers`);
    }
  });

  test('ingredient names, synonyms, label names and small misspellings are found', async () => {
    const top = async (q) => (await call(fn.search, null, 'GET', `/api/food/search?q=${encodeURIComponent(q)}`)).body.results[0];
    assert.equal((await top('Maltodextrin')).name, 'Maltodextrin');
    assert.equal((await top('tapioca maltodextrin')).name, 'Maltodextrin');
    assert.equal((await top('maltodextrine')).name, 'Maltodextrin');
    assert.equal((await top('tatrazine')).name, 'Tartrazine');
    assert.equal((await top('roast barley')).name, 'Roasted Barley');
    assert.equal((await top('MALTODEXTRIN')).type, 'ingredient');
  });

  test('mixed results show both types, and the filters narrow them', async () => {
    const all = await call(fn.search, null, 'GET', '/api/food/search?q=gum');
    assert.ok(all.body.counts.additive > 0 && all.body.counts.ingredient > 0);
    const types = new Set(all.body.results.map((result) => result.type));
    assert.deepEqual([...types].sort(), ['additive', 'ingredient']);
    const additive = all.body.results.find((result) => result.type === 'additive');
    assert.ok(additive.eNumber && additive.keyInfo.some((item) => item.label === 'Awareness level'));
    const ingredient = all.body.results.find((result) => result.type === 'ingredient');
    assert.equal(ingredient.eNumber, null);
    assert.ok(!ingredient.keyInfo.some((item) => item.label === 'Awareness level'));
    const onlyAdditives = await call(fn.search, null, 'GET', '/api/food/search?q=gum&type=additives');
    assert.ok(onlyAdditives.body.results.every((result) => result.type === 'additive'));
    const onlyIngredients = await call(fn.search, null, 'GET', '/api/food/search?q=gum&type=ingredients');
    assert.ok(onlyIngredients.body.results.length && onlyIngredients.body.results.every((result) => result.type === 'ingredient'));
  });

  test('unpublished additives stay hidden from search and record pages', async () => {
    const hidden = await one('SELECT e_number, additive_name FROM additives WHERE NOT publish_ready ORDER BY ual_id LIMIT 1');
    const { body } = await call(fn.search, null, 'GET', `/api/food/search?q=${encodeURIComponent(hidden.additive_name)}`);
    assert.ok(!body.results.some((result) => result.name === hidden.additive_name));
  });

  test('visitors see only the summary; members see the full additive and ingredient layouts', async () => {
    const guest = await call(fn.record, null, 'GET', '/api/food/record?type=additive&slug=e102-tartrazine');
    assert.equal(guest.status, 200);
    assert.equal(guest.body.authenticated, false);
    assert.equal(guest.body.record, undefined);
    assert.equal(guest.body.preview.name, 'Tartrazine');

    const additive = await call(fn.record, member, 'GET', '/api/food/record?type=additive&slug=e102-tartrazine');
    assert.equal(additive.body.type, 'additive');
    const stored = await one("SELECT * FROM additives WHERE e_number = 'E102'");
    for (const field of ['evidence_suggests', 'peak_exposure', 'typical_clearance', 'adi', 'stacking_factors', 'natural_alternatives', 'uk_regulatory_status', 'unboxed_view', 'evidence_strength', 'research_status', 'evidence_notes', 'source_url_efsa']) {
      assert.equal(additive.body.record[field], stored[field], field);
    }

    const ingredient = await call(fn.record, member, 'GET', '/api/food/record?type=ingredient&slug=roasted-barley');
    assert.equal(ingredient.body.type, 'ingredient');
    assert.equal(ingredient.body.record.ingredient_id, 'UIL-0590');
    assert.equal(ingredient.body.record.internal_notes, undefined, 'internal notes are team-only');
    assert.deepEqual(ingredient.body.record.related.map((item) => item.id).sort(), ['UIL-0026', 'UIL-0512', 'UIL-0551', 'UIL-0564']);

    const wrongType = await call(fn.record, member, 'GET', '/api/food/record?type=ingredient&slug=e102-tartrazine');
    assert.equal(wrongType.status, 404);
  });

  test('the existing additive search endpoints still work', async () => {
    const legacy = await call(fn.legacySearch, null, 'GET', '/api/additives?q=E211');
    assert.equal(legacy.status, 200);
    assert.equal(legacy.body.results[0].eNumber, 'E211');
    const legacyMember = await call(fn.legacyMemberSearch, member, 'GET', '/api/member-additives?q=tartrazine');
    assert.equal(legacyMember.body.results[0].additiveName, 'Tartrazine');
  });

  test('only allowlisted admins can use the importer', async () => {
    assert.equal((await call(fn.importer, null, 'GET', '/api/admin/food-library')).status, 401);
    assert.equal((await call(fn.importer, member, 'GET', '/api/admin/food-library')).status, 403);
    assert.equal((await call(fn.importer, roleOnlyAdmin, 'GET', '/api/admin/food-library')).status, 403);
    const ok = await call(fn.importer, admin, 'GET', '/api/admin/food-library');
    assert.equal(ok.status, 200);
    assert.equal(ok.body.counts.ingredients, 587);
    assert.equal(ok.body.batches.length, 1);
  });

  test('an import is previewed, then applied without duplicates, deletions or additive changes', async () => {
    const existing = await one("SELECT * FROM ingredients WHERE ingredient_id = 'UIL-0002'");
    const reviewed = existing.last_reviewed.toISOString().slice(0, 10);
    const csv = toCsv([
      // Existing record with an edited summary field and a new internal note.
      ['UIL-0002', existing.ingredient_name, existing.alternative_names, existing.ingredient_category, `${existing.what_it_is} Updated.`, existing.evidence_quality, existing.reference_sources, reviewed, 'Team note', ''],
      // A new record, the incomplete record from the supplied file, a duplicate and an invalid row.
      ['UIL-0592', 'Test Teff Flakes', 'Teff flakes', 'Whole and minimally processed grains', 'Rolled teff grain.', 'Moderate', 'https://www.gov.uk/food-labelling-and-packaging/ingredients-list', '27/10/2026', '', 'Autumn'],
      ['UIL-0591', 'Pregelatinised Starch', '', 'Starches and carbohydrate ingredients', 'Starch gelatinised and dried.', '', '', '', '', ''],
      ['UIL-0593', 'maltodextrin', '', 'Refined carbohydrates', 'Copy.', 'High', 'https://example.org', '2026-10-27', '', ''],
      ['ABC-1', 'Nameless', '', 'x', 'x', 'High', 'https://example.org', '2026-13-40', '', ''],
    ]);

    const preview = await call(fn.importer, admin, 'POST', '/api/admin/food-library', { action: 'preview', csv, fileName: 'test.csv' });
    assert.equal(preview.status, 200, preview.text);
    assert.deepEqual(preview.body.summary, { created: 1, updated: 1, unchanged: 0, duplicates: 1, rejected: 2, notInFile: 586 });
    assert.deepEqual(preview.body.updated[0].fields.sort(), ['Internal Notes', 'What It Is']);
    assert.match(preview.body.duplicates[0].reason, /already used by UIL-0001/);
    assert.match(preview.body.rejected.find((row) => row.ingredientId === 'UIL-0591').reasons.join(), /Evidence Quality/);
    assert.deepEqual(preview.body.extraColumns, ['Season']);
    assert.equal((await one('SELECT COUNT(*)::int AS n FROM ingredients')).n, 587, 'preview saves nothing');

    const stale = await call(fn.importer, admin, 'POST', '/api/admin/food-library', { action: 'apply', csv: `${csv}\r\n`, fileName: 'test.csv', fingerprint: preview.body.fingerprint });
    assert.equal(stale.status, 409);

    const applied = await call(fn.importer, admin, 'POST', '/api/admin/food-library', { action: 'apply', csv, fileName: 'test.csv', fingerprint: preview.body.fingerprint });
    assert.equal(applied.status, 200, applied.text);
    assert.equal((await one('SELECT COUNT(*)::int AS n FROM ingredients')).n, 588);
    const added = await one("SELECT * FROM ingredients WHERE ingredient_id = 'UIL-0592'");
    assert.equal(added.slug, 'test-teff-flakes');
    assert.equal(added.last_reviewed.toISOString().slice(0, 10), '2026-10-27');
    assert.deepEqual(added.extra_fields, { Season: 'Autumn' });
    const updated = await one("SELECT * FROM ingredients WHERE ingredient_id = 'UIL-0002'");
    assert.match(updated.what_it_is, /Updated\.$/);
    assert.equal(updated.internal_notes, 'Team note');
    // Columns not in the file keep their stored values.
    assert.equal(updated.processing_level, existing.processing_level);
    assert.equal(updated.better_alternatives, existing.better_alternatives);
    assert.equal(updated.slug, existing.slug);

    const again = await call(fn.importer, admin, 'POST', '/api/admin/food-library', { action: 'preview', csv, fileName: 'test.csv' });
    assert.deepEqual(again.body.summary, { created: 0, updated: 0, unchanged: 2, duplicates: 1, rejected: 2, notInFile: 586 });
    const reapply = await call(fn.importer, admin, 'POST', '/api/admin/food-library', { action: 'apply', csv, fileName: 'test.csv', fingerprint: again.body.fingerprint });
    assert.equal(reapply.status, 409);
    assert.equal((await one('SELECT COUNT(*)::int AS n FROM ingredients')).n, 588);

    const found = await call(fn.search, null, 'GET', '/api/food/search?q=teff%20flakes');
    assert.equal(found.body.results[0].name, 'Test Teff Flakes');

    const afterImport = await additiveFingerprint('additives');
    assert.equal(afterImport.hash, additivesFingerprint);
    assert.equal(afterImport.full_row, (await additiveFingerprint('additives_backup_2026_10_27')).full_row);
    const log = await one("SELECT COUNT(*)::int AS n FROM questionnaire_admin_access_log WHERE action = 'apply_ingredient_import'");
    assert.equal(log.n, 1);
  });

  test('the planner flags repeated UIL codes and refuses files without the ID column', () => {
    const repeated = planIngredientImport(toCsv([
      ['UIL-0700', 'Alpha', '', 'c', 'w', 'High', 'https://a.test', '2026-10-27', '', ''],
      ['UIL-0700', 'Beta', '', 'c', 'w', 'High', 'https://a.test', '2026-10-27', '', ''],
    ]));
    assert.equal(repeated.created.length, 0);
    assert.equal(repeated.duplicates.length, 2);
    assert.match(planIngredientImport('Name,Category\nA,B').error, /Ingredient ID/);
  });
});
