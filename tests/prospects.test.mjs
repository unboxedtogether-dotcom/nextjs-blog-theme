// Prospect (join-us) tests. They call the real public, member and admin
// endpoints against a throwaway local copy of Netlify Database built from the
// project's migrations, so no live data is read or changed.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { NetlifyDB } from '@netlify/database-dev';
import { cleanProspectSubmission, toggleOption } from '../utils/prospect-questionnaire.mjs';
import { safeReturnPath } from '../utils/auth-errors.js';

const origin = 'https://prospects.test';
const memberA = { sub: randomUUID(), email: 'prospect-a@prospects.test', name: 'Prospect Member A', roles: ['member'] };
const memberB = { sub: randomUUID(), email: 'prospect-b@prospects.test', name: 'Prospect Member B', roles: ['member'] };
const roleOnlyAdmin = { sub: randomUUID(), email: 'role-only@prospects.test', name: 'Role Only', roles: ['admin'] };
const admin = { sub: randomUUID(), email: 'admin@prospects.test', name: 'Allowlisted Admin', roles: ['member', 'admin'] };

function signInAs(member) {
  globalThis.netlifyIdentityContext = member
    ? { user: { sub: member.sub, email: member.email, app_metadata: { roles: member.roles }, user_metadata: { full_name: member.name } } }
    : undefined;
}

let ipCounter = 0;
async function call(handler, member, method, path, body, { ip = `10.0.0.${(ipCounter += 1)}`, headers = {} } = {}) {
  signInAs(member);
  const init = { method, headers: { origin, 'content-type': 'application/json', ...headers } };
  if (body !== undefined) init.body = JSON.stringify(body);
  const response = await handler(new Request(`${origin}${path}`, init), { ip });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: response.status, body: json, text, headers: response.headers };
}

const baseAnswers = () => ({
  topics: ['Food, ingredients and additives'],
  challenges: [],
  projects: ['30-Day Barcode Challenge', 'Unboxed Together app and tracking tools'],
  involvement: ['Become an early app tester'],
});
const submission = (overrides = {}) => ({
  idempotencyKey: randomUUID(),
  startedAt: Date.now() - 60_000,
  website: '',
  answers: baseAnswers(),
  firstName: '',
  email: '',
  consent: {},
  ...overrides,
});

