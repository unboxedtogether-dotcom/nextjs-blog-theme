import { getDatabase } from '@netlify/database';
import { SCORING_VERSION } from '../../../utils/progress-checkin.mjs';
import {
  REMINDER_GAP_DAYS, checkinSchedule, optionalStatus, reminderEligibility, reminderKey, reminderTemplates, welcomeStatus,
} from '../../../utils/member-status.mjs';
import { deliverQueuedEmails, emailDeliveryConfigured, queueEmail, suppressedAddresses } from './email.mjs';
import { logAdminAccess, withMemberAccess } from './member-access.mjs';

const db = getDatabase();
const DAY = 86400000;
const emailOrNull = (value) => {
  const email = String(value || '').trim().toLowerCase();
  return email.length >= 3 && email.length <= 254 && email.includes('@') ? email : null;
};
const isoOrNull = (value) => (value && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null);

/**
 * Makes sure every Netlify Identity account has a member profile, without
 * touching anything already saved. Profiles used to be created only when an
 * account was confirmed (the Identity signup event) or first used the member
 * area, and the team area lists profiles, so accounts that never got that far
 * were invisible. Existing profiles only have their account email and
 * verification date brought up to date.
 */
export async function reconcileIdentityAccounts(accounts) {
  if (!accounts) return { available: false, created: 0, updated: 0 };
  const list = [...accounts.values()].filter((account) => typeof account.id === 'string' && account.id);
  if (!list.length) return { available: true, created: 0, updated: 0 };
  const ids = list.map((account) => account.id);
  const names = list.map((account) => String(account.userMetadata?.full_name || account.name || '').trim().slice(0, 80));
  const emails = list.map((account) => emailOrNull(account.email));
  const createdAts = list.map((account) => isoOrNull(account.createdAt));
  const confirmedAts = list.map((account) => isoOrNull(account.confirmedAt));

  const created = await db.sql`
    INSERT INTO profiles (id, display_name, created_at, membership_started_at, account_email, email_verified_at, identity_synced_at, created_via)
    SELECT u.id, u.name, COALESCE(u.created_at, NOW()), COALESCE(u.created_at, NOW()), u.email, u.confirmed_at, NOW(), 'identity_reconcile'
    FROM unnest(${ids}::text[], ${names}::text[], ${createdAts}::timestamptz[], ${emails}::text[], ${confirmedAts}::timestamptz[])
      AS u(id, name, created_at, email, confirmed_at)
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `;
  const updated = await db.sql`
    UPDATE profiles p SET account_email = COALESCE(u.email, p.account_email),
      email_verified_at = COALESCE(p.email_verified_at, u.confirmed_at), identity_synced_at = NOW()
    FROM unnest(${ids}::text[], ${emails}::text[], ${confirmedAts}::timestamptz[]) AS u(id, email, confirmed_at)
    WHERE p.id = u.id AND ((u.email IS NOT NULL AND p.account_email IS DISTINCT FROM u.email) OR (p.email_verified_at IS NULL AND u.confirmed_at IS NOT NULL))
    RETURNING p.id
  `;
  if (created.length) console.log('Member profiles reconciled from Identity', created.length);
  return { available: true, created: created.length, updated: updated.length };
}

