import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import SEO from '../../components/SEO';
import ProgressPage from '../../components/progress/ProgressPage';
import CheckInForm from '../../components/progress/CheckInForm';
import { sampleProgressState } from '../../utils/progress-sample.mjs';

// Sample-data preview of MY PROGRESS and the weekly check-in for reviewing the
// design on deploy previews without signing in. Never loads real member data
// and is not built into production deploys. Saving asks you to log in.
const previewContexts = ['deploy-preview', 'branch-deploy', 'dev'];

export function getStaticProps() {
  if (!previewContexts.includes(process.env.CONTEXT)) return { notFound: true };
  return { props: {} };
}

export default function ProgressPreview() {
  const { query } = useRouter();
  const checkIn = query.view === 'checkin';
  const notice = (
    <div className="preview-banner" role="note">
      <strong>Design preview with demonstration values.</strong> These scores are not a real member’s, and saving asks you to log in. This page only exists on deploy previews.{' '}
      {checkIn ? <Link href="/members/progress-preview">Preview My progress</Link> : <Link href="/members/progress-preview?view=checkin">Preview the weekly check-in</Link>} · <Link href="/members/preview">Dashboard preview</Link>
    </div>
  );
  if (!checkIn) return <ProgressPage initial={sampleProgressState} preview notice={notice} />;
  return (
    <Layout>
      <SEO title="Check-in preview | Unboxed Together" description="Sample preview of the weekly check-in." path="/members/progress-preview" />
      <Head><meta name="robots" content="noindex, nofollow" /></Head>
      {notice}
      <div className="member-page checkin-page">
        <section className="onboarding-card wq-card checkin-card">
          <p className="wq-tagline">Week 6 check-in</p>
          <CheckInForm formType="weekly_checkin" onSaved={() => {}} />
        </section>
      </div>
    </Layout>
  );
}