describe('prospective member journey', () => {
  let localDb;
  let owner;
  let fn;
  let store;
  let withMemberAccess;
  let identityEvents;

  before(async () => {
    localDb = new NetlifyDB({ logger: () => {} });
    const url = await localDb.start();
    await localDb.applyMigrations(fileURLToPath(new URL('../netlify/database/migrations', import.meta.url)));
    process.env.NETLIFY_DB_URL = url;
    delete process.env.NETLIFY_DATABASE_URL;
    delete process.env.RESEND_API_KEY;

    const load = async (name) => (await import(`../netlify/functions/${name}.mjs`)).default;
    fn = {
      prospect: await load('prospect-interest'),
      preferences: await load('prospect-preferences'),
      memberInterest: await load('member-interest'),
      adminProspects: await load('admin-prospects'),
      questionnaire: await load('questionnaire'),
      member: await load('member-data'),
      adminQuestionnaires: await load('admin-questionnaires'),
      adminMessages: await load('admin-messages'),
      referral: await load('member-referral'),
    };
    identityEvents = (await import('../netlify/functions/identity.mjs')).default;
    store = await import('../netlify/functions/_shared/prospect-store.mjs');
    ({ withMemberAccess } = await import('../netlify/functions/_shared/member-access.mjs'));
    owner = new pg.Client({ connectionString: url });
    await owner.connect();
    await owner.query("INSERT INTO member_admins (email, user_id, added_by, role) VALUES ($1, $2, 'test', 'admin')", [admin.email, admin.sub]);
    for (const member of [memberA, memberB]) {
      const saved = await call(fn.questionnaire, member, 'PUT', '/api/questionnaire', {
        section: 1, idempotencyKey: randomUUID(), answers: { preferredName: member.name, email: member.email, adultConfirmed: true },
      });
      assert.equal(saved.status, 200, saved.text);
    }
  });

  after(async () => {
    signInAs(null);
    await owner?.end().catch(() => {});
    await localDb?.stop?.().catch(() => {});
  });

  const count = async (sql, params = []) => (await owner.query(sql, params)).rows[0].n;

  test('a visitor can submit without logging in, and no account is created', async () => {
    const profilesBefore = await count('SELECT count(*)::int AS n FROM profiles');
    const response = await call(fn.prospect, null, 'POST', '/api/prospect', submission());
    assert.equal(response.status, 201, response.text);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(await count('SELECT count(*)::int AS n FROM profiles'), profilesBefore, 'no member profile created');
    assert.deepEqual(Object.keys(response.body).sort(), ['contactRequested', 'marketingPending', 'ok'], 'answers are never echoed back');
  });

  test('repeated clicks with the same key store the submission once', async () => {
    const body = submission({ firstName: 'Repeat', email: 'repeat@prospects.test', consent: { project_contact: true } });
    // Sequential: the local test database shares one connection, so truly
    // parallel transactions are not meaningful here. In production the unique
    // idempotency key also settles simultaneous requests.
    for (let i = 0; i < 3; i += 1) {
      const response = await call(fn.prospect, null, 'POST', '/api/prospect', body, { ip: '10.1.1.1' });
      assert.equal(response.status, 201, response.text);
    }
    assert.equal(await count('SELECT count(*)::int AS n FROM prospect_submissions WHERE idempotency_key = $1', [body.idempotencyKey]), 1);
    assert.equal(await count("SELECT count(*)::int AS n FROM email_outbox WHERE to_email = 'repeat@prospects.test'"), 1, 'one confirmation email queued');
    // A fresh page sending identical answers straight away is also treated as a duplicate.
    await call(fn.prospect, null, 'POST', '/api/prospect', { ...body, idempotencyKey: randomUUID() }, { ip: '10.1.1.2' });
    assert.equal(await count("SELECT count(*)::int AS n FROM prospect_submissions WHERE email = 'repeat@prospects.test'"), 1);
  });

  test('choices are validated on the server', async () => {
    const bad = [
      { ...baseAnswers(), topics: [] },
      { ...baseAnswers(), topics: ['Not an option'] },
      { ...baseAnswers(), challenges: ['Nothing in particular', 'Sleep quality'] },
      { ...baseAnswers(), challenges: ['Prefer not to say', 'Nothing in particular'] },
      { ...baseAnswers(), involvement: ['Just explore for now', 'Become an early app tester'] },
      { ...baseAnswers(), projects: 'Community discussions' },
    ];
    for (const answers of bad) {
      const response = await call(fn.prospect, null, 'POST', '/api/prospect', submission({ answers }));
      assert.equal(response.status, 422, JSON.stringify(answers));
    }
    const noEmail = await call(fn.prospect, null, 'POST', '/api/prospect', submission({ firstName: 'Sam', consent: { project_contact: true } }));
    assert.equal(noEmail.status, 422, 'contact permission needs an email address');
    const badEmail = await call(fn.prospect, null, 'POST', '/api/prospect', submission({ email: 'not-an-email' }));
    assert.equal(badEmail.status, 422);
    const badKey = await call(fn.prospect, null, 'POST', '/api/prospect', submission({ idempotencyKey: 'x' }));
    assert.equal(badKey.status, 400);
  });

  test('exclusive answers replace other selections in the browser helper', () => {
    assert.deepEqual(toggleOption('challenges', ['Sleep quality'], 'Prefer not to say'), ['Prefer not to say']);
    assert.deepEqual(toggleOption('challenges', ['Prefer not to say'], 'Sleep quality'), ['Sleep quality']);
    assert.deepEqual(toggleOption('involvement', ['Become an early app tester'], 'Just explore for now'), ['Just explore for now']);
  });

  test('personal challenges are only stored with explicit consent', async () => {
    const challenges = ['Sleep quality', 'Stress or feeling overwhelmed'];
    const without = submission({ answers: { ...baseAnswers(), challenges } });
    assert.equal((await call(fn.prospect, null, 'POST', '/api/prospect', without)).status, 201);
    const [stored] = (await owner.query('SELECT support_interests FROM prospect_submissions WHERE idempotency_key = $1', [without.idempotencyKey])).rows;
    assert.deepEqual(stored.support_interests, [], 'dropped without consent');

    const withConsent = submission({ answers: { ...baseAnswers(), challenges }, consent: { sensitive_answers: true } });
    assert.equal((await call(fn.prospect, null, 'POST', '/api/prospect', withConsent)).status, 201);
    const [kept] = (await owner.query(`
      SELECT s.support_interests, p.permission_type, p.consent_text_version FROM prospect_submissions s
      JOIN prospect_contact_permissions p ON p.prospect_id = s.id WHERE s.idempotency_key = $1
    `, [withConsent.idempotencyKey])).rows;
    assert.deepEqual(kept.support_interests, challenges);
    assert.equal(kept.permission_type, 'sensitive_answers');
    assert.ok(kept.consent_text_version);

    const skipped = submission({ answers: { ...baseAnswers(), challenges: ['Prefer not to say'] } });
    assert.equal((await call(fn.prospect, null, 'POST', '/api/prospect', skipped)).status, 201, 'prefer not to say needs no consent');
  });

  test('interest can be registered without agreeing to marketing, and consents are recorded separately', async () => {
    const body = submission({ firstName: 'Jo', email: 'jo@prospects.test', consent: { project_contact: true, general_marketing: false } });
    const response = await call(fn.prospect, null, 'POST', '/api/prospect', body);
    assert.equal(response.body.contactRequested, true);
    assert.equal(response.body.marketingPending, false);
    const rows = (await owner.query(`
      SELECT p.permission_type, p.granted, p.verified_at FROM prospect_contact_permissions p
      JOIN prospect_submissions s ON s.id = p.prospect_id WHERE s.email = 'jo@prospects.test'
    `)).rows;
    assert.deepEqual(rows.map((row) => row.permission_type), ['project_contact']);
    const cleaned = cleanProspectSubmission(submission({ firstName: 'Al', email: 'al@x.test', consent: { general_marketing: 'yes' } }));
    assert.equal(cleaned.values.permissions.general_marketing, false, 'only a real true counts as consent');
  });

  test('bots, other sites and floods are turned away', async () => {
    const honeypot = submission({ website: 'http://spam.example', email: 'bot@prospects.test' });
    assert.equal((await call(fn.prospect, null, 'POST', '/api/prospect', honeypot)).status, 201);
    const tooFast = submission({ startedAt: Date.now(), email: 'fast@prospects.test' });
    assert.equal((await call(fn.prospect, null, 'POST', '/api/prospect', tooFast)).status, 201);
    assert.equal(await count("SELECT count(*)::int AS n FROM prospect_submissions WHERE email IN ('bot@prospects.test', 'fast@prospects.test')"), 0, 'nothing stored');

    const foreign = await call(fn.prospect, null, 'POST', '/api/prospect', submission(), { headers: { origin: 'https://evil.example' } });
    assert.equal(foreign.status, 403);

    const statuses = [];
    for (let i = 0; i < 7; i += 1) statuses.push((await call(fn.prospect, null, 'POST', '/api/prospect', submission(), { ip: '10.9.9.9' })).status);
    assert.deepEqual(statuses.slice(0, 5), [201, 201, 201, 201, 201]);
    assert.equal(statuses[5], 429, 'rate limited after five an hour');
    assert.equal((await call(fn.prospect, null, 'GET', '/api/prospect')).status, 405);
  });

  test('anonymous users, members and role-only admins cannot read prospects', async () => {
    assert.equal((await call(fn.adminProspects, null, 'GET', '/api/admin/prospects')).status, 401);
    assert.equal((await call(fn.memberInterest, null, 'GET', '/api/member/interest')).status, 401);
    for (const member of [memberA, roleOnlyAdmin]) {
      for (const path of ['/api/admin/prospects', '/api/admin/prospects?view=export&kind=marketing', `/api/admin/prospects?view=detail&id=${randomUUID()}`]) {
        const response = await call(fn.adminProspects, member, 'GET', path);
        assert.equal(response.status, 403, `${member.name} ${path}`);
        assert.ok(!response.text.includes('@prospects.test'));
      }
      const erase = await call(fn.adminProspects, member, 'DELETE', '/api/admin/prospects', { id: randomUUID(), confirmation: 'DELETE' });
      assert.equal(erase.status, 403);
    }
  });

  test('the restricted database role cannot read prospect tables at all', async () => {
    for (const table of ['prospect_submissions', 'prospect_contact_permissions', 'prospect_email_suppressions', 'email_outbox']) {
      await assert.rejects(withMemberAccess(memberA.sub, (query) => query(`SELECT * FROM ${table}`)), /permission denied/, table);
      await assert.rejects(withMemberAccess(admin.sub, (query) => query(`SELECT * FROM ${table}`), 'admin'), /permission denied/, `${table} (admin role)`);
    }
  });

  test('an allowlisted admin sees summaries, minimal details and a consent-based export, and access is logged', async () => {
    const list = await call(fn.adminProspects, admin, 'GET', '/api/admin/prospects');
    assert.equal(list.status, 200, list.text);
    assert.equal(list.headers.get('cache-control'), 'no-store');
    assert.ok(list.body.summary.total >= 5);
    assert.ok(list.body.summary.app >= 1 && list.body.summary.barcode >= 1);
    assert.ok(!list.text.includes('@prospects.test'), 'the list view never includes email addresses');

    const filtered = await call(fn.adminProspects, admin, 'GET', '/api/admin/prospects?search=Jo&permission=project_contact');
    assert.ok(filtered.body.prospects.some((item) => item.first_name === 'Jo'));

    const anonymousRow = list.body.prospects.find((item) => !item.has_email);
    const detail = await call(fn.adminProspects, admin, 'GET', `/api/admin/prospects?view=detail&id=${anonymousRow.id}`);
    assert.equal(detail.status, 200);

    // Marketing export includes only confirmed marketing consent.
    const marketing = submission({ firstName: '=HYPERLINK("x")', email: 'news@prospects.test', consent: { general_marketing: true } });
    const saved = await call(fn.prospect, null, 'POST', '/api/prospect', marketing);
    assert.equal(saved.body.marketingPending, true);
    let csv = await call(fn.adminProspects, admin, 'GET', '/api/admin/prospects?view=export&kind=marketing');
    assert.equal(csv.status, 200);
    assert.ok(!csv.text.includes('news@prospects.test'), 'unconfirmed marketing is not exported');
    assert.ok(!csv.text.includes('jo@prospects.test'), 'project contact alone is not marketing consent');

    const [queued] = (await owner.query("SELECT payload FROM email_outbox WHERE to_email = 'news@prospects.test'")).rows;
    const token = new URLSearchParams(queued.payload.manageUrl.split('#')[1]).get('token');
    const confirm = await call(fn.preferences, null, 'POST', '/api/prospect/preferences', { token, action: 'confirm_marketing' });
    assert.equal(confirm.body.permissions.general_marketing, 'verified');
    csv = await call(fn.adminProspects, admin, 'GET', '/api/admin/prospects?view=export&kind=marketing');
    assert.ok(csv.text.includes('news@prospects.test'), 'confirmed marketing is exported');
    assert.ok(csv.text.includes(`"'=HYPERLINK`), 'spreadsheet formulas are neutralised');

    const appSegment = await call(fn.adminProspects, admin, 'GET', '/api/admin/prospects?view=export&kind=project&segment=app');
    assert.ok(appSegment.text.includes('jo@prospects.test'), 'project contacts are exported for their project');
    assert.ok(!appSegment.text.includes('news@prospects.test'), 'marketing-only contacts are not in project segments');

    const logged = await count("SELECT count(*)::int AS n FROM questionnaire_admin_access_log WHERE admin_user_id = $1 AND resource_type = 'prospect'", [admin.sub]);
    assert.ok(logged >= 5, 'admin views and exports are audited');
  });

  test('preference links can withdraw consent and erase a record', async () => {
    assert.equal((await call(fn.preferences, null, 'POST', '/api/prospect/preferences', { token: 'x'.repeat(43) })).status, 404);
    const [queued] = (await owner.query("SELECT payload, prospect_id FROM email_outbox WHERE to_email = 'news@prospects.test'")).rows;
    const token = new URLSearchParams(queued.payload.manageUrl.split('#')[1]).get('token');
    const loaded = await call(fn.preferences, null, 'POST', '/api/prospect/preferences', { token });
    assert.ok(!loaded.text.includes('@'), 'no email or answers returned');
    const withdrawn = await call(fn.preferences, null, 'POST', '/api/prospect/preferences', { token, action: 'withdraw', type: 'general_marketing' });
    assert.equal(withdrawn.body.permissions.general_marketing, false);
    const [history] = (await owner.query("SELECT withdrawn_at FROM prospect_contact_permissions WHERE prospect_id = $1 AND permission_type = 'general_marketing'", [queued.prospect_id])).rows;
    assert.ok(history.withdrawn_at, 'withdrawal is kept in the audit trail');
    const csv = await call(fn.adminProspects, admin, 'GET', '/api/admin/prospects?view=export&kind=marketing');
    assert.ok(!csv.text.includes('news@prospects.test'));

    const erased = await call(fn.preferences, null, 'POST', '/api/prospect/preferences', { token, action: 'erase' });
    assert.equal(erased.body.erased, true);
    assert.equal(await count('SELECT count(*)::int AS n FROM prospect_submissions WHERE id = $1', [queued.prospect_id]), 0);
    assert.equal(await count('SELECT count(*)::int AS n FROM prospect_email_suppressions'), 1, 'only a hash is kept');
    assert.equal(await count("SELECT count(*)::int AS n FROM prospect_email_suppressions WHERE email_hash LIKE '%@%'"), 0);
  });

  test('prospects link to members only through a verified, confirmed email', async () => {
    const body = submission({ firstName: 'A', email: memberA.email, consent: { project_contact: true } });
    assert.equal((await call(fn.prospect, null, 'POST', '/api/prospect', body)).status, 201);
    const [row] = (await owner.query('SELECT id FROM prospect_submissions WHERE idempotency_key = $1', [body.idempotencyKey])).rows;

    // A session without a confirmed email (claims only) is offered nothing and cannot link.
    const unverified = await call(fn.memberInterest, memberA, 'GET', '/api/member/interest');
    assert.equal(unverified.status, 200);
    assert.deepEqual(unverified.body.available, []);
    const attempt = await call(fn.memberInterest, memberA, 'POST', '/api/member/interest', { action: 'link', id: row.id });
    assert.equal(attempt.status, 403);

    // Member B, verified, cannot see or link a record carrying A's email.
    const verifiedB = { id: memberB.sub, email: memberB.email, confirmedAt: new Date().toISOString() };
    assert.deepEqual((await store.prospectsForMember(verifiedB)).available, []);
    assert.equal(await store.linkProspect(verifiedB, row.id), false);
    // Not even with A's id supplied alongside.
    assert.equal(await store.linkProspect({ ...verifiedB, userId: memberA.sub }, row.id), false);

    const verifiedA = { id: memberA.sub, email: memberA.email, confirmedAt: new Date().toISOString() };
    assert.deepEqual((await store.prospectsForMember(verifiedA)).available.map((item) => item.id), [row.id]);
    assert.equal(await store.linkProspect(verifiedA, row.id), true);
    assert.equal(await store.linkProspect(verifiedA, row.id), false, 'cannot be linked twice');
    assert.deepEqual((await store.prospectsForMember(verifiedA)).linked.map((item) => item.id), [row.id]);
    assert.equal(await store.unlinkProspect(verifiedB, row.id), false, "B cannot unlink A's record");

    // The member's welcome answers are untouched by linking.
    const dashboard = await call(fn.member, memberA, 'GET', '/api/member');
    assert.equal(dashboard.body.profile.display_name, memberA.name);
    const summary = await call(fn.adminProspects, admin, 'GET', '/api/admin/prospects?registered=yes');
    assert.ok(summary.body.summary.registered >= 1);
    assert.ok(summary.body.prospects.every((item) => item.registered));
  });

  test('an allowlisted admin can use the existing team tools, and members still only see themselves', async () => {
    const list = await call(fn.adminQuestionnaires, admin, 'GET', '/api/admin/questionnaires');
    assert.equal(list.status, 200, list.text);
    const ids = list.body.members.map((member) => member.id);
    assert.ok(ids.includes(memberA.sub) && ids.includes(memberB.sub));
    const detail = await call(fn.adminQuestionnaires, admin, 'GET', `/api/admin/questionnaires?member=${memberB.sub}`);
    assert.equal(detail.body.member.profile.display_name, memberB.name);
    assert.equal((await call(fn.adminMessages, admin, 'GET', '/api/admin/messages')).status, 200);
    const logged = await count('SELECT count(*)::int AS n FROM questionnaire_admin_access_log WHERE admin_user_id = $1 AND member_user_id = $2', [admin.sub, memberB.sub]);
    assert.ok(logged >= 1, 'viewing a member is audited');
    // Admin access is per request: member A's session in between sees only A.
    const a = await call(fn.member, memberA, 'GET', '/api/member');
    assert.equal(a.body.profile.display_name, memberA.name);
    assert.equal(a.body.isAdmin, false);
    assert.ok(!a.text.includes(memberB.name));
  });

  test('confirming a new account queues one branded welcome email', async () => {
    const newcomer = { id: randomUUID(), email: 'newcomer@prospects.test', userMetadata: { full_name: 'New Comer' }, appMetadata: {} };
    const result = await identityEvents.userSignup({ user: newcomer });
    assert.deepEqual(result.user.appMetadata.roles, ['member'], 'new accounts only ever get the member role');
    await identityEvents.userSignup({ user: newcomer });
    const rows = (await owner.query("SELECT kind, status, payload FROM email_outbox WHERE user_id = $1", [newcomer.id])).rows;
    assert.equal(rows.length, 1, 'only one welcome email');
    assert.equal(rows[0].kind, 'member_welcome');
    assert.equal(rows[0].status, 'queued', 'nothing is sent without an email provider');
    const { renderEmail } = await import('../netlify/functions/_shared/email.mjs');
    const email = renderEmail('member_welcome', rows[0].payload);
    assert.match(email.html, /unboxed-together-logo\.png/);
    assert.match(email.html, /Hi New,/);
    const confirmation = renderEmail('interest_confirmation', { firstName: '<script>', manageUrl: 'https://x.test/join-us/preferences#token=abc', marketingPending: true });
    assert.ok(!confirmation.html.includes('<script>'), 'names are escaped');
    assert.match(confirmation.html, /Confirm my email preferences/);
  });

  test('refer a friend needs a signed-in, confirmed member and never emails friends without consent', async () => {
    assert.equal((await call(fn.referral, null, 'GET', '/api/member/refer')).status, 401);
    const summary = await call(fn.referral, memberA, 'GET', '/api/member/refer');
    assert.equal(summary.status, 200, summary.text);
    assert.deepEqual(Object.keys(summary.body).sort(), ['createdThisMonth', 'preferredName', 'referrals', 'remainingToday']);
    // Test sessions carry no confirmation date, so creating an invitation is refused.
    const unconfirmed = await call(fn.referral, memberA, 'POST', '/api/member/refer', { email: 'friend@prospects.test' });
    assert.equal(unconfirmed.status, 403);
    assert.equal(await count("SELECT count(*)::int AS n FROM email_outbox WHERE kind = 'friend_referral'"), 0);
    const { renderEmail } = await import('../netlify/functions/_shared/email.mjs');
    const email = renderEmail('friend_referral', { referralUrl: 'https://x.test/join-us?ref=abc', referrerName: '<Sam>' });
    assert.match(email.html, /join-us\?ref=abc/);
    assert.match(email.html, /&lt;SAM&gt; THOUGHT YOU MIGHT FIND THIS INTERESTING/, 'names are escaped');
    assert.equal(email.subject, 'You’ve been invited to discover Unboxed Together');
    const anonymous = renderEmail('friend_referral', { referralUrl: 'https://x.test/join-us?ref=abc', referrerName: null });
    assert.match(anonymous.html, /SOMEONE THOUGHT YOU MIGHT FIND THIS INTERESTING/);
    assert.match(anonymous.html, /DISCOVER UNBOXED TOGETHER|Discover Unboxed Together/);
  });

  test('retention removes expired records without contact permission', async () => {
    const body = submission();
    await call(fn.prospect, null, 'POST', '/api/prospect', body);
    await owner.query("UPDATE prospect_submissions SET retain_until = NOW() - INTERVAL '1 day' WHERE idempotency_key = $1", [body.idempotencyKey]);
    await owner.query("UPDATE prospect_submissions SET retain_until = NOW() - INTERVAL '1 day' WHERE email = 'jo@prospects.test'");
    const result = await store.runRetention();
    assert.ok(result.expired >= 1);
    assert.equal(await count('SELECT count(*)::int AS n FROM prospect_submissions WHERE idempotency_key = $1', [body.idempotencyKey]), 0);
    assert.equal(await count("SELECT count(*)::int AS n FROM prospect_submissions WHERE email = 'jo@prospects.test'"), 1, 'kept while contact permission is active');
  });
});

describe('login redirects', () => {
  test('only same-site paths are accepted', () => {
    assert.equal(safeReturnPath('/members/progress'), '/members/progress');
    assert.equal(safeReturnPath('/onboarding?page=2'), '/onboarding?page=2');
    for (const value of ['//evil.example', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)', '/\tevil', undefined, ['/members']]) {
      assert.equal(safeReturnPath(value), '/members', String(value));
    }
  });
});
