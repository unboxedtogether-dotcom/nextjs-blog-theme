// Two-account privacy tests. They call the real member and admin endpoints,
// signed in as two separate test members, and check that neither can read,
// change or submit against the other's records, including by adding another
// member's id to the request.
//
// They run against a throwaway local copy of Netlify Database built from the
// project's migrations, so no live member data is read or changed.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { NetlifyDB } from '@netlify/database-dev';

const origin = 'https://isolation.test';

const memberA = { sub: randomUUID(), email: 'member-a@isolation.test', name: 'Isolation Member A', town: 'Alphatown', roles: ['member'] };
const memberB = { sub: randomUUID(), email: 'member-b@isolation.test', name: 'Isolation Member B', town: 'Betaville', roles: ['member'] };
// Has the Identity `admin` role but is not on the database admin allowlist.
const roleOnlyAdmin = { sub: randomUUID(), email: 'role-only-admin@isolation.test', name: 'Isolation Role Admin', roles: ['admin'] };

// Simulates a session that Netlify has already verified for this request.
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
  return { status: response.status, body: json, text, headers: response.headers };
}

const welcome = (member, extra = {}) => ({
  section: 1,
  idempotencyKey: randomUUID(),
  answers: { preferredName: member.name, email: member.email, adultConfirmed: true, town: member.town, enjoys: `${member.name} hobbies`, ...extra },
});

