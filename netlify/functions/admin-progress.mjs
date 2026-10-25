import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { getDatabase } from '@netlify/database';
import { authoriseAdmin, logAdminAccess, notAllowlistedMessage, withMemberAccess } from './_shared/member-access.mjs';
import { loadSubmissionDetail, loadSubmissionList } from './_shared/member-records.mjs';
import { isUuid, loadProgressState } from './_shared/progress-store.mjs';
import { buildProgressReport } from './_shared/progress-report.mjs';
import { deliverQueuedEmails, emailDeliveryConfigured, queueEmail } from './_shared/email.mjs';
import { loadIdentityAccount, loadIdentityAccounts } from './_shared/identity-accounts.mjs';
import { buildTimeline } from '../../utils/progress-timeline.mjs';
import { SCORING_VERSION } from '../../utils/progress-checkin.mjs';

const db = getDatabase();

const noStore = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
const REMINDER_GAP_DAYS = 6;
const reminderKinds = { checkin: 'checkin_reminder', welcome: 'welcome_reminder' };

// The latest reminder of each kind per member. The outbox is only reachable
// as the table owner, so it is read here outside the restricted role.
async function loadReminders() {
  const rows = await db.sql`
    SELECT DISTINCT ON (user_id, kind) user_id, kind, status, created_at, sent_at
    FROM email_outbox
    WHERE user_id IS NOT NULL AND kind IN ('checkin_reminder', 'welcome_reminder')
    ORDER BY user_id, kind, created_at DESC
  `;
  const byMember = new Map();
  for (const row of rows) {
    if (!byMember.has(row.user_id)) byMember.set(row.user_id, {});
    byMember.get(row.user_id)[row.kind === 'checkin_reminder' ? 'checkin' : 'welcome'] = { status: row.status, at: row.sent_at || row.created_at };
  }
  return byMember;
}

const recentlyReminded = (reminder) => reminder && reminder.status !== 'cancelled' && reminder.status !== 'failed'
  && Date.now() - new Date(reminder.at).getTime() < REMINDER_GAP_DAYS * 86400000;

// One row per member profile, with the same counting rules as the member's own
// progress page: each check-in counts once (its latest correction is the one
// scored), a missed week is a past week since the baseline with no check-in,
// and the current week is never counted as missed.
async function memberOverview(query, accounts, reminders) {
  const rows = await query(`
    WITH wk AS (SELECT date_trunc('week', timezone('Europe/London', NOW()))::date AS start),
    latest AS (
      SELECT DISTINCT ON (COALESCE(s.revision_of, s.id)) s.user_id, s.reporting_week_number, s.reporting_week_start,
        COALESCE(s.entry_date, timezone('Europe/London', s.submitted_at)::date) AS dated, ws.overall_score, ws.completeness
      FROM member_form_submissions s
      LEFT JOIN member_weekly_scores ws ON ws.submission_id = s.id AND ws.scoring_version = $1
      WHERE s.form_type = 'weekly_checkin'
      ORDER BY COALESCE(s.revision_of, s.id), s.revision_number DESC
    ),
    consent AS (
      SELECT DISTINCT ON (user_id) user_id, action FROM member_consent_events
      WHERE consent_type = 'progress_tracking' ORDER BY user_id, recorded_at DESC
    )
    SELECT p.id, p.display_name, w.answers->>'email' AS welcome_email, p.membership_status, p.created_at,
      b.baseline_date::text AS baseline_date, ((wk.start - b.reporting_week_start) / 7)::int AS weeks_since,
      w.completed_at AS welcome_completed_at, h.section_3_saved_at AS welcome_starting_point_saved_at,
      CASE WHEN h.answers->>'baselineDate' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN h.answers->>'baselineDate' END AS welcome_baseline_date,
      COALESCE(c.action = 'given', FALSE) AS progress_consent,
      COALESCE(l.checkins, 0) AS checkins, COALESCE(l.past_checkins, 0) AS past_checkins,
      COALESCE(l.checked_in_this_week, FALSE) AS checked_in_this_week, l.last_checkin_date, l.latest_score,
      GREATEST((SELECT MAX(s.submitted_at) FROM member_form_submissions s WHERE s.user_id = p.id), w.updated_at, h.updated_at, p.created_at) AS last_activity_at
    FROM profiles p
    CROSS JOIN wk
    LEFT JOIN member_welcome_details w ON w.user_id = p.id
    LEFT JOIN member_health_information h ON h.user_id = p.id
    LEFT JOIN member_baselines b ON b.user_id = p.id
    LEFT JOIN consent c ON c.user_id = p.id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS checkins,
        COUNT(*) FILTER (WHERE x.reporting_week_start < wk.start)::int AS past_checkins,
        BOOL_OR(x.reporting_week_start = wk.start) AS checked_in_this_week,
        MAX(x.dated)::text AS last_checkin_date,
        (ARRAY_AGG(x.overall_score ORDER BY x.reporting_week_number DESC) FILTER (WHERE x.completeness = 'complete' AND x.reporting_week_number > 0))[1] AS latest_score
      FROM latest x WHERE x.user_id = p.id
    ) l ON TRUE
    ORDER BY last_activity_at DESC NULLS LAST, p.display_name
  `, [SCORING_VERSION]);

  return rows.map(({ welcome_email: welcomeEmail, weeks_since: weeksSince, past_checkins: pastCheckins, ...row }) => {
    const account = accounts?.get(row.id);
    const memberReminders = reminders.get(row.id) || {};
    const email = account?.email || welcomeEmail || null;
    // Completed past weeks are 1 to weeksSince - 1; the current week is not missed yet.
    const missed = row.baseline_date ? Math.max(0, weeksSince - 1 - pastCheckins) : null;
    return {
      ...row,
      email,
      signed_up_at: account?.createdAt || row.created_at,
      latest_score: row.latest_score === null ? null : Number(row.latest_score),
      missed,
      reminders: memberReminders,
      can_remind: {
        checkin: Boolean(email && row.progress_consent && missed > 0 && !recentlyReminded(memberReminders.checkin)),
        welcome: Boolean(email && !row.welcome_completed_at && !recentlyReminded(memberReminders.welcome)),
      },
    };
  });
}

