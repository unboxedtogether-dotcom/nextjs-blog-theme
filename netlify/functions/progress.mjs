import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { ensureProfile, withMemberAccess } from './_shared/member-access.mjs';
import {
  ProgressError, addMemberNote, eraseProgressRecords, giveProgressConsent, loadProgressState, saveCheckin, saveDraft,
} from './_shared/progress-store.mjs';

const noStore = { 'Cache-Control': 'no-store' };

// Baseline, weekly check-ins and progress for the signed-in member only. The
// member id always comes from the verified Identity session, never the request.
export default async function progress(request) {
  const user = await getUser();
  if (!user) return Response.json({ error: 'Please log in to continue.' }, { status: 401 });
  await ensureProfile(user);

  if (request.method === 'GET') {
    return Response.json(await withMemberAccess(user.id, (query) => loadProgressState(query, user.id)), { headers: noStore });
  }
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed.' }, { status: 405 });
  verifyRequestOrigin(request);
  const body = await request.json().catch(() => ({}));

  try {
    if (body.action === 'withdraw') {
      if (body.confirmation !== 'DELETE MY PROGRESS') throw new ProgressError(422, 'Type DELETE MY PROGRESS to confirm.');
      await eraseProgressRecords(user.id);
      return Response.json({ ok: true, state: await withMemberAccess(user.id, (query) => loadProgressState(query, user.id)) }, { headers: noStore });
    }

    const result = await withMemberAccess(user.id, async (query) => {
      if (body.action === 'consent') {
        if (body.consent !== true) throw new ProgressError(422, 'Please tick the consent box to start progress tracking.');
        await giveProgressConsent(query, user.id);
      } else if (body.action === 'draft') {
        await saveDraft(query, user.id, body.formType, body.answers);
        return { ok: true, draftSavedAt: new Date().toISOString() };
      } else if (body.action === 'submit') {
        const saved = await saveCheckin(query, user.id, body);
        return { ok: true, submissionId: saved.submissionId, duplicate: saved.duplicate, state: await loadProgressState(query, user.id) };
      } else if (body.action === 'note') {
        await addMemberNote(query, user.id, body.submissionId, body.body);
      } else {
        throw new ProgressError(422, 'Unknown action.');
      }
      return { ok: true, state: await loadProgressState(query, user.id) };
    });
    return Response.json(result, { headers: noStore });
  } catch (error) {
    if (error instanceof ProgressError) return Response.json({ error: error.message, ...error.extra }, { status: error.status });
    // A concurrent duplicate (for example two tabs submitting the same week).
    if (error.code === '23505') return Response.json({ error: 'This check-in has already been saved. Reload the page to see it.' }, { status: 409 });
    throw error;
  }
}

export const config = { path: '/api/progress' };