// Owner-only email data per member: latest reminder of each type, how many
// of each were sent, and the latest email of any kind sent to them.
async function loadEmailState() {
  const kinds = Object.fromEntries(Object.entries(reminderTemplates).map(([type, template]) => [template.kind, type]));
  const latest = await db.sql`
    SELECT DISTINCT ON (user_id, kind) user_id, kind, id, status, created_at, sent_at, context->>'week' AS week
    FROM email_outbox
    WHERE user_id IS NOT NULL AND kind IN ('checkin_reminder', 'welcome_reminder', 'baseline_reminder')
    ORDER BY user_id, kind, created_at DESC
  `;
  const counts = await db.sql`
    SELECT user_id, kind, COUNT(*)::int AS n FROM email_outbox
    WHERE user_id IS NOT NULL AND kind IN ('welcome_reminder', 'baseline_reminder', 'checkin_reminder')
      AND status NOT IN ('cancelled', 'expired', 'failed', 'bounced', 'complained')
    GROUP BY user_id, kind
  `;
  const last = await db.sql`
    SELECT DISTINCT ON (user_id) user_id, kind, status, created_at, sent_at, last_error
    FROM email_outbox WHERE user_id IS NOT NULL AND kind <> 'friend_referral'
    ORDER BY user_id, created_at DESC
  `;
  const byMember = new Map();
  const entry = (id) => {
    if (!byMember.has(id)) byMember.set(id, { reminders: {}, counts: {}, last: null });
    return byMember.get(id);
  };
  for (const row of latest) entry(row.user_id).reminders[kinds[row.kind]] = { id: row.id, status: row.status, at: row.sent_at || row.created_at, week: row.week };
  for (const row of counts) entry(row.user_id).counts[kinds[row.kind]] = row.n;
  for (const row of last) entry(row.user_id).last = { kind: row.kind, status: row.status, at: row.sent_at || row.created_at, error: row.last_error };
  return byMember;
}

async function loadReferralCounts() {
  const rows = await db.sql`
    SELECT referrer_user_id, COUNT(*)::int AS total, COUNT(registered_user_id)::int AS registered
    FROM member_referrals GROUP BY referrer_user_id
  `;
  return new Map(rows.map((row) => [row.referrer_user_id, row]));
}

// Rows run through the restricted role as an authorised admin, so RLS still
// applies to every member record read here.
const memberSql = `
  WITH wk AS (SELECT date_trunc('week', timezone('Europe/London', NOW()))::date AS start, timezone('Europe/London', NOW())::date AS today),
  latest AS (
    SELECT DISTINCT ON (COALESCE(s.revision_of, s.id)) s.user_id, s.reporting_week_number, s.reporting_week_start, s.submitted_at,
      COALESCE(s.entry_date, timezone('Europe/London', s.submitted_at)::date) AS dated, ws.overall_score, ws.completeness
    FROM member_form_submissions s
    LEFT JOIN member_weekly_scores ws ON ws.submission_id = s.id AND ws.scoring_version = $1
    WHERE s.form_type = 'weekly_checkin' AND ($2::text IS NULL OR s.user_id = $2)
    ORDER BY COALESCE(s.revision_of, s.id), s.revision_number DESC
  ),
  consent AS (
    SELECT DISTINCT ON (user_id) user_id, action FROM member_consent_events
    WHERE consent_type = 'progress_tracking' AND ($2::text IS NULL OR user_id = $2) ORDER BY user_id, recorded_at DESC
  )
  SELECT p.id, p.display_name, p.account_email, w.answers->>'email' AS welcome_email, p.membership_status, p.created_at, p.created_via,
    p.email_verified_at, p.welcome_started_at, p.reminder_emails_paused_at, p.marketing_consent, p.membership_tier,
    wk.start::text AS current_week_start, wk.today::text AS today,
    b.baseline_date::text AS baseline_date, b.reporting_week_start::text AS baseline_week_start,
    ((wk.start - b.reporting_week_start) / 7)::int AS weeks_since,
    w.completed_at AS welcome_completed_at, h.consent_given_at AS health_consent_at,
    ((h.section_2_saved_at IS NOT NULL)::int + (h.section_3_saved_at IS NOT NULL)::int + (h.section_4_saved_at IS NOT NULL)::int) AS optional_sections,
    h.section_3_saved_at AS welcome_starting_point_saved_at,
    CASE WHEN h.answers->>'baselineDate' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN h.answers->>'baselineDate' END AS welcome_baseline_date,
    COALESCE(c.action = 'given', FALSE) AS progress_consent,
    COALESCE(l.checkins, 0) AS checkins, COALESCE(l.past_checkins, 0) AS past_checkins,
    COALESCE(l.checked_in_this_week, FALSE) AS checked_in_this_week, COALESCE(l.checked_in_last_week, FALSE) AS checked_in_last_week,
    l.last_checkin_date, l.last_checkin_at, l.latest_score, l.previous_score,
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
      BOOL_OR(x.reporting_week_start = wk.start - 7) AS checked_in_last_week,
      MAX(x.dated)::text AS last_checkin_date,
      MAX(x.submitted_at) AS last_checkin_at,
      (ARRAY_AGG(x.overall_score ORDER BY x.reporting_week_number DESC) FILTER (WHERE x.completeness = 'complete' AND x.reporting_week_number > 0))[1] AS latest_score,
      (ARRAY_AGG(x.overall_score ORDER BY x.reporting_week_number DESC) FILTER (WHERE x.completeness = 'complete' AND x.reporting_week_number > 0))[2] AS previous_score
    FROM latest x WHERE x.user_id = p.id
  ) l ON TRUE
  WHERE $2::text IS NULL OR p.id = $2
  ORDER BY last_activity_at DESC NULLS LAST, p.display_name
`;

