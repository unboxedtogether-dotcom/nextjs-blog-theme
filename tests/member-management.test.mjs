// Member management, reminder, email delivery and referral tests. They call
// the real member, admin, public and webhook endpoints as separate test
// accounts, against a throwaway local copy of Netlify Database built from the
// project's migrations, so no live data is read or changed. The email
// provider is replaced by a local stand-in, so nothing is ever sent.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { NetlifyDB } from '@netlify/database-dev';
import {
  checkinSchedule, reminderEligibility, referralStage, welcomeStatus, optionalStatus,
} from '../utils/member-status.mjs';

const origin = 'https://management.test';
const alice = { sub: randomUUID(), email: 'alice@management.test', name: 'Alice Tracker', roles: ['member'] };
const bob = { sub: randomUUID(), email: 'bob@management.test', name: 'Bob Newcomer', roles: ['member'] };
const carol = { sub: randomUUID(), email: 'carol@management.test', name: 'Carol Quiet', roles: ['member'] };
const dave = { sub: randomUUID(), email: 'dave@management.test', name: 'Dave Unverified' };
const admin = { sub: randomUUID(), email: 'admin@management.test', name: 'Management Admin', roles: ['member', 'admin'] };
const best = { sleepQuality: 5, restedAfterSleep: 3, enoughSleep: 3, mood: 5, managingDemands: 5, energy: 5, focus: 5, regularMeals: 7, freshMeals: 7, fruitVeg: 3, hydration: 3, movementDays: 5 };
const webhookSecret = `whsec_${Buffer.from('management-test-secret').toString('base64')}`;

function signInAs(member) {
  globalThis.netlifyIdentityContext = member
    ? { user: { sub: member.sub, email: member.email, app_metadata: { roles: member.roles }, user_metadata: { full_name: member.name } } }
    : undefined;
}

async function call(handler, member, method, path, body, headers = {}) {
  signInAs(member);
  const init = { method, headers: { origin, 'content-type': 'application/json', ...headers } };
  if (body !== undefined) init.body = typeof body === 'string' ? body : JSON.stringify(body);
  const response = await handler(new Request(`${origin}${path}`, init), { ip: '10.1.0.1' });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: response.status, body: json, text };
}

const addDays = (date, count) => new Date(Date.parse(`${date}T00:00:00Z`) + count * 86400000).toISOString().slice(0, 10);

// Stand-in for the email provider: records requests and answers as told.
const provider = { requests: [], respond: () => ({ status: 200, body: { id: `msg_${randomUUID()}` } }) };
const realFetch = globalThis.fetch;
function useProvider() {
  process.env.RESEND_API_KEY = 'test-key';
  process.env.EMAIL_FROM = 'Unboxed Together <test@management.test>';
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith('https://api.resend.com/')) {
      const body = JSON.parse(init.body);
      provider.requests.push({ url: String(url), headers: init.headers, body });
      const { status, body: reply } = provider.respond(body);
      return new Response(JSON.stringify(reply), { status, headers: { 'content-type': 'application/json' } });
    }
    return realFetch(url, init);
  };
}
function stopProvider() {
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  globalThis.fetch = realFetch;
}

function signedWebhook(payload, { id = `evt_${randomUUID()}`, secret = webhookSecret, timestamp = Math.floor(Date.now() / 1000) } = {}) {
  const body = JSON.stringify(payload);
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const signature = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
  return { body, headers: { 'svix-id': id, 'svix-timestamp': String(timestamp), 'svix-signature': `v1,${signature}` } };
}

