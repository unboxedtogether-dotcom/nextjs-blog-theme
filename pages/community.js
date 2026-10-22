import Link from 'next/link';
import Layout from '../components/Layout';
import SEO from '../components/SEO';
import { BrandImage } from '../components/BrandLogo';
import { useAuth } from '../components/auth/AuthProvider';
import { siteConfig } from '../utils/site-config';

const upcoming = ['Group discussions', 'Community activities', 'App integration'];

export default function Community() {
  const { user } = useAuth();
  return (
    <Layout>
      <SEO title={siteConfig.seo.community.title} description={siteConfig.seo.community.description} path="/community" />
      <section className="simple-hero">
        <div className="site-container simple-hero__grid">
          <div>
            <p className="ut-kicker">Join our community</p>
            <h1>A place to learn, connect and support one another.</h1>
            <p className="ut-lead">Create your free member profile, tell us what brings you here and explore the support available.</p>
            <div className="button-row">
              {user
                ? <Link href="/members" className="ut-btn ut-btn--primary">Go to my dashboard</Link>
                : <><Link href="/signup" className="ut-btn ut-btn--primary">Join for free</Link><Link href="/login" className="ut-btn ut-btn--secondary">Log in</Link></>}
            </div>
          </div>
          <BrandImage variant="vertical" className="simple-hero__logo" alt="Unboxed Together logo" sizes="260px" priority />
        </div>
      </section>
      <section className="ut-section ut-section--tint">
        <div className="site-container">
          <div className="ut-section__heading">
            <span className="soon-badge">Coming soon</span>
            <h2>More ways to connect</h2>
            <p>We are building space for members to connect with one another. These features will appear here and in your member dashboard when they are ready.</p>
          </div>
          <ul className="soon-list">
            {upcoming.map((item) => <li key={item}><strong>{item}</strong><span className="soon-badge">Coming soon</span></li>)}
          </ul>
        </div>
      </section>
    </Layout>
  );
}