/**
 * Every member (or one, with memberId) with their status in plain fields.
 * Same counting rules as the member's own progress page: each check-in
 * counts once (its latest correction is the one scored), a missed week is a
 * past week since the baseline with no check-in, and the current week is
 * never counted as missed.
 *
 * Member records are read through the restricted role as the authorised
 * admin (so RLS applies); outbox and referral data, which that role cannot
 * reach, are read as the table owner before and after that transaction,
 * never inside it. `log` runs inside the transaction to audit the read.
 */
export async function loadMembers(adminId, { accounts = null, memberId = null, now = Date.now(), log = null } = {}) {
  const emailState = await loadEmailState();
  const referrals = await loadReferralCounts();
  const rows = await withMemberAccess(adminId, async (query) => {
    if (log) await log(query);
    return query(memberSql, [SCORING_VERSION, memberId]);
  }, 'admin');
  const members = rows.map(({ welcome_email: welcomeEmail, weeks_since: weeksSince, past_checkins: pastCheckins, ...row }) => {
    const account = accounts?.get(row.id) || null;
    const email = emailOrNull(account?.email) || row.account_email || emailOrNull(welcomeEmail);
    // A profile made by signup confirmation or a signed-in visit proves the
    // email was verified (Identity only lets confirmed accounts log in).
    const verifiedAt = (account ? account.confirmedAt : null) || row.email_verified_at || null;
    const emailVerified = Boolean(verifiedAt) || (!account && row.created_via === 'app');
    const schedule = checkinSchedule({
      progressConsent: row.progress_consent,
      baselineWeekStart: row.baseline_week_start,
      currentWeekStart: row.current_week_start,
      today: row.today,
      checkedInThisWeek: row.checked_in_this_week,
      checkedInLastWeek: row.checked_in_last_week,
    });
    const mail = emailState.get(row.id) || { reminders: {}, counts: {}, last: null };
    const referral = referrals.get(row.id);
    const signedUpAt = account?.createdAt || row.created_at;
    const lastActivity = row.last_activity_at ? new Date(row.last_activity_at).getTime() : 0;
    return {
      ...row,
      email,
      email_verified: emailVerified,
      email_verified_at: verifiedAt,
      signed_up_at: signedUpAt,
      identity_missing: Boolean(accounts) && !account,
      welcome_status: welcomeStatus({ completedAt: row.welcome_completed_at, startedAt: row.welcome_started_at }),
      optional_status: optionalStatus({ consentGiven: Boolean(row.health_consent_at), sectionsSaved: row.optional_sections }),
      checkin_status: schedule.status,
      checkin_week_number: schedule.weekNumber,
      next_due: schedule.nextDue,
      checkin_opens: schedule.opensOn,
      latest_score: row.latest_score === null ? null : Number(row.latest_score),
      previous_score: row.previous_score === null ? null : Number(row.previous_score),
      missed: row.baseline_date ? Math.max(0, weeksSince - 1 - pastCheckins) : null,
      active: lastActivity >= now - 30 * DAY,
      stage: !emailVerified ? 'registered' : !row.welcome_completed_at ? 'verified' : row.last_checkin_at && new Date(row.last_checkin_at).getTime() >= now - 14 * DAY ? 'checking_in' : 'onboarded',
      reminders_paused: Boolean(row.reminder_emails_paused_at),
      reminders: mail.reminders,
      reminder_counts: mail.counts,
      last_email: mail.last,
      referrals: referral?.total || 0,
      referrals_registered: referral?.registered || 0,
    };
  });
  const suppressed = await suppressedAddresses(members.map((member) => member.email));
  for (const member of members) {
    member.email_suppressed = Boolean(member.email && suppressed.has(member.email));
    member.can_remind = {};
    member.remind_reasons = {};
    for (const type of Object.keys(reminderTemplates)) {
      const check = reminderEligibility(type, member, now);
      member.can_remind[type] = check.eligible;
      member.remind_reasons[type] = check.reason;
    }
    member.no_response = noResponse(member, now);
  }
  return members;
}

