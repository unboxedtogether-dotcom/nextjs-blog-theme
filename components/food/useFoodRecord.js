import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../auth/AuthProvider';

// Loads one Food Database record. Signed-in members get the full record;
// everyone else gets the card summary, as the database has always worked.
export function useFoodRecord(type) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const slug = typeof router.query.slug === 'string' ? router.query.slug : '';
  const requestKey = `${type}|${slug}|${user?.id || ''}`;
  const [response, setResponse] = useState({ key: '', status: 'loading', data: null, error: '' });

  useEffect(() => {
    if (!router.isReady || authLoading || !slug) return undefined;
    let cancelled = false;
    fetch(`/api/food/record?type=${type}&slug=${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then(async (result) => {
        const data = await result.json().catch(() => ({}));
        if (result.status === 404) throw Object.assign(new Error(data.error), { notFound: true });
        if (!result.ok) throw new Error(data.error || 'The food database is temporarily unavailable.');
        if (!cancelled) setResponse({ key: requestKey, status: 'ready', data, error: '' });
      })
      .catch((error) => { if (!cancelled) setResponse({ key: requestKey, status: error.notFound ? 'missing' : 'error', data: null, error: error.message }); });
    return () => { cancelled = true; };
  }, [router.isReady, authLoading, slug, type, requestKey]);

  const state = response.key === requestKey ? response : { status: 'loading', data: null, error: '' };
  return { ...state, slug, path: router.asPath.split('#')[0] };
}
