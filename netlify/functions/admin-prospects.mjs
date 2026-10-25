import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { permissionTypes, projectSegments } from '../../utils/prospect-questionnaire.mjs';
import { authoriseAdmin, logAdminAccess, notAllowlistedMessage, withMemberAccess } from './_shared/member-access.mjs';
import { emailDeliveryConfigured } from './_shared/email.mjs';
import {
  eraseProspect, exportContacts, isUuid, listProspects, prospectDetail, prospectSummary, setSupportStatus, suppressEmail, withdrawPermission,
} from './_shared/prospect-store.mjs';

const noStore = { 'Cache-Control': 'no-store' };
const log = (user, action, resourceId = null, detail = null) => withMemberAccess(user.id, (query) => logAdminAccess(query, user.id, null, action, 'prospect', resourceId, detail), 'admin');
const csvCell = (value) => {
  const text = String(value ?? '');
  // Neutralises spreadsheet formulas as well as quoting.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

// Prospective members & interest, for allowlisted admins only.
export default async function adminProspects(request) {
  const user = await getUser();
  if (!user) return Response.json({ error: 'Please log in to continue.' }, { status: 401, headers: noStore });
  if (!(user.roles || []).includes('admin')) return Response.json({ error: 'You do not have access to this area.' }, { status: 403, headers: noStore });
  if (!(await authoriseAdmin(user))) return Response.json({ error: notAllowlistedMessage }, { status: 403, headers: noStore });

  const url = new URL(request.url);

  if (request.method === 'GET') {
    const view = url.searchParams.get('view') || 'list';
    if (view === 'detail') {
      const id = url.searchParams.get('id');
      const prospect = await prospectDetail(id);
      if (!prospect) return Response.json({ error: 'That record could not be found.' }, { status: 404, headers: noStore });
      await log(user, 'view_prospect', id);
      return Response.json({ prospect }, { headers: noStore });
    }
    if (view === 'export') {
      const kind = url.searchParams.get('kind') === 'project' ? 'project' : 'marketing';
      const segment = url.searchParams.get('segment') || '';
      if (kind === 'project' && !projectSegments[segment]) return Response.json({ error: 'Choose a project.' }, { status: 422, headers: noStore });
      const rows = await exportContacts(kind, segment);
      await log(user, 'export_prospects', null, `${kind}${segment ? `:${segment}` : ''} (${rows.length})`);
      const csv = ['first_name,email,submitted_at', ...rows.map((row) => [row.first_name, row.email, new Date(row.submitted_at).toISOString()].map(csvCell).join(','))].join('\r\n');
      return new Response(csv, {
        headers: {
          ...noStore,
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="unboxed-${kind === 'marketing' ? 'marketing' : `project-${segment}`}-contacts.csv"`,
        },
      });
    }
    const filters = Object.fromEntries(['search', 'segment', 'permission', 'registered', 'support'].map((key) => [key, url.searchParams.get(key) || '']));
    const [summary, prospects] = await Promise.all([prospectSummary(), listProspects(filters)]);
    await log(user, 'list_prospects', null, filters.search ? 'search' : null);
    return Response.json({ summary, prospects, emailDelivery: emailDeliveryConfigured() }, { headers: noStore });
  }

  if (!['PATCH', 'DELETE'].includes(request.method)) return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: noStore });
  try {
    verifyRequestOrigin(request);
  } catch {
    return Response.json({ error: 'This request could not be accepted.' }, { status: 403, headers: noStore });
  }
  const body = await request.json().catch(() => ({}));
  if (!isUuid(body.id)) return Response.json({ error: 'Choose a record.' }, { status: 422, headers: noStore });

  if (request.method === 'DELETE') {
    if (body.confirmation !== 'DELETE') return Response.json({ error: 'Type DELETE to confirm.' }, { status: 422, headers: noStore });
    const erased = await eraseProspect(body.id);
    if (!erased) return Response.json({ error: 'That record could not be found.' }, { status: 404, headers: noStore });
    await log(user, 'erase_prospect', body.id);
    return Response.json({ ok: true }, { headers: noStore });
  }

  if (body.action === 'support_status') {
    if (!(await setSupportStatus(body.id, body.status))) return Response.json({ error: 'That support request could not be updated.' }, { status: 422, headers: noStore });
    await log(user, 'prospect_support_status', body.id, body.status);
  } else if (body.action === 'withdraw') {
    if (!permissionTypes.includes(body.type)) return Response.json({ error: 'Choose a permission.' }, { status: 422, headers: noStore });
    await withdrawPermission(body.id, body.type, `admin:${user.id}`);
    if (body.type === 'general_marketing') await suppressEmail(body.id, 'unsubscribed');
    await log(user, 'prospect_withdraw_permission', body.id, body.type);
  } else {
    return Response.json({ error: 'Unknown action.' }, { status: 422, headers: noStore });
  }
  const prospect = await prospectDetail(body.id);
  return Response.json({ prospect }, { headers: noStore });
}

export const config = { path: '/api/admin/prospects' };