// A reminder went out more than two days ago and the thing it was about is still not done.
function noResponse(member, now) {
  const waited = (reminder) => reminder && ['sent', 'delivered'].includes(reminder.status) && now - new Date(reminder.at).getTime() > 2 * DAY;
  if (waited(member.reminders.welcome) && member.welcome_status !== 'completed') return true;
  if (waited(member.reminders.baseline) && member.checkin_status === 'baseline_needed') return true;
  const checkin = member.reminders.checkin;
  return Boolean(waited(checkin) && (!member.last_checkin_at || new Date(member.last_checkin_at) < new Date(checkin.at)));
}

const within = (value, days, now) => value && new Date(value).getTime() >= now - days * DAY;

// Filters behind each overview card and the member table's status menu.
export const memberFilters = {
  all: () => true,
  new_week: (m, now) => within(m.signed_up_at, 7, now),
  new_month: (m, now) => within(m.signed_up_at, 30, now),
  unverified: (m) => !m.email_verified,
  awaiting_onboarding: (m) => m.email_verified && m.welcome_status !== 'completed',
  onboarded: (m) => m.welcome_status === 'completed',
  active: (m) => m.active,
  checking_in: (m) => m.stage === 'checking_in',
  welcome_completed: (m) => m.welcome_status === 'completed',
  welcome_outstanding: (m) => m.welcome_status !== 'completed',
  welcome_in_progress: (m) => m.welcome_status === 'in_progress',
  optional_completed: (m) => m.optional_sections > 0,
  checkin_completed: (m) => m.checkin_status === 'completed',
  checkin_due: (m) => m.checkin_status === 'due' || m.checkin_status === 'due_today',
  checkin_overdue: (m) => m.checkin_status === 'overdue',
  missed_multiple: (m) => (m.missed || 0) >= 2,
  baseline_needed: (m) => m.checkin_status === 'baseline_needed',
  no_response: (m) => m.no_response,
  has_referrals: (m) => m.referrals > 0,
  email_problem: (m) => Boolean(m.last_email && ['failed', 'bounced', 'complained'].includes(m.last_email.status)) || m.email_suppressed,
  reminders_paused: (m) => m.reminders_paused,
  can_remind_welcome: (m) => m.can_remind.welcome,
  can_remind_checkin: (m) => m.can_remind.checkin,
  can_remind_baseline: (m) => m.can_remind.baseline,
};

const sorters = {
  joined_desc: (a, b) => new Date(b.signed_up_at) - new Date(a.signed_up_at),
  joined_asc: (a, b) => new Date(a.signed_up_at) - new Date(b.signed_up_at),
  activity_desc: (a, b) => new Date(b.last_activity_at || 0) - new Date(a.last_activity_at || 0),
  last_checkin_desc: (a, b) => (b.last_checkin_date || '').localeCompare(a.last_checkin_date || ''),
  next_due_asc: (a, b) => (a.next_due || '9999').localeCompare(b.next_due || '9999'),
  name_asc: (a, b) => (a.display_name || '').localeCompare(b.display_name || '', 'en-GB'),
};

