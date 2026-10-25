// Team area overview and reminder tests. They sign in as test members and an
// allowlisted admin, save real check-ins, and check that the admin counts
// follow the same rules as the member's own progress page.
//
// They run against a throwaway local copy of Netlify Database built from the
// project's migrations, so no live member data is read or changed.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { NetlifyDB } from '@netlify/database-dev';

const origin = 'https://overview.test';
const tracker = { sub: randomUUID(), email: 'tracker@overview.test', name: 'Overview Tracker', roles: ['member'] };
const newcomer = { sub: randomUUID(), email: 'newcomer@overview.test', name: 'Overview Newcomer', roles: ['member'] };
const admin = { sub: randomUUID(), email: 'admin@overview.test', name: 'Overview Admin', roles: ['member', 'admin'] };
const best = { sleepQuality: 5, restedAfterSleep: 3, enoughSleep: 3, mood: 5, managingDemands: 5, energy: 5, focus: 5, regularMeals: 7, freshMeals: 7, fruitVeg: 3, hydration: 3, movementDays: 5 };

function signInAs(member) {
  globalThis.netlifyIdentityContext = member
    ? { user: { sub: member.sub, email: member.email, app_metadata: { roles: member.roles }, user_metadata: { full_name: member.name } } }
    : undefined;
}

async function call(handler, member, method, path, body) {
  signInAs(member);
  const init = { method, headers: { origin, 'content-type': 'application/json' } };
  if (body !== undefined) init.body = JSON.stringify(body);
  const response = await handler(new Request(`${origin}${path}`, init));
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: response.status, body: json, text };
}

const addDays = (date, count) => new Date(Date.parse(`${date}T00:00:00Z`) + count * 86400000).toISOString().slice(0, 10);

