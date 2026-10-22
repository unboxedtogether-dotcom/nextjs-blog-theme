import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import SEO from '../../components/SEO';
import Dashboard from '../../components/members/Dashboard';
import { useMemberData } from '../../utils/use-member-data';

const seo = <SEO title="My dashboard | Unboxed Together" description="Your private Unboxed Together member dashboard." path="/members" />;

export default function Members() {
  const router = useRouter();
  const { data, user, loading, error } = useMemberData();
  const welcomeDone = Boolean(data?.questionnaire?.welcomeCompletedAt);

  useEffect(() => {
    if (!loading && data?.profile && !welcomeDone) router.replace('/onboarding');
  }, [data, loading, router, welcomeDone]);

  if (error || loading || !data?.profile || !welcomeDone) {
    return <Layout>{seo}<div className="member-page">{error ? <p className="onboarding-error" role="alert">{error}</p> : <p className="auth-loading">Loading your member space…</p>}</div></Layout>;
  }

  return <Dashboard initial={data} email={user?.email || ''} seo={seo} />;
}
