import { createHash, randomBytes } from 'node:crypto';
import { getDatabase } from '@netlify/database';
import {
  ONE_TO_ONE, PROSPECT_CONSENT_VERSION, PROSPECT_QUESTIONNAIRE_VERSION, PROSPECT_RETENTION_MONTHS, consentTexts, projectSegments,
} from '../../../utils/prospect-questionnaire.mjs';

const db = getDatabase();
const query = async (text, params = []) => (await db.pool.query(text, params)).rows;

// Prospect records are only reached through these server-side helpers, which
// run as the table owner after the calling function has checked who is asking.

export const isUuid = (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const hashValue = (value) => createHash('sha256').update(String(value)).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');

// The current state of each permission: granted and not withdrawn.
const activeFilter = 'granted AND withdrawn_at IS NULL';

export async function emailSuppressed(email) {
  if (!email) return false;
  const rows = await query('SELECT 1 FROM prospect_email_suppressions WHERE email_hash = $1', [hashValue(email)]);
  return rows.length > 0;
}

// Returns { status, prospectId, manageToken, duplicate }.
export async function saveProspect(values, { idempotencyKey, submitterHash }) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const [existing] = (await client.query('SELECT id FROM prospect_submissions WHERE idempotency_key = $1', [idempotencyKey])).rows;
    if (existing) {
      await client.query('ROLLBACK');
      return { prospectId: existing.id, duplicate: true };
    }

    // The same person pressing submit again from a fresh page within ten minutes.
    if (values.email) {
      const [recent] = (await client.query(`
        SELECT id FROM prospect_submissions
        WHERE email = $1 AND submitted_at > NOW() - INTERVAL '10 minutes'
          AND topics = $2 AND project_interests = $3 AND involvement = $4
        LIMIT 1
      `, [values.email, values.topics, values.projects, values.involvement])).rows;
      if (recent) {
        await client.query('ROLLBACK');
        return { prospectId: recent.id, duplicate: true };
      }
    }

    const wantsContact = values.permissions.project_contact || values.permissions.general_marketing;
    const manageToken = values.email ? newToken() : null;
    const supportStatus = values.involvement.includes(ONE_TO_ONE) && values.permissions.project_contact ? 'new' : 'none';
    const [saved] = (await client.query(`
      INSERT INTO prospect_submissions
        (idempotency_key, first_name, email, topics, support_interests, project_interests, involvement,
         questionnaire_version, consent_version, source_campaign, manage_token_hash, support_status, retain_until)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW() + make_interval(months => $13))
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id
    `, [
      idempotencyKey, values.firstName, values.email, values.topics, values.challenges, values.projects, values.involvement,
      PROSPECT_QUESTIONNAIRE_VERSION, PROSPECT_CONSENT_VERSION, values.sourceCampaign, manageToken ? hashValue(manageToken) : null,
      supportStatus, PROSPECT_RETENTION_MONTHS,
    ])).rows;
    if (!saved) {
      // Another request with the same key won the race.
      await client.query('ROLLBACK');
      const [winner] = await query('SELECT id FROM prospect_submissions WHERE idempotency_key = $1', [idempotencyKey]);
      return { prospectId: winner?.id, duplicate: true };
    }

    for (const type of Object.keys(consentTexts)) {
      if (!values.permissions[type]) continue;
      await client.query(`
        INSERT INTO prospect_contact_permissions (prospect_id, permission_type, granted, consent_text_version, consent_text, source)
        VALUES ($1, $2, TRUE, $3, $4, 'questionnaire')
      `, [saved.id, type, PROSPECT_CONSENT_VERSION, consentTexts[type]]);
    }
    await client.query('INSERT INTO prospect_submission_attempts (submitter_hash) VALUES ($1)', [submitterHash]);
    await client.query('COMMIT');
    return { prospectId: saved.id, manageToken, duplicate: false, wantsContact };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function recentAttempts(submitterHash, email) {
  const [counts] = await query(`
    SELECT
      (SELECT count(*)::int FROM prospect_submission_attempts WHERE submitter_hash = $1 AND attempted_at > NOW() - INTERVAL '1 hour') AS per_hour,
      (SELECT count(*)::int FROM prospect_submission_attempts WHERE submitter_hash = $1 AND attempted_at > NOW() - INTERVAL '1 day') AS per_day,
      (SELECT count(*)::int FROM prospect_submissions WHERE $2::text IS NOT NULL AND email = $2 AND submitted_at > NOW() - INTERVAL '1 day') AS per_email
  `, [submitterHash, email]);
  return counts;
}

async function permissionState(prospectIds) {
  if (!prospectIds.length) return {};
  const rows = await query(`
    SELECT prospect_id, permission_type, bool_or(${activeFilter}) AS active,
      bool_or(${activeFilter} AND verified_at IS NOT NULL) AS verified
    FROM prospect_contact_permissions WHERE prospect_id = ANY($1::uuid[])
    GROUP BY prospect_id, permission_type
  `, [prospectIds]);
  const state = {};
  for (const row of rows) {
    state[row.prospect_id] ||= {};
    state[row.prospect_id][row.permission_type] = row.permission_type === 'general_marketing'
      ? (row.verified ? 'verified' : row.active ? 'pending' : false)
      : row.active;
  }
  return state;
}

// ---------- Preferences link (no login; the private token proves ownership) ----------

export async function findByManageToken(token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
  const [row] = await query('SELECT id, first_name, submitted_at FROM prospect_submissions WHERE manage_token_hash = $1', [hashValue(token)]);
  if (!row) return null;
  const permissions = (await permissionState([row.id]))[row.id] || {};
  return {
    id: row.id,
    firstName: row.first_name,
    submittedAt: row.submitted_at,
    permissions: {
      project_contact: permissions.project_contact === true,
      general_marketing: permissions.general_marketing || false,
      sensitive_answers: permissions.sensitive_answers === true,
    },
  };
}

export async function withdrawPermission(prospectId, type, withdrawnBy) {
  await query(`
    UPDATE prospect_contact_permissions SET withdrawn_at = NOW(), withdrawn_by = $3
    WHERE prospect_id = $1 AND permission_type = $2 AND ${activeFilter}
  `, [prospectId, type, withdrawnBy]);
  // Withdrawing consent for personal answers deletes them.
  if (type === 'sensitive_answers') await query("UPDATE prospect_submissions SET support_interests = '{}' WHERE id = $1", [prospectId]);
  if (type === 'project_contact') await query("UPDATE prospect_submissions SET support_status = CASE WHEN support_status = 'new' THEN 'closed' ELSE support_status END WHERE id = $1", [prospectId]);
}

export async function confirmMarketing(prospectId) {
  const rows = await query(`
    UPDATE prospect_contact_permissions SET verified_at = NOW()
    WHERE prospect_id = $1 AND permission_type = 'general_marketing' AND ${activeFilter} AND verified_at IS NULL
    RETURNING id
  `, [prospectId]);
  return rows.length > 0;
}

export async function grantMarketing(prospectId) {
  const [current] = await query(`SELECT 1 FROM prospect_contact_permissions WHERE prospect_id = $1 AND permission_type = 'general_marketing' AND ${activeFilter}`, [prospectId]);
  if (current) return;
  // Opened from the private link sent to this address, so it is already verified.
  await query(`
    INSERT INTO prospect_contact_permissions (prospect_id, permission_type, granted, consent_text_version, consent_text, source, verified_at)
    VALUES ($1, 'general_marketing', TRUE, $2, $3, 'preferences_link', NOW())
  `, [prospectId, PROSPECT_CONSENT_VERSION, consentTexts.general_marketing]);
  const [row] = await query('SELECT email FROM prospect_submissions WHERE id = $1', [prospectId]);
  if (row?.email) await query("DELETE FROM prospect_email_suppressions WHERE email_hash = $1 AND reason = 'unsubscribed'", [hashValue(row.email)]);
}

export async function suppressEmail(prospectId, reason) {
  const [row] = await query('SELECT email FROM prospect_submissions WHERE id = $1', [prospectId]);
  if (!row?.email) return;
  await query(`
    INSERT INTO prospect_email_suppressions (email_hash, reason) VALUES ($1, $2)
    ON CONFLICT (email_hash) DO UPDATE SET reason = CASE WHEN EXCLUDED.reason = 'erased' THEN 'erased' ELSE prospect_email_suppressions.reason END
  `, [hashValue(row.email), reason]);
}

// Erasure: the record, its answers and consent rows are deleted. Only a hash
// of the address is kept so it is not contacted again.
export async function eraseProspect(prospectId) {
  await suppressEmail(prospectId, 'erased');
  const rows = await query('DELETE FROM prospect_submissions WHERE id = $1 RETURNING id', [prospectId]);
  return rows.length > 0;
}

// ---------- Members ----------

// A member may only see and link records that carry their own verified account
// email. The email on a prospect record was never verified, so linking always
// needs the signed-in member to confirm it.
export async function prospectsForMember(user) {
  const email = (user.email || '').trim().toLowerCase();
  const linked = await query('SELECT id, submitted_at, linked_at FROM prospect_submissions WHERE linked_member_user_id = $1 ORDER BY submitted_at DESC', [user.id]);
  const available = email && user.confirmedAt
    ? await query('SELECT id, submitted_at FROM prospect_submissions WHERE email = $1 AND linked_member_user_id IS NULL ORDER BY submitted_at DESC', [email])
    : [];
  return { linked, available };
}

export async function linkProspect(user, prospectId) {
  const email = (user.email || '').trim().toLowerCase();
  if (!email || !user.confirmedAt || !isUuid(prospectId)) return false;
  const rows = await query(`
    UPDATE prospect_submissions SET linked_member_user_id = $1, linked_at = NOW()
    WHERE id = $2 AND email = $3 AND linked_member_user_id IS NULL
      AND EXISTS (SELECT 1 FROM profiles WHERE id = $1)
    RETURNING id
  `, [user.id, prospectId, email]);
  return rows.length > 0;
}

export async function unlinkProspect(user, prospectId) {
  if (!isUuid(prospectId)) return false;
  const rows = await query('UPDATE prospect_submissions SET linked_member_user_id = NULL, linked_at = NULL WHERE id = $1 AND linked_member_user_id = $2 RETURNING id', [prospectId, user.id]);
  return rows.length > 0;
}

// ---------- Admin (callers must have passed authoriseAdmin first) ----------

const segmentWhere = (segment, params) => {
  const config = projectSegments[segment];
  if (!config) return null;
  params.push(config.project);
  let clause = `$${params.length} = ANY(s.project_interests)`;
  if (config.involvement) {
    params.push(config.involvement);
    clause = `(${clause} OR $${params.length} = ANY(s.involvement))`;
  }
  return clause;
};

const activeExists = (type) => `EXISTS (SELECT 1 FROM prospect_contact_permissions p WHERE p.prospect_id = s.id AND p.permission_type = '${type}' AND p.granted AND p.withdrawn_at IS NULL${type === 'general_marketing' ? ' AND p.verified_at IS NOT NULL' : ''})`;

export async function prospectSummary() {
  const params = [];
  const segmentCounts = Object.keys(projectSegments).map((key) => `count(*) FILTER (WHERE ${segmentWhere(key, params)})::int AS "${key}"`).join(',\n      ');
  const [row] = await query(`
    SELECT count(*)::int AS total,
      ${segmentCounts},
      count(*) FILTER (WHERE ${activeExists('general_marketing')})::int AS marketing_verified,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM prospect_contact_permissions p WHERE p.prospect_id = s.id AND p.permission_type = 'general_marketing' AND p.granted AND p.withdrawn_at IS NULL AND p.verified_at IS NULL))::int AS marketing_pending,
      count(*) FILTER (WHERE ${activeExists('project_contact')})::int AS project_contact,
      count(*) FILTER (WHERE s.support_status = 'new')::int AS support_new,
      count(*) FILTER (WHERE s.linked_member_user_id IS NOT NULL)::int AS registered
    FROM prospect_submissions s
  `, params);
  return row;
}

// Lists only what an admin needs to scan: first name, date, choices and
// permission state. Email addresses and personal challenges stay on the
// detail view, which is logged.
export async function listProspects({ search = '', segment = '', permission = '', registered = '', support = '' } = {}) {
  const params = [];
  const where = [];
  const term = String(search).trim().slice(0, 100);
  if (term) {
    params.push(`%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`);
    where.push(`(s.first_name ILIKE $${params.length} OR s.email ILIKE $${params.length})`);
  }
  const segmentClause = segment ? segmentWhere(segment, params) : null;
  if (segmentClause) where.push(segmentClause);
  if (['project_contact', 'general_marketing'].includes(permission)) where.push(activeExists(permission));
  if (permission === 'none') where.push(`NOT ${activeExists('project_contact')} AND NOT ${activeExists('general_marketing')}`);
  if (registered === 'yes') where.push('s.linked_member_user_id IS NOT NULL');
  if (registered === 'no') where.push('s.linked_member_user_id IS NULL');
  if (['new', 'contacted', 'closed'].includes(support)) {
    params.push(support);
    where.push(`s.support_status = $${params.length}`);
  }
  const rows = await query(`
    SELECT s.id, s.first_name, s.topics, s.project_interests, s.involvement, s.source_campaign, s.submitted_at,
      s.support_status, s.linked_member_user_id IS NOT NULL AS registered, (s.email IS NOT NULL) AS has_email
    FROM prospect_submissions s
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY s.submitted_at DESC LIMIT 500
  `, params);
  const permissions = await permissionState(rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, permissions: permissions[row.id] || {} }));
}