describe('team area overview and reminders', () => {
  let localDb;
  let owner;
  let fn;

  before(async () => {
    delete process.env.RESEND_API_KEY;
    localDb = new NetlifyDB({ logger: () => {} });
    const url = await localDb.start();
    await localDb.applyMigrations(fileURLToPath(new URL('../netlify/database/migrations', import.meta.url)));
    process.env.NETLIFY_DB_URL = url;
    delete process.env.NETLIFY_DATABASE_URL;
    owner = new pg.Client({ connectionString: url });
    await owner.connect();
    await owner.query('INSERT INTO member_admins (email, added_by) VALUES ($1, $2)', [admin.email, 'test']);

    const load = async (name) => (await import(`../netlify/functions/${name}.mjs`)).default;
    fn = {
      member: await load('member-data'),
      questionnaire: await load('questionnaire'),
      progress: await load('progress'),
      adminProgress: await load('admin-progress'),
      adminQuestionnaires: await load('admin-questionnaires'),
      adminAccess: await load('admin-access'),
    };

    // The tracker: welcome form, consent, a baseline three weeks ago, a
    // complete Week 1 check-in later corrected to incomplete, and no Week 2.
    const saved = await call(fn.questionnaire, tracker, 'PUT', '/api/questionnaire', {
      section: 1, idempotencyKey: randomUUID(), answers: { preferredName: tracker.name, email: tracker.email, adultConfirmed: true },
    });
    assert.equal(saved.status, 200, saved.text);
    assert.equal((await call(fn.progress, tracker, 'POST', '/api/progress', { action: 'consent', consent: true })).status, 200);
    const [{ today }] = (await owner.query("SELECT to_char(timezone('Europe/London', NOW()), 'YYYY-MM-DD') AS today")).rows;
    const baseline = await call(fn.progress, tracker, 'POST', '/api/progress', { action: 'submit', formType: 'baseline_wellbeing', idempotencyKey: randomUUID(), answers: best, entryDate: addDays(today, -21) });
    assert.equal(baseline.status, 200, baseline.text);
    const week1 = await call(fn.progress, tracker, 'POST', '/api/progress', { action: 'submit', formType: 'weekly_checkin', idempotencyKey: randomUUID(), answers: best, entryDate: addDays(today, -14) });
    assert.equal(week1.status, 200, week1.text);
    const corrected = await call(fn.progress, tracker, 'POST', '/api/progress', {
      action: 'submit', formType: 'weekly_checkin', idempotencyKey: randomUUID(), answers: { ...best, mood: null },
      revisionOf: week1.body.submissionId, revisionReason: 'I chose the wrong answer',
    });
    assert.equal(corrected.status, 200, corrected.text);

    // The newcomer has an account but has not started the welcome form.
    assert.equal((await call(fn.member, newcomer, 'GET', '/api/member')).status, 200);
  });

  after(async () => {
    signInAs(null);
    await owner?.end().catch(() => {});
    await localDb?.stop?.().catch(() => {});
  });

  const overview = async () => {
    const response = await call(fn.adminProgress, admin, 'GET', '/api/admin/progress?q=');
    assert.equal(response.status, 200, response.text);
    return { ...response.body, byId: Object.fromEntries(response.body.members.map((member) => [member.id, member])) };
  };

  test('member counts match the progress timeline rules', async () => {
    const { summary, byId } = await overview();
    const row = byId[tracker.sub];
    assert.equal(row.checkins, 1, 'a corrected check-in still counts once');
    assert.equal(row.missed, 1, 'Week 2 is missed; the current week is not');
    assert.equal(row.latest_score, null, 'the latest correction is incomplete, so there is no current score');
    assert.equal(row.checked_in_this_week, false);
    assert.equal(row.email, tracker.email);
    assert.equal(byId[newcomer.sub].welcome_completed_at, null);
    assert.equal(byId[newcomer.sub].missed, null);

    assert.equal(summary.members, 2);
    assert.equal(summary.welcomeCompleted, 1);
    assert.equal(summary.welcomeNotStarted, 1);
    assert.equal(summary.baselines, 1);
    assert.equal(summary.missedCheckin, 1);
    assert.equal(summary.newThisWeek, 2);
  });

  test('questionnaires list includes members who have not started', async () => {
    const response = await call(fn.adminQuestionnaires, admin, 'GET', '/api/admin/questionnaires');
    assert.equal(response.status, 200, response.text);
    const ids = response.body.members.map((member) => member.id);
    assert.ok(ids.includes(tracker.sub) && ids.includes(newcomer.sub));
  });

  test('reminders go only to eligible members, at most once every few days', async () => {
    const before = await overview();
    assert.equal(before.byId[tracker.sub].can_remind.checkin, true);
    assert.equal(before.byId[newcomer.sub].can_remind.checkin, false, 'no baseline, no check-in reminder');
    // Locally there is no Identity service, so the newcomer's account email is
    // unknown and no reminder can be addressed; on the site Identity supplies it.
    assert.equal(before.byId[newcomer.sub].email, null);
    assert.equal(before.byId[newcomer.sub].can_remind.welcome, false, 'no email on record, no reminder');

    const member = await call(fn.adminProgress, tracker, 'POST', '/api/admin/progress', { action: 'remind', kind: 'checkin', members: [tracker.sub] });
    assert.equal(member.status, 403, 'members cannot send reminders');

    const first = await call(fn.adminProgress, admin, 'POST', '/api/admin/progress', { action: 'remind', kind: 'checkin', members: [tracker.sub, newcomer.sub] });
    assert.equal(first.status, 200, first.text);
    assert.deepEqual({ queued: first.body.queued, skipped: first.body.skipped, sent: first.body.sent }, { queued: 1, skipped: 1, sent: 0 });

    const again = await call(fn.adminProgress, admin, 'POST', '/api/admin/progress', { action: 'remind', kind: 'checkin', members: [tracker.sub] });
    assert.equal(again.body.queued, 0, 'a second reminder within the gap is skipped');

    const { rows } = await owner.query("SELECT to_email, status FROM email_outbox WHERE kind = 'checkin_reminder'");
    assert.deepEqual(rows, [{ to_email: tracker.email, status: 'queued' }]);

    const after = await overview();
    assert.equal(after.byId[tracker.sub].reminders.checkin.status, 'queued');
    assert.equal(after.byId[tracker.sub].can_remind.checkin, false);

    const log = await call(fn.adminAccess, admin, 'GET', '/api/admin/access?filter=changes');
    assert.equal(log.status, 200, log.text);
    assert.ok(log.body.log.length >= 1);
    assert.ok(log.body.log.every((entry) => entry.action === 'send_reminder'), 'views are left out of the changes view');
  });
});