export function filterMembers(members, { q = '', filter = 'all', sort = 'joined_desc', page = 1, pageSize = 25, now = Date.now() } = {}) {
  const term = String(q).trim().toLowerCase().slice(0, 100);
  const test = memberFilters[filter] || memberFilters.all;
  const matched = members
    .filter((member) => test(member, now))
    .filter((member) => !term || `${member.display_name || ''} ${member.email || ''}`.toLowerCase().includes(term))
    .sort(sorters[sort] || sorters.joined_desc);
  const size = Math.min(100, Math.max(5, Number(pageSize) || 25));
  const pages = Math.max(1, Math.ceil(matched.length / size));
  const current = Math.min(pages, Math.max(1, Number(page) || 1));
  return { total: matched.length, page: current, pages, pageSize: size, members: matched.slice((current - 1) * size, current * size) };
}

export function summariseMembers(members, accounts, now = Date.now()) {
  const count = (filter) => members.filter((member) => memberFilters[filter](member, now)).length;
  const withProfile = new Set(members.map((member) => member.id));
  return {
    members: members.length,
    newThisWeek: count('new_week'),
    newThisMonth: count('new_month'),
    unverified: count('unverified'),
    // Identity accounts not yet linked to a profile (normally 0 after reconciliation).
    awaitingConfirmation: accounts ? [...accounts.values()].filter((account) => !account.confirmedAt && !withProfile.has(account.id)).length : null,
    awaitingOnboarding: count('awaiting_onboarding'),
    onboarded: count('onboarded'),
    active: count('active'),
    checkingIn: count('checking_in'),
    welcomeCompleted: count('welcome_completed'),
    welcomeNotStarted: members.filter((member) => member.welcome_status === 'not_started').length,
    welcomeOutstanding: count('welcome_outstanding'),
    welcomeInProgress: count('welcome_in_progress'),
    optionalCompleted: count('optional_completed'),
    baselines: members.filter((member) => member.baseline_date).length,
    baselineNeeded: count('baseline_needed'),
    checkinsCompleted: members.reduce((total, member) => total + member.checkins, 0),
    checkedInThisWeek: count('checkin_completed'),
    checkinDue: count('checkin_due'),
    checkinOverdue: count('checkin_overdue'),
    missedCheckin: members.filter((member) => member.missed > 0).length,
    missedMultiple: count('missed_multiple'),
    noResponse: count('no_response'),
    withReferrals: count('has_referrals'),
    remindersPaused: count('reminders_paused'),
    remindCheckin: count('can_remind_checkin'),
    remindWelcome: count('can_remind_welcome'),
    remindBaseline: count('can_remind_baseline'),
  };
}

