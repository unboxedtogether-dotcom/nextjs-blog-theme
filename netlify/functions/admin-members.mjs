import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { authoriseAdmin, logAdminAccess, notAllowlistedMessage } from './_shared/member-access.mjs';
import { loadIdentityAccount, loadIdentityAccounts } from './_shared/identity-accounts.mjs';
import {
  communicationSummary, filterMembers, loadMemberRecord, loadMembers, memberFilters, previewReminders, reconcileIdentityAccounts, sendReminders, summariseMembers,
} from './_shared/member-directory.mjs';
import { loadProgressState } from './_shared/progress-store.mjs';
import { adminReferralList } from './_shared/referrals.mjs';
import { emailDeliveryConfigured } from './_shared/email.mjs';
import { buildTimeline } from '../../utils/progress-timeline.mjs';
import { SCORING_VERSION } from '../../utils/progress-checkin.mjs';

const noStore = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
const json = (body, status = 200) => Response.json(body, { status, headers: noStore });

// Weekly history without any answers: week, date, status and the score
// stored under the scoring version it was calculated with.
async function progressHistory(query, memberId) {
  const state = await loadProgressState(query, memberId);
  const timeline = buildTimeline(state.entries, state.currentWeek.number);
  return {
    consent: state.consent,
    state: state.state,
    baseline: state.baseline,
    currentWeek: state.currentWeek,
    summary: timeline.summary,
    scoringVersion: SCORING_VERSION,
    weeks: timeline.weeks.map((week) => ({
      weekNumber: week.weekNumber,
      weekStart: week.weekStart || null,
      entryDate: week.entryDate || null,
      submittedAt: week.submittedAt || null,
      status: week.status,
      overall: week.overall ?? null,
      scoringVersion: week.scoringVersion || null,
      change: week.change ?? null,
    })),
  };
}

// Chronological, content-free history for one member. No answers, scores or notes.
function memberTimeline(record, referrals) {
  const { member, submissions, emails, referredBy } = record;
  const events = [];
  const add = (at, type, label, extra = {}) => { if (at) events.push({ at, type, label, ...extra }); };
  add(member.signed_up_at, 'registered', 'Member registered');
  add(member.email_verified_at, 'verified', 'Email verified');
  if (referredBy) add(referredBy.registered_at, 'referred', `Joined through ${referredBy.referrer_name || 'a member'}’s invitation`);
  for (const item of submissions) {
    if (item.revision_number > 0) continue;
    if (item.form_type === 'welcome_details') add(item.submitted_at, 'form', 'Welcome form completed');
    else if (item.form_type.startsWith('welcome_')) add(item.submitted_at, 'form', 'Optional welcome section saved');
    else if (item.form_type === 'baseline_wellbeing') add(item.submitted_at, 'checkin', 'Baseline completed');
    else if (item.form_type === 'weekly_checkin') add(item.submitted_at, 'checkin', `Weekly check-in completed (Week ${item.reporting_week_number})`);
  }
  const names = { welcome_reminder: 'Welcome form reminder', checkin_reminder: 'Check-in reminder', baseline_reminder: 'Onboarding reminder', member_welcome: 'Welcome email' };
  for (const email of emails) {
    const name = names[email.kind] || 'Email';
    add(email.created_at, 'email', `${name} requested`, { emailId: email.id });
    add(email.sent_at, 'email', `${name} accepted by provider`, { emailId: email.id });
    add(email.delivered_at, 'email', `${name} delivered`, { emailId: email.id });
    if (['failed', 'bounced', 'complained'].includes(email.status)) add(email.failed_at || email.last_attempt_at || email.created_at, 'email_failure', `${name} ${email.status}`, { emailId: email.id });
  }
  for (const referral of referrals) {
    add(referral.created_at, 'referral', 'Referral created');
    add(referral.shared_at, 'referral', 'Referral link shared');
    add(referral.email_sent_at, 'referral', 'Referral invitation email accepted by provider');
    if (['failed', 'bounced', 'complained'].includes(referral.email_status)) add(referral.email_created_at, 'email_failure', `Referral invitation email ${referral.email_status}`);
    add(referral.registered_at, 'referral', `Referred friend registered${referral.registered_name ? ` (${referral.registered_name})` : ''}`);
  }
  return events.sort((a, b) => new Date(b.at) - new Date(a.at));
}

// Member management for allowlisted administrators. Every list, view and
// reminder is checked on the server and written to the admin access log.
export default async function adminMembers(request) {
  const user = await getUser();
  if (!user) return json({ error: 'Please log in to continue.' }, 401);
  if (!(await authoriseAdmin(user))) return json({ error: (user.roles || []).includes('admin') ? notAllowlistedMessage : 'You do not have access to this area.' }, 403);
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const memberId = url.searchParams.get('member');
    if (memberId) {
      const account = await loadIdentityAccount(memberId);
      const result = await loadMemberRecord(user.id, memberId, account, async (query) => {
        await logAdminAccess(query, user.id, memberId, 'view_member_record', 'profile', memberId);
        return { progress: await progressHistory(query, memberId) };
      });
      if (!result) return json({ error: 'Member not found.' }, 404);
      const referrals = await adminReferralList({ referrerId: memberId, limit: 200 });
      return json({ ...result, referrals, timeline: memberTimeline(result, referrals), emailDelivery: emailDeliveryConfigured() });
    }

    const accounts = await loadIdentityAccounts();
    const reconciliation = await reconcileIdentityAccounts(accounts);
    const view = url.searchParams.get('view');
    const params = Object.fromEntries(['q', 'filter', 'sort', 'page', 'pageSize'].map((key) => [key, url.searchParams.get(key) || undefined]));
    const action = view === 'referrals' ? 'list_referrals' : params.q ? 'search_members' : 'list_members';
    const members = await loadMembers(user.id, {
      accounts,
      log: (query) => logAdminAccess(query, user.id, null, action, null, null, params.filter && params.filter !== 'all' ? `filter: ${params.filter}` : null),
    });
    const result = { members, extra: view === 'list' ? null : await communicationSummary(user.id, members) };

    const summary = summariseMembers(result.members, accounts);
    if (view === 'referrals') {
      return json({ summary, communications: result.extra, referrals: await adminReferralList() });
    }
    if (params.filter && !memberFilters[params.filter]) return json({ error: 'Unknown filter.' }, 422);
    return json({
      summary,
      communications: result.extra,
      identity: { available: reconciliation.available, reconciled: reconciliation.created },
      ...filterMembers(result.members, params),
    });
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  try {
    verifyRequestOrigin(request);
  } catch {
    return json({ error: 'This request could not be accepted.' }, 403);
  }
  const body = await request.json().catch(() => ({}));
  const accounts = await loadIdentityAccounts();

  if (body.action === 'preview_reminders') {
    const preview = await previewReminders(user.id, body.type, body.members, accounts);
    if (preview.error) return json({ error: preview.error }, 422);
    const { eligibleMembers, ...rest } = preview;
    return json(rest);
  }
  if (body.action === 'send_reminders') {
    // The browser shows the preview first; this flag records that the admin confirmed it.
    if (body.confirm !== true) return json({ error: 'Please review and confirm the reminder before sending.' }, 422);
    const result = await sendReminders(user.id, body.type, body.members, accounts);
    if (result.error) return json({ error: result.error }, 422);
    return json({ ok: true, ...result });
  }
  return json({ error: 'Unknown action.' }, 422);
}

export const config = { path: '/api/admin/members' };
