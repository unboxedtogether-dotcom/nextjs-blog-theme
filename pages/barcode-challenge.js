import Link from 'next/link';
import Layout from '../components/Layout';
import SEO from '../components/SEO';
import { siteConfig } from '../utils/site-config';

export default function BarcodeChallenge() {
  return (
    <Layout>
      <SEO title={siteConfig.seo.barcodeChallenge.title} description={siteConfig.seo.barcodeChallenge.description} path="/barcode-challenge" />
      <section className="simple-hero">
        <div className="site-container simple-hero__narrow">
          <span className="soon-badge">Coming soon</span>
          <h1>The 30-Day Barcode Challenge</h1>
          <p className="ut-lead">A practical challenge encouraging people to explore everyday ingredients, understand food labels and discover alternatives.</p>
          <p>Discover a practical way to become more aware of everyday ingredients and food choices. The challenge is not open yet — join for free and it will appear in your member dashboard when it launches.</p>
          <div className="button-row">
            <Link href="/signup" className="ut-btn ut-btn--primary">Join for free</Link>
            <Link href="/additives" className="ut-btn ut-btn--secondary">Explore the food database</Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
