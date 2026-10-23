import { getUser } from '@netlify/identity';
import { ensureProfile, withMemberAccess } from './_shared/member-access.mjs';
import { loadMemberExport, loadSubmissionList } from './_shared/member-records.mjs';
import { loadProgressState } from './_shared/progress-store.mjs';
import { buildProgressReport } from './_shared/progress-report.mjs';
import { buildTimeline } from '../../utils/progress-timeline.mjs';

const privateHeaders = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'X-Content-Type-Options': 'nosniff' };

// Downloads of the signed-in member's own records: a PDF progress report or a
// complete machine-readable copy of their data.
export default async function memberExport(request) {
  if (request.method !== 'GET') return Response.json({ error: 'Method not allowed.' }, { status: 405 });
  const user = await getUser();
  if (!user) return Response.json({ error: 'Please log in to continue.' }, { status: 401 });
  await ensureProfile(user);
  const format = new URL(request.url).searchParams.get('format');
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === 'json') {
    const data = await withMemberAccess(user.id, (query) => loadMemberExport(query, user.id));
    return new Response(JSON.stringify(data, null, 2), {
      headers: { ...privateHeaders, 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="unboxed-together-my-data-${stamp}.json"` },
    });
  }
  if (format !== 'pdf') return Response.json({ error: 'Choose pdf or json.' }, { status: 422 });

  const { state, list, name } = await withMemberAccess(user.id, async (query) => {
    const [profile] = await query('SELECT display_name FROM profiles WHERE id = $1', [user.id]);
    return { state: await loadProgressState(query, user.id), list: await loadSubmissionList(query, user.id), name: profile?.display_name || 'Member' };
  });
  const pdf = await buildProgressReport({ memberName: name, audience: 'member', timeline: buildTimeline(state.entries, state.currentWeek.number), submissions: list.submissions });
  return new Response(pdf, {
    headers: { ...privateHeaders, 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="unboxed-together-progress-${stamp}.pdf"` },
  });
}

export const config = { path: '/api/forms/export' };
