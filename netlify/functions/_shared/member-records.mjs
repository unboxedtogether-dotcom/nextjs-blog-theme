import { SCORING_VERSION } from '../../../utils/progress-checkin.mjs';
import { isUuid } from './progress-store.mjs';

// Read-only views of a member's permanent form history. Every query filters
// by the member id AND runs under RLS, so changing an id in a URL can never
// return another member's record.

export async function loadSubmissionList(query, userId) {
  const submissions = await query(`
    SELECT s.id, COALESCE(s.revision_of, s.id) AS root_id, s.form_type, s.form_version, s.reporting_week_number,
      s.reporting_week_start::text AS week_start, s.entry_date::text AS entry_date, s.status, s.revision_number, s.revision_reason, s.source, s.submitted_at,
      w.overall_score, w.completeness
    FROM member_form_submissions s
    LEFT JOIN member_weekly_scores w ON w.submission_id = s.id AND w.scoring_version = $2
    WHERE s.user_id = $1
    ORDER BY s.submitted_at DESC
  `, [userId, SCORING_VERSION]);
  const messages = await query('SELECT id, topic, status, created_at FROM member_messages WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
  return {
    submissions: submissions.map((row) => ({ ...row, overall_score: row.overall_score === null ? null : Number(row.overall_score) })),
    messages,
  };
}

// One record plus every other version of the same form (original and revisions).
export async function loadSubmissionDetail(query, userId, id) {
  if (!isUuid(id)) return null;
  const [target] = await query('SELECT COALESCE(revision_of, id) AS root_id FROM member_form_submissions WHERE id = $1 AND user_id = $2', [id, userId]);
  if (!target) return null;
  const versions = await query(`
    SELECT s.id, s.form_type, s.form_version, s.reporting_week_number, s.reporting_week_start::text AS week_start, s.entry_date::text AS entry_date, s.answers,
      s.status, s.revision_number, s.revision_reason, s.source, s.submitted_at,
      w.id AS score_id, w.overall_score, w.completeness, w.scoring_version
    FROM member_form_submissions s
    LEFT JOIN member_weekly_scores w ON w.submission_id = s.id AND w.scoring_version = $3
    WHERE s.user_id = $2 AND (s.id = $1 OR s.revision_of = $1)
    ORDER BY s.revision_number
  `, [target.root_id, userId, SCORING_VERSION]);
  const scoreIds = versions.map((row) => row.score_id).filter(Boolean);
  const categories = scoreIds.length
    ? await query('SELECT weekly_score_id, category, score, status FROM member_score_categories WHERE user_id = $1 AND weekly_score_id = ANY($2::uuid[])', [userId, scoreIds])
    : [];
  return {
    selectedId: id,
    versions: versions.map((row) => ({
      ...row,
      overall_score: row.overall_score === null ? null : Number(row.overall_score),
      categories: Object.fromEntries(categories.filter((item) => item.weekly_score_id === row.score_id)
        .map((item) => [item.category, { score: item.score === null ? null : Number(item.score), status: item.status }])),
    })),
  };
}

// Full personal data export (UK GDPR right of access and portability).
export async function loadMemberExport(query, userId) {
  const [profile] = await query(`
    SELECT display_name, bio, membership_tier, is_moderator, membership_status, membership_started_at, marketing_consent,
      marketing_consented_at, marketing_withdrawn_at, created_at
    FROM profiles WHERE id = $1
  `, [userId]);
  const [welcome] = await query('SELECT answers, adult_confirmed_at, completed_at, updated_at FROM member_welcome_details WHERE user_id = $1', [userId]);
  const [health] = await query('SELECT consent_name, consent_given_at, answers, updated_at FROM member_health_information WHERE user_id = $1', [userId]);
  const consentHistory = await query('SELECT consent_type, action, recorded_name, notice_version, recorded_at FROM member_consent_events WHERE user_id = $1 ORDER BY recorded_at', [userId]);
  const submissions = await query(`
    SELECT id, revision_of, form_type, form_version, reporting_week_number, reporting_week_start::text AS reporting_week_start,
      entry_date::text AS entry_date, answers, status, revision_number, revision_reason, source, submitted_at
    FROM member_form_submissions WHERE user_id = $1 ORDER BY submitted_at
  `, [userId]);
  const scores = await query(`
    SELECT w.submission_id, w.reporting_week_number, w.scoring_version, w.overall_score, w.completeness, w.calculated_at,
      COALESCE(jsonb_object_agg(c.category, jsonb_build_object('score', c.score, 'status', c.status)) FILTER (WHERE c.id IS NOT NULL), '{}') AS categories
    FROM member_weekly_scores w LEFT JOIN member_score_categories c ON c.weekly_score_id = w.id
    WHERE w.user_id = $1 GROUP BY w.id ORDER BY w.reporting_week_number
  `, [userId]);
  const notes = await query('SELECT submission_id, body, created_at FROM member_progress_notes WHERE user_id = $1 ORDER BY created_at', [userId]);
  const messages = await query('SELECT topic, message, reply_email, created_at FROM member_messages WHERE user_id = $1 ORDER BY created_at', [userId]);
  return { exportedAt: new Date().toISOString(), profile, welcome: welcome || null, healthInformation: health || null, consentHistory, submissions, scores, notes, messages };
}
