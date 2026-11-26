import { useEffect } from 'react';
import { useRouter } from 'next/router';
import BrandLoader from '../components/BrandLoader';
import { useAuth } from '../components/auth/AuthProvider';
import { hasHadAccount } from '../utils/member-cookie';

// Normally the edge redirect at "/" handles this before the page loads. This
// is a fallback with the same rules: dashboard, login, or create an account.
export default function Landing() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    const target = user ? '/members' : hasHadAccount() ? '/login' : '/signup';
    router.replace({ pathname: target, query: router.query });
  }, [loading, user, router]);

  return <BrandLoader />;
}
