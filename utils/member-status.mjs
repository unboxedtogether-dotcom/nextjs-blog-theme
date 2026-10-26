// Status rules shared by the team area (server) and its tables (browser).
// Pure functions with no database access, so they are unit tested directly.
//
// Weekly check-ins follow the existing progress rules: reporting weeks run
// Monday to Sunday (UK time), the baseline's week is Week 0, and each later
// week has one check-in. A week's check-in is due by its Sunday.

const DAY = 86400000;
export const addDays = (date, count) => new Date(Date.parse(`${date}T00:00:00Z`) + count * DAY).toISOString().slice(0, 10);
const weeksBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / (7 * DAY));

// Days between reminders of the same kind, and how many a member can get
// for the same unfinished thing (welcome form or baseline).
export const REMINDER_GAP_DAYS = 6;
export const REMINDER_LIMIT = 3;

export const reminderTemplates = {
  welcome: { kind: 'welcome_reminder', label: 'Welcome questionnaire reminder', subject: 'Your Unboxed Together welcome form is waiting' },
  checkin: { kind: 'checkin_reminder', label: 'Weekly check-in reminder', subject: 'Your Unboxed Together check-in is ready' },
  baseline: { kind: 'baseline_reminder', label: 'Onboarding reminder (start progress tracking)', subject: 'Your Unboxed Together starting point is ready' },
};

// Colour for each status: green done, amber due soon, red overdue, grey n/a.
export const statusTone = {
  completed: 'green', due: 'amber', due_today: 'amber', overdue: 'red', not_applicable: 'grey',
  not_started: 'grey', in_progress: 'amber', baseline_needed: 'amber', waiting: 'green',
};

export const checkinStatusLabels = {
  completed: 'Completed', due: 'Due', due_today: 'Due today', overdue: 'Overdue', not_applicable: 'Not tracking', baseline_needed: 'Baseline needed', waiting: 'Baseline this week',
};

/**
 * Weekly check-in status for one member.
 * @param {object} input
 * @param {boolean} input.progressConsent  progress tracking turned on
 * @param {string|null} input.baselineWeekStart  Monday of the baseline's week
 * @param {string} input.currentWeekStart  Monday of the current UK week
 * @param {string} input.today  current UK date
 * @param {boolean} input.checkedInThisWeek
 * @param {boolean} input.checkedInLastWeek
 */
export function checkinSchedule({ progressConsent, baselineWeekStart, currentWeekStart, today, checkedInThisWeek, checkedInLastWeek }) {
  if (!progressConsent) return { status: 'not_applicable', weekNumber: null, dueDate: null, nextDue: null, opensOn: null };
  if (!baselineWeekStart) return { status: 'baseline_needed', weekNumber: null, dueDate: null, nextDue: null, opensOn: null };
  const weekNumber = weeksBetween(baselineWeekStart, currentWeekStart);
  const thisSunday = addDays(currentWeekStart, 6);
  const nextSunday = addDays(currentWeekStart, 13);
  const nextMonday = addDays(currentWeekStart, 7);
  // The baseline was this week: Week 1 opens next Monday.
  if (weekNumber <= 0) return { status: 'waiting', weekNumber: 0, dueDate: null, nextDue: nextSunday, opensOn: nextMonday };
  if (checkedInThisWeek) return { status: 'completed', weekNumber, dueDate: thisSunday, nextDue: nextSunday, opensOn: nextMonday };
  // Last week passed with no check-in (Week 1 has no earlier week to miss).
  const overdue = weekNumber >= 2 && !checkedInLastWeek;
  return {
    status: overdue ? 'overdue' : today === thisSunday ? 'due_today' : 'due',
    weekNumber,
    dueDate: thisSunday,
    nextDue: thisSunday,
    opensOn: currentWeekStart,
  };
}

// Only page 1 is required. Pages 2 to 4 are optional and never "overdue".
export function welcomeStatus({ completedAt, startedAt }) {
  if (completedAt) return 'completed';
  if (startedAt) return 'in_progress';
  return 'not_started';
}

export function optionalStatus({ consentGiven, sectionsSaved }) {
  if (!consentGiven) return 'not_applicable';
  if (sectionsSaved >= 3) return 'completed';
  return sectionsSaved > 0 ? 'in_progress' : 'not_started';
}

const live = (reminder) => reminder && !['failed', 'cancelled', 'expired', 'bounced', 'complained'].includes(reminder.status);
const daysSince = (at, now) => (now - new Date(at).getTime()) / DAY;

/**
 * Whether a reminder of `type` may be sent to a member now, and if not, why.
 * The server always re-checks this; the browser only uses it for display.
 * @param {'welcome'|'checkin'|'baseline'} type
 * @param {object} member  a row from the team area member list
 * @param {number} [now]
 */