export async function prospectDetail(prospectId) {
  if (!isUuid(prospectId)) return null;
  const [row] = await query(`
    SELECT s.id, s.first_name, s.email, s.topics, s.support_interests, s.project_interests, s.involvement, s.source_campaign,
      s.questionnaire_version, s.consent_version, s.submitted_at, s.retain_until, s.support_status, s.linked_at,
      p.display_name AS member_name
    FROM prospect_submissions s LEFT JOIN profiles p ON p.id = s.linked_member_user_id
    WHERE s.id = $1
  `, [prospectId]);
  if (!row) return null;
  const consentHistory = await query(`
    SELECT permission_type, granted, consent_text_version, source, recorded_at, verified_at, withdrawn_at
    FROM prospect_contact_permissions WHERE prospect_id = $1 ORDER BY recorded_at
  `, [prospectId]);
  const permissions = (await permissionState([prospectId]))[prospectId] || {};
  // Contact details are only shown where there is permission to use them.
  const mayContact = permissions.project_contact === true || permissions.general_marketing === 'verified';
  return { ...row, email: mayContact ? row.email : null, emailWithheld: Boolean(row.email) && !mayContact, permissions, consentHistory };
}

export async function setSupportStatus(prospectId, status) {
  if (!isUuid(prospectId) || !['new', 'contacted', 'closed'].includes(status)) return false;
  const rows = await query("UPDATE prospect_submissions SET support_status = $2 WHERE id = $1 AND support_status <> 'none' RETURNING id", [prospectId, status]);
  return rows.length > 0;
}