// Communication and referral figures for the overview, straight from the outbox and referral tables.
export async function communicationSummary(adminId, members) {
  const [outbox] = await db.sql`
    SELECT COUNT(*) FILTER (WHERE status IN ('queued', 'sending'))::int AS awaiting,
      COUNT(*) FILTER (WHERE status IN ('sent', 'delivered', 'delayed'))::int AS accepted,
      COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered,
      COUNT(*) FILTER (WHERE status IN ('failed', 'bounced', 'complained'))::int AS failures,
      COUNT(*) FILTER (WHERE status = 'bounced')::int AS bounced,
      COUNT(*) FILTER (WHERE kind IN ('checkin_reminder', 'welcome_reminder', 'baseline_reminder') AND status IN ('sent', 'delivered', 'delayed'))::int AS reminders_sent,
      COUNT(*) FILTER (WHERE kind IN ('checkin_reminder', 'welcome_reminder', 'baseline_reminder'))::int AS reminders_total
    FROM email_outbox
  `;
  const [referrals] = await db.sql`
    SELECT COUNT(*)::int AS created,
      COUNT(*) FILTER (WHERE r.shared_at IS NOT NULL)::int AS shared,
      COUNT(*) FILTER (WHERE r.first_opened_at IS NOT NULL)::int AS opened,
      COUNT(*) FILTER (WHERE r.prospect_id IS NOT NULL)::int AS interested,
      COUNT(*) FILTER (WHERE r.registered_user_id IS NOT NULL)::int AS registered,
      COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM email_outbox o WHERE o.referral_id = r.id AND o.status IN ('sent', 'delivered', 'delayed')))::int AS emails_sent,
      COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM email_outbox o WHERE o.referral_id = r.id AND o.status IN ('queued', 'sending', 'failed', 'bounced', 'complained')))::int AS emails_pending_or_failed,
      COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM email_outbox o WHERE o.referral_id = r.id AND o.status NOT IN ('cancelled', 'expired')) AND r.shared_at IS NULL AND r.registered_user_id IS NULL)::int AS awaiting_sharing
    FROM member_referrals r
  `;
  const registeredIds = await db.sql`SELECT registered_user_id FROM member_referrals WHERE registered_user_id IS NOT NULL`;
  const byId = new Map(members.map((member) => [member.id, member]));
  const referredOnboarded = registeredIds.filter((row) => byId.get(row.registered_user_id)?.welcome_status === 'completed').length;
  const topReferrers = await db.sql`
    SELECT r.referrer_user_id AS id, p.display_name, COUNT(*)::int AS referrals, COUNT(r.registered_user_id)::int AS registered
    FROM member_referrals r JOIN profiles p ON p.id = r.referrer_user_id
    GROUP BY r.referrer_user_id, p.display_name ORDER BY registered DESC, referrals DESC LIMIT 5
  `;
  const [support] = await withMemberAccess(adminId, (query) => query("SELECT COUNT(*)::int AS n FROM member_messages WHERE topic = 'Practical support' AND status = 'new'"), 'admin');
  const [prospectSupport] = await db.sql`SELECT COUNT(*)::int AS n FROM prospect_submissions WHERE support_status = 'new'`;
  return {
    emails: { ...outbox, deliveryConfigured: emailDeliveryConfigured(), webhookConfigured: Boolean(process.env.RESEND_WEBHOOK_SECRET) },
    referrals: { ...referrals, onboarded: referredOnboarded, topReferrers },
    support: { members: support?.n || 0, prospects: prospectSupport?.n || 0 },
  };
}

/**
 * Who would receive a reminder, who would not and why. Always worked out on
 * the server from fresh records; nothing from the browser is trusted.
 */
export async function previewReminders(adminId, type, ids, accounts) {
  const template = reminderTemplates[type];
  if (!template) return { error: 'Choose which reminder to send.' };
  const unique = [...new Set((Array.isArray(ids) ? ids : []).filter((id) => typeof id === 'string'))].slice(0, 200);
  if (!unique.length) return { error: 'Choose at least one member.' };
  const all = await loadMembers(adminId, { accounts });
  const chosen = all.filter((member) => unique.includes(member.id));
  const eligible = chosen.filter((member) => member.can_remind[type]);
  const excluded = chosen.filter((member) => !member.can_remind[type])
    .map((member) => ({ id: member.id, name: member.display_name || 'Member', reason: member.remind_reasons[type] }));
  const reasons = {};
  for (const item of excluded) reasons[item.reason] = (reasons[item.reason] || 0) + 1;
  return {
    template: { type, kind: template.kind, label: template.label, subject: template.subject },
    selected: unique.length,
    found: chosen.length,
    eligible: eligible.map((member) => ({ id: member.id, name: member.display_name || 'Member', email: member.email })),
    excluded,
    excludedReasons: reasons,
    eligibleMembers: eligible,
    deliveryConfigured: emailDeliveryConfigured(),
    gapDays: REMINDER_GAP_DAYS,
  };
}

