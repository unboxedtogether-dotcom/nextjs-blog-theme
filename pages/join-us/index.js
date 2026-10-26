import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import SEO from '../../components/SEO';
import { BrandImage } from '../../components/BrandLogo';
import { useAuth } from '../../components/auth/AuthProvider';
import { siteConfig } from '../../utils/site-config';
import { joinSourceKey } from '../../utils/prospect-questionnaire.mjs';

const coming = [
  {
    status: 'Coming soon',
    title: '30-Day Barcode Challenge',
    text: 'A practical challenge exploring food choices, understanding ingredients and discovering what works for you.',
    icon: <path d="M4 5v14M7 5v14M10 5v14M14 5v14M17 5v14M20 5v14" />,
  },
  {
    status: 'Coming soon',
    title: 'Food & Ingredient Database',
    text: 'A searchable resource to make information about food ingredients and additives easier to understand.',
    icon: <path d="M4 7h16M4 12h16M4 17h10M18 15l2 2-2 2" />,
  },
  {
    status: 'In development',
    title: 'Unboxed Together App',
    text: 'Tools designed to help people explore their food choices, record daily habits and identify personal patterns involving food, mood, sleep and wellbeing.',
    icon: <path d="M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM11 18h2" />,
  },
  {
    status: 'Growing',
    title: 'Community & Support',
    text: 'A community built around shared experiences, discussions, local activities, walks and practical support.',
    icon: <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20a6 6 0 0 1 12 0M12 20a6 6 0 0 1 10 0" />,
  },
];

export default function JoinUs() {
  const router = useRouter();
  const { user: signedInUser } = useAuth();
  // ?preview=friend shows a signed-in member the page exactly as an invited
  // friend sees it (from the Refer a friend page).
  const previewing = Boolean(signedInUser) && router.query.preview === 'friend';
  const user = previewing ? null : signedInUser;

  // Campaign label from the invitation link (for example ?source=invite-oct26).
  // Only this short label is kept; nothing personal goes in the URL.
  useEffect(() => {
    if (!router.isReady || router.query.preview === 'friend') return;
    const source = router.query.source || router.query.utm_campaign;
    if (typeof source === 'string' && source) {
      try { window.sessionStorage.setItem(joinSourceKey, source.slice(0, 60)); } catch { /* storage unavailable */ }
    }
  }, [router.isReady, router.query.preview, router.query.source, router.query.utm_campaign]);

  // A member's invitation link (?ref=...). The visit is recorded against the
  // invitation on the server, without cookies, and the token is passed on in
  // the address so a later interest form or signup is credited to them. The
  // inviter's first name is only returned when they chose to share it.
  const ref = !previewing && typeof router.query.ref === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(router.query.ref) ? router.query.ref : '';
  const [referrerName, setReferrerName] = useState('');
  useEffect(() => {
    if (!ref || signedInUser) return;
    fetch('/api/referral/open', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: ref }) })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setReferrerName(typeof data?.referrerName === 'string' ? data.referrerName : ''))
      .catch(() => {});
  }, [ref, signedInUser]);
  const withRef = (path) => (ref ? `${path}?ref=${encodeURIComponent(ref)}` : path);

  const cta = user
    ? <Link href="/members" className="ut-btn ut-btn--primary">Go to my dashboard</Link>
    : <Link href={withRef('/join-us/questionnaire')} className="ut-btn ut-btn--primary">I&apos;m interested — let&apos;s get started</Link>;

  return (
    <Layout>
      <SEO title="Join us | Unboxed Together" description="A personal journey. A book. A community. And something bigger we're building together. Tell us what you'd find useful." path="/join-us" />

      {previewing && (
        <div className="site-container">
          <p className="join-note" role="status">This is the page your friend sees when they open your invitation. <Link href="/members/refer-a-friend">Back to Refer a friend</Link></p>
        </div>
      )}
      <section className="join-hero" aria-labelledby="join-title">
        <div className="site-container join-hero__grid">
          <div>
            <p className="ut-kicker">{ref ? `${referrerName || 'Someone'} thought you might find this interesting` : 'Unboxed Together'}</p>
            <h1 id="join-title">What if understanding yourself started with understanding your food?</h1>
            <p className="ut-lead">A personal journey. A book. A community. And something bigger we&apos;re building together.</p>
            <div className="button-row">{cta}</div>
            {!user && <p className="join-note">It takes around two minutes. No obligation to join.{ref && <> Ready to join now? <Link href={withRef('/signup')}>Create a free account</Link>.</>}</p>}
          </div>
          <BrandImage variant="symbol" className="join-hero__mark" alt="" priority sizes="(max-width: 860px) 40vw, 260px" />
        </div>
      </section>

      <section className="ut-section" aria-labelledby="join-story">
        <div className="site-container join-story">
          <div className="join-story__cover">
            <Image src="/images/book/unboxed-front-cover.jpg" alt={`Front cover of ${siteConfig.bookTitle} by ${siteConfig.bookAuthor}`} width={1200} height={1702} sizes="(max-width: 860px) 60vw, 320px" />
          </div>
          <div className="join-story__copy">
            <p className="ut-kicker">Why we exist</p>
            <h2 id="join-story">It started with one person asking questions.</h2>
            <p>I&apos;m Lee, founder of Unboxed Together.</p>
            <p>My own journey through ADHD and burnout led me to question things I&apos;d never really considered before. Particularly what I was eating, how I was living and how I felt.</p>
            <p>Making changes and understanding my own experiences eventually led me to write a book: <strong>{siteConfig.bookTitle}</strong>.</p>
            <p>But I didn&apos;t want it to end with a book. I wanted to create somewhere people could learn, ask questions, share experiences and support one another.</p>
            <p className="join-story__sign">That&apos;s why Unboxed Together was created.</p>
            <div className="button-row">
              <Link href="/story" className="ut-btn ut-btn--secondary">Read my story</Link>
              <Link href="/book" className="ut-btn ut-btn--secondary">Discover the book</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="ut-section ut-section--tint" aria-labelledby="join-coming">
        <div className="site-container">
          <div className="ut-section__heading">
            <p className="ut-kicker">What&apos;s coming</p>
            <h2 id="join-coming">What we&apos;re building next</h2>
            <p>None of these have launched yet. Your answers help decide what we build first and how it works.</p>
          </div>
          <ul className="join-coming">
            {coming.map((item) => (
              <li key={item.title} className="ut-card">
                <span className="ut-card__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{item.icon}</svg>
                </span>
                <span className={`soon-badge${item.status === 'Growing' ? ' is-growing' : ''}`}>{item.status}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="join-band" aria-label="Our approach">
        <div className="site-container">
          <p>No perfect diets. No quick fixes. <strong>Just helping you understand you.</strong></p>
        </div>
      </section>

      <section className="ut-section" aria-labelledby="join-cta">
        <div className="site-container join-cta">
          <BrandImage variant="horizontal" className="join-cta__logo" alt="" sizes="220px" />
          <h2 id="join-cta">We&apos;re building something different. Help us shape it.</h2>
          {user
            ? <p>You&apos;re already a member, so there&apos;s nothing more to fill in here. Your dashboard has everything that&apos;s available to you.</p>
            : <p>Tell us what you&apos;d like to understand, what interests you and how you&apos;d like to get involved. No account needed.</p>}
          <div className="button-row">{cta}</div>
          {!user && <p className="join-note">It takes around two minutes. No obligation to join.</p>}
        </div>
      </section>
    </Layout>
  );
}