// Contacts eligible for a mailing: general marketing needs verified consent;
// a project segment needs project contact permission and interest in that project.
export async function exportContacts(kind, segment) {
  const params = [];
  let where;
  if (kind === 'marketing') where = activeExists('general_marketing');
  else {
    const clause = segmentWhere(segment, params);
    if (!clause) return null;
    where = `${activeExists('project_contact')} AND ${clause}`;
  }
  const rows = await query(`
    SELECT DISTINCT ON (s.email) s.first_name, s.email, s.submitted_at
    FROM prospect_submissions s
    WHERE s.email IS NOT NULL AND ${where}
      AND NOT EXISTS (SELECT 1 FROM prospect_email_suppressions x WHERE x.email_hash = encode(sha256(convert_to(s.email, 'UTF8')), 'hex'))
    ORDER BY s.email, s.submitted_at DESC
  `, params);
  return rows;
}

// ---------- Retention ----------

export async function runRetention() {
  await query("DELETE FROM prospect_submission_attempts WHERE attempted_at < NOW() - INTERVAL '1 day'");
  // Private links in unsent emails do not wait forever.
  await query("UPDATE email_outbox SET status = 'cancelled', payload = '{}'::jsonb WHERE status IN ('queued', 'failed') AND created_at < NOW() - INTERVAL '14 days'");
  await query("UPDATE email_outbox SET to_email = 'removed@invalid', payload = '{}'::jsonb WHERE status <> 'queued' AND created_at < NOW() - INTERVAL '90 days' AND to_email <> 'removed@invalid'");
  // Unlinked records past their retention date with no active contact permission.
  const expired = await query(`
    DELETE FROM prospect_submissions s
    WHERE s.retain_until < NOW() AND s.linked_member_user_id IS NULL
      AND NOT ${activeExists('project_contact')} AND NOT ${activeExists('general_marketing')}
    RETURNING id
  `);
  return { expired: expired.length };
}
