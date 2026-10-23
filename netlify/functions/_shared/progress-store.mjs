import { getDatabase } from '@netlify/database';
import { checkInRows } from '../../../utils/welcome-questionnaire.mjs';
import {
  CHECKIN_FORM_VERSION, PROGRESS_NOTICE_VERSION, SCORING_VERSION, cleanCheckinAnswers, scoreCheckin, scoredItems, welcomeFormTypes, welcomePrefill,
} from '../../../utils/progress-checkin.mjs';

const db = getDatabase();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (value) => typeof value === 'string' && uuidPattern.test(value);
export const progressFormTypes = ['baseline_wellbeing', 'weekly_checkin'];
export const WELCOME_FORM_VERSION = 'welcome-v1';
export const revisionReasons = ['I chose the wrong answer', 'I remembered something more accurately', 'Something else'];

export class ProgressError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

// Reporting weeks run Monday to Sunday, UK time.
export async function currentWeek(query) {
  const [row] = await query(`
    SELECT to_char(date_trunc('week', timezone('Europe/London', NOW())), 'YYYY-MM-DD') AS week_start,
      to_char(timezone('Europe/London', NOW()), 'YYYY-MM-DD') AS today
  `);
  return { start: row.week_start, today: row.today };
}

const weeksBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / (7 * 86400000));
const addDays = (date, count) => new Date(Date.parse(`${date}T00:00:00Z`) + count * 86400000).toISOString().slice(0, 10);
// Monday of the reporting week that contains a YYYY-MM-DD date.
export const weekStartOf = (date) => addDays(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
export const isRealDate = (value) => typeof value === 'string' && datePattern.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
// How far back a member can date a new baseline.
export const BASELINE_DATE_LIMIT_DAYS = 365;
const longDate = (date) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// Appends one submission. Retrying with the same idempotency key returns the
// first record instead of creating another.
export async function appendSubmission(query, {
  userId, formType, formVersion, answers, idempotencyKey, status = 'submitted', weekStart = null, weekNumber = null,
  revisionOf = null, revisionNumber = 0, revisionReason = null, entryDate = null,
}) {
  const [existing] = await query('SELECT id, submitted_at FROM member_form_submissions WHERE user_id = $1 AND idempotency_key = $2', [userId, idempotencyKey]);
  if (existing) return { id: existing.id, submittedAt: existing.submitted_at, duplicate: true };
  const [row] = await query(`
    INSERT INTO member_form_submissions (user_id, form_type, form_version, reporting_week_start, reporting_week_number,
      answers, status, revision_of, revision_number, revision_reason, idempotency_key, entry_date)
    VALUES ($1, $2, $3, $4::date, $5, $6::jsonb, $7, $8, $9, $10, $11, $12::date)
    ON CONFLICT (user_id, idempotency_key) DO NOTHING
    RETURNING id, submitted_at
  `, [userId, formType, formVersion, weekStart, weekNumber, JSON.stringify(answers), status, revisionOf, revisionNumber, revisionReason, idempotencyKey, entryDate]);
  if (!row) {
    const [first] = await query('SELECT id, submitted_at FROM member_form_submissions WHERE user_id = $1 AND idempotency_key = $2', [userId, idempotencyKey]);
    return { id: first.id, submittedAt: first.submitted_at, duplicate: true };
  }
  await query(`
    INSERT INTO member_record_events (user_id, actor_user_id, actor_role, action, form_type, resource_id)
    VALUES ($1, $1, 'member', $2, $3, $4)
  `, [userId, revisionOf ? 'revised' : 'submitted', formType, row.id]);
  return { id: row.id, submittedAt: row.submitted_at, duplicate: false };
}

async function latestRevision(query, rootId) {
  const [row] = await query(`
    SELECT id, answers, revision_number FROM member_form_submissions
    WHERE id = $1 OR revision_of = $1 ORDER BY revision_number DESC LIMIT 1
  `, [rootId]);
  return row;
}

// Every save of a welcome page is kept. The first is the original record;
// later saves with changed answers become numbered revisions of it.
export async function appendWelcomeHistory(query, userId, section, answers, idempotencyKey) {
  const formType = welcomeFormTypes[section];
  const key = isUuid(idempotencyKey) ? idempotencyKey : crypto.randomUUID();
  const [root] = await query('SELECT id FROM member_form_submissions WHERE user_id = $1 AND form_type = $2 AND revision_of IS NULL', [userId, formType]);
  if (!root) return appendSubmission(query, { userId, formType, formVersion: WELCOME_FORM_VERSION, answers, idempotencyKey: key });
  const latest = await latestRevision(query, root.id);
  const [same] = await query('SELECT $1::jsonb = $2::jsonb AS same', [JSON.stringify(latest.answers), JSON.stringify(answers)]);
  if (same.same) return { id: latest.id, unchanged: true };
  return appendSubmission(query, {
    userId, formType, formVersion: WELCOME_FORM_VERSION, answers, idempotencyKey: key,
    revisionOf: root.id, revisionNumber: latest.revision_number + 1, revisionReason: 'Updated by the member',
  });
}

export async function progressConsentState(query, userId) {
  const [event] = await query(`
    SELECT action, recorded_at, notice_version FROM member_consent_events
    WHERE user_id = $1 AND consent_type = 'progress_tracking' ORDER BY recorded_at DESC LIMIT 1
  `, [userId]);
  return { given: event?.action === 'given', givenAt: event?.action === 'given' ? event.recorded_at : null, noticeVersion: event?.notice_version || null };
}

export async function giveProgressConsent(query, userId) {
  const consent = await progressConsentState(query, userId);
  if (consent.given) return;
  const [profile] = await query('SELECT display_name FROM profiles WHERE id = $1', [userId]);
  await query(`
    INSERT INTO member_consent_events (user_id, consent_type, action, recorded_name, notice_version)
    VALUES ($1, 'progress_tracking', 'given', $2, $3)
  `, [userId, profile?.display_name || null, PROGRESS_NOTICE_VERSION]);
}

// Loads baseline and weekly check-ins grouped by original submission, with
// the latest revision's answers and scores. Notes visible to the caller are
// attached by RLS (members never receive private admin notes).
export async function loadProgressEntries(query, userId) {
  const rows = await query(`
    SELECT s.id, COALESCE(s.revision_of, s.id) AS root_id, s.form_type, s.reporting_week_number,
      s.reporting_week_start::text AS week_start, s.entry_date::text AS entry_date, s.answers, s.status, s.revision_number, s.revision_reason,
      s.submitted_at, w.id AS score_id, w.overall_score, w.completeness, w.scoring_version
    FROM member_form_submissions s
    LEFT JOIN member_weekly_scores w ON w.submission_id = s.id AND w.scoring_version = $2
    WHERE s.user_id = $1 AND s.form_type IN ('baseline_wellbeing', 'weekly_checkin')
    ORDER BY s.reporting_week_number, s.revision_number
  `, [userId, SCORING_VERSION]);
  const categoryRows = await query('SELECT weekly_score_id, category, score, status FROM member_score_categories WHERE user_id = $1', [userId]);
  const noteRows = await query(`
    SELECT n.id, n.submission_id, n.body, n.author_role, n.visibility, n.created_at, COALESCE(s.revision_of, s.id) AS root_id
    FROM member_progress_notes n LEFT JOIN member_form_submissions s ON s.id = n.submission_id
    WHERE n.user_id = $1 ORDER BY n.created_at
  `, [userId]);

  const categoriesByScore = new Map();
  for (const row of categoryRows) {
    if (!categoriesByScore.has(row.weekly_score_id)) categoriesByScore.set(row.weekly_score_id, {});
    categoriesByScore.get(row.weekly_score_id)[row.category] = { score: row.score === null ? null : Number(row.score), status: row.status };
  }

  const entries = new Map();
  for (const row of rows) {
    const revision = { id: row.id, revisionNumber: row.revision_number, reason: row.revision_reason, submittedAt: row.submitted_at, overall: row.overall_score === null ? null : Number(row.overall_score) };
    const existing = entries.get(row.root_id);
    const entry = {
      rootId: row.root_id,
      submissionId: row.id,
      formType: row.form_type,
      weekNumber: row.reporting_week_number,
      weekStart: row.week_start,
      entryDate: row.entry_date,
      submittedAt: row.submitted_at,
      originalSubmittedAt: existing?.originalSubmittedAt || row.submitted_at,
      revisionNumber: row.revision_number,
      revisions: [...(existing?.revisions || []), revision],
      answers: row.answers,
      overall: row.overall_score === null ? null : Number(row.overall_score),
      completeness: row.completeness || 'incomplete',
      scoringVersion: row.scoring_version,
      categories: categoriesByScore.get(row.score_id) || {},
      notes: [],
    };
    entries.set(row.root_id, entry);
  }
  const generalNotes = [];
  for (const note of noteRows) {
    const item = { id: note.id, body: note.body, authorRole: note.author_role, visibility: note.visibility, createdAt: note.created_at };
    const entry = note.root_id && entries.get(note.root_id);
    if (entry) entry.notes.push(item); else generalNotes.push(item);
  }
  return { entries: [...entries.values()], generalNotes };
}

export async function loadDrafts(query, userId, weekStart) {
  const rows = await query('SELECT form_type, reporting_week_start::text AS week_start, answers, updated_at FROM member_form_drafts WHERE user_id = $1', [userId]);
  return Object.fromEntries(rows
    .filter((row) => row.form_type === 'baseline_wellbeing' || row.week_start === weekStart)
    .map((row) => [row.form_type, { answers: row.answers, updatedAt: row.updated_at }]));
}

// Everything the member progress and check-in pages need, in one read.
export async function loadProgressState(query, userId) {
  const consent = await progressConsentState(query, userId);
  const week = await currentWeek(query);
  const [baseline] = await query('SELECT baseline_date::text AS baseline_date, reporting_week_start::text AS week_start FROM member_baselines WHERE user_id = $1', [userId]);
  const { entries, generalNotes } = await loadProgressEntries(query, userId);
  const currentWeekNumber = baseline ? weeksBetween(baseline.week_start, week.start) : null;
  const thisWeek = entries.find((entry) => entry.formType === 'weekly_checkin' && entry.weekStart === week.start) || null;
  const baselineEntry = entries.find((entry) => entry.formType === 'baseline_wellbeing') || null;
  const [health] = await query('SELECT answers, section_3_saved_at FROM member_health_information WHERE user_id = $1', [userId]);
  const welcomeAnswers = health?.answers || {};
  const welcomeStartingPoint = welcomeStartingPointFrom(welcomeAnswers, health?.section_3_saved_at);

  // Earlier weeks since the baseline without a check-in, newest first. A
  // member can still add these, dated on a day inside that week.
  const checkedWeeks = new Set(entries.filter((entry) => entry.formType === 'weekly_checkin').map((entry) => entry.weekNumber));
  const missedWeeks = [];
  for (let number = (currentWeekNumber ?? 0) - 1; number >= 1; number -= 1) {
    if (!checkedWeeks.has(number)) missedWeeks.push({ number, start: addDays(baseline.week_start, number * 7) });
  }

  let state = 'due';
  if (!baseline) state = consent.given ? 'needs_baseline' : 'needs_consent';
  else if (!consent.given) state = 'needs_consent';
  else if (currentWeekNumber === 0) state = 'waiting';
  else if (thisWeek) state = 'done';

  let prefill = {};
  if (!baseline) {
    const answers = welcomeAnswers;
    prefill = Object.fromEntries(Object.entries(welcomePrefill)
      .filter(([from]) => answers[from] !== null && answers[from] !== undefined && answers[from] !== '')
      .map(([from, to]) => [to, answers[from]]));
    prefill = cleanCheckinAnswers(prefill);
    prefill = Object.fromEntries(Object.entries(prefill).filter(([, value]) => value !== null && value !== '' && !(Array.isArray(value) && !value.length)));
  }

  return {
    consent,
    state,
    currentWeek: { start: week.start, number: currentWeekNumber },
    baseline: baseline ? { date: baseline.baseline_date, weekStart: baseline.week_start } : null,
    nextCheckInOpens: baseline ? addDays(baseline.week_start, 7) : null,
    today: week.today,
    missedWeeks,
    // Dates a member may choose for a new entry (YYYY-MM-DD, inclusive).
    entryDateRange: baseline
      ? { min: addDays(baseline.week_start, 7), max: week.today }
      : { min: addDays(week.today, -BASELINE_DATE_LIMIT_DAYS), max: week.today },
    suggestedBaselineDate: !baseline && welcomeStartingPoint?.date && welcomeStartingPoint.date <= week.today
      && welcomeStartingPoint.date >= addDays(week.today, -BASELINE_DATE_LIMIT_DAYS) ? welcomeStartingPoint.date : null,
    welcomeStartingPoint,
    thisWeekRootId: thisWeek?.rootId || null,
    canCorrectBaseline: Boolean(baselineEntry) && !entries.some((entry) => entry.formType === 'weekly_checkin'),
    baselineRootId: baselineEntry?.rootId || null,
    drafts: consent.given ? await loadDrafts(query, userId, week.start) : {},
    prefill,
    scoringVersion: SCORING_VERSION,
    revisionReasons,
    entries,
    generalNotes,
  };
}

// Page 3 of the welcome questionnaire asks the same 1 to 5 questions as the
// check-in, dated by the member's own "Baseline date". Shown alongside
// progress (never scored or mixed into the weekly chart).
function welcomeStartingPointFrom(answers, savedAt) {
  const scores = checkInRows.map(({ key, label }) => ({ key, label, value: Number.isInteger(answers[key]) ? answers[key] : null }));
  const date = isRealDate(answers.baselineDate) ? answers.baselineDate : null;
  if (!date && !scores.some((row) => row.value !== null)) return null;
  return { date, savedAt: savedAt || null, scores };
}

export async function saveDraft(query, userId, formType, input) {
  if (!progressFormTypes.includes(formType)) throw new ProgressError(422, 'Unknown form.');
  if (!(await progressConsentState(query, userId)).given) throw new ProgressError(403, 'Please give consent for progress tracking first.');
  const week = await currentWeek(query);
  const answers = cleanCheckinAnswers(input);
  await query(`
    INSERT INTO member_form_drafts (user_id, form_type, reporting_week_start, answers, updated_at)
    VALUES ($1, $2, $3::date, $4::jsonb, NOW())
    ON CONFLICT (user_id, form_type) DO UPDATE SET reporting_week_start = EXCLUDED.reporting_week_start, answers = EXCLUDED.answers, updated_at = NOW()
  `, [userId, formType, week.start, JSON.stringify(answers)]);
}

// Saves a baseline or weekly check-in with its scores in the caller's
// transaction, so answers and scores are committed together or not at all.
export async function saveCheckin(query, userId, body) {
  const formType = body.formType;
  if (!progressFormTypes.includes(formType)) throw new ProgressError(422, 'Unknown form.');
  if (!isUuid(body.idempotencyKey)) throw new ProgressError(422, 'This form is missing its submission reference. Please reload the page and try again.');
  if (!(await progressConsentState(query, userId)).given) throw new ProgressError(403, 'Please give consent for progress tracking first.');

  const [duplicate] = await query('SELECT id FROM member_form_submissions WHERE user_id = $1 AND idempotency_key = $2', [userId, body.idempotencyKey]);
  if (duplicate) return { submissionId: duplicate.id, duplicate: true };

  const answers = cleanCheckinAnswers(body.answers);
  if (!scoredItems.some((item) => answers[item.key] !== null)) throw new ProgressError(422, 'Please answer at least one question before saving.');
  const score = scoreCheckin(answers);
  const week = await currentWeek(query);
  const [baseline] = await query('SELECT reporting_week_start::text AS week_start FROM member_baselines WHERE user_id = $1', [userId]);

  if (body.entryDate !== undefined && body.entryDate !== null && body.entryDate !== '' && !isRealDate(body.entryDate)) throw new ProgressError(422, 'Please choose a valid date for this check-in.');
  let entryDate = body.entryDate || week.today;
  if (entryDate > week.today) throw new ProgressError(422, 'The date cannot be in the future.');

  let weekStart = weekStartOf(entryDate);
  let weekNumber = 0;
  let revisionOf = null;
  let revisionNumber = 0;
  let revisionReason = null;

  if (body.revisionOf) {
    const [root] = isUuid(body.revisionOf) ? await query(`
      SELECT id, reporting_week_start::text AS week_start, reporting_week_number, entry_date::text AS entry_date,
        submitted_at > NOW() - INTERVAL '7 days' AS recent
      FROM member_form_submissions
      WHERE id = $1 AND user_id = $2 AND form_type = $3 AND revision_of IS NULL
    `, [body.revisionOf, userId, formType]) : [];
    if (!root) throw new ProgressError(404, 'That check-in could not be found.');
    if (formType === 'weekly_checkin' && !root.recent) throw new ProgressError(409, 'A check-in can only be corrected within 7 days of saving it. Earlier check-ins stay exactly as submitted.');
    if (formType === 'baseline_wellbeing') {
      const [later] = await query("SELECT 1 FROM member_form_submissions WHERE user_id = $1 AND form_type = 'weekly_checkin' LIMIT 1", [userId]);
      if (later) throw new ProgressError(409, 'Your baseline can no longer be corrected because weekly check-ins have been compared with it.');
    }
    if (!revisionReasons.includes(body.revisionReason)) throw new ProgressError(422, 'Please choose why you are correcting this check-in.');
    revisionOf = root.id;
    revisionNumber = (await latestRevision(query, root.id)).revision_number + 1;
    revisionReason = body.revisionReason;
    weekStart = root.week_start;
    weekNumber = root.reporting_week_number;
    // A correction keeps the original's week; its date can move within that week.
    if (!body.entryDate || weekStartOf(entryDate) !== root.week_start) entryDate = root.entry_date || root.week_start;
  } else if (formType === 'baseline_wellbeing') {
    if (baseline) throw new ProgressError(409, 'Your baseline has already been saved. It stays as your Week 0 starting point.');
    if (entryDate < addDays(week.today, -BASELINE_DATE_LIMIT_DAYS)) throw new ProgressError(422, 'Please choose a baseline date within the last 12 months.');
  } else {
    if (!baseline) throw new ProgressError(409, 'Please complete your baseline assessment first.');
    weekNumber = weeksBetween(baseline.week_start, weekStart);
    if (weekNumber < 1) throw new ProgressError(409, `Please choose a date after your baseline week. Weekly check-ins can be dated from ${longDate(addDays(baseline.week_start, 7))}.`);
    const [already] = await query("SELECT id FROM member_form_submissions WHERE user_id = $1 AND form_type = 'weekly_checkin' AND reporting_week_start = $2::date AND revision_of IS NULL", [userId, weekStart]);
    if (already) {
      throw new ProgressError(409, weekStart === week.start
        ? 'You have already completed this week’s check-in.'
        : `You already have a check-in for the week starting ${longDate(weekStart)}. Each week has one check-in so scores stay comparable.`, { submissionId: already.id });
    }
  }

  const saved = await appendSubmission(query, {
    userId, formType, formVersion: CHECKIN_FORM_VERSION, answers, idempotencyKey: body.idempotencyKey,
    status: score.completeness === 'complete' ? 'submitted' : 'incomplete', weekStart, weekNumber, revisionOf, revisionNumber, revisionReason, entryDate,
  });
  if (saved.duplicate) return { submissionId: saved.id, duplicate: true };

  const [scoreRow] = await query(`
    INSERT INTO member_weekly_scores (submission_id, user_id, reporting_week_number, reporting_week_start, scoring_version, overall_score, completeness)
    VALUES ($1, $2, $3, $4::date, $5, $6, $7) RETURNING id
  `, [saved.id, userId, weekNumber, weekStart, score.version, score.overall, score.completeness]);
  for (const category of score.categories) {
    await query(`
      INSERT INTO member_score_categories (weekly_score_id, user_id, category, weight, score, items_answered, items_required, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [scoreRow.id, userId, category.key, category.weight, category.score, category.itemsAnswered, category.itemsRequired, category.status]);
  }
  if (formType === 'baseline_wellbeing' && !revisionOf) {
    await query('INSERT INTO member_baselines (user_id, submission_id, baseline_date, reporting_week_start) VALUES ($1, $2, $3::date, $4::date)', [userId, saved.id, entryDate, weekStart]);
  }
  await query('DELETE FROM member_form_drafts WHERE user_id = $1 AND form_type = $2', [userId, formType]);
  return { submissionId: saved.id, duplicate: false, score };
}

export async function addMemberNote(query, userId, submissionId, body) {
  const text = typeof body === 'string' ? body.trim() : '';
  if (!text || text.length > 2000) throw new ProgressError(422, 'Please write a note of up to 2,000 characters.');
  if (submissionId && !isUuid(submissionId)) throw new ProgressError(404, 'That check-in could not be found.');
  if (submissionId) {
    const [owned] = await query('SELECT 1 FROM member_form_submissions WHERE id = $1 AND user_id = $2', [submissionId, userId]);
    if (!owned) throw new ProgressError(404, 'That check-in could not be found.');
  }
  await query(`
    INSERT INTO member_progress_notes (user_id, author_user_id, author_role, visibility, submission_id, body)
    VALUES ($1, $1, 'member', 'member', $2, $3)
  `, [userId, submissionId || null, text]);
}

// Erasure is the only path that removes history. It runs as the table owner
// (the restricted role has no DELETE on history) and only for the signed-in
// member's own id, after the member has confirmed. A content-free event is
// kept so the erasure itself stays on record.
async function asOwner(userId, work) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    // Lets policies on FORCE RLS tables (consent history) see the member's own rows.
    await client.query("SELECT set_config('app.current_user_id', $1, TRUE), set_config('app.current_access_role', 'member', TRUE)", [userId]);
    const result = await work(async (text, params = []) => (await client.query(text, params)).rows);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export function eraseProgressRecords(userId) {
  return asOwner(userId, async (query) => {
    const removed = await query("DELETE FROM member_form_submissions WHERE user_id = $1 AND form_type IN ('baseline_wellbeing', 'weekly_checkin') RETURNING id", [userId]);
    await query('DELETE FROM member_progress_notes WHERE user_id = $1', [userId]);
    await query('DELETE FROM member_form_drafts WHERE user_id = $1', [userId]);
    const consent = await progressConsentState(query, userId);
    if (consent.given) {
      await query("INSERT INTO member_consent_events (user_id, consent_type, action, notice_version) VALUES ($1, 'progress_tracking', 'withdrawn', $2)", [userId, PROGRESS_NOTICE_VERSION]);
    }
    await query("INSERT INTO member_record_events (user_id, actor_user_id, actor_role, action, form_type) VALUES ($1, $1, 'member', 'erased', 'progress_tracking')", [userId]);
    return removed.length;
  });
}

export function eraseWelcomeHistory(userId, formTypes) {
  return asOwner(userId, async (query) => {
    const removed = await query('DELETE FROM member_form_submissions WHERE user_id = $1 AND form_type = ANY($2::text[]) RETURNING id', [userId, formTypes]);
    if (removed.length) {
      await query("INSERT INTO member_record_events (user_id, actor_user_id, actor_role, action, form_type) VALUES ($1, $1, 'member', 'erased', $2)", [userId, formTypes.join(',')]);
    }
    return removed.length;
  });
}
