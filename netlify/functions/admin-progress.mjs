import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { authoriseAdmin, logAdminAccess, notAllowlistedMessage, withMemberAccess } from './_shared/member-access.mjs';
import { loadSubmissionDetail, loadSubmissionList } from './_shared/member-records.mjs';
import { isUuid, loadProgressState } from './_shared/progress-store.mjs';
import { buildProgressReport } from './_shared/progress-report.mjs';
import { emailDeliveryConfigured } from './_shared/email.mjs';
import { loadMembers, reconcileIdentityAccounts, sendReminders, summariseMembers } from './_shared/member-directory.mjs';
import { loadIdentityAccount, loadIdentityAccounts } from './_shared/identity-accounts.mjs';
import { buildTimeline } from '../../utils/progress-timeline.mjs';

const noStore = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };

const matches = (member, term) => !term || `${member.display_name} ${member.email || ''}`.toLowerCase().includes(term.toLowerCase());

async function loadMember(query, memberId, account) {
  const [row] = await query(`
    SELECT p.id, p.display_name, p.membership_status, p.membership_started_at, p.created_at, COALESCE(p.account_email, w.answers->>'email') AS email
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

// Reminders from the progress tab use the same eligibility checks, limits
// and audit trail as the member management table.
async function remind(user, body) {
  const result = await sendReminders(user.id, body.kind, body.members, await loadIdentityAccounts());
  if (result.error) return Response.json({ error: result.error }, { status: 422 });
  return Response.json({ ok: true, ...result }, { headers: noStore });
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
      const accounts = await loadIdentityAccounts();
      await reconcileIdentityAccounts(accounts);
      const all = await loadMembers(user.id, { accounts, log: (query) => logAdminAccess(query, user.id, null, term ? 'search_member_progress' : 'list_member_progress') });
      return Response.json({
        summary: summariseMembers(all, accounts),
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
  if (body.action === 'remind') return remind(user, body);
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
