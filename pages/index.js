import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Layout from '../components/Layout';
import SEO from '../components/SEO';
import PhotoPlaceholder from '../components/PhotoPlaceholder';
import { siteConfig } from '../utils/site-config';

const featureIcons = [
  <path key="scan" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />,
  <path key="clear" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
  <path key="track" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
];

const features = [
  ['Scan barcodes', "Scan products in seconds and see what's really inside."],
  ['See additives clearly', 'Traffic-light clarity that explains what additives may be doing to you.'],
  ['Track what works for you', 'Log what you eat and spot patterns in mood, focus, sleep, and gut.'],
];

export default function Home() {
  const [formStatus, setFormStatus] = useState('idle');

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

      <section className="home-hero">
        <div className="hero-scanlines" aria-hidden="true" />
        <div className="site-container home-hero__grid">
          <div className="home-hero__copy">
            <h1>{siteConfig.siteName}</h1>
            <p>We're building a simple barcode-scanning app to help people understand food additives and make clearer choices.</p>
            <div className="button-row">
              <Link href="/additives" className="btn btn-light">Search additives</Link>
              <a href="#signup" className="btn btn-ghost-light">Join early testers</a>
            </div>
          </div>
          <div className="home-hero__visual">
            <div className="hero-brand-stage">
              <Image
                src="/images/brand/unboxed-together-3d.png"
                alt="Unboxed Together three-dimensional UB logo in white on vivid blue"
                fill
                sizes="(max-width: 860px) 90vw, 46vw"
                priority
              />
            </div>
            <div className="hero-scan-card">
              <PhotoPlaceholder type="scan" alt="A person using a phone to scan the barcode on a food product" />
            </div>
          </div>
        </div>
      </section>

      <section className="additive-feature">
        <div className="site-container additive-feature__grid">
          <div className="section-heading section-heading--left">
            <span className="eyebrow">Additive Search</span>
            <h2>See additives clearly</h2>
            <p>Traffic-light clarity that explains what additives may be doing to you.</p>
            <Link href="/additives" className="btn btn-primary">Search additives</Link>
          </div>
          <div className="search-preview" aria-hidden="true">
            <div className="search-preview__top"><span /><span /></div>
            <div className="search-preview__field">
              <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
              <span>Search by E number or additive name</span>
            </div>
            <div className="search-preview__result">
              <strong>E621</strong>
              <div><b>Monosodium glutamate</b><span /></div>
              <i>3/5</i>
            </div>
            <div className="search-preview__lines"><span /><span /><span /></div>
          </div>
        </div>
      </section>

      <section className="features-section">
        <div className="site-container">
          <div className="section-heading">
            <span className="eyebrow">Practical awareness</span>
            <h2>What it does</h2>
          </div>
          <div className="feature-grid">
            {features.map(([title, description], index) => (
              <article className={`feature-card feature-card--${index + 1}`} key={title}>
                <div className="outline-icon">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">{featureIcons[index]}</svg>
                </div>
                <span className="feature-number">0{index + 1}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="human-section">
        <div className="site-container human-section__grid">
          <PhotoPlaceholder type="food" alt="A selection of colourful whole foods and fresh produce" />
          <PhotoPlaceholder type="family" alt="A family shopping together and choosing food products" />
        </div>
      </section>

      <section id="signup" className="signup-section">
        <div className="signup-section__lines" aria-hidden="true" />
        <div className="signup-card">
          <span className="eyebrow">Early access</span>
          <h2>Get early access</h2>
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
              <button type="submit" disabled={formStatus === 'submitting'} className="btn btn-primary">
                {formStatus === 'submitting' ? 'Sending...' : 'Notify me'}
              </button>
              {formStatus === 'error' && <p className="form-error" role="alert">Something went wrong. Please try again.</p>}
            </form>
          )}
          <p className="form-note">No spam. Early access invites only.</p>
          <p className="form-privacy">We only use your email to contact you about early access.</p>
        </div>
      </section>
    </Layout>
  );
}