describe('member account isolation', () => {
  let localDb;
  let fn;
  let withMemberAccess;
  let owner;
  let submissionB;

  before(async () => {
    localDb = new NetlifyDB({ logger: () => {} });
    const url = await localDb.start();
    await localDb.applyMigrations(fileURLToPath(new URL('../netlify/database/migrations', import.meta.url)));
    process.env.NETLIFY_DB_URL = url;
    delete process.env.NETLIFY_DATABASE_URL;

    const load = async (name) => (await import(`../netlify/functions/${name}.mjs`)).default;
    fn = {
      member: await load('member-data'),
      questionnaire: await load('questionnaire'),
      forms: await load('member-forms'),
      exportData: await load('member-export'),
      messages: await load('member-messages'),
      progress: await load('progress'),
      avatar: await load('member-avatar'),
      adminProgress: await load('admin-progress'),
      adminQuestionnaires: await load('admin-questionnaires'),
      adminMessages: await load('admin-messages'),
      adminReviews: await load('admin-reviews'),
      adminAccess: await load('admin-access'),
    };
    ({ withMemberAccess } = await import('../netlify/functions/_shared/member-access.mjs'));
    owner = new pg.Client({ connectionString: url });
    await owner.connect();

    for (const member of [memberA, memberB]) {
      const saved = await call(fn.questionnaire, member, 'PUT', '/api/questionnaire', welcome(member));
      assert.equal(saved.status, 200, saved.text);
    }
    await call(fn.messages, memberB, 'POST', '/api/member/messages', { message: 'Private message from member B', topic: undefined });
    const formsB = await call(fn.forms, memberB, 'GET', '/api/forms');
    submissionB = formsB.body.submissions?.[0]?.id;
    assert.ok(submissionB, 'member B has a saved form submission');
  });

  after(async () => {
    signInAs(null);
    await owner?.end().catch(() => {});
    await localDb?.stop?.().catch(() => {});
  });

  test('signed-out visitors get no member or admin data', async () => {
    const endpoints = [
      [fn.member, '/api/member'], [fn.member, '/api/member?summary=1'], [fn.questionnaire, '/api/questionnaire'],
      [fn.forms, '/api/forms'], [fn.exportData, '/api/forms/export?format=json'], [fn.messages, '/api/member/messages'],
      [fn.progress, '/api/progress'], [fn.avatar, '/api/member/avatar'], [fn.adminProgress, '/api/admin/progress'],
      [fn.adminQuestionnaires, '/api/admin/questionnaires'], [fn.adminMessages, '/api/admin/messages'],
      [fn.adminReviews, '/api/admin/reviews'], [fn.adminAccess, '/api/admin/access'],
    ];
    for (const [handler, path] of endpoints) {
      const response = await call(handler, null, 'GET', path);
      assert.equal(response.status, 401, `${path} must require login`);
    }
  });

  test('each member sees only their own name, email and welcome answers', async () => {
    for (const [self, other] of [[memberA, memberB], [memberB, memberA]]) {
      const dashboard = await call(fn.member, self, 'GET', '/api/member');
      assert.equal(dashboard.status, 200);
      assert.equal(dashboard.body.profile.display_name, self.name);
      assert.equal(dashboard.body.about.town, self.town);
      assert.equal(dashboard.headers.get('cache-control'), 'no-store');

      const header = await call(fn.member, self, 'GET', '/api/member?summary=1');
      assert.equal(header.body.displayName, self.name);

      const questionnaire = await call(fn.questionnaire, self, 'GET', '/api/questionnaire');
      assert.equal(questionnaire.status, 200);
      for (const response of [dashboard, header, questionnaire]) {
        assert.ok(!response.text.includes(other.name), `${self.name} must not see ${other.name}`);
        assert.ok(!response.text.includes(other.email), `${self.name} must not see ${other.email}`);
        assert.ok(!response.text.includes(other.sub), `${self.name} must not see ${other.name}'s id`);
        assert.ok(!/lee jones/i.test(response.text), 'no hardcoded owner details');
      }
    }
  });

  test("adding another member's id to the URL is ignored", async () => {
    for (const query of [`?member=${memberB.sub}`, `?userId=${memberB.sub}`, `?user_id=${memberB.sub}`, `?id=${memberB.sub}`]) {
      const dashboard = await call(fn.member, memberA, 'GET', `/api/member${query}`);
      assert.equal(dashboard.body.profile.display_name, memberA.name);
      const progress = await call(fn.progress, memberA, 'GET', `/api/progress${query}`);
      assert.ok(!progress.text.includes(memberB.sub));
      const exported = await call(fn.exportData, memberA, 'GET', `/api/forms/export?format=json&${query.slice(1)}`);
      assert.ok(!exported.text.includes(memberB.name) && !exported.text.includes(memberB.email));
    }
  });

  test("a member cannot open another member's form record", async () => {
    const list = await call(fn.forms, memberA, 'GET', '/api/forms');
    assert.equal(list.status, 200);
    assert.ok(!list.text.includes(submissionB), "B's submission is not in A's list");
    const direct = await call(fn.forms, memberA, 'GET', `/api/forms?id=${submissionB}`);
    assert.equal(direct.status, 404);
    assert.ok(!direct.text.includes(memberB.name));
    const own = await call(fn.forms, memberB, 'GET', `/api/forms?id=${submissionB}`);
    assert.equal(own.status, 200, 'the owner can still open it');
  });

  test("a member cannot submit forms against another member's account", async () => {
    const hijackFields = { userId: memberB.sub, user_id: memberB.sub, memberId: memberB.sub, member: memberB.sub, id: memberB.sub };
    const welcomeSave = await call(fn.questionnaire, memberA, 'PUT', '/api/questionnaire', { ...welcome(memberA, { town: 'Changed by A' }), ...hijackFields });
    assert.equal(welcomeSave.status, 200);
    const profileSave = await call(fn.member, memberA, 'PUT', '/api/member', {
      ...hijackFields,
      profile: { displayName: 'Hijacked name', bio: '', interests: '', reasons: [], town: 'Hijacked town', phone: '', idempotencyKey: randomUUID(), ...hijackFields },
    });
    assert.equal(profileSave.status, 200);
    const message = await call(fn.messages, memberA, 'POST', '/api/member/messages', { message: 'Message from A', ...hijackFields });
    assert.equal(message.status, 201);
    const note = await call(fn.progress, memberA, 'POST', '/api/progress', { action: 'note', submissionId: submissionB, body: 'A writing on B', ...hijackFields });
    assert.notEqual(note.status, 200, "A cannot add a note to B's record");

    const b = await call(fn.member, memberB, 'GET', '/api/member');
    assert.equal(b.body.profile.display_name, memberB.name, "B's name is unchanged");
    assert.equal(b.body.about.town, memberB.town, "B's welcome answers are unchanged");
    const bMessages = await call(fn.messages, memberB, 'GET', '/api/member/messages');
    assert.ok(!bMessages.text.includes('Message from A'));
    const aMessages = await call(fn.messages, memberA, 'GET', '/api/member/messages');
    assert.ok(aMessages.text.includes('Message from A'), "A's message went to A's own account");
    assert.ok(!aMessages.text.includes('Private message from member B'));

    const a = await call(fn.member, memberA, 'GET', '/api/member');
    assert.equal(a.body.profile.display_name, 'Hijacked name', "the change landed on A's own account");
  });

  test('ordinary members and role-only admins cannot use admin tools', async () => {
    for (const member of [memberA, roleOnlyAdmin]) {
      const responses = [
        await call(fn.adminProgress, member, 'GET', `/api/admin/progress?member=${memberB.sub}`),
        await call(fn.adminProgress, member, 'GET', '/api/admin/progress?q=Isolation'),
        await call(fn.adminProgress, member, 'POST', '/api/admin/progress', { member: memberB.sub, body: 'note' }),
        await call(fn.adminQuestionnaires, member, 'GET', `/api/admin/questionnaires?member=${memberB.sub}`),
        await call(fn.adminMessages, member, 'GET', '/api/admin/messages'),
        await call(fn.adminReviews, member, 'GET', '/api/admin/reviews'),
        await call(fn.adminAccess, member, 'GET', '/api/admin/access'),
        await call(fn.adminAccess, member, 'POST', '/api/admin/access', { email: member.email }),
      ];
      for (const response of responses) {
        assert.equal(response.status, 403, `${member.name}: ${response.text}`);
        assert.ok(!response.text.includes(memberB.name) && !response.text.includes(memberB.email));
      }
    }
    const dashboard = await call(fn.member, memberA, 'GET', '/api/member');
    assert.equal(dashboard.body.isAdmin, false);
  });

  test('the database itself blocks cross-account reads and writes', async () => {
    const tables = (await owner.query(`
      SELECT DISTINCT c.table_name FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.column_name = 'user_id'
        AND has_table_privilege('unboxed_member_access', format('public.%I', c.table_name), 'SELECT')
    `)).rows.map((row) => row.table_name);
    assert.ok(tables.length >= 8, 'member tables found');

    await withMemberAccess(memberA.sub, async (query) => {
      for (const table of tables) {
        const rows = await query(`SELECT count(*)::int AS n FROM "${table}" WHERE user_id IS DISTINCT FROM $1`, [memberA.sub]);
        assert.equal(rows[0].n, 0, `${table}: member A sees no other member's rows`);
      }
      const profiles = await query('SELECT id FROM profiles');
      assert.deepEqual(profiles.map((row) => row.id), [memberA.sub]);
      const updated = await query("UPDATE profiles SET display_name = 'x' WHERE id = $1 RETURNING id", [memberB.sub]);
      assert.equal(updated.length, 0, "A cannot change B's profile");
    });

    // Asking for admin access in the database without being on the allowlist grants nothing.
    await withMemberAccess(memberA.sub, async (query) => {
      const profiles = await query('SELECT id FROM profiles');
      assert.deepEqual(profiles.map((row) => row.id), [memberA.sub]);
    }, 'admin');

    await assert.rejects(
      withMemberAccess(memberA.sub, (query) => query("INSERT INTO member_messages (user_id, topic, message, reply_email) VALUES ($1, 'General', 'forged', 'x@isolation.test')", [memberB.sub])),
      /row-level security/,
    );
  });
});