describe('status rules', () => {
  const week = '2026-10-26';
  test('weekly check-in due dates follow the Monday-to-Sunday reporting weeks', () => {
    const base = { progressConsent: true, currentWeekStart: week, today: week, checkedInThisWeek: false, checkedInLastWeek: false };
    assert.equal(checkinSchedule({ ...base, progressConsent: false, baselineWeekStart: '2026-10-12' }).status, 'not_applicable');
    assert.equal(checkinSchedule({ ...base, baselineWeekStart: null }).status, 'baseline_needed');
    const waiting = checkinSchedule({ ...base, baselineWeekStart: week });
    assert.deepEqual([waiting.status, waiting.opensOn, waiting.nextDue], ['waiting', '2026-11-02', '2026-11-08']);
    const week1 = checkinSchedule({ ...base, baselineWeekStart: '2026-10-19' });
    assert.deepEqual([week1.status, week1.weekNumber, week1.nextDue], ['due', 1, '2026-11-01'], 'Week 1 cannot be overdue');
    assert.equal(checkinSchedule({ ...base, baselineWeekStart: '2026-10-12', checkedInLastWeek: true }).status, 'due');
    assert.equal(checkinSchedule({ ...base, baselineWeekStart: '2026-10-12' }).status, 'overdue', 'last week was missed');
    assert.equal(checkinSchedule({ ...base, baselineWeekStart: '2026-10-12', checkedInLastWeek: true, today: '2026-11-01' }).status, 'due_today');
    const done = checkinSchedule({ ...base, baselineWeekStart: '2026-10-12', checkedInThisWeek: true });
    assert.deepEqual([done.status, done.nextDue], ['completed', '2026-11-08']);
  });

  test('only the required welcome page can be outstanding', () => {
    assert.equal(welcomeStatus({ completedAt: null, startedAt: null }), 'not_started');
    assert.equal(welcomeStatus({ completedAt: null, startedAt: '2026-10-20' }), 'in_progress');
    assert.equal(welcomeStatus({ completedAt: '2026-10-20', startedAt: null }), 'completed');
    assert.equal(optionalStatus({ consentGiven: false, sectionsSaved: 0 }), 'not_applicable', 'optional health pages are never overdue');
  });

  test('reminder eligibility gives a reason for every exclusion', () => {
    const member = {
      id: 'm', email: 'm@x.test', email_verified: true, welcome_status: 'not_started', progress_consent: true, checkin_status: 'overdue',
      current_week_start: week, reminders: {}, reminder_counts: {}, membership_status: 'active',
    };
    assert.equal(reminderEligibility('welcome', member).eligible, true);
    assert.match(reminderEligibility('welcome', { ...member, email_verified: false }).reason, /not verified/);
    assert.match(reminderEligibility('welcome', { ...member, reminders_paused: true }).reason, /turned reminder emails off/);
    assert.match(reminderEligibility('welcome', { ...member, reminder_counts: { welcome: 3 } }).reason, /Already sent 3/);
    assert.match(reminderEligibility('welcome', { ...member, reminders: { welcome: { status: 'sent', at: new Date().toISOString() } } }).reason, /last 6 days/);
    assert.equal(reminderEligibility('welcome', { ...member, reminders: { welcome: { status: 'failed', at: new Date().toISOString() } } }).eligible, true, 'a failed reminder does not count');
    assert.match(reminderEligibility('checkin', { ...member, checkin_status: 'completed' }).reason, /already completed/);
    assert.match(reminderEligibility('checkin', { ...member, reminders: { checkin: { status: 'queued', at: '2026-10-20T00:00:00Z', week } } }).reason, /this week/);
    assert.match(reminderEligibility('checkin', { ...member, email_suppressed: true }).reason, /bounced/);
  });

  test('referral stages never call an email delivered before the provider confirms it', () => {
    assert.equal(referralStage({}), 'awaiting_sharing');
    assert.equal(referralStage({ email_status: 'queued' }), 'email_queued');
    assert.equal(referralStage({ email_status: 'sent' }), 'email_accepted');
    assert.equal(referralStage({ email_status: 'delivered' }), 'email_delivered');
    assert.equal(referralStage({ email_status: 'bounced' }), 'email_failed');
    assert.equal(referralStage({ registered_at: 'x', onboarded_at: 'y' }), 'onboarded');
  });
});

