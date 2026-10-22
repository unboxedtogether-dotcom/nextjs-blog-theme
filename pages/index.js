import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Layout from '../components/Layout';
import SEO from '../components/SEO';
import { BrandImage } from '../components/BrandLogo';
import { useAuth } from '../components/auth/AuthProvider';
import { siteConfig } from '../utils/site-config';

const pillarIcons = {
  food: <path d="M4 7h16M4 12h16M4 17h10M18 15l2 2-2 2" />,
  book: <path d="M5 4h9a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4V4zm0 12a4 4 0 0 1 4-4h9" />,
  community: <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20a6 6 0 0 1 12 0M12 20a6 6 0 0 1 10 0" />,
};

const pillars = [
  {
    icon: 'food',
    title: 'Understand your food',
    text: ['Explore our growing database of food ingredients and additives.', 'Understand what is in everyday products and make more informed choices.'],
    href: '/additives',
    cta: 'Explore ingredients',
  },
  {
    icon: 'book',
    title: 'Discover Unboxed',
    text: ['Unboxed: The Dirty Secret Hiding in Our Diet.', 'Discover the personal journey behind the book and explore the relationship between modern food, nutrition and wellbeing.'],
    href: '/book',
    cta: 'Discover the book',
  },
  {
    icon: 'community',
    title: 'Join our community',
    text: ['A place to learn, connect and support one another.', 'Create your free member profile, tell us what brings you here and explore the support available.'],
    href: '/signup',
    cta: 'Join for free',
    // Shown instead to signed-in members.
    memberHref: '/members',
    memberCta: 'Go to my dashboard',
  },
];

const appFeatures = [
  ['Scan barcodes', "Scan products in seconds and see what's really inside."],
  ['See additives clearly', 'Traffic-light clarity that explains what additives may be doing to you.'],
  ['Track what works for you', 'Log what you eat and spot patterns in mood, focus, sleep, and gut.'],
];