function summarise(members, accounts) {
  const weekAgo = Date.now() - 7 * 86400000;
  const withProfile = new Set(members.map((member) => member.id));
  const unconfirmed = accounts ? [...accounts.values()].filter((account) => !account.confirmedAt && !withProfile.has(account.id)).length : null;
  const count = (test) => members.filter(test).length;
  return {
    members: members.length,
    newThisWeek: count((member) => new Date(member.signed_up_at).getTime() >= weekAgo),
    awaitingConfirmation: unconfirmed,
    welcomeCompleted: count((member) => member.welcome_completed_at),
    welcomeNotStarted: count((member) => !member.welcome_completed_at),
    baselines: count((member) => member.baseline_date),
    checkedInThisWeek: count((member) => member.checked_in_this_week),
    missedCheckin: count((member) => member.missed > 0),
    remindCheckin: count((member) => member.can_remind.checkin),
    remindWelcome: count((member) => member.can_remind.welcome),
  };
}

const matches = (member, term) => !term || `${member.display_name} ${member.email || ''}`.toLowerCase().includes(term.toLowerCase());

async function loadMember(query, memberId, account) {
  const [row] = await query(`
    SELECT p.id, p.display_name, p.membership_status, p.membership_started_at, p.created_at, w.answers->>'email' AS email
    FROM profiles p LEFT JOIN member_welcome_details w ON w.user_id = p.id WHERE p.id = $1
  `, [memberId]);
  if (!row) return null;
  // The account email is the one the member signs in with; the welcome form copy can differ.
  const profile = { ...row, email: account?.email || row.email, signed_up_at: account?.createdAt || row.created_at };
  const state = await loadProgressState(query, memberId);
  const { submissions } = await loadSubmissionList(query, memberId);
  const consentHistory = await query("SELECT action, recorded_at, notice_version FROM member_consent_events WHERE user_id = $1 AND consent_type = 'progress_tracking' ORDER BY recorded_at DESC", [memberId]);
  return {
    profile,
    consent: state.consent,
    consentHistory,
    baseline: state.baseline,
    currentWeek: state.currentWeek,
    welcomeStartingPoint: state.welcomeStartingPoint,
    entries: state.entries,
    generalNotes: state.generalNotes,
    submissions,
  };
}

// Queues a reminder email for each chosen member who is still eligible
// (checked again here, not trusted from the browser) and sends it straight
// away when email delivery is configured. Each member is reminded at most
// once every few days per kind, and every reminder is logged.
async function sendReminders(user, body) {
  const kind = reminderKinds[body.kind];
  if (!kind) return Response.json({ error: 'Choose which reminder to send.' }, { status: 422 });
  const ids = Array.isArray(body.members) ? [...new Set(body.members.filter((id) => typeof id === 'string'))].slice(0, 500) : [];
  if (!ids.length) return Response.json({ error: 'Choose at least one member.' }, { status: 422 });

  const [accounts, reminders] = await Promise.all([loadIdentityAccounts(), loadReminders()]);
  const all = await withMemberAccess(user.id, (query) => memberOverview(query, accounts, reminders), 'admin');
  const chosen = all.filter((member) => ids.includes(member.id));
  const eligible = chosen.filter((member) => member.can_remind[body.kind]);

  const queued = [];
  for (const member of eligible) {
    const id = await queueEmail({ kind, to: member.email, userId: member.id, payload: { firstName: (member.display_name || '').split(' ')[0] } });
    if (id) queued.push({ id, member });
  }
  const delivery = queued.length ? await deliverQueuedEmails({ ids: queued.map((item) => item.id) }) : { sent: 0, configured: emailDeliveryConfigured() };
  await withMemberAccess(user.id, async (query) => {
    for (const item of queued) await logAdminAccess(query, user.id, item.member.id, 'send_reminder', 'email', item.id, body.kind);
  }, 'admin');

  return Response.json({
    ok: true,
    queued: queued.length,
    sent: delivery.sent,
    skipped: chosen.length - queued.length,
    emailDelivery: delivery.configured,
  }, { headers: noStore });
}