describe('member management, reminders and referrals', () => {
  let localDb;
  let owner;
  let fn;
  let directory;
  let email;
  let identityEvents;
  const count = async (sql, params = []) => (await owner.query(sql, params)).rows[0].n;

  before(async () => {
    stopProvider();
    delete process.env.RESEND_WEBHOOK_SECRET;
    localDb = new NetlifyDB({ logger: () => {} });
    const url = await localDb.start();
    await localDb.applyMigrations(fileURLToPath(new URL('../netlify/database/migrations', import.meta.url)));
    process.env.NETLIFY_DB_URL = url;
    delete process.env.NETLIFY_DATABASE_URL;
    owner = new pg.Client({ connectionString: url });
    await owner.connect();
    await owner.query("INSERT INTO member_admins (email, user_id, added_by, role) VALUES ($1, $2, 'test', 'admin')", [admin.email, admin.sub]);

    const load = async (name) => (await import(`../netlify/functions/${name}.mjs`)).default;
    fn = {
      member: await load('member-data'),
      questionnaire: await load('questionnaire'),
      progress: await load('progress'),
      adminMembers: await load('admin-members'),
      adminEmails: await load('admin-emails'),
      adminProgress: await load('admin-progress'),
      referral: await load('member-referral'),
      referralOpen: await load('referral-open'),
      prospect: await load('prospect-interest'),
      webhook: await load('email-webhook'),
    };
    directory = await import('../netlify/functions/_shared/member-directory.mjs');
    email = await import('../netlify/functions/_shared/email.mjs');
    identityEvents = (await import('../netlify/functions/identity.mjs')).default;

    // Alice: welcome form, progress tracking, baseline two weeks ago, no check-ins since.
    const saved = await call(fn.questionnaire, alice, 'PUT', '/api/questionnaire', {
      section: 1, idempotencyKey: randomUUID(), answers: { preferredName: alice.name, email: alice.email, adultConfirmed: true, town: 'Secretville' },
    });
    assert.equal(saved.status, 200, saved.text);
    assert.equal((await call(fn.progress, alice, 'POST', '/api/progress', { action: 'consent', consent: true })).status, 200);
    const [{ today }] = (await owner.query("SELECT to_char(timezone('Europe/London', NOW()), 'YYYY-MM-DD') AS today")).rows;
    const baseline = await call(fn.progress, alice, 'POST', '/api/progress', { action: 'submit', formType: 'baseline_wellbeing', idempotencyKey: randomUUID(), answers: best, entryDate: addDays(today, -14) });
    assert.equal(baseline.status, 200, baseline.text);
    // Bob: signed in once, nothing else.
    assert.equal((await call(fn.member, bob, 'GET', '/api/member')).status, 200);
    // Carol: opened the welcome form, then turned reminder emails off.
    assert.equal((await call(fn.questionnaire, carol, 'GET', '/api/questionnaire')).status, 200);
    assert.equal((await call(fn.member, carol, 'PUT', '/api/member', { preferences: { marketingConsent: false, reminderEmails: false } })).status, 200);
    // Alice's confirmation, as the Identity signup event records it.
    await owner.query('UPDATE profiles SET email_verified_at = NOW() WHERE id = $1', [alice.sub]);
  });

  after(async () => {
    stopProvider();
    signInAs(null);
    await owner?.end().catch(() => {});
    await localDb?.stop?.().catch(() => {});
  });

  const list = async (query = '') => {
    const response = await call(fn.adminMembers, admin, 'GET', `/api/admin/members?pageSize=100${query}`);
    assert.equal(response.status, 200, response.text);
    return { ...response.body, byId: Object.fromEntries(response.body.members.map((member) => [member.id, member])) };
  };

  test('Identity accounts without a profile are added once, without overwriting anything', async () => {
    const accounts = new Map([
      [dave.sub, { id: dave.sub, email: dave.email, userMetadata: { full_name: dave.name }, createdAt: '2026-10-20T10:00:00Z' }],
      [alice.sub, { id: alice.sub, email: alice.email, userMetadata: { full_name: 'Someone Else' }, createdAt: '2026-10-01T10:00:00Z', confirmedAt: '2026-10-01T11:00:00Z' }],
    ]);
    const first = await directory.reconcileIdentityAccounts(accounts);
    assert.equal(first.created, 1);
    const again = await directory.reconcileIdentityAccounts(accounts);
    assert.equal(again.created, 0, 'no duplicate members');
    const { rows } = await owner.query('SELECT id, display_name, created_via, email_verified_at FROM profiles WHERE id = ANY($1)', [[alice.sub, dave.sub]]);
    const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
    assert.equal(byId[alice.sub].display_name, alice.name, 'existing names are kept');
    assert.equal(byId[dave.sub].created_via, 'identity_reconcile');
    assert.equal(byId[dave.sub].email_verified_at, null, 'not confirmed in Identity, so not verified');
  });

  test('the member list shows every registered member and keeps prospects apart', async () => {
    const before = await list();
    const interest = await call(fn.prospect, null, 'POST', '/api/prospect', {
      idempotencyKey: randomUUID(), startedAt: Date.now() - 60_000, website: '', firstName: 'Pat', email: '', consent: {},
      answers: { topics: ['Food, ingredients and additives'], challenges: [], projects: ['30-Day Barcode Challenge'], involvement: ['Become an early app tester'] },
    });
    assert.equal(interest.status, 201, interest.text);
    const { summary, byId, total } = await list();
    assert.equal(summary.members, before.summary.members, 'a prospect is not a member');
    assert.equal(total, 4);
    assert.equal(byId[dave.sub].stage, 'registered');
    assert.equal(byId[dave.sub].email_verified, false);
    assert.equal(byId[bob.sub].welcome_status, 'not_started');
    assert.equal(byId[carol.sub].welcome_status, 'in_progress');
    assert.equal(byId[carol.sub].reminders_paused, true);
    assert.equal(byId[alice.sub].welcome_status, 'completed');
    assert.equal(byId[alice.sub].checkin_status, 'overdue');
    assert.equal(byId[alice.sub].email, alice.email);
    assert.equal(summary.unverified, 1);
    assert.equal(summary.welcomeCompleted, 1);
    assert.equal(summary.checkinOverdue, 1);
    assert.equal(summary.awaitingOnboarding, 2, 'verified members without the welcome form');
  });

  test('search, filters, sorting and pagination run on the server', async () => {
    assert.deepEqual((await list('&q=carol@')).members.map((member) => member.id), [carol.sub]);
    assert.deepEqual((await list('&filter=checkin_overdue')).members.map((member) => member.id), [alice.sub]);
    assert.deepEqual((await list('&filter=unverified')).members.map((member) => member.id), [dave.sub]);
    const sorted = await list('&sort=name_asc');
    assert.deepEqual(sorted.members.map((member) => member.display_name), [alice.name, bob.name, carol.name, dave.name]);
    const paged = await call(fn.adminMembers, admin, 'GET', '/api/admin/members?pageSize=5&page=9');
    assert.equal(paged.body.page, 1, 'out-of-range pages are clamped');
    assert.equal((await call(fn.adminMembers, admin, 'GET', '/api/admin/members?filter=nope')).status, 422);
  });

  test('only allowlisted admins can use member management', async () => {
    assert.equal((await call(fn.adminMembers, null, 'GET', '/api/admin/members')).status, 401);
    assert.equal((await call(fn.adminMembers, alice, 'GET', '/api/admin/members')).status, 403);
    assert.equal((await call(fn.adminMembers, alice, 'GET', `/api/admin/members?member=${bob.sub}`)).status, 403);
    assert.equal((await call(fn.adminMembers, alice, 'POST', '/api/admin/members', { action: 'send_reminders', type: 'welcome', members: [bob.sub], confirm: true })).status, 403);
    assert.equal((await call(fn.adminEmails, bob, 'GET', '/api/admin/emails')).status, 403);
    assert.equal((await call(fn.adminEmails, bob, 'POST', '/api/admin/emails', { action: 'retry', id: randomUUID() })).status, 403);
  });

  test('a member record brings everything together without exposing answers', async () => {
    const record = await call(fn.adminMembers, admin, 'GET', `/api/admin/members?member=${alice.sub}`);
    assert.equal(record.status, 200, record.text);
    assert.ok(!record.text.includes('Secretville'), 'questionnaire answers stay behind the logged form view');
    assert.ok(!record.text.includes('"answers"'));
    assert.equal(record.body.member.welcome_status, 'completed');
    assert.equal(record.body.progress.baseline.date !== null, true);
    assert.equal(record.body.progress.scoringVersion, 'wellbeing-v1');
    assert.ok(record.body.timeline.some((event) => event.label === 'Welcome form completed'));
    assert.ok(record.body.timeline.some((event) => event.label === 'Baseline completed'));
    assert.equal((await call(fn.adminMembers, admin, 'GET', `/api/admin/members?member=${randomUUID()}`)).status, 404);
    assert.ok(await count("SELECT count(*)::int AS n FROM questionnaire_admin_access_log WHERE action = 'view_member_record' AND member_user_id = $1", [alice.sub]) >= 1, 'record views are audited');
  });

  test('bulk reminders preview who is excluded and why, and never send twice', async () => {
    const everyone = [alice.sub, bob.sub, carol.sub, dave.sub];
    const preview = await call(fn.adminMembers, admin, 'POST', '/api/admin/members', { action: 'preview_reminders', type: 'welcome', members: everyone });
    assert.equal(preview.status, 200, preview.text);
    assert.equal(preview.body.selected, 4);
    assert.deepEqual(preview.body.eligible.map((member) => member.id), [bob.sub]);
    const reasons = Object.fromEntries(preview.body.excluded.map((item) => [item.id, item.reason]));
    assert.match(reasons[alice.sub], /already completed/);
    assert.match(reasons[carol.sub], /turned reminder emails off/);
    assert.match(reasons[dave.sub], /not verified/);
    assert.equal(preview.body.template.subject, 'Your Unboxed Together welcome form is waiting');
    assert.equal(await count("SELECT count(*)::int AS n FROM email_outbox WHERE kind = 'welcome_reminder'"), 0, 'a preview sends nothing');

    const unconfirmed = await call(fn.adminMembers, admin, 'POST', '/api/admin/members', { action: 'send_reminders', type: 'welcome', members: everyone });
    assert.equal(unconfirmed.status, 422, 'sending needs confirmation');

    const sent = await call(fn.adminMembers, admin, 'POST', '/api/admin/members', { action: 'send_reminders', type: 'welcome', members: everyone, confirm: true });
    assert.equal(sent.status, 200, sent.text);
    assert.equal(sent.body.queued, 1);
    assert.equal(sent.body.results.length, 4, 'one result per selected member');
    const again = await call(fn.adminMembers, admin, 'POST', '/api/admin/members', { action: 'send_reminders', type: 'welcome', members: [bob.sub], confirm: true });
    assert.equal(again.body.queued, 0);
    assert.equal(await count("SELECT count(*)::int AS n FROM email_outbox WHERE kind = 'welcome_reminder'"), 1);
    const [row] = (await owner.query("SELECT requested_by, idempotency_key, template_version FROM email_outbox WHERE kind = 'welcome_reminder'")).rows;
    assert.equal(row.requested_by, admin.sub, 'the requesting admin is recorded');
    assert.equal(row.template_version, 'v2');

    const checkin = await call(fn.adminMembers, admin, 'POST', '/api/admin/members', { action: 'send_reminders', type: 'checkin', members: [alice.sub, bob.sub], confirm: true });
    assert.equal(checkin.body.queued, 1);
    const repeat = await call(fn.adminMembers, admin, 'POST', '/api/admin/members', { action: 'preview_reminders', type: 'checkin', members: [alice.sub] });
    assert.match(repeat.body.excluded[0].reason, /Already reminded this week/);
    const html = email.renderEmail('checkin_reminder', { firstName: 'Alice' });
    assert.equal(html.subject, 'Your Unboxed Together check-in is ready');
    assert.match(html.html, /COMPLETE MY CHECK-IN|Complete my check-in/);
    assert.match(html.html, /login\?next=%2Fmembers%2Fcheck-in/, 'logged-out members return to the form after login');
    assert.ok(!/score|\/100|Secretville/i.test(html.text + html.html), 'no answers or scores in reminders');
  });

  test('queued emails are sent once, with provider ids, failures recorded and safe retries', async () => {
    useProvider();
    try {
      provider.requests = [];
      provider.respond = () => ({ status: 200, body: { id: 'msg_checkin' } });
      const [checkin] = (await owner.query("SELECT id FROM email_outbox WHERE kind = 'checkin_reminder'")).rows;
      const [first, second] = await Promise.all([
        email.deliverQueuedEmails({ ids: [checkin.id] }),
        email.deliverQueuedEmails({ ids: [checkin.id] }),
      ]);
      assert.equal(first.sent + second.sent, 1, 'an email is claimed by one sender only');
      assert.equal(provider.requests.length, 1);
      assert.equal(provider.requests[0].headers['Idempotency-Key'], checkin.id);
      const [sentRow] = (await owner.query('SELECT status, provider_message_id, payload FROM email_outbox WHERE id = $1', [checkin.id])).rows;
      assert.deepEqual([sentRow.status, sentRow.provider_message_id], ['sent', 'msg_checkin']);
      assert.deepEqual(sentRow.payload, {}, 'payload cleared after sending');

      provider.respond = () => ({ status: 422, body: { message: 'Invalid `to` field' } });
      const [welcome] = (await owner.query("SELECT id FROM email_outbox WHERE kind = 'welcome_reminder'")).rows;
      const failed = await email.deliverQueuedEmails({ ids: [welcome.id] });
      assert.equal(failed.failed, 1);
      const [failedRow] = (await owner.query('SELECT status, last_error FROM email_outbox WHERE id = $1', [welcome.id])).rows;
      assert.equal(failedRow.status, 'failed');
      assert.match(failedRow.last_error, /422/);

      const listed = await call(fn.adminEmails, admin, 'GET', '/api/admin/emails?status=failed');
      assert.equal(listed.status, 200, listed.text);
      assert.deepEqual(listed.body.emails.map((item) => item.id), [welcome.id]);
      assert.ok(!listed.text.includes('payload'));

      assert.equal((await call(fn.adminEmails, admin, 'POST', '/api/admin/emails', { action: 'retry', id: checkin.id })).status, 409, 'only failed emails can be retried');
      provider.respond = () => ({ status: 200, body: { id: 'msg_welcome' } });
      const retried = await call(fn.adminEmails, admin, 'POST', '/api/admin/emails', { action: 'retry', id: welcome.id });
      assert.equal(retried.status, 200, retried.text);
      assert.equal(retried.body.email.status, 'sent');
      const history = await call(fn.adminEmails, admin, 'GET', `/api/admin/emails?email=${welcome.id}`);
      assert.deepEqual(history.body.events.map((event) => event.event_type), ['queued', 'attempt', 'failed', 'retried', 'attempt', 'accepted']);
      assert.ok(await count("SELECT count(*)::int AS n FROM questionnaire_admin_access_log WHERE action = 'retry_email'") >= 1, 'retries are audited');
    } finally {
      stopProvider();
    }
  });

  test('provider webhooks need a valid signature and only move statuses forward', async () => {
    const payload = (type, extra = {}) => ({ type, created_at: new Date().toISOString(), data: { email_id: 'msg_checkin', ...extra } });
    assert.equal((await call(fn.webhook, null, 'POST', '/api/email/webhook', JSON.stringify(payload('email.delivered')))).status, 503, 'refused until a secret is configured');
    process.env.RESEND_WEBHOOK_SECRET = webhookSecret;
    try {
      const forged = signedWebhook(payload('email.delivered'), { secret: `whsec_${Buffer.from('wrong').toString('base64')}` });
      assert.equal((await call(fn.webhook, null, 'POST', '/api/email/webhook', forged.body, forged.headers)).status, 401);
      const stale = signedWebhook(payload('email.delivered'), { timestamp: Math.floor(Date.now() / 1000) - 3600 });
      assert.equal((await call(fn.webhook, null, 'POST', '/api/email/webhook', stale.body, stale.headers)).status, 401);

      const delivered = signedWebhook(payload('email.delivered'));
      assert.equal((await call(fn.webhook, null, 'POST', '/api/email/webhook', delivered.body, delivered.headers)).status, 200);
      assert.equal((await call(fn.webhook, null, 'POST', '/api/email/webhook', delivered.body, delivered.headers)).status, 200, 'repeats are ignored');
      let [row] = (await owner.query("SELECT status, delivered_at FROM email_outbox WHERE provider_message_id = 'msg_checkin'")).rows;
      assert.equal(row.status, 'delivered');
      assert.ok(row.delivered_at);

      const late = signedWebhook(payload('email.sent'));
      await call(fn.webhook, null, 'POST', '/api/email/webhook', late.body, late.headers);
      [row] = (await owner.query("SELECT status FROM email_outbox WHERE provider_message_id = 'msg_checkin'")).rows;
      assert.equal(row.status, 'delivered', 'a late event never moves a status back');

      const bounce = signedWebhook(payload('email.bounced', { bounce: { type: 'Permanent', message: 'Mailbox does not exist' } }));
      await call(fn.webhook, null, 'POST', '/api/email/webhook', bounce.body, bounce.headers);
      [row] = (await owner.query("SELECT status, last_error FROM email_outbox WHERE provider_message_id = 'msg_checkin'")).rows;
      assert.equal(row.status, 'bounced');
      assert.match(row.last_error, /Mailbox does not exist/);
      assert.equal(await email.emailAddressSuppressed(alice.email), true, 'bounced addresses are not emailed again');
      const { byId } = await list();
      assert.equal(byId[alice.sub].email_suppressed, true);
      assert.equal(byId[alice.sub].can_remind.checkin, false);
      await owner.query('DELETE FROM prospect_email_suppressions');
    } finally {
      delete process.env.RESEND_WEBHOOK_SECRET;
    }
  });

  test('referrals give the member a personal link and never email friends without consent', async () => {
    const created = await call(fn.referral, alice, 'POST', '/api/member/refer', { friendName: 'Sam', email: 'sam@friend.test', shareName: false });
    assert.equal(created.status, 201, created.text);
    assert.match(created.body.referral.url, /\/join-us\?ref=[A-Za-z0-9_-]{43}$/);
    assert.equal(created.body.referral.stage, 'awaiting_sharing');
    assert.ok(!created.text.includes('email_status'), 'the member is not told whether the friend has a relationship with us');
    assert.equal(await count("SELECT count(*)::int AS n FROM email_outbox WHERE kind = 'friend_referral'"), 0, 'no consent, no email');

    const duplicate = await call(fn.referral, alice, 'POST', '/api/member/refer', { email: 'SAM@friend.test' });
    assert.equal(duplicate.body.duplicate, true);
    assert.equal(duplicate.body.referral.id, created.body.referral.id);
    assert.equal(await count('SELECT count(*)::int AS n FROM member_referrals WHERE referrer_user_id = $1', [alice.sub]), 1);

    assert.equal((await call(fn.referral, alice, 'POST', '/api/member/refer', { email: alice.email })).status, 422, 'not your own address');
    assert.equal((await call(fn.referral, alice, 'POST', '/api/member/refer', { email: 'not-an-email' })).status, 422);

    // Bob (no confirmation recorded) cannot create invitations or touch Alice's.
    assert.equal((await call(fn.referral, bob, 'POST', '/api/member/refer', { email: 'x@friend.test' })).status, 403);
    await owner.query('UPDATE profiles SET email_verified_at = NOW() WHERE id = $1', [bob.sub]);
    assert.equal((await call(fn.referral, bob, 'POST', '/api/member/refer', { action: 'shared', id: created.body.referral.id, via: 'copy' })).status, 404);
    const bobsView = await call(fn.referral, bob, 'GET', '/api/member/refer');
    assert.equal(bobsView.body.referrals.length, 0);

    const shared = await call(fn.referral, alice, 'POST', '/api/member/refer', { action: 'shared', id: created.body.referral.id, via: 'native_share' });
    assert.equal(shared.body.referrals[0].stage, 'shared');

    const token = new URL(created.body.referral.url).searchParams.get('ref');
    const opened = await call(fn.referralOpen, null, 'POST', '/api/referral/open', { token });
    assert.deepEqual(opened.body, { referrerName: null }, 'the name is only shown when the member agreed');
    assert.deepEqual((await call(fn.referralOpen, null, 'POST', '/api/referral/open', { token: 'x'.repeat(43) })).body, { referrerName: null });
    const named = await call(fn.referral, alice, 'POST', '/api/member/refer', { shareName: true });
    const namedToken = new URL(named.body.referral.url).searchParams.get('ref');
    assert.deepEqual((await call(fn.referralOpen, null, 'POST', '/api/referral/open', { token: namedToken })).body, { referrerName: 'Alice' });

    // The friend registers interest, then signs up through the link.
    const interest = await call(fn.prospect, null, 'POST', '/api/prospect', {
      idempotencyKey: randomUUID(), startedAt: Date.now() - 60_000, website: '', firstName: 'Sam', email: '', consent: {}, referralToken: token,
      answers: { topics: ['Food, ingredients and additives'], challenges: [], projects: ['30-Day Barcode Challenge'], involvement: ['Become an early app tester'] },
    });
    assert.equal(interest.status, 201, interest.text);
    const friend = { id: randomUUID(), email: 'sam@friend.test', userMetadata: { full_name: 'Sam Friend', referral_token: token }, appMetadata: {}, confirmedAt: new Date().toISOString() };
    await identityEvents.userSignup({ user: friend });
    const [referral] = (await owner.query('SELECT registered_user_id, attributed_by, prospect_id, first_opened_at FROM member_referrals WHERE token = $1', [token])).rows;
    assert.equal(referral.registered_user_id, friend.id);
    assert.equal(referral.attributed_by, 'token');
    assert.ok(referral.prospect_id && referral.first_opened_at);

    // A token cannot credit the referrer themselves, or credit anyone twice.
    await identityEvents.userLogin({ user: { id: alice.sub, email: alice.email, userMetadata: { referral_token: namedToken }, appMetadata: {} } });
    assert.equal(await count('SELECT count(*)::int AS n FROM member_referrals WHERE registered_user_id = $1', [alice.sub]), 0);
    await identityEvents.userLogin({ user: { ...friend, userMetadata: { referral_token: namedToken } } });
    assert.equal(await count('SELECT count(*)::int AS n FROM member_referrals WHERE registered_user_id = $1', [friend.id]), 1);

    const admins = await call(fn.adminMembers, admin, 'GET', '/api/admin/members?view=referrals');
    assert.equal(admins.status, 200, admins.text);
    const row = admins.body.referrals.find((item) => item.id === created.body.referral.id);
    assert.equal(row.registered_name, 'Sam Friend');
    assert.equal(row.recipient_email, 'sam@friend.test');
    assert.ok(!admins.text.includes(token), 'tokens are never shown to admins');
    assert.equal(admins.body.communications.referrals.registered, 1);
    assert.equal(admins.body.communications.referrals.topReferrers[0].id, alice.sub);
  });

  test('a friend who already agreed to our emails gets one branded invitation', async () => {
    const [prospect] = (await owner.query(`
      INSERT INTO prospect_submissions (idempotency_key, first_name, email, questionnaire_version, consent_version, retain_until)
      VALUES ($1, 'Kim', 'kim@friend.test', 'test', 'test', NOW() + INTERVAL '1 year') RETURNING id
    `, [randomUUID()])).rows;
    await owner.query(`
      INSERT INTO prospect_contact_permissions (prospect_id, permission_type, granted, consent_text_version, consent_text, source, verified_at)
      VALUES ($1, 'general_marketing', TRUE, 'test', 'test', 'questionnaire', NOW())
    `, [prospect.id]);
    useProvider();
    try {
      provider.requests = [];
      provider.respond = () => ({ status: 200, body: { id: 'msg_referral' } });
      const created = await call(fn.referral, alice, 'POST', '/api/member/refer', { email: 'kim@friend.test', shareName: true });
      assert.equal(created.status, 201, created.text);
      assert.equal(provider.requests.length, 1);
      const sent = provider.requests[0].body;
      assert.equal(sent.subject, 'You’ve been invited to discover Unboxed Together');
      assert.match(sent.html, /ALICE THOUGHT YOU MIGHT FIND THIS INTERESTING/);
      assert.ok(sent.html.includes(created.body.referral.url.replace(/&/g, '&amp;')), 'the button carries the referral link');
      const [row] = (await owner.query("SELECT status, referral_id, requested_by FROM email_outbox WHERE kind = 'friend_referral'")).rows;
      assert.deepEqual([row.status, row.referral_id, row.requested_by], ['sent', created.body.referral.id, `member:${alice.sub}`]);
      // A second member inviting the same friend within 30 days does not email them again.
      await call(fn.referral, bob, 'POST', '/api/member/refer', { email: 'kim@friend.test' });
      assert.equal(provider.requests.length, 1);
    } finally {
      stopProvider();
    }
  });

  test('the progress tab reminder still uses the shared rules', async () => {
    const response = await call(fn.adminProgress, admin, 'GET', '/api/admin/progress?q=');
    assert.equal(response.status, 200, response.text);
    assert.equal(response.body.summary.members, 5, 'four test members plus the referred friend who signed up');
  });
});