export default function Home() {
  const [formStatus, setFormStatus] = useState('idle');
  const { user } = useAuth();

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    setFormStatus('submitting');

    try {
      const formData = new FormData(event.target);
      const response = await fetch('/__forms.html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(formData).toString(),
      });

      if (response.ok) {
        setFormStatus('success');
        event.target.reset();
      } else {
        setFormStatus('error');
      }
    } catch (error) {
      setFormStatus('error');
    }
  };

  return (
    <Layout>
      <SEO title={siteConfig.seo.home.title} description={siteConfig.seo.home.description} />

      <section className="home-intro" aria-labelledby="home-title">
        <div className="site-container home-intro__grid">
          <div className="home-intro__copy">
            <h1 id="home-title">
              <span>Understand your food.</span>
              <span>Understand yourself.</span>
              <span className="is-blue">Find your community.</span>
            </h1>
            <p className="ut-lead">Unboxed Together is about understanding what we put into our bodies, how our everyday choices affect us, and finding practical ways to improve our wellbeing.</p>
            <p>Explore ingredients, understand food labels, discover our book and connect with a community built around learning, sharing and supporting one another.</p>
            <div className="button-row">
              <Link href="/additives" className="ut-btn ut-btn--primary">Explore our food database</Link>
              {user
                ? <Link href="/members" className="ut-btn ut-btn--secondary">Go to my dashboard</Link>
                : <Link href="/signup" className="ut-btn ut-btn--secondary">Join Unboxed Together — free</Link>}
            </div>
          </div>
          <div className="home-intro__logo">
            <BrandImage variant="horizontal" alt="Unboxed Together logo" priority sizes="(max-width: 860px) 45vw, 300px" />
          </div>
        </div>
      </section>

      <section className="ut-section" aria-labelledby="pillars-heading">
        <div className="site-container">
          <h2 id="pillars-heading" className="sr-only">What you can do at Unboxed Together</h2>
          <ul className="feature-card-grid">
            {pillars.map((pillar) => (
              <li key={pillar.title} className="ut-card">
                <span className="ut-card__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{pillarIcons[pillar.icon]}</svg>
                </span>
                <h3>{pillar.title}</h3>
                {pillar.text.map((line) => <p key={line}>{line}</p>)}
                <Link href={(user && pillar.memberHref) || pillar.href} className="ut-btn ut-btn--primary">{(user && pillar.memberCta) || pillar.cta}</Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="ut-section ut-section--tint" aria-labelledby="database-heading">
        <div className="site-container home-split">
          <div>
            <p className="ut-kicker">Food database</p>
            <h2 id="database-heading">See additives clearly</h2>
            <p>Traffic-light clarity that explains what additives may be doing to you. Search by E number or additive name.</p>
            <Link href="/additives" className="ut-btn ut-btn--primary">Search the database</Link>
          </div>
          <div className="search-preview" aria-hidden="true">
            <div className="search-preview__field">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
              <span>Search by E number or additive name</span>
            </div>
            <div className="search-preview__result">
              <strong>E621</strong>
              <span>Monosodium glutamate</span>
              <i>3/5</i>
            </div>
          </div>
        </div>
      </section>

      <section className="ut-section" aria-labelledby="home-book-heading">
        <div className="site-container home-book">
          <Link href="/book" className="home-book__cover" aria-label="Discover the book Unboxed">
            <Image src="/images/book/unboxed-front-cover.jpg" alt="Front cover of Unboxed by Lee Jones" width={1200} height={1702} sizes="(max-width: 860px) 50vw, 260px" />
          </Link>
          <div>
            <p className="ut-kicker">The book</p>
            <h2 id="home-book-heading">Unboxed: The Dirty Secret Hiding in Our Diet</h2>
            <p>A personal journey into the relationship between modern food, nutrition, ADHD, burnout and our physical and mental wellbeing, by Lee Jones.</p>
            <div className="button-row">
              <Link href="/book" className="ut-btn ut-btn--primary">Discover the book</Link>
              <Link href="/story" className="ut-btn ut-btn--secondary">Read my story</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="ut-section ut-section--tint" aria-labelledby="challenge-heading">
        <div className="site-container challenge-banner">
          <div>
            <span className="soon-badge">Coming soon</span>
            <h2 id="challenge-heading">The 30-Day Barcode Challenge</h2>
            <p>A practical challenge encouraging people to explore everyday ingredients, understand food labels and discover alternatives.</p>
          </div>
          <Link href="/barcode-challenge" className="ut-btn ut-btn--secondary">Learn more</Link>
        </div>
      </section>

      <section className="ut-section" aria-labelledby="app-heading">
        <div className="site-container">
          <div className="ut-section__heading">
            <p className="ut-kicker">The Unboxed app</p>
            <h2 id="app-heading">What we’re building</h2>
            <p>We're building a simple barcode-scanning app to help people understand food additives and make clearer choices.</p>
          </div>
          <ol className="app-feature-list">
            {appFeatures.map(([title, text], index) => (
              <li key={title}><span aria-hidden="true">0{index + 1}</span><div><h3>{title}</h3><p>{text}</p></div></li>
            ))}
          </ol>
        </div>
      </section>

      <section id="signup" className="ut-section ut-section--tint" aria-labelledby="early-access-heading">
        <div className="signup-card">
          <p className="ut-kicker">Early access</p>
          <h2 id="early-access-heading">Get early access to the app</h2>
          {formStatus === 'success' ? (
            <div className="form-success" role="status">
              <p>Thank you for signing up!</p>
              <p>We'll notify you when early access is available.</p>
            </div>
          ) : (
            <form name="early-access" onSubmit={handleFormSubmit} className="signup-form">
              <input type="hidden" name="form-name" value="early-access" />
              <p className="hidden"><label>Don't fill this out if you're human: <input name="bot-field" /></label></p>
              <label className="sr-only" htmlFor="early-name">Name (optional)</label>
              <input id="early-name" type="text" name="name" placeholder="Name (optional)" />
              <label className="sr-only" htmlFor="early-email">Email address</label>
              <input id="early-email" type="email" name="email" placeholder="Email address" required />
              <button type="submit" disabled={formStatus === 'submitting'} className="ut-btn ut-btn--primary">
                {formStatus === 'submitting' ? 'Sending...' : 'Notify me'}
              </button>
              {formStatus === 'error' && <p className="form-error" role="alert">Something went wrong. Please try again.</p>}
            </form>
          )}
          <p className="form-note">No spam. Early access invites only.</p>
          <p className="form-privacy">We only use your email to contact you about early access.</p>
        </div>
      </section>

      <section className="ut-section brainz-strip" aria-label="As featured in Brainz Magazine">
        <div className="site-container brainz-strip__inner">
          <p><strong>{siteConfig.brainzContributor.name}</strong> writes for Brainz Magazine as an {siteConfig.brainzContributor.title}.</p>
          <Link href="/brainz" className="text-link">Read the articles →</Link>
        </div>
      </section>
    </Layout>
  );
}