// Queues and sends one reminder per eligible member, then reports what
// happened to each. Idempotency keys stop a double click (or two admins)
// sending the same reminder twice.
export async function sendReminders(adminId, type, ids, accounts) {
  const preview = await previewReminders(adminId, type, ids, accounts);
  if (preview.error) return preview;
  const results = preview.excluded.map((item) => ({ ...item, outcome: 'excluded' }));
  const queued = [];
  for (const member of preview.eligibleMembers) {
    const id = await queueEmail({
      kind: preview.template.kind,
      to: member.email,
      userId: member.id,
      payload: { firstName: (member.display_name || '').split(' ')[0] },
      requestedBy: adminId,
      idempotencyKey: reminderKey(type, member),
      context: type === 'checkin' ? { week: member.current_week_start } : {},
    });
    if (id) queued.push({ id, member });
    else results.push({ id: member.id, name: member.display_name || 'Member', outcome: 'excluded', reason: 'Same reminder already queued' });
  }
  const delivery = queued.length ? await deliverQueuedEmails({ ids: queued.map((item) => item.id) }) : { sent: 0, failed: 0, configured: emailDeliveryConfigured(), results: [] };
  const outcomes = new Map(delivery.results.map((item) => [item.id, item]));
  for (const item of queued) {
    const outcome = outcomes.get(item.id);
    results.push({ id: item.member.id, name: item.member.display_name || 'Member', emailId: item.id, outcome: outcome?.status || 'queued', reason: outcome?.error || null });
  }
  await withMemberAccess(adminId, async (query) => {
    for (const item of queued) await logAdminAccess(query, adminId, item.member.id, 'send_reminder', 'email', item.id, type);
  }, 'admin');
  return {
    template: preview.template,
    selected: preview.selected,
    queued: queued.length,
    sent: delivery.sent,
    failed: delivery.failed,
    skipped: preview.selected - queued.length,
    emailDelivery: delivery.configured,
    results,
  };
}

// Everything the team needs on one member, without questionnaire answers.
// Answers stay behind the separate, logged "view form" requests. `extra`
// runs inside the restricted transaction for further reads (and logging).
export async function loadMemberRecord(adminId, memberId, account, extra = async () => ({})) {
  const accounts = account ? new Map([[memberId, account]]) : null;
  const emails = await db.sql`
    SELECT id, kind, status, template_version, requested_by, created_at, last_attempt_at, sent_at, delivered_at, failed_at, last_error, attempts, retry_count,
      provider_message_id IS NOT NULL AS has_provider_id
    FROM email_outbox WHERE user_id = ${memberId} AND kind <> 'friend_referral' ORDER BY created_at DESC LIMIT 100
  `;
  const [referredBy] = await db.sql`
    SELECT r.id, r.referrer_user_id, p.display_name AS referrer_name, r.attributed_by, r.registered_at
    FROM member_referrals r JOIN profiles p ON p.id = r.referrer_user_id WHERE r.registered_user_id = ${memberId}
  `;
  const [member] = await loadMembers(adminId, { accounts, memberId });
  if (!member) return null;
  const restricted = await withMemberAccess(adminId, async (query) => {
    const submissions = await query(`
      SELECT s.id, COALESCE(s.revision_of, s.id) AS root_id, s.form_type, s.form_version, s.reporting_week_number,
        s.reporting_week_start::text AS week_start, s.entry_date::text AS entry_date, s.status, s.revision_number, s.source, s.submitted_at,
        w.overall_score, w.completeness, w.scoring_version
      FROM member_form_submissions s
      LEFT JOIN member_weekly_scores w ON w.submission_id = s.id AND w.scoring_version = $2
      WHERE s.user_id = $1 ORDER BY s.submitted_at DESC
    `, [memberId, SCORING_VERSION]);
    const consent = await query(`
      SELECT DISTINCT ON (consent_type) consent_type, action, recorded_at FROM member_consent_events
      WHERE user_id = $1 ORDER BY consent_type, recorded_at DESC
    `, [memberId]);
    const [health] = await query('SELECT section_2_saved_at, section_3_saved_at, section_4_saved_at, consent_given_at FROM member_health_information WHERE user_id = $1', [memberId]);
    return { submissions, consent, health, ...(await extra(query)) };
  }, 'admin');
  const { submissions, consent, health, ...rest } = restricted;
  return {
    member,
    submissions: submissions.map((item) => ({ ...item, overall_score: item.overall_score === null ? null : Number(item.overall_score) })),
    consent: Object.fromEntries(consent.map((item) => [item.consent_type, { action: item.action, at: item.recorded_at }])),
    optionalSections: health ? { 2: health.section_2_saved_at, 3: health.section_3_saved_at, 4: health.section_4_saved_at, consentGivenAt: health.consent_given_at } : null,
    emails,
    referredBy: referredBy || null,
    ...rest,
  };
}