// Member progress for allowlisted administrators. Read-only except for
// private notes; every request is written to the admin access log.
export default async function adminProgress(request) {
  const user = await getUser();
  if (!user) return Response.json({ error: 'Please log in to continue.' }, { status: 401 });
  if (!(await authoriseAdmin(user))) return Response.json({ error: (user.roles || []).includes('admin') ? notAllowlistedMessage : 'You do not have access to member progress.' }, { status: 403 });
  const url = new URL(request.url);
  const memberId = url.searchParams.get('member');

  if (request.method === 'GET') {
    if (!memberId) {
      const term = (url.searchParams.get('q') || '').trim().slice(0, 100);
      const [accounts, reminders] = await Promise.all([loadIdentityAccounts(), loadReminders()]);
      const all = await withMemberAccess(user.id, async (query) => {
        await logAdminAccess(query, user.id, null, term ? 'search_member_progress' : 'list_member_progress');
        return memberOverview(query, accounts, reminders);
      }, 'admin');
      return Response.json({
        summary: summarise(all, accounts),
        members: all.filter((member) => matches(member, term)).slice(0, 200),
        emailDelivery: emailDeliveryConfigured(),
      }, { headers: noStore });
    }

    const submissionId = url.searchParams.get('submission');
    if (submissionId) {
      const detail = await withMemberAccess(user.id, async (query) => {
        await logAdminAccess(query, user.id, memberId, 'view_submission', 'form_submission', submissionId);
        return loadSubmissionDetail(query, memberId, submissionId);
      }, 'admin');
      if (!detail) return Response.json({ error: 'That record could not be found.' }, { status: 404 });
      return Response.json(detail, { headers: noStore });
    }

    if (url.searchParams.get('export') === 'pdf') {
      const member = await withMemberAccess(user.id, async (query) => {
        await logAdminAccess(query, user.id, memberId, 'export_member_report', 'progress_report');
        return loadMember(query, memberId, null);
      }, 'admin');
      if (!member) return Response.json({ error: 'Member not found.' }, { status: 404 });
      const pdf = await buildProgressReport({
        memberName: member.profile.display_name,
        audience: 'admin',
        timeline: buildTimeline(member.entries, member.currentWeek.number),
        submissions: member.submissions,
        adminNotes: [...member.generalNotes, ...member.entries.flatMap((entry) => entry.notes)].filter((note) => note.authorRole === 'admin'),
      });
      return new Response(pdf, {
        headers: { ...noStore, 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="progress-report-${new Date().toISOString().slice(0, 10)}.pdf"` },
      });
    }

    const account = await loadIdentityAccount(memberId);
    const member = await withMemberAccess(user.id, async (query) => {
      await logAdminAccess(query, user.id, memberId, 'view_member_progress');
      return loadMember(query, memberId, account);
    }, 'admin');
    if (!member) return Response.json({ error: 'Member not found.' }, { status: 404 });
    return Response.json({ member }, { headers: noStore });
  }

  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed.' }, { status: 405 });
  verifyRequestOrigin(request);
  const body = await request.json().catch(() => ({}));
  if (body.action === 'remind') return sendReminders(user, body);
  const text = typeof body.body === 'string' ? body.body.trim() : '';
  if (body.action !== 'note') return Response.json({ error: 'Unknown action.' }, { status: 422 });
  if (!text || text.length > 2000) return Response.json({ error: 'Please write a note of up to 2,000 characters.' }, { status: 422 });
  if (body.submissionId && !isUuid(body.submissionId)) return Response.json({ error: 'That check-in could not be found.' }, { status: 404 });

  const result = await withMemberAccess(user.id, async (query) => {
    const [profile] = await query('SELECT id FROM profiles WHERE id = $1', [body.member]);
    if (!profile) return { status: 404, error: 'Member not found.' };
    if (body.submissionId) {
      const [owned] = await query('SELECT 1 FROM member_form_submissions WHERE id = $1 AND user_id = $2', [body.submissionId, body.member]);
      if (!owned) return { status: 404, error: 'That check-in could not be found.' };
    }
    const [note] = await query(`
      INSERT INTO member_progress_notes (user_id, author_user_id, author_role, visibility, submission_id, body)
      VALUES ($1, $2, 'admin', 'admin_private', $3, $4) RETURNING id
    `, [body.member, user.id, body.submissionId || null, text]);
    await logAdminAccess(query, user.id, body.member, 'add_private_note', 'progress_note', note.id);
    return { status: 200, member: await loadMember(query, body.member, await loadIdentityAccount(body.member)) };
  }, 'admin');
  if (result.error) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ ok: true, member: result.member }, { headers: noStore });
}

export const config = { path: '/api/admin/progress' };
