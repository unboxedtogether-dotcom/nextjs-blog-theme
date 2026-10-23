import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { authoriseAdmin, logAdminAccess, notAllowlistedMessage, withMemberAccess } from './_shared/member-access.mjs';
import { loadSubmissionDetail, loadSubmissionList } from './_shared/member-records.mjs';
import { isUuid, loadProgressState } from './_shared/progress-store.mjs';
import { buildProgressReport } from './_shared/progress-report.mjs';
import { buildTimeline } from '../../utils/progress-timeline.mjs';

const noStore = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
const likePattern = (value) => `%${value.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;

async function searchMembers(query, term) {
  const rows = await query(`
    SELECT p.id, p.display_name, w.answers->>'email' AS email, p.membership_status, p.created_at,
      b.baseline_date::text AS baseline_date, b.reporting_week_start::text AS baseline_week_start,
      to_char(date_trunc('week', timezone('Europe/London', NOW())), 'YYYY-MM-DD') AS current_week_start,
      (SELECT MAX(s.submitted_at) FROM member_form_submissions s WHERE s.user_id = p.id AND s.form_type = 'weekly_checkin') AS last_checkin_at,
      (SELECT MAX(s.entry_date)::text FROM member_form_submissions s WHERE s.user_id = p.id AND s.form_type = 'weekly_checkin') AS last_checkin_date,
      w.completed_at AS welcome_completed_at, h.section_3_saved_at AS welcome_starting_point_saved_at,
      CASE WHEN h.answers->>'baselineDate' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN h.answers->>'baselineDate' END AS welcome_baseline_date,
      (SELECT COUNT(*) FROM member_form_submissions s WHERE s.user_id = p.id AND s.form_type = 'weekly_checkin' AND s.revision_of IS NULL)::int AS checkins,
      (SELECT COUNT(*) FROM member_form_submissions s WHERE s.user_id = p.id)::int AS submissions,
      EXISTS (SELECT 1 FROM member_form_submissions s WHERE s.user_id = p.id AND s.form_type = 'weekly_checkin'
        AND s.reporting_week_start = date_trunc('week', timezone('Europe/London', NOW()))::date) AS checked_in_this_week,
      (SELECT ws.overall_score FROM member_weekly_scores ws WHERE ws.user_id = p.id AND ws.completeness = 'complete' AND ws.reporting_week_number > 0
        ORDER BY ws.reporting_week_number DESC, ws.calculated_at DESC LIMIT 1) AS latest_score
    FROM profiles p
    LEFT JOIN member_welcome_details w ON w.user_id = p.id
    LEFT JOIN member_health_information h ON h.user_id = p.id
    LEFT JOIN member_baselines b ON b.user_id = p.id
    WHERE $1 = '' OR p.display_name ILIKE $2 OR w.answers->>'email' ILIKE $2
    ORDER BY GREATEST((SELECT MAX(s.submitted_at) FROM member_form_submissions s WHERE s.user_id = p.id), w.updated_at, h.updated_at, p.created_at) DESC NULLS LAST, p.display_name
    LIMIT 200
  `, [term, likePattern(term)]);
  return rows.map(({ baseline_week_start: baselineWeek, current_week_start: currentWeek, checked_in_this_week: thisWeek, ...row }) => {
    const weeksSince = baselineWeek ? Math.round((Date.parse(currentWeek) - Date.parse(baselineWeek)) / (7 * 86400000)) : null;
    // Completed past weeks are 1 to weeksSince - 1; the current week is not missed yet.
    const pastCheckins = row.checkins - (thisWeek ? 1 : 0);
    return {
      ...row,
      latest_score: row.latest_score === null ? null : Number(row.latest_score),
      missed: weeksSince === null ? null : Math.max(0, weeksSince - 1 - pastCheckins),
    };
  });
}

async function loadMember(query, memberId) {
  const [profile] = await query(`
    SELECT p.id, p.display_name, p.membership_status, p.membership_started_at, p.created_at, w.answers->>'email' AS email
    FROM profiles p LEFT JOIN member_welcome_details w ON w.user_id = p.id WHERE p.id = $1
  `, [memberId]);
  if (!profile) return null;
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
      const members = await withMemberAccess(user.id, async (query) => {
        await logAdminAccess(query, user.id, null, term ? 'search_member_progress' : 'list_member_progress');
        return searchMembers(query, term);
      }, 'admin');
      return Response.json({ members }, { headers: noStore });
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
        return loadMember(query, memberId);
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

    const member = await withMemberAccess(user.id, async (query) => {
      await logAdminAccess(query, user.id, memberId, 'view_member_progress');
      return loadMember(query, memberId);
    }, 'admin');
    if (!member) return Response.json({ error: 'Member not found.' }, { status: 404 });
    return Response.json({ member }, { headers: noStore });
  }

  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed.' }, { status: 405 });
  verifyRequestOrigin(request);
  const body = await request.json().catch(() => ({}));
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
    return { status: 200, member: await loadMember(query, body.member) };
  }, 'admin');
  if (result.error) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ ok: true, member: result.member }, { headers: noStore });
}

export const config = { path: '/api/admin/progress' };
