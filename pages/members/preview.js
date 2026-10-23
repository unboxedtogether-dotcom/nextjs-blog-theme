import Head from 'next/head';
import Link from 'next/link';
import SEO from '../../components/SEO';
import Dashboard from '../../components/members/Dashboard';
import { sampleProgressSummary } from '../../utils/progress-sample.mjs';

// Sample-data preview of the member dashboard for reviewing the design on
// deploy previews without signing in. It never loads real member data and is
// not built into production deploys.
const previewContexts = ['deploy-preview', 'branch-deploy', 'dev'];

export function getStaticProps() {
  if (!previewContexts.includes(process.env.CONTEXT)) return { notFound: true };
  return { props: {} };
}

const sample = {
  profile: {
    display_name: 'Sam Example',
    bio: 'Busy parent of two, trying to cook from scratch a little more often and understand what is in our weekly shop.',
    avatar_updated_at: null,
    membership_tier_name: 'Free Member',
    membership_status: 'active',
    membership_started_at: '2026-10-01T09:00:00Z',
    created_at: '2026-10-01T09:00:00Z',
    marketing_consent: false,
  },
  about: { interests: 'Walking, batch cooking and gardening', reasons: ['Understand food labels', 'Learn to cook', 'Meet people'], town: 'Leeds', phone: '' },
  questionnaire: {
    welcomeCompletedAt: '2026-10-01T09:05:00Z',
    healthConsentGivenAt: '2026-10-01T09:10:00Z',
    sectionSavedAt: { 2: '2026-10-01T09:15:00Z', 3: null, 4: null },
  },
  progress: sampleProgressSummary,
  isAdmin: false,
};

const notice = (
  <div className="preview-banner" role="note">
    <strong>Design preview with sample data.</strong> Nothing here is a real member, and buttons that save will ask you to log in. This page only exists on deploy previews. <Link href="/members/progress-preview">Preview My progress</Link> or <Link href="/signup">create a test account</Link> to try the real dashboard.
  </div>
);

export default function MembersPreview() {
  return (
    <Dashboard
      initial={sample}
      email="sam@example.com"
      notice={notice}
      seo={<><SEO title="Dashboard preview | Unboxed Together" description="Sample preview of the member dashboard." path="/members/preview" /><Head><meta name="robots" content="noindex, nofollow" /></Head></>}
    />
  );
}
