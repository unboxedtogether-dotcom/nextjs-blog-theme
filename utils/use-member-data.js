import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../components/auth/AuthProvider';

export function useMemberData() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState({ data: null, loading: true, error: '' });

  useEffect(() => {
    if (!router.isReady || authLoading) return undefined;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(router.asPath)}`);
      return undefined;
    }

    const controller = new AbortController();
    fetch('/api/member', { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (response.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(router.asPath)}`);
          return;
        }
        if (!response.ok) throw new Error(data.error || 'Your member details could not be loaded.');
        setState({ data, loading: false, error: '' });
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ data: null, loading: false, error: error.message });
      });

    return () => controller.abort();
  }, [authLoading, router, user]);

  return { ...state, user };
}
