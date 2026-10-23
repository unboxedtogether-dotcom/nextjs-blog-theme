import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../components/auth/AuthProvider';

export function useMemberData(endpoint = '/api/member') {
  const router = useRouter();
  const { user, loading: authLoading, updateMember } = useAuth();
  const [state, setState] = useState({ data: null, loading: true, error: '' });

  useEffect(() => {
    if (!router.isReady || authLoading) return undefined;
    if (!user) {
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
        setState({ data, loading: false, error: '' });
        // Keeps the header name and photo in step with the freshly loaded profile.
        if (data.profile && 'avatar_updated_at' in data.profile) updateMember({ name: data.profile.display_name, avatarVersion: data.profile.avatar_updated_at });
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ data: null, loading: false, error: error.message });
      });

    return () => controller.abort();
  }, [authLoading, endpoint, router, user, updateMember]);

  return { ...state, user };
}
