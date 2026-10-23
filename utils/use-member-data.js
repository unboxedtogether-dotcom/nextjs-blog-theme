import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../components/auth/AuthProvider';

export function useMemberData(endpoint = '/api/member') {
  const router = useRouter();
  const { user, loading: authLoading, updateMember } = useAuth();
  const [state, setState] = useState({ data: null, loading: true, error: '', userId: null });
  const userId = user?.id;

  useEffect(() => {
    if (!router.isReady || authLoading) return undefined;
    if (!userId) {
      router.replace(`/login?next=${encodeURIComponent(router.asPath)}`);
      return undefined;
    }

    const controller = new AbortController();
    fetch(endpoint, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (response.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(router.asPath)}`);
          return;
        }
        if (!response.ok) throw new Error(data.error || 'Your member details could not be loaded.');
        setState({ data, loading: false, error: '', userId });
        // Keeps the header name and photo in step with the freshly loaded profile.
        if (data.profile && 'avatar_updated_at' in data.profile) updateMember({ name: data.profile.display_name, avatarVersion: data.profile.avatar_updated_at });
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ data: null, loading: false, error: error.message, userId });
      });

    return () => controller.abort();
  }, [authLoading, endpoint, router, userId, updateMember]);

  // Details loaded for a previous login are never shown to the account signed in now.
  const current = state.userId === userId ? state : { data: null, loading: true, error: '' };
  return { data: current.data, loading: current.loading, error: current.error, user };
}