export function reminderEligibility(type, member, now = Date.now()) {
  const no = (reason) => ({ eligible: false, reason });
  if (!reminderTemplates[type]) return no('Unknown reminder type');
  if (!member.email) return no('No email address on record');
  if (!member.email_verified) return no('Email address not verified yet');
  if (member.email_suppressed) return no('Address bounced, complained or unsubscribed');
  if (member.reminders_paused) return no('Member turned reminder emails off');
  if (member.membership_status && member.membership_status !== 'active') return no('Membership is not active');
  const history = member.reminders?.[type];

  if (type === 'welcome') {
    if (member.welcome_status === 'completed') return no('Welcome form already completed');
    if ((member.reminder_counts?.welcome || 0) >= REMINDER_LIMIT) return no(`Already sent ${REMINDER_LIMIT} welcome reminders`);
    if (live(history) && daysSince(history.at, now) < REMINDER_GAP_DAYS) return no(`Reminded in the last ${REMINDER_GAP_DAYS} days`);
    return { eligible: true, reason: null };
  }
  if (type === 'baseline') {
    if (member.welcome_status !== 'completed') return no('Welcome form not completed yet');
    if (!member.progress_consent) return no('Progress tracking not turned on');
    if (member.checkin_status !== 'baseline_needed') return no('Baseline already completed');
    if ((member.reminder_counts?.baseline || 0) >= REMINDER_LIMIT) return no(`Already sent ${REMINDER_LIMIT} onboarding reminders`);
    if (live(history) && daysSince(history.at, now) < REMINDER_GAP_DAYS) return no(`Reminded in the last ${REMINDER_GAP_DAYS} days`);
    return { eligible: true, reason: null };
  }
  // Weekly check-in: at most one live reminder per reporting week.
  if (!member.progress_consent) return no('Progress tracking not turned on');
  if (member.checkin_status === 'baseline_needed') return no('No baseline yet');
  if (member.checkin_status === 'waiting') return no('First check-in not open yet');
  if (member.checkin_status === 'completed') return no('This week’s check-in already completed');
  if (live(history) && history.week === member.current_week_start) return no('Already reminded this week');
  if (live(history) && daysSince(history.at, now) < 2) return no('Reminded in the last 2 days');
  return { eligible: true, reason: null };
}

// Idempotency key: the same reminder for the same period can only be queued once.
export function reminderKey(type, member) {
  if (type === 'checkin') return `checkin_reminder:${member.id}:${member.current_week_start}`;
  const count = (member.reminder_counts?.[type] || 0) + 1;
  return `${reminderTemplates[type].kind}:${member.id}:${count}`;
}

// What an email's status means, in words an admin can rely on.
export const emailStatusLabels = {
  queued: 'Awaiting dispatch',
  sending: 'Sending',
  sent: 'Accepted by provider',
  delivered: 'Delivered (confirmed)',
  delayed: 'Delivery delayed',
  bounced: 'Bounced',
  complained: 'Marked as spam',
  failed: 'Failed',
  cancelled: 'Cancelled',
  expired: 'Expired unsent',
};
export const emailStatusTone = {
  queued: 'amber', sending: 'amber', sent: 'blue', delivered: 'green', delayed: 'amber', bounced: 'red', complained: 'red', failed: 'red', cancelled: 'grey', expired: 'grey',
};

// Referral journey stage, from the furthest milestone reached.
export function referralStage(referral) {
  if (referral.onboarded_at) return 'onboarded';
  if (referral.registered_at) return 'registered';
  if (referral.prospect_at) return 'interested';
  if (referral.first_opened_at) return 'opened';
  if (referral.email_status && ['queued', 'sending'].includes(referral.email_status)) return 'email_queued';
  if (referral.email_status === 'sent') return 'email_accepted';
  if (referral.email_status === 'delivered') return 'email_delivered';
  if (referral.email_status && ['failed', 'bounced', 'complained'].includes(referral.email_status)) return 'email_failed';
  if (referral.shared_at) return 'shared';
  return 'awaiting_sharing';
}

export const referralStageLabels = {
  awaiting_sharing: 'Created – awaiting member sharing',
  shared: 'Shared by member',
  email_queued: 'Email queued',
  email_accepted: 'Email accepted by provider',
  email_delivered: 'Email delivered',
  email_failed: 'Email failed',
  opened: 'Link opened',
  interested: 'Registered interest',
  registered: 'Registered',
  onboarded: 'Completed onboarding',
};
export const referralStageTone = {
  awaiting_sharing: 'grey', shared: 'amber', email_queued: 'amber', email_accepted: 'blue', email_delivered: 'blue', email_failed: 'red', opened: 'blue', interested: 'blue', registered: 'green', onboarded: 'green',
};
