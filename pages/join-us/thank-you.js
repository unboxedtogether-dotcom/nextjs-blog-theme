import { useMemo, useSyncExternalStore } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import SEO from '../../components/SEO';
import { BrandImage } from '../../components/BrandLogo';
import { useAuth } from '../../components/auth/AuthProvider';
import { joinResultKey } from '../../utils/prospect-questionnaire.mjs';

const subscribe = () => () => {};
const readSaved = () => {
  try { return window.sessionStorage.getItem(joinResultKey); } catch { return null; }
};

// Shows only which confirmations apply, read from this browser tab. No answers
// are ever loaded here, so the page is safe to share or revisit.
export default function JoinThankYou() {
  const { user } = useAuth();
  const router = useRouter();
  // Keeps a member's invitation with the visitor, so signing up credits them.
  const ref = typeof router.query.ref === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(router.query.ref) ? router.query.ref : '';
  const saved = useSyncExternalStore(subscribe, readSaved, () => null);
  const result = useMemo(() => {
    try {
      const parsed = JSON.parse(saved || 'null');
      return parsed ? { contactRequested: parsed.contactRequested === true, marketingPending: parsed.marketingPending === true } : null;
    } catch {
      return null;
    }
  }, [saved]);

  return (
    <Layout>
      <SEO title="Thank you | Unboxed Together" description="Welcome to the beginning of Unboxed Together." path="/join-us/thank-you" />
      <Head><meta name="robots" content="noindex" /></Head>
      <section className="join-hero join-thanks" aria-labelledby="thanks-title">
        <div className="site-container join-thanks__inner">
          <BrandImage variant="symbol" className="join-thanks__mark" alt="" sizes="120px" />
          <p className="ut-kicker">Thank you</p>
          <h1 id="thanks-title">Welcome to the beginning of Unboxed Together</h1>
          <p className="ut-lead">Thank you for taking the time to tell us a little about yourself.</p>
          <p>Your answers help us understand what people are interested in and what support could make a difference.</p>
          <p><strong>We&apos;re building Unboxed Together with people, not just for them.</strong></p>

          {result && (result.contactRequested || result.marketingPending) && (
            <ul className="join-thanks__confirmations">
              {result.contactRequested && <li>Your interest has been recorded. We&apos;ll get in touch about the projects or support you selected when there&apos;s something to share. We can&apos;t promise launch dates yet.</li>}
              {result.marketingPending && <li>You asked for general news. We&apos;ll email you to confirm your address first. Your subscription only starts once you confirm it.</li>}
            </ul>
          )}

          <h2 className="join-thanks__next">Next steps</h2>
          <div className="button-row">
            {user
              ? <Link href="/members" className="ut-btn ut-btn--primary">Go to my dashboard</Link>
              : <Link href={ref ? `/signup?ref=${encodeURIComponent(ref)}` : '/signup'} className="ut-btn ut-btn--primary">Join the free community</Link>}
            <Link href="/" className="ut-btn ut-btn--secondary">Explore the website</Link>
          </div>
          {!user && <p className="join-note">Membership is free and optional. We haven&apos;t created an account for you.</p>}
        </div>
      </section>
    </Layout>
  );
}
